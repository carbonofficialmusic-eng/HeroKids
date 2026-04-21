import type { Express, RequestHandler } from "express";
import { z } from "zod";
import { checkTransactionalEmailHealth } from "./emailHealth";

const adminEmailHealthTestSchema = z.object({
  recipient: z.string().trim().email("Enter a valid recipient email address"),
});

export function registerAdminEmailHealthRoutes(app: Express, isAdmin: RequestHandler) {
  app.get("/api/admin/email-health", isAdmin, async (req, res) => {
    try {
      const health = await checkTransactionalEmailHealth({
        includeMissingTestRecipientIssue: false,
      });
      res.json(health);
    } catch (error) {
      console.error("Error checking admin email health:", error);
      res.status(500).json({ message: "Failed to check email health" });
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
      res.json(health);
    } catch (error) {
      console.error("Error sending admin email health test:", error);
      res.status(500).json({ message: "Failed to send email health test" });
    }
  });
}