import type { Express, RequestHandler } from "express";
import { z } from "zod";
import { storage } from "./storage";
import { checkTransactionalEmailHealth, type EmailHealthResult } from "./emailHealth";
import type { InsertEmailReadinessCheck } from "@shared/schema";

const adminEmailHealthTestSchema = z.object({
  recipient: z.string().trim().email("Enter a valid recipient email address"),
});

function truncateEmailHistoryText(value: string, maxLength = 500) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function maskEmailForHistory(recipient: string) {
  const [localPart, domain] = recipient.split("@");
  if (!localPart || !domain) {
    return "masked-recipient";
  }
  const visibleLocal = localPart.slice(0, Math.min(localPart.length, 2));
  const maskedLocal = `${visibleLocal}${localPart.length > 2 ? "***" : "*"}`;
  return `${maskedLocal}@${domain}`;
}

function buildEmailReadinessRecord(checkType: "readiness_check" | "test_send", health: EmailHealthResult): InsertEmailReadinessCheck {
  const issues = health.issues.slice(0, 5).map((issue) => truncateEmailHistoryText(issue));
  const issueSummary = health.testSend.issue || issues[0] || null;

  return {
    checkType,
    status: health.status,
    configured: health.configured,
    provider: health.provider,
    credentialSource: health.credentialSource,
    fromAddress: health.fromAddress,
    baseUrl: health.baseUrl,
    expectedProductionBaseUrl: health.expectedProductionBaseUrl,
    linksUseExpectedDomain: health.linksUseExpectedDomain,
    productionLinksUseExpectedDomain: health.productionLinksUseExpectedDomain,
    testAttempted: health.testSend.attempted,
    testSucceeded: health.testSend.succeeded,
    testRecipient: health.testSend.recipient ? maskEmailForHistory(health.testSend.recipient) : null,
    issueSummary: issueSummary ? truncateEmailHistoryText(issueSummary) : null,
    issues,
  };
}

export function registerAdminEmailHealthRoutes(app: Express, isAdmin: RequestHandler) {
  app.get("/api/admin/email-health", isAdmin, async (req, res) => {
    try {
      const health = await checkTransactionalEmailHealth({
        includeMissingTestRecipientIssue: false,
      });
      await storage.createEmailReadinessCheck(buildEmailReadinessRecord("readiness_check", health));
      res.json(health);
    } catch (error) {
      console.error("Error checking admin email health:", error);
      res.status(500).json({ message: "Failed to check email health" });
    }
  });

  app.get("/api/admin/email-health/history", isAdmin, async (req, res) => {
    try {
      const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : 10;
      const checks = await storage.getRecentEmailReadinessChecks(Number.isFinite(limit) ? limit : 10);
      res.json(checks);
    } catch (error) {
      console.error("Error fetching admin email health history:", error);
      res.status(500).json({ message: "Failed to fetch email health history" });
    }
  });

  app.post("/api/admin/email-health/test", isAdmin, async (req, res) => {
    try {
      const parsed = adminEmailHealthTestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid test recipient" });
      }

      const health = await checkTransactionalEmailHealth({
        testRecipient: parsed.data.recipient,
      });
      await storage.createEmailReadinessCheck(buildEmailReadinessRecord("test_send", health));
      res.json(health);
    } catch (error) {
      console.error("Error sending admin email health test:", error);
      res.status(500).json({ message: "Failed to send email health test" });
    }
  });
}