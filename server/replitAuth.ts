import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import { verifyAccessToken } from "./mobileAuth";
import { EmailProviderNotConfiguredError, isTransactionalEmailConfigured, sendPasswordResetEmail, sendVerificationEmail } from "./email";
import { createEmailVerificationUrl, createPasswordResetUrl } from "./authLinks";

const registerSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).optional().nullable(),
});

const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(128),
});

const forgotPasswordSchema = z.object({
  email: z.string().email().max(320),
});

const resetPasswordSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8).max(128),
});

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function authRateLimit(maxRequests: number, windowMs: number): RequestHandler {
  return async (req: any, res, next) => {
    const clientIp = req.ip || req.connection?.remoteAddress || "unknown";
    const key = `${clientIp}:${req.path}`;
    try {
      const result = await storage.incrementAuthRateLimit(key, maxRequests, windowMs);
      if (result.allowed) {
        return next();
      }
      const retryAfter = result.retryAfter;
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({ message: "Zu viele Versuche. Bitte versuche es später erneut.", retryAfter });
    } catch (error) {
      console.error("Auth rate limit error:", error);
      next();
    }
  };
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

function createSessionUser(userId: string) {
  return {
    claims: { sub: userId },
    authMethod: "local",
  };
}

function sanitizeUser(user: any) {
  if (!user) return user;
  const {
    passwordHash,
    emailVerificationTokenHash,
    emailVerificationTokenExpiresAt,
    passwordResetTokenHash,
    passwordResetTokenExpiresAt,
    ...safeUser
  } = user;
  return safeUser;
}

function loginAsync(req: any, user: any) {
  return new Promise<void>((resolve, reject) => {
    req.login(user, (error: any) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function clearAccountSessionState(req: any) {
  if (req.session?.actingAsMemberId) {
    delete req.session.actingAsMemberId;
  }
}

async function trySendVerificationEmail(user: any, token: string) {
  const verificationUrl = createEmailVerificationUrl(token);
  return sendVerificationEmail(user.email, user.firstName, verificationUrl);
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (_req, res) => {
    res.redirect("/");
  });

  app.get("/api/callback", (_req, res) => {
    res.redirect("/");
  });

  app.post("/api/auth/register", async (req: any, res) => {
    try {
      const parsed = registerSchema.parse(req.body);
      const email = normalizeEmail(parsed.email);
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(409).json({ message: "Für diese E-Mail-Adresse gibt es bereits ein Konto." });
      }

      const passwordHash = await bcrypt.hash(parsed.password, 12);
      const verificationToken = createToken();
      const verificationTokenHash = hashToken(verificationToken);
      const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const user = await storage.createLocalUser({
        email,
        firstName: parsed.firstName.trim(),
        lastName: parsed.lastName?.trim() || null,
        passwordHash,
        emailVerificationTokenHash: verificationTokenHash,
        emailVerificationTokenExpiresAt: verificationExpiresAt,
      });

      clearAccountSessionState(req);
      await loginAsync(req, createSessionUser(user.id));
      clearAccountSessionState(req);

      let emailStatus: any = { status: "sent" };
      try {
        const delivery = await trySendVerificationEmail(user, verificationToken);
        emailStatus = { status: "sent", provider: delivery.provider };
      } catch (error) {
        if (error instanceof EmailProviderNotConfiguredError) {
          emailStatus = {
            status: "not_configured",
            message: "E-Mail-Versand ist noch nicht verbunden. Registrierung funktioniert, Bestätigungsmail wurde nicht gesendet.",
          };
        } else {
          console.error("Verification email failed:", error);
          emailStatus = { status: "failed", message: "Bestätigungsmail konnte nicht gesendet werden." };
        }
      }

      res.status(201).json({ user: sanitizeUser(user), emailStatus });
    } catch (error: any) {
      console.error("Register error:", error);
      res.status(400).json({ message: error?.message || "Registrierung fehlgeschlagen" });
    }
  });

  app.post("/api/auth/login", authRateLimit(10, 60 * 1000), async (req: any, res) => {
    try {
      const parsed = loginSchema.parse(req.body);
      const email = normalizeEmail(parsed.email);
      const user = await storage.getUserByEmail(email);

      if (!user || !user.passwordHash) {
        return res.status(401).json({ message: "E-Mail oder Passwort ist falsch." });
      }

      if (user.isDisabled) {
        return res.status(403).json({ message: "Dieses Konto ist deaktiviert." });
      }

      const isValidPassword = await bcrypt.compare(parsed.password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ message: "E-Mail oder Passwort ist falsch." });
      }

      await storage.updateUserLastLogin(user.id);
      clearAccountSessionState(req);
      await loginAsync(req, createSessionUser(user.id));
      clearAccountSessionState(req);
      const updatedUser = await storage.getUser(user.id);
      res.json({ user: sanitizeUser(updatedUser || user) });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(400).json({ message: error?.message || "Login fehlgeschlagen" });
    }
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const parsed = forgotPasswordSchema.parse(req.body);
      const email = normalizeEmail(parsed.email);
      const canSendEmail = await isTransactionalEmailConfigured();

      if (!canSendEmail) {
        return res.status(503).json({
          message: "E-Mail-Versand ist noch nicht verbunden. Bitte richte Resend oder SendGrid ein, bevor Passwort-Reset-E-Mails verschickt werden können.",
        });
      }

      const user = await storage.getUserByEmail(email);

      if (!user) {
        return res.json({ message: "Falls ein Konto existiert, senden wir dir eine E-Mail." });
      }

      const resetToken = createToken();
      await storage.updateUserAuthFields(user.id, {
        passwordResetTokenHash: hashToken(resetToken),
        passwordResetTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      const resetUrl = createPasswordResetUrl(resetToken);
      try {
        await sendPasswordResetEmail(email, user.firstName, resetUrl);
      } catch (error) {
        if (error instanceof EmailProviderNotConfiguredError) {
          return res.status(503).json({
            message: "E-Mail-Versand ist noch nicht verbunden. Bitte richte Resend oder SendGrid ein, bevor Passwort-Reset-E-Mails verschickt werden können.",
          });
        }
        throw error;
      }

      res.json({ message: "Falls ein Konto existiert, senden wir dir eine E-Mail." });
    } catch (error: any) {
      console.error("Forgot password error:", error);
      res.status(400).json({ message: error?.message || "Passwort-Reset fehlgeschlagen" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const parsed = resetPasswordSchema.parse(req.body);
      const tokenHash = hashToken(parsed.token);
      const user = await storage.getUserByPasswordResetToken(tokenHash);

      if (!user || !user.passwordResetTokenExpiresAt || user.passwordResetTokenExpiresAt < new Date()) {
        return res.status(400).json({ message: "Der Reset-Link ist ungültig oder abgelaufen." });
      }

      const passwordHash = await bcrypt.hash(parsed.password, 12);
      await storage.updateUserAuthFields(user.id, {
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetTokenExpiresAt: null,
      });
      clearAccountSessionState(req);

      res.json({ message: "Passwort wurde aktualisiert." });
    } catch (error: any) {
      console.error("Reset password error:", error);
      res.status(400).json({ message: error?.message || "Passwort konnte nicht aktualisiert werden" });
    }
  });

  app.get("/api/auth/verify-email", async (req, res) => {
    try {
      const token = String(req.query.token || "");
      if (!token) {
        return res.redirect("/?verified=invalid");
      }

      const user = await storage.getUserByEmailVerificationToken(hashToken(token));
      if (!user || !user.emailVerificationTokenExpiresAt || user.emailVerificationTokenExpiresAt < new Date()) {
        return res.redirect("/?verified=invalid");
      }

      await storage.updateUserAuthFields(user.id, {
        isEmailVerified: true,
        emailVerificationTokenHash: null,
        emailVerificationTokenExpiresAt: null,
      });

      res.redirect("/?verified=success");
    } catch (error) {
      console.error("Verify email error:", error);
      res.redirect("/?verified=invalid");
    }
  });

  app.post("/api/auth/resend-verification", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      if (!user?.email) {
        return res.status(404).json({ message: "Konto nicht gefunden." });
      }

      if (user.isEmailVerified) {
        return res.json({ message: "E-Mail ist bereits bestätigt." });
      }

      const token = createToken();
      await storage.updateUserAuthFields(user.id, {
        emailVerificationTokenHash: hashToken(token),
        emailVerificationTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      try {
        const delivery = await trySendVerificationEmail(user, token);
        res.json({ message: "Bestätigungsmail wurde gesendet.", provider: delivery.provider });
      } catch (error) {
        if (error instanceof EmailProviderNotConfiguredError) {
          return res.status(503).json({ message: error.message });
        }
        throw error;
      }
    } catch (error: any) {
      console.error("Resend verification error:", error);
      res.status(400).json({ message: error?.message || "Bestätigungsmail konnte nicht gesendet werden" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout(() => {
      req.session.destroy(() => {
        res.clearCookie("connect.sid");
        res.json({ success: true });
      });
    });
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      req.session.destroy(() => {
        res.clearCookie("connect.sid");
        res.redirect("/");
      });
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (req.isAuthenticated() && user?.claims?.sub) {
    const account = await storage.getUser(user.claims.sub);
    if (account && !account.isDisabled) {
      return next();
    }
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const payload = verifyAccessToken(token);
    if (payload) {
      try {
        const member = await storage.getFamilyMember(payload.memberId);
        if (member) {
          (req as any).user = {
            claims: {
              sub: `mobile:${member.id}`,
            },
            authMethod: "mobile",
            member: member,
            jwtPayload: payload,
          };
          return next();
        }
      } catch (error) {
        console.error("JWT token validation error:", error);
      }
    }
  }

  const deviceToken = req.cookies?.child_device_token;
  if (deviceToken) {
    try {
      const session = await storage.findValidChildDeviceSession(deviceToken);
      if (session) {
        const member = await storage.getFamilyMember(session.memberId);
        if (member) {
          await storage.updateDeviceSessionLastSeen(session.id);
          (req as any).user = {
            claims: {
              sub: `device:${member.id}`,
            },
            authMethod: "device",
            deviceSession: session,
            member: member,
          };
          return next();
        }
      }
    } catch (error) {
      console.error("Device token validation error:", error);
    }
  }

  return res.status(401).json({ message: "Unauthorized" });
};
