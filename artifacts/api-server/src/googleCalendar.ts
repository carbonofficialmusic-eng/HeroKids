import crypto from "crypto";
import type { Express } from "express";
import { and, eq, inArray, isNull, lt, ne, or } from "drizzle-orm";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { db } from "./db";
import { storage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import {
  normalizeImportedTaskPoints,
  preserveFirstCancellationStatus,
  resolveImportedTaskStatusOnUpdate,
} from "./google-calendar-policy";
import {
  googleCalendarConnections,
  googleCalendarEvents,
  googleCalendarMappings,
  taskAssignments,
  tasks,
} from "@workspace/db";
import { hasFeature, type SubscriptionTierLegacy } from "@shared/tier-config";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
function callbackUrl(req: any) {
  const configuredBase = process.env.APP_BASE_URL || process.env.PUBLIC_APP_URL;
  const base = configuredBase || `${req.protocol}://${req.get("host")}`;
  return `${base.replace(/\/$/, "")}/api/google-calendar/oauth/callback`;
}

function key() {
  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is required for Google Calendar token encryption");
  }
  return crypto.createHash("sha256").update(process.env.SESSION_SECRET).digest();
}
function seal(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${body.toString("base64url")}`;
}
function open(value: string) {
  const [iv, tag, body] = value.split(".").map(v => Buffer.from(v, "base64url"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
}

export async function revokeGoogleCalendarRefreshToken(encryptedToken: string): Promise<void> {
  const response = await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: open(encryptedToken) }),
  });
  // Google also returns 400 when a token has already been revoked.
  if (!response.ok && response.status !== 400) {
    throw new Error(`Google revocation failed (${response.status})`);
  }
}

async function parent(req: any) {
  if (req.cookies?.child_device_token) return null;
  if (req.user?.member) {
    return req.user.member.role === "parent" ? req.user.member : null;
  }
  const id = req.user?.claims?.sub;
  if (!id) return null;
  const member = await storage.getFamilyMemberByUserId(id);
  return member?.role === "parent" ? member : null;
}
async function familyMember(req: any) {
  if (req.user?.member) return req.user.member;
  const id = req.user?.claims?.sub;
  if (!id) return null;
  const realMember = await storage.getFamilyMemberByUserId(id);
  if (!realMember) return null;

  const actingAsMemberId = req.session?.actingAsMemberId;
  if (!actingAsMemberId || req.user?.authMethod === "device") return realMember;
  if (realMember.role !== "parent") {
    delete req.session.actingAsMemberId;
    return realMember;
  }

  const actingMember = await storage.getFamilyMember(actingAsMemberId);
  if (!actingMember || actingMember.familyName !== realMember.familyName) {
    delete req.session.actingAsMemberId;
    return realMember;
  }
  return actingMember;
}

async function hasGoogleCalendarAccess(familyName: string) {
  const family = await storage.getFamily(familyName);
  if (!family) return false;
  const onTrial = !!(family.trialEndsAt && new Date(family.trialEndsAt) > new Date());
  return onTrial || hasFeature((family.subscriptionTier || "free") as SubscriptionTierLegacy, "googleCalendar");
}

async function requireGoogleCalendarAccess(member: { familyName: string }, res: any) {
  if (await hasGoogleCalendarAccess(member.familyName)) return true;
  res.status(403).json({
    message: "Google Kalender ist im Family-Paket enthalten.",
    requiredTier: "family",
  });
  return false;
}

function signOAuthState(payload: Record<string, unknown>) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", key()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyOAuthState(value: string) {
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) throw new Error("Ungültiger OAuth-Status");
  const expected = crypto.createHmac("sha256", key()).update(encoded).digest("base64url");
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error("Ungültiger OAuth-Status");
  }
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  if (!payload.exp || Number(payload.exp) < Date.now()) throw new Error("OAuth-Anfrage ist abgelaufen");
  return payload as {
    familyName: string;
    memberId: string;
    redirectUri: string;
    native: boolean;
  };
}

function googleAuthorizationUrl(state: string, redirectUri: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: `${CALENDAR_SCOPE} openid email`,
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function archiveLinkedTasks(connectionId: string, mappingIds?: string[]) {
  const conditions = [eq(googleCalendarEvents.connectionId, connectionId)];
  if (mappingIds?.length) conditions.push(inArray(googleCalendarEvents.mappingId, mappingIds));
  const links = await db.select({
    id: googleCalendarEvents.id,
    taskId: googleCalendarEvents.taskId,
    cancelled: googleCalendarEvents.cancelled,
    taskStatusBeforeCancellation: googleCalendarEvents.taskStatusBeforeCancellation,
  })
    .from(googleCalendarEvents)
    .where(and(...conditions));
  for (const link of links) {
    const task = await storage.getTask(link.taskId);
    await storage.updateTaskStatus(link.taskId, "archived");
    await db.update(googleCalendarEvents).set({
      cancelled: true,
      taskStatusBeforeCancellation: preserveFirstCancellationStatus(
        link.cancelled,
        link.taskStatusBeforeCancellation,
        task?.status,
      ),
      updatedAt: new Date(),
    }).where(eq(googleCalendarEvents.id, link.id));
  }
}
async function google(path: string, token: string, init?: RequestInit) {
  const response = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const data: any = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `Google Calendar request failed (${response.status})`);
  return data;
}
async function accessToken(connection: any) {
  if (connection.tokenExpiresAt && new Date(connection.tokenExpiresAt).getTime() > Date.now() + 60_000) return open(connection.accessTokenEncrypted);
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
    refresh_token: open(connection.refreshTokenEncrypted),
    grant_type: "refresh_token",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const data: any = await response.json();
  if (!response.ok || !data.access_token) throw new Error(data?.error_description || "Google token refresh failed");
  await db.update(googleCalendarConnections).set({
    accessTokenEncrypted: seal(data.access_token),
    tokenExpiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
    updatedAt: new Date(), lastError: null,
  }).where(eq(googleCalendarConnections.id, connection.id));
  return data.access_token;
}

export async function syncGoogleCalendarFamily(familyName: string) {
  let lockedConnectionId: string | null = null;
  const lockOwner = crypto.randomUUID();
  let lockHeartbeat: ReturnType<typeof setInterval> | null = null;
  try {
    const now = new Date();
    const [connection] = await db.update(googleCalendarConnections)
      .set({ syncLockUntil: new Date(now.getTime() + 10 * 60 * 1000), syncLockOwner: lockOwner })
      .where(and(
        eq(googleCalendarConnections.familyName, familyName),
        eq(googleCalendarConnections.active, true),
        or(isNull(googleCalendarConnections.syncLockUntil), lt(googleCalendarConnections.syncLockUntil, now)),
      ))
      .returning();
    if (!connection) return { imported: 0, skipped: true };
    lockedConnectionId = connection.id;
    lockHeartbeat = setInterval(() => {
      db.update(googleCalendarConnections)
        .set({ syncLockUntil: new Date(Date.now() + 10 * 60 * 1000) })
        .where(and(
          eq(googleCalendarConnections.id, connection.id),
          eq(googleCalendarConnections.syncLockOwner, lockOwner),
        ))
        .catch(error => console.error("Google Calendar lock renewal:", error?.message || error));
    }, 60 * 1000);
    lockHeartbeat.unref();
    const mappings = await db.select().from(googleCalendarMappings).where(and(eq(googleCalendarMappings.connectionId, connection.id), eq(googleCalendarMappings.active, true)));
    const memberList = await storage.getFamilyMembersByFamily(familyName);
    const members = new Set(memberList.map(m => m.id));
    const token = await accessToken(connection);
    let imported = 0;
    const family = await storage.getFamily(familyName);
    const timezone = family?.timezone || "Europe/Berlin";
    const yesterday = new Date(now.getTime() - 86400000);
    const localYesterday = formatInTimeZone(yesterday, timezone, "yyyy-MM-dd");
    const timeMin = fromZonedTime(`${localYesterday}T00:00:00`, timezone).toISOString();
    const timeMax = new Date(now.getTime() + 90 * 86400000).toISOString();
    for (const mapping of mappings) {
      if (!members.has(mapping.memberId)) continue;
      const seenOccurrenceKeys = new Set<string>();
      let pageToken: string | undefined;
      do {
        const query = new URLSearchParams({ singleEvents: "true", showDeleted: "true", timeMin, timeMax, maxResults: "2500" });
        if (pageToken) query.set("pageToken", pageToken);
        const result: any = await google(`/calendars/${encodeURIComponent(mapping.googleCalendarId)}/events?${query}`, token);
        for (const event of result.items || []) {
          const occurrenceKey = event.id || `${event.recurringEventId}:${event.originalStartTime?.dateTime || event.originalStartTime?.date}`;
          seenOccurrenceKeys.add(occurrenceKey);
          const [existing] = await db.select().from(googleCalendarEvents).where(and(
            eq(googleCalendarEvents.connectionId, connection.id), eq(googleCalendarEvents.googleCalendarId, mapping.googleCalendarId), eq(googleCalendarEvents.occurrenceKey, occurrenceKey),
          ));
          if (event.status === "cancelled") {
            if (existing) {
              const task = await storage.getTask(existing.taskId);
              await storage.updateTaskStatus(existing.taskId, "archived");
              await db.update(googleCalendarEvents).set({
                cancelled: true,
                taskStatusBeforeCancellation: preserveFirstCancellationStatus(
                  existing.cancelled,
                  existing.taskStatusBeforeCancellation,
                  task?.status,
                ),
                updatedAt: new Date(),
              }).where(eq(googleCalendarEvents.id, existing.id));
            }
            continue;
          }
          const start = event.start?.dateTime || event.start?.date;
          if (!start) continue;
          const dueDate = event.start?.date
            ? String(event.start.date)
            : formatInTimeZone(new Date(start), family?.timezone || "Europe/Berlin", "yyyy-MM-dd");
          const dueTime = event.start?.date
            ? null
            : formatInTimeZone(new Date(start), family?.timezone || "Europe/Berlin", "HH:mm");
          const title = String(event.summary || "Google-Termin").slice(0, 255);
          const description = event.description
            ? String(event.description).slice(0, 2000)
            : "Aus Google Kalender importiert";
          if (existing) {
            const currentTask = await storage.getTask(existing.taskId);
            const nextStatus = resolveImportedTaskStatusOnUpdate(
              (currentTask?.status || "active") as "active" | "completed" | "archived",
              existing.cancelled,
              existing.taskStatusBeforeCancellation,
            );
            await storage.updateTask(existing.taskId, {
              title,
              description,
              dueDate,
              dueTime,
              status: nextStatus,
            });
            await db.update(googleCalendarEvents).set({
              mappingId: mapping.id,
              googleUpdatedAt: event.updated ? new Date(event.updated) : null,
              cancelled: false,
              taskStatusBeforeCancellation: null,
              updatedAt: new Date(),
            }).where(eq(googleCalendarEvents.id, existing.id));
          } else {
            await db.transaction(async tx => {
              const [task] = await tx.insert(tasks).values({
                familyName,
                createdBy: memberList.find(m => m.role === "parent")?.id || mapping.memberId,
                title,
                description,
                points: normalizeImportedTaskPoints(mapping.defaultPoints),
                recurrence: "none",
                dueDate,
                dueTime,
                requiresApproval: true,
                requiresProof: false,
                status: "active",
                iconEmoji: "📅",
              }).returning();
              await tx.insert(taskAssignments).values({ taskId: task.id, memberId: mapping.memberId });
              await tx.insert(googleCalendarEvents).values({
                connectionId: connection.id,
                mappingId: mapping.id,
                googleCalendarId: mapping.googleCalendarId,
                googleEventId: event.id,
                occurrenceKey,
                taskId: task.id,
                googleUpdatedAt: event.updated ? new Date(event.updated) : null,
              });
            });
            imported++;
          }
        }
        pageToken = result.nextPageToken;
      } while (pageToken);
      const links = await db.select().from(googleCalendarEvents)
        .where(and(eq(googleCalendarEvents.connectionId, connection.id), eq(googleCalendarEvents.mappingId, mapping.id)));
      const familyTasks = await storage.getTasksByFamily(familyName);
      const byId = new Map(familyTasks.map(task => [task.id, task]));
      const minDate = localYesterday;
      const maxDate = formatInTimeZone(new Date(timeMax), timezone, "yyyy-MM-dd");
      for (const link of links) {
        const task = byId.get(link.taskId);
        const dueDate = String(task?.dueDate || "");
        if (!seenOccurrenceKeys.has(link.occurrenceKey) && dueDate >= minDate && dueDate <= maxDate) {
          const currentTask = await storage.getTask(link.taskId);
          await storage.updateTaskStatus(link.taskId, "archived");
          await db.update(googleCalendarEvents).set({
            cancelled: true,
            taskStatusBeforeCancellation: preserveFirstCancellationStatus(
              link.cancelled,
              link.taskStatusBeforeCancellation,
              currentTask?.status,
            ),
            updatedAt: new Date(),
          })
            .where(eq(googleCalendarEvents.id, link.id));
        }
      }
    }
    await db.update(googleCalendarConnections).set({ lastSyncAt: new Date(), lastError: null, updatedAt: new Date() }).where(eq(googleCalendarConnections.id, connection.id));
    return { imported };
  } catch (error: any) {
    await db.update(googleCalendarConnections).set({ lastError: error?.message || "Sync failed", updatedAt: new Date() }).where(eq(googleCalendarConnections.familyName, familyName));
    throw error;
  } finally {
    if (lockHeartbeat) clearInterval(lockHeartbeat);
    if (lockedConnectionId) {
      await db.update(googleCalendarConnections)
        .set({ syncLockUntil: null, syncLockOwner: null })
        .where(and(
          eq(googleCalendarConnections.id, lockedConnectionId),
          eq(googleCalendarConnections.syncLockOwner, lockOwner),
        ))
        .catch(error => console.error("Google Calendar lock release:", error?.message || error));
    }
  }
}

export function startGoogleCalendarScheduler() {
  const run = async () => {
    const active = await db.select({ familyName: googleCalendarConnections.familyName }).from(googleCalendarConnections).where(eq(googleCalendarConnections.active, true));
    for (const item of active) {
      if (!(await hasGoogleCalendarAccess(item.familyName))) continue;
      syncGoogleCalendarFamily(item.familyName).catch(error => console.error("Google Calendar sync:", error?.message || error));
    }
  };
  const runSafely = () => {
    void run().catch(error => console.error("Google Calendar scheduler:", error?.message || error));
  };
  runSafely();
  setInterval(runSafely, 15 * 60 * 1000).unref();
}

export function registerGoogleCalendarRoutes(app: Express) {
  app.get("/api/google-calendar/status", isAuthenticated, async (req: any, res) => {
    const member = await parent(req); if (!member) return res.status(403).json({ message: "Nur Eltern können die Kalenderverbindung verwalten." });
    if (!(await requireGoogleCalendarAccess(member, res))) return;
    const [connection] = await db.select({ id: googleCalendarConnections.id, googleEmail: googleCalendarConnections.googleEmail, active: googleCalendarConnections.active, lastSyncAt: googleCalendarConnections.lastSyncAt, lastError: googleCalendarConnections.lastError }).from(googleCalendarConnections).where(eq(googleCalendarConnections.familyName, member.familyName));
    const mappings = connection ? await db.select().from(googleCalendarMappings).where(and(eq(googleCalendarMappings.connectionId, connection.id), eq(googleCalendarMappings.active, true))) : [];
    res.json({
      connected: !!connection,
      active: connection?.active || false,
      email: connection?.googleEmail || null,
      lastSyncAt: connection?.lastSyncAt || null,
      lastError: connection?.lastError || null,
      connection: connection || null,
      mappings: mappings.map(mapping => ({
        calendarId: mapping.googleCalendarId,
        calendarName: mapping.googleCalendarName,
        memberId: mapping.memberId,
        defaultPoints: mapping.defaultPoints,
      })),
    });
    return undefined;
  });
  app.get("/api/google-calendar/auth-url", isAuthenticated, async (req: any, res) => {
    const member = await parent(req);
    if (!member) return res.status(403).json({ message: "Nur Eltern können Google Kalender einrichten." });
    if (!(await requireGoogleCalendarAccess(member, res))) return;
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.status(503).json({ message: "Google Kalender ist noch nicht konfiguriert." });
    }
    const redirectUri = callbackUrl(req);
    const state = signOAuthState({
      familyName: member.familyName,
      memberId: member.id,
      redirectUri,
      native: req.query.native === "1",
      exp: Date.now() + 10 * 60 * 1000,
      nonce: crypto.randomBytes(16).toString("hex"),
    });
    res.json({ url: googleAuthorizationUrl(state, redirectUri) });
    return undefined;
  });
  app.get("/api/google-calendar/oauth/start", isAuthenticated, async (req: any, res) => {
    const member = await parent(req); if (!member) return res.status(403).json({ message: "Nur Eltern können Google Kalender einrichten." });
    if (!(await requireGoogleCalendarAccess(member, res))) return;
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return res.status(503).json({ message: "Google Kalender ist noch nicht konfiguriert." });
    const redirectUri = callbackUrl(req);
    const state = signOAuthState({
      familyName: member.familyName,
      memberId: member.id,
      redirectUri,
      native: false,
      exp: Date.now() + 10 * 60 * 1000,
      nonce: crypto.randomBytes(16).toString("hex"),
    });
    res.redirect(googleAuthorizationUrl(state, redirectUri));
    return undefined;
  });
  app.get("/api/google-calendar/oauth/callback", async (req: any, res) => {
    try {
      const state = verifyOAuthState(String(req.query.state || ""));
      const member = await storage.getFamilyMember(state.memberId);
      if (!member || member.role !== "parent" || member.familyName !== state.familyName) {
        throw new Error("Die Elternberechtigung ist nicht mehr gültig");
      }
      if (!(await hasGoogleCalendarAccess(member.familyName))) {
        throw new Error("Google Kalender benötigt das Family-Paket");
      }
      const body = new URLSearchParams({ code: String(req.query.code || ""), client_id: process.env.GOOGLE_CLIENT_ID || "", client_secret: process.env.GOOGLE_CLIENT_SECRET || "", redirect_uri: state.redirectUri, grant_type: "authorization_code" });
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
      const token: any = await tokenResponse.json();
      if (!tokenResponse.ok || !token.access_token || !token.refresh_token) throw new Error(token.error_description || "Google-Verbindung fehlgeschlagen");
      const profile: any = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${token.access_token}` } }).then(r => r.json());
      await db.insert(googleCalendarConnections).values({ familyName: state.familyName, googleSubject: profile.sub, googleEmail: profile.email, accessTokenEncrypted: seal(token.access_token), refreshTokenEncrypted: seal(token.refresh_token), tokenExpiresAt: new Date(Date.now() + (token.expires_in || 3600) * 1000), scopes: CALENDAR_SCOPE }).onConflictDoUpdate({ target: googleCalendarConnections.familyName, set: { googleSubject: profile.sub, googleEmail: profile.email, accessTokenEncrypted: seal(token.access_token), refreshTokenEncrypted: seal(token.refresh_token), tokenExpiresAt: new Date(Date.now() + (token.expires_in || 3600) * 1000), active: false, lastError: null, updatedAt: new Date() } });
      res.redirect(state.native ? "herokids://calendar-connected" : "/settings?googleCalendar=connected");
    } catch (error: any) {
      console.error("Google Calendar OAuth callback:", error?.message || error);
      res.redirect("/settings?googleCalendar=error");
    }
  });
  app.get("/api/google-calendar/calendars", isAuthenticated, async (req: any, res) => {
    const member = await parent(req); if (!member) return res.status(403).json({ message: "Nur Eltern können Kalender abrufen." });
    if (!(await requireGoogleCalendarAccess(member, res))) return;
    const [connection] = await db.select().from(googleCalendarConnections).where(eq(googleCalendarConnections.familyName, member.familyName)); if (!connection) return res.status(404).json({ message: "Kein Google Konto verbunden." });
    const result = await google("/users/me/calendarList", await accessToken(connection));
    res.json(result.items || []);
    return undefined;
  });
  app.post("/api/google-calendar/conflicts", isAuthenticated, async (req: any, res) => {
    const member = await parent(req);
    if (!member) return res.status(403).json({ message: "Nur Eltern können Kalender prüfen." });
    if (!(await requireGoogleCalendarAccess(member, res))) return;

    const [connection] = await db.select()
      .from(googleCalendarConnections)
      .where(eq(googleCalendarConnections.familyName, member.familyName));
    if (!connection?.googleSubject) {
      return res.json({ familyNames: [] });
    }

    const calendarIds: string[] = Array.from(new Set<string>(
      (Array.isArray(req.body?.calendarIds) ? req.body.calendarIds : [])
        .filter((value: unknown): value is string => typeof value === "string" && value.length > 0)
        .map((value: string) => value.slice(0, 512)),
    ));
    if (!calendarIds.length) {
      return res.json({ familyNames: [] });
    }

    const conflicts = await db.select({
      familyName: googleCalendarConnections.familyName,
    })
      .from(googleCalendarMappings)
      .innerJoin(
        googleCalendarConnections,
        eq(googleCalendarMappings.connectionId, googleCalendarConnections.id),
      )
      .where(and(
        inArray(googleCalendarMappings.googleCalendarId, calendarIds),
        eq(googleCalendarMappings.active, true),
        eq(googleCalendarConnections.googleSubject, connection.googleSubject),
        ne(googleCalendarConnections.familyName, member.familyName),
      ));

    res.json({
      familyNames: Array.from(new Set(conflicts.map(item => item.familyName))).sort(),
    });
    return undefined;
  });
  const saveMappings = async (req: any, res: any) => {
    const member = await parent(req); if (!member) return res.status(403).json({ message: "Nur Eltern können Kalender einrichten." });
    if (!(await requireGoogleCalendarAccess(member, res))) return;
    const [connection] = await db.select().from(googleCalendarConnections).where(eq(googleCalendarConnections.familyName, member.familyName)); if (!connection) return res.status(404).json({ message: "Kein Google Konto verbunden." });
    const mappings = Array.isArray(req.body?.mappings) ? req.body.mappings : [];
    const members = await storage.getFamilyMembersByFamily(member.familyName); const valid = new Set(members.map(m => m.id));
    await db.update(googleCalendarMappings).set({ active: false }).where(eq(googleCalendarMappings.connectionId, connection.id));
    for (const item of mappings) if (item.calendarId && valid.has(item.memberId)) {
      const calendarId = String(item.calendarId);
      const points = normalizeImportedTaskPoints(item.defaultPoints);
      const [existing] = await db.select().from(googleCalendarMappings).where(and(eq(googleCalendarMappings.connectionId, connection.id), eq(googleCalendarMappings.googleCalendarId, calendarId)));
      if (existing) await db.update(googleCalendarMappings).set({ googleCalendarName: String(item.calendarName || calendarId), memberId: item.memberId, defaultPoints: points, active: true }).where(eq(googleCalendarMappings.id, existing.id));
      else await db.insert(googleCalendarMappings).values({ connectionId: connection.id, googleCalendarId: calendarId, googleCalendarName: String(item.calendarName || calendarId), memberId: item.memberId, defaultPoints: points, active: true });
    }
    const inactiveMappings = await db.select({ id: googleCalendarMappings.id }).from(googleCalendarMappings)
      .where(and(eq(googleCalendarMappings.connectionId, connection.id), eq(googleCalendarMappings.active, false)));
    if (inactiveMappings.length) await archiveLinkedTasks(connection.id, inactiveMappings.map(item => item.id));
    await db.update(googleCalendarConnections).set({ active: req.body?.active !== false, updatedAt: new Date() }).where(eq(googleCalendarConnections.id, connection.id));
    await syncGoogleCalendarFamily(member.familyName); res.json({ ok: true });
  };
  app.post("/api/google-calendar/mappings", isAuthenticated, saveMappings);
  app.put("/api/google-calendar/config", isAuthenticated, saveMappings);
  app.post("/api/google-calendar/sync", isAuthenticated, async (req: any, res) => { const member = await parent(req); if (!member) return res.status(403).json({ message: "Nur Eltern können synchronisieren." }); if (!(await requireGoogleCalendarAccess(member, res))) return; try { res.json(await syncGoogleCalendarFamily(member.familyName)); } catch (e: any) { res.status(502).json({ message: e?.message || "Synchronisierung fehlgeschlagen" }); } return undefined; });
  const disconnect = async (req: any, res: any) => {
    const member = await parent(req); if (!member) return res.status(403).json({ message: "Nur Eltern können trennen." });
    const [connection] = await db.select().from(googleCalendarConnections).where(eq(googleCalendarConnections.familyName, member.familyName));
    if (connection) {
      try {
        await revokeGoogleCalendarRefreshToken(connection.refreshTokenEncrypted);
      } catch (error: any) {
        console.error("Google Calendar token revocation failed:", error?.message || error);
        return res.status(502).json({
          message: "Die Google-Verbindung konnte nicht sicher getrennt werden. Bitte versuche es erneut.",
        });
      }
      await db.transaction(async tx => {
        const links = await tx.select({ taskId: googleCalendarEvents.taskId })
          .from(googleCalendarEvents)
          .where(eq(googleCalendarEvents.connectionId, connection.id));
        const taskIds = links.map(link => link.taskId);
        if (taskIds.length) {
          await tx.update(tasks).set({ status: "archived", updatedAt: new Date() })
            .where(inArray(tasks.id, taskIds));
        }
        await tx.delete(googleCalendarConnections).where(eq(googleCalendarConnections.id, connection.id));
      });
    }
    res.json({ ok: true });
  };
  app.post("/api/google-calendar/disconnect", isAuthenticated, disconnect);
  app.delete("/api/google-calendar/connection", isAuthenticated, disconnect);
  app.get("/api/appointments", isAuthenticated, async (req: any, res) => {
    const member = await familyMember(req); if (!member) return res.status(401).json({ message: "Nicht angemeldet" });
    const tasks = await storage.getTasksByFamily(member.familyName);
    let visible = tasks.filter(task =>
      task.recurrence === "none"
      && Boolean(task.dueDate)
      && task.status !== "archived"
    );
    if (member.role !== "parent") {
      visible = visible.filter(task => task.sharedMemberIds?.includes(member.id));
    }
    const visibleTaskIds = visible.map(task => task.id);
    const googleLinkedTaskIds = visibleTaskIds.length
      ? new Set((await db.select({ taskId: googleCalendarEvents.taskId })
          .from(googleCalendarEvents)
          .where(inArray(googleCalendarEvents.taskId, visibleTaskIds)))
          .map(link => link.taskId))
      : new Set<string>();
    res.json(visible.sort((a, b) => {
      const dateOrder = String(a.dueDate).localeCompare(String(b.dueDate));
      if (dateOrder !== 0) return dateOrder;
      return String(a.dueTime || "99:99").localeCompare(String(b.dueTime || "99:99"));
    }).map(task => ({
      ...task,
      isGoogleCalendarEvent: googleLinkedTaskIds.has(task.id),
    })));
    return undefined;
  });
}