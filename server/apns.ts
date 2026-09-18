import http2 from "http2";
import crypto from "crypto";

interface ApnsPayload {
  aps: {
    alert: {
      title: string;
      body: string;
    };
    sound?: string;
    badge?: number;
    "content-available"?: number;
  };
  notificationType?: string;
  memberId?: string;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

function parseApnsPrivateKey(value: string): crypto.KeyObject {
  let normalized = value.trim();

  if (
    normalized.length >= 2
    && ((normalized.startsWith('"') && normalized.endsWith('"'))
      || (normalized.startsWith("'") && normalized.endsWith("'")))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }

  normalized = normalized
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .trim();

  const pemMatch = normalized.match(
    /-----BEGIN ((?:EC )?PRIVATE KEY)-----([\s\S]*?)-----END \1-----/
  );
  if (pemMatch) {
    const [, label, encodedBody] = pemMatch;
    const compactBody = encodedBody.replace(/\s/g, "");
    const pemBody = compactBody.match(/.{1,64}/g)?.join("\n") || compactBody;
    return crypto.createPrivateKey(
      `-----BEGIN ${label}-----\n${pemBody}\n-----END ${label}-----`
    );
  }

  const base64Value = normalized
    .replace(/^base64:/i, "")
    .replace(/\s/g, "");
  if (!base64Value || !/^[A-Za-z0-9+/=_-]+$/.test(base64Value)) {
    throw new Error("APNS_PRIVATE_KEY is not a valid Apple .p8 private key");
  }

  try {
    const decoded = Buffer.from(base64Value, "base64");
    if (decoded.toString("utf8", 0, 40).includes("-----BEGIN")) {
      return crypto.createPrivateKey(decoded);
    }
    return crypto.createPrivateKey({ key: decoded, format: "der", type: "pkcs8" });
  } catch {
    throw new Error("APNS_PRIVATE_KEY is not a valid Apple .p8 private key");
  }
}

export function createApnsProviderToken(
  keyId: string,
  teamId: string,
  privateKey: string,
  issuedAt = Math.floor(Date.now() / 1000)
): string {
  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: keyId })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ iss: teamId, iat: issuedAt })).toString("base64url");
  const signingInput = `${header}.${payload}`;
  const key = parseApnsPrivateKey(privateKey);
  const signature = crypto.sign("sha256", Buffer.from(signingInput), {
    key,
    dsaEncoding: "ieee-p1363",
  });

  return `${signingInput}.${signature.toString("base64url")}`;
}

function generateApnsJwt(): string {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const privateKey = process.env.APNS_PRIVATE_KEY;

  if (!keyId || !teamId || !privateKey) {
    throw new Error("APNS_KEY_ID, APNS_TEAM_ID, and APNS_PRIVATE_KEY must be set");
  }

  return createApnsProviderToken(keyId, teamId, privateKey);
}

function getJwtToken(): string {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.value;
  }
  const token = generateApnsJwt();
  cachedToken = { value: token, expiresAt: now + 50 * 60 * 1000 };
  return token;
}

export async function sendApnsPush(
  deviceToken: string,
  title: string,
  body: string,
  extra?: { notificationType?: string; memberId?: string }
): Promise<void> {
  const bundleId = process.env.APNS_BUNDLE_ID;
  if (!bundleId) throw new Error("APNS_BUNDLE_ID not set");

  if (!process.env.APNS_KEY_ID || !process.env.APNS_TEAM_ID || !process.env.APNS_PRIVATE_KEY) {
    console.warn("[APNs] Secrets not configured — skipping push");
    return;
  }

  const payload: ApnsPayload = {
    aps: {
      alert: { title, body },
      sound: "default",
    },
    ...extra,
  };

  const bodyStr = JSON.stringify(payload);
  const jwt = getJwtToken();

  return new Promise((resolve, reject) => {
    const client = http2.connect("https://api.push.apple.com");
    let settled = false;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      client.close();
      error ? reject(error) : resolve();
    };

    client.setTimeout(10_000, () => {
      client.destroy();
      finish(new Error("APNs request timed out"));
    });

    client.on("error", (error) => {
      finish(new Error(`APNs connection error: ${error.message}`));
    });

    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
      "content-length": Buffer.byteLength(bodyStr),
    });

    let statusCode = 0;
    let responseBody = "";
    let apnsId = "";

    req.setEncoding("utf8");
    req.on("response", (headers) => {
      statusCode = Number(headers[":status"] || 0);
      apnsId = String(headers["apns-id"] || "");
    });
    req.on("data", (chunk) => {
      responseBody += chunk;
    });
    req.on("end", () => {
      if (statusCode === 200) {
        finish();
        return;
      }

      let reason = responseBody;
      try {
        reason = JSON.parse(responseBody)?.reason || responseBody;
      } catch {
        // Keep the raw APNs response when it is not JSON.
      }
      finish(new Error(`APNs rejected push (${statusCode || "no status"}${apnsId ? `, id ${apnsId}` : ""}): ${reason || "unknown reason"}`));
    });
    req.on("error", (error) => {
      finish(new Error(`APNs request error: ${error.message}`));
    });
    req.end(bodyStr);
  });
}

