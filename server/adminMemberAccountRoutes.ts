import type { Express, RequestHandler } from "express";
import { z } from "zod";
import { storage } from "./storage";

const adminMemberAccountSchema = z.object({
  action: z.enum(["link", "unlink"]),
  email: z.preprocess((value) => (typeof value === "string" ? value.trim() : value), z.string().email()).optional(),
  detachExisting: z.boolean().optional().default(false),
});

function sanitizeAccountForAdmin(user: any) {
  if (!user) return null;
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

export function registerAdminMemberAccountRoutes(app: Express, isAdmin: RequestHandler) {
  app.patch("/api/admin/families/:familyName/members/:memberId/account", isAdmin, async (req, res) => {
    try {
      const { familyName, memberId } = req.params;
      const parsed = adminMemberAccountSchema.parse(req.body);
      const member = await storage.getFamilyMember(memberId);

      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }

      if (member.familyName !== familyName) {
        return res.status(400).json({ message: "Member not in this family" });
      }

      if (parsed.action === "unlink") {
        const oldAccount = member.userId ? await storage.getUser(member.userId) : null;
        const updatedMember = member.userId ? await storage.unlinkUserFromFamilyMember(member.id) : member;
        if (member.userId) {
          await storage.createAccountLinkRepairHistory({
            familyName,
            memberId: member.id,
            memberDisplayName: member.displayName,
            action: "unlink",
            oldAccountId: oldAccount?.id || member.userId,
            oldAccountEmail: oldAccount?.email || null,
            newAccountId: null,
            newAccountEmail: null,
          });
        }
        return res.json({
          success: true,
          member: updatedMember,
          account: null,
          message: "Account unlinked from member",
        });
      }

      if (!parsed.email) {
        return res.status(400).json({ message: "Email is required to link an account" });
      }

      if (member.userId) {
        return res.status(409).json({ message: "This member is already linked to an account. Unlink it first." });
      }

      const user = await storage.getUserByEmail(parsed.email.trim().toLowerCase());
      if (!user) {
        return res.status(404).json({ message: "Account not found for this email" });
      }

      if (user.isDisabled) {
        return res.status(400).json({ message: "Disabled accounts cannot be linked to a member" });
      }

      const existingLinkedMember = await storage.getFamilyMemberByUserId(user.id);
      if (existingLinkedMember && existingLinkedMember.id !== member.id) {
        if (!parsed.detachExisting) {
          return res.status(409).json({
            message: `This account is already linked to ${existingLinkedMember.displayName}. Unlink it there first or confirm moving it.`,
            existingMember: {
              id: existingLinkedMember.id,
              displayName: existingLinkedMember.displayName,
              familyName: existingLinkedMember.familyName,
              role: existingLinkedMember.role,
            },
          });
        }
        const detachedAccount = await storage.getUser(user.id);
        await storage.unlinkUserFromFamilyMember(existingLinkedMember.id);
        await storage.createAccountLinkRepairHistory({
          familyName: existingLinkedMember.familyName,
          memberId: existingLinkedMember.id,
          memberDisplayName: existingLinkedMember.displayName,
          action: "move_detach",
          oldAccountId: detachedAccount?.id || user.id,
          oldAccountEmail: detachedAccount?.email || user.email || null,
          newAccountId: null,
          newAccountEmail: null,
        });
      }

      const linkedMember = await storage.linkUserToFamilyMember(member.id, user.id, {
        displayName: member.displayName,
        avatarUrl: member.avatarUrl || "",
        color: member.color,
      });
      await storage.createAccountLinkRepairHistory({
        familyName,
        memberId: member.id,
        memberDisplayName: member.displayName,
        action: parsed.detachExisting ? "move_link" : "link",
        oldAccountId: member.userId || null,
        oldAccountEmail: null,
        newAccountId: user.id,
        newAccountEmail: user.email || null,
      });

      res.json({
        success: true,
        member: linkedMember,
        account: sanitizeAccountForAdmin(user),
        message: "Account linked to member",
      });
    } catch (error: any) {
      console.error("Error updating member account link:", error);
      res.status(400).json({ message: error?.message || "Failed to update member account link" });
    }
  });
}