export async function sendPushToMembers(
  deviceTokens: string[],
  title: string,
  body: string,
  extra?: { notificationType?: string; memberId?: string }
): Promise<void> {
  if (!deviceTokens.length) return;
  const results = await Promise.allSettled(
    deviceTokens.map((token) => sendApnsPush(token, title, body, extra))
  );
  const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
  const notificationType = extra?.notificationType || "unknown";

  console.log(`[APNs] ${notificationType}: accepted ${results.length - failures.length}/${results.length}`);
  for (const failure of failures) {
    console.error(`[APNs] ${notificationType}:`, failure.reason instanceof Error ? failure.reason.message : String(failure.reason));
  }
}

const chatBatches = new Map<string, {
  recipientId: string;
  tokens: string[];
  title: string;
  count: number;
  timer: NodeJS.Timeout;
  body?: (count: number) => string;
  canSend?: () => boolean | Promise<boolean>;
}>();
const CHAT_BATCH_WINDOW_MS = 90 * 1000;

/** Determine whether a time falls inside the family's child push quiet period. */
export function isChildPushQuietHours(
  date: Date,
  timezone: string,
  quietStart = "20:00",
  quietEnd = "07:00",
): boolean {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const hour = Number(parts.find(part => part.type === "hour")?.value);
    const minute = Number(parts.find(part => part.type === "minute")?.value);
    const parseTime = (value: string) => {
      const [hours, minutes] = value.split(":").map(Number);
      if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        throw new Error("Invalid quiet time");
      }
      return hours * 60 + minutes;
    };
    const nowMinutes = hour * 60 + minute;
    const startMinutes = parseTime(quietStart);
    const endMinutes = parseTime(quietEnd);
    if (startMinutes === endMinutes) return false;
    return startMinutes < endMinutes
      ? nowMinutes >= startMinutes && nowMinutes < endMinutes
      : nowMinutes >= startMinutes || nowMinutes < endMinutes;
  } catch {
    // Invalid timezone should not suppress delivery.
    return false;
  }
}

/** Cancel a recipient's pending chat alert when they have read the chat. */
export function cancelQueuedChatPush(recipientId: string, conversationKey?: string): boolean {
  let cancelled = false;
  chatBatches.forEach((batch, key) => {
    if (batch.recipientId !== recipientId) return;
    if (conversationKey && key !== `${recipientId}:${conversationKey}`) return;
    clearTimeout(batch.timer);
    chatBatches.delete(key);
    cancelled = true;
  });
  return cancelled;
}

function scheduleChatSummary(batchKey: string): NodeJS.Timeout {
  const timer = setTimeout(async () => {
    const batch = chatBatches.get(batchKey);
    chatBatches.delete(batchKey);
    if (!batch || batch.count === 0) return;
    try {
      if (batch.canSend && !(await batch.canSend())) return;
      const bodyText = batch.body?.(batch.count) || (batch.count === 1 ? "1 new chat message" : `${batch.count} new chat messages`);
      await sendPushToMembers(batch.tokens, batch.title, bodyText, { notificationType: "chat_message" });
    } catch (error: any) {
      console.error("[APNs] chat summary error:", error?.message || error);
    }
  }, CHAT_BATCH_WINDOW_MS);
  timer.unref?.();
  return timer;
}

/**
 * Send the first message immediately, then summarize additional messages from
 * the same sender after 90 seconds of inactivity.
 */
export function queueChatPush(
  recipientId: string,
  deviceTokens: string[],
  title: string,
  body?: (count: number) => string,
  canSend?: () => boolean | Promise<boolean>,
  conversationKey = "all",
): void {
  if (!deviceTokens.length) return;
  const batchKey = `${recipientId}:${conversationKey}`;
  const existing = chatBatches.get(batchKey);
  if (existing) {
    existing.count += 1;
    existing.tokens = deviceTokens;
    existing.title = title;
    existing.body = body;
    existing.canSend = canSend;
    clearTimeout(existing.timer);
    existing.timer = scheduleChatSummary(batchKey);
    return;
  }

  void (async () => {
    try {
      if (canSend && !(await canSend())) return;
      const bodyText = body?.(1) || "1 new chat message";
      await sendPushToMembers(deviceTokens, title, bodyText, { notificationType: "chat_message" });
    } catch (error: any) {
      console.error("[APNs] immediate chat push error:", error?.message || error);
    }
  })();

  chatBatches.set(batchKey, {
    recipientId,
    tokens: deviceTokens,
    title,
    count: 0,
    timer: scheduleChatSummary(batchKey),
    body,
    canSend,
  });
}
