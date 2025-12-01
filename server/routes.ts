import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { join } from "path";
import { z } from "zod";
import Stripe from "stripe";
import { storage } from "./storage";
import { db } from "./db";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { achievementEngine } from "./achievementEngine";
import { wsClients, broadcastToFamily } from "./websocket";
import { insertFamilyMemberSchema, insertTaskSchema, insertRewardSchema, insertRewardRedemptionSchema, insertChatMessageSchema, insertAchievementDefinitionSchema, insertFamilyGoalSchema, type Family, familyGoals, familyMembers } from "@shared/schema";
import { getMaxMembers, hasFeature, canAddMember, getMaxSkins, TIER_CONFIG, getAllTiers } from "@shared/tier-config";
import type { SubscriptionTier } from "@shared/tier-config";
import { calculateAvailableCards, getUnlockedTier, getSkinTier } from "@shared/skin-config";
import { eq } from "drizzle-orm";
import "./types";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-10-29.clover",
});

// Track uploaded photos to prevent URL spoofing (now using Object Storage instead of multer)
const uploadedPhotos = new Map<string, { memberId: string; taskId: string; timestamp: number }>();

// Clean up old uploads every hour
setInterval(() => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  Array.from(uploadedPhotos.entries()).forEach(([photoUrl, data]) => {
    if (data.timestamp < oneHourAgo) {
      uploadedPhotos.delete(photoUrl);
    }
  });
}, 60 * 60 * 1000);

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve uploaded files
  app.use('/uploads', (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  });
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

  // NOTE: Stripe webhook handler is in server/index.ts (MUST be before express.json())
  // The webhook endpoint is /api/stripe-webhook (with hyphen, not slash)

  // Auth middleware
  await setupAuth(app);

  // Object Storage: Serve private objects with ACL check
  app.get("/objects/:objectPath(*)", isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId,
        requestedPermission: ObjectPermission.READ,
      });
      if (!canAccess) {
        return res.sendStatus(401);
      }
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Auth routes
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Family routes
  app.get("/api/families/current", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const member = await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      const family = await storage.getFamily(member.familyName);
      if (!family) {
        return res.status(404).json({ message: "Family not found" });
      }
      
      const memberCount = await storage.getFamilyMemberCount(member.familyName);
      
      res.json({ ...family, memberCount });
    } catch (error) {
      console.error("Error fetching family:", error);
      res.status(500).json({ message: "Failed to fetch family" });
    }
  });

  // Get family settings (includes showLeaderboard)
  app.get("/api/families/settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const member = await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      const family = await storage.getFamily(member.familyName);
      if (!family) {
        return res.status(404).json({ message: "Family not found" });
      }
      
      // Filter sensitive data for children
      if (member.role === "child") {
        const { joinCode, weeklyPrize, monthlyPrize, ...safeData } = family;
        return res.json(safeData);
      }
      
      res.json(family);
    } catch (error) {
      console.error("Error fetching family settings:", error);
      res.status(500).json({ message: "Failed to fetch family settings" });
    }
  });

  // Zod schema for family settings update
  const updateFamilySettingsSchema = z.object({
    showLeaderboard: z.boolean().optional(),
    singleDeviceMode: z.boolean().optional(),
    language: z.enum(["de", "en", "fr", "es", "ja", "zh", "ko"]).optional(),
    timezone: z.string().optional(),
    weeklyPrize: z.string().nullable().optional(),
    monthlyPrize: z.string().nullable().optional(),
    yearlyPrize: z.string().nullable().optional(),
  }).refine(data => 
    data.showLeaderboard !== undefined || 
    data.singleDeviceMode !== undefined ||
    data.language !== undefined ||
    data.timezone !== undefined ||
    data.weeklyPrize !== undefined ||
    data.monthlyPrize !== undefined ||
    data.yearlyPrize !== undefined, {
    message: "At least one setting must be provided"
  });

  // Update family settings (parents only)
  app.patch("/api/families/settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const member = await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }

      // Only parents can update settings
      if (member.role !== "parent") {
        return res.status(403).json({ message: "Only parents can update family settings" });
      }
      
      // Validate request body
      const validation = updateFamilySettingsSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid settings", 
          errors: validation.error.errors 
        });
      }
      
      const settings = validation.data;
      
      await storage.updateFamilySettings(member.familyName, settings);
      
      // Broadcast settings change to all family members
      broadcastToFamily(member.familyName, {
        type: "settings_updated",
        settings,
      });
      
      res.json({ message: "Settings updated successfully" });
    } catch (error) {
      console.error("Error updating family settings:", error);
      res.status(500).json({ message: "Failed to update family settings" });
    }
  });

  // Factory reset - parent only
  app.post("/api/family/reset", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const actingMemberId = req.session.actingAsMemberId;
      
      const member = actingMemberId 
        ? await storage.getFamilyMemberById(actingMemberId)
        : await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Only parents can reset the family
      if (member.role !== "parent") {
        return res.status(403).json({ message: "Only parents can reset the family" });
      }
      
      // Perform factory reset
      await storage.resetFamilyToFactory(member.familyName);
      
      // Broadcast reset to all family members
      broadcastToFamily(member.familyName, {
        type: "factory_reset",
        message: "Family has been reset to factory settings",
      });
      
      res.json({ message: "Family reset to factory settings successfully" });
    } catch (error) {
      console.error("Error resetting family:", error);
      res.status(500).json({ message: "Failed to reset family" });
    }
  });

  // Family member routes
  app.get("/api/family-members/current", isAuthenticated, async (req: any, res) => {
    try {
      // Check if we're acting as another member
      if (req.session.actingAsMemberId) {
        const actingAsMember = await storage.getFamilyMember(req.session.actingAsMemberId);
        if (actingAsMember) {
          return res.json(actingAsMember);
        }
        // If acting as member not found, clear the session and fall through
        delete req.session.actingAsMemberId;
      }
      
      const userId = req.user.claims.sub;
      const member = await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      res.json(member);
    } catch (error) {
      console.error("Error fetching current family member:", error);
      res.status(500).json({ message: "Failed to fetch family member" });
    }
  });

  // Get the real authenticated user's member record (not acting as)
  app.get("/api/family-members/real", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const member = await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      res.json(member);
    } catch (error) {
      console.error("Error fetching real family member:", error);
      res.status(500).json({ message: "Failed to fetch family member" });
    }
  });

  // Switch member (parents only)
  app.post("/api/family-members/switch", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const realMember = await storage.getFamilyMemberByUserId(userId);
      
      if (!realMember) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Only parents can switch members
      if (realMember.role !== "parent") {
        return res.status(403).json({ message: "Only parents can switch members" });
      }
      
      const { memberId, pinCode } = req.body;
      
      // If no memberId provided, switch back to self
      if (!memberId) {
        delete req.session.actingAsMemberId;
        return res.json({ message: "Switched back to self", member: realMember });
      }
      
      // Verify the target member exists and is in the same family
      const targetMember = await storage.getFamilyMember(memberId);
      
      if (!targetMember) {
        return res.status(404).json({ message: "Target member not found" });
      }
      
      if (targetMember.familyName !== realMember.familyName) {
        return res.status(403).json({ message: "Cannot switch to member from different family" });
      }
      
      // Get family settings to check if single device mode is enabled
      const family = await storage.getFamily(realMember.familyName);
      
      // If single device mode is enabled and switching to a parent, verify PIN
      if (family?.singleDeviceMode && targetMember.role === "parent") {
        if (!pinCode) {
          return res.status(401).json({ 
            message: "PIN required for this member",
            requiresPin: true 
          });
        }
        
        // If no PIN is set, default PIN is "0000"
        // If PIN is set, validate it
        let isValidPin = false;
        if (!targetMember.pinCode) {
          // No PIN set - accept default PIN "0000"
          isValidPin = pinCode === "0000";
        } else {
          // PIN is set - validate against stored PIN
          isValidPin = await storage.validatePin(memberId, pinCode);
        }
        
        if (!isValidPin) {
          return res.status(401).json({ 
            message: "Incorrect PIN",
            requiresPin: true 
          });
        }
      }
      
      // Set the session to act as this member
      req.session.actingAsMemberId = memberId;
      
      res.json({ message: "Switched member successfully", member: targetMember });
    } catch (error) {
      console.error("Error switching member:", error);
      res.status(500).json({ message: "Failed to switch member" });
    }
  });

  // Set or update PIN code for a family member (parents only)
  app.patch("/api/family-members/:id/pin", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const realMember = await storage.getFamilyMemberByUserId(userId);
      
      if (!realMember) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Only parents can set PIN codes
      if (realMember.role !== "parent") {
        return res.status(403).json({ message: "Only parents can manage PIN codes" });
      }
      
      const { id: targetMemberId } = req.params;
      const { pinCode } = req.body;
      
      // Validate PIN code
      if (pinCode !== null && pinCode !== undefined && pinCode !== "") {
        if (!/^\d{4}$/.test(pinCode)) {
          return res.status(400).json({ message: "PIN must be exactly 4 digits" });
        }
      }
      
      // Verify the target member exists and is in the same family
      const targetMember = await storage.getFamilyMember(targetMemberId);
      
      if (!targetMember) {
        return res.status(404).json({ message: "Target member not found" });
      }
      
      if (targetMember.familyName !== realMember.familyName) {
        return res.status(403).json({ message: "Cannot manage PIN for member from different family" });
      }
      
      // Update PIN code (allow null/empty string to clear PIN)
      if (pinCode && pinCode.trim() !== "") {
        await storage.setPinCode(targetMemberId, pinCode);
      } else {
        // Clear PIN by setting to null
        await storage.clearPinCode(targetMemberId);
      }
      
      res.json({ message: "PIN updated successfully" });
    } catch (error) {
      console.error("Error updating PIN:", error);
      res.status(500).json({ message: "Failed to update PIN" });
    }
  });

  app.get("/api/family-members", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentMember = await storage.getFamilyMemberByUserId(userId);
      
      if (!currentMember) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      const members = await storage.getFamilyMembersByFamily(currentMember.familyName);
      res.json(members);
    } catch (error) {
      console.error("Error fetching family members:", error);
      res.status(500).json({ message: "Failed to fetch family members" });
    }
  });

  app.post("/api/family-members", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Check if user already has a family member profile
      const existingMember = await storage.getFamilyMemberByUserId(userId);
      
      if (existingMember) {
        // Adding a new member - user must be a parent
        if (existingMember.role !== "parent") {
          return res.status(403).json({ message: "Only parents can add family members" });
        }
        
        const parsed = insertFamilyMemberSchema.parse(req.body);
        const familyName = existingMember.familyName;
        
        // Get family for tier checking
        const family = await storage.getFamily(familyName);
        if (!family) {
          return res.status(404).json({ message: "Family not found" });
        }
        
        // Check subscription tier limits (bypass in test/development environment)
        const bypassTierLimits = process.env.BYPASS_TIER_LIMITS === "true" || process.env.NODE_ENV === "development";
        
        if (!bypassTierLimits) {
          const currentCount = await storage.getFamilyMemberCount(familyName);
          const tier = family.subscriptionTier as SubscriptionTier;
          const limit = getMaxMembers(tier);
          
          if (!canAddMember(tier, currentCount)) {
            return res.status(403).json({
              message: `Your ${tier} plan is limited to ${limit} members. Upgrade to add more family members.`,
              currentTier: tier,
              currentCount,
              limit,
            });
          }
        }
        
        // Create member (no userId - this is a placeholder member)
        const member = await storage.createFamilyMember({
          ...parsed,
          familyName,
        });
        
        // Broadcast new member to family
        broadcastToFamily(member.familyName, {
          type: "member_joined",
          member,
        });
        
        res.json(member);
      } else {
        // Initial setup - creating first member for this user
        const parsed = insertFamilyMemberSchema.parse(req.body);
        
        // Check if family exists, create if not
        let family = await storage.getFamily(parsed.familyName);
        if (!family) {
          // Generate a cryptographically secure join code for the family
          const crypto = await import('crypto');
          const joinCode = crypto.randomBytes(4).toString('hex').substring(0, 6).toUpperCase();
          
          family = await storage.createFamily({
            familyName: parsed.familyName,
            joinCode,
            subscriptionTier: "free",
          });
        }
        
        // Check subscription tier limits (bypass in test/development environment)
        const bypassTierLimits = process.env.BYPASS_TIER_LIMITS === "true" || process.env.NODE_ENV === "development";
        
        if (!bypassTierLimits) {
          const currentCount = await storage.getFamilyMemberCount(parsed.familyName);
          const tier = family.subscriptionTier as SubscriptionTier;
          const limit = getMaxMembers(tier);
          
          if (!canAddMember(tier, currentCount)) {
            return res.status(403).json({
              message: `Your ${tier} plan is limited to ${limit} members. Upgrade to add more family members.`,
              currentTier: tier,
              currentCount,
              limit,
            });
          }
        }
        
        // Create member linked to current user
        const member = await storage.createFamilyMember({
          ...parsed,
          userId, // Associate with authenticated user
        } as any);
        
        // Broadcast new member to family
        broadcastToFamily(member.familyName, {
          type: "member_joined",
          member,
        });
        
        res.json(member);
      }
    } catch (error: any) {
      console.error("Error creating family member:", error);
      res.status(400).json({ message: error.message || "Failed to create family member" });
    }
  });

  // Join family with join code
  app.post("/api/join-family", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate and parse request body
      const joinFamilySchema = z.object({
        joinCode: z.string().length(6, "Join code must be 6 characters"),
        displayName: z.string().min(1, "Display name is required"),
        avatarUrl: z.string().min(1, "Avatar is required"),
        color: z.string().min(1, "Color is required"),
        role: z.enum(["parent", "child"]).optional().default("child"),
      });
      
      const parsed = joinFamilySchema.parse(req.body);
      
      // Normalize join code to uppercase for case-insensitive comparison
      const normalizedJoinCode = parsed.joinCode.toUpperCase();
      
      // Check if user already has a family member profile
      const existingMember = await storage.getFamilyMemberByUserId(userId);
      
      if (existingMember) {
        return res.status(400).json({ message: "You are already part of a family" });
      }
      
      // Find the family with this join code
      const family = await storage.getFamilyByJoinCode(normalizedJoinCode);
      
      if (!family) {
        return res.status(404).json({ message: "Invalid join code" });
      }
      
      // Check subscription tier limits (bypass in test/development environment)
      const bypassTierLimits = process.env.BYPASS_TIER_LIMITS === "true" || process.env.NODE_ENV === "development";
      
      if (!bypassTierLimits) {
        const currentCount = await storage.getFamilyMemberCount(family.familyName);
        const tier = family.subscriptionTier as SubscriptionTier;
        const limit = getMaxMembers(tier);
        
        if (!canAddMember(tier, currentCount)) {
          return res.status(403).json({
            message: `This family's ${tier} plan is limited to ${limit} members. Ask them to upgrade to add more members.`,
            currentTier: tier,
            currentCount,
            limit,
          });
        }
      }
      
      // Create new member linked to the user
      const newMember = await storage.createFamilyMember({
        familyName: family.familyName,
        displayName: parsed.displayName,
        avatarUrl: parsed.avatarUrl,
        color: parsed.color,
        role: parsed.role,
        userId,
      } as any);
      
      // Broadcast member joined to family
      broadcastToFamily(newMember.familyName, {
        type: "member_joined",
        member: newMember,
      });
      
      res.json(newMember);
    } catch (error: any) {
      console.error("Error joining family:", error);
      res.status(400).json({ message: error.message || "Failed to join family" });
    }
  });

  app.put("/api/family-members/:memberId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { memberId } = req.params;
      
      // Get current member to verify permissions
      const currentMember = await storage.getFamilyMemberByUserId(userId);
      
      if (!currentMember) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Get the member being updated
      const memberToUpdate = await storage.getFamilyMemberById(memberId);
      
      if (!memberToUpdate) {
        return res.status(404).json({ message: "Member to update not found" });
      }
      
      // Verify they're in the same family
      if (memberToUpdate.familyName !== currentMember.familyName) {
        return res.status(403).json({ message: "Cannot update members from other families" });
      }
      
      // Only allow updating own profile or if you're a parent
      if (memberToUpdate.id !== currentMember.id && currentMember.role !== "parent") {
        return res.status(403).json({ message: "Only parents can update other members' profiles" });
      }
      
      // Security: Prevent role changes that could lock out the family
      if (req.body.role && req.body.role !== memberToUpdate.role) {
        // Validate role value
        if (req.body.role !== "parent" && req.body.role !== "child") {
          return res.status(400).json({ message: "Invalid role. Must be 'parent' or 'child'." });
        }
        
        // Only parents can change roles
        if (currentMember.role !== "parent") {
          return res.status(403).json({ message: "Only parents can change member roles" });
        }
        
        // Prevent self-demotion: parents cannot change their own role to child
        if (memberToUpdate.id === currentMember.id && req.body.role === "child") {
          return res.status(400).json({ message: "Parents cannot demote themselves to child. Ask another parent to change your role." });
        }
        
        // Prevent demoting the last parent
        if (req.body.role === "child" && memberToUpdate.role === "parent") {
          const allMembers = await storage.getFamilyMembersByFamily(currentMember.familyName);
          const parentCount = allMembers.filter(m => m.role === "parent").length;
          
          if (parentCount <= 1) {
            return res.status(400).json({ message: "Cannot demote the last parent. At least one parent must remain to manage the family." });
          }
        }
      }
      
      // Update the member
      const updates = {
        displayName: req.body.displayName,
        avatarUrl: req.body.avatarUrl,
        color: req.body.color,
        role: req.body.role,
        excludeFromLeaderboard: req.body.excludeFromLeaderboard,
        useCustomAvatar: req.body.useCustomAvatar,
      };
      
      const updatedMember = await storage.updateFamilyMember(memberId, updates);
      
      // Broadcast update to family
      broadcastToFamily(currentMember.familyName, {
        type: "member_updated",
        member: updatedMember,
      });
      
      res.json(updatedMember);
    } catch (error: any) {
      console.error("Error updating family member:", error);
      res.status(400).json({ message: error.message || "Failed to update family member" });
    }
  });

  app.delete("/api/family-members/:memberId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { memberId } = req.params;
      
      // Get current member to verify permissions
      const currentMember = await storage.getFamilyMemberByUserId(userId);
      
      if (!currentMember) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Only parents can delete members
      if (currentMember.role !== "parent") {
        return res.status(403).json({ message: "Only parents can delete family members" });
      }
      
      // Get the member being deleted
      const memberToDelete = await storage.getFamilyMemberById(memberId);
      
      if (!memberToDelete) {
        return res.status(404).json({ message: "Member to delete not found" });
      }
      
      // Verify they're in the same family
      if (memberToDelete.familyName !== currentMember.familyName) {
        return res.status(403).json({ message: "Cannot delete members from other families" });
      }

      // Prevent self-deletion
      if (memberToDelete.id === currentMember.id) {
        return res.status(400).json({ message: "Cannot delete yourself" });
      }
      
      // Delete the member
      await storage.deleteFamilyMember(memberId);
      
      // Broadcast deletion to family
      broadcastToFamily(currentMember.familyName, {
        type: "member_deleted",
        memberId,
      });
      
      res.json({ message: "Family member deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting family member:", error);
      res.status(500).json({ message: "Failed to delete family member" });
    }
  });

  // Get presigned URL for avatar upload (client-side upload to Object Storage)
  app.post("/api/upload-avatar-url", isAuthenticated, async (req: any, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL("avatars");
      
      res.json({ uploadURL });
    } catch (error: any) {
      console.error("Error getting avatar upload URL:", error);
      res.status(500).json({ message: "Failed to get upload URL" });
    }
  });

  // Set ACL policy for uploaded avatar
  app.put("/api/avatar", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { avatarUrl } = req.body;
      
      if (!avatarUrl) {
        return res.status(400).json({ message: "avatarUrl is required" });
      }
      
      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        avatarUrl,
        {
          owner: userId,
          visibility: "public", // Avatars are public, accessible by everyone
        }
      );
      
      res.json({ avatarUrl: objectPath });
    } catch (error: any) {
      console.error("Error setting avatar ACL:", error);
      res.status(500).json({ message: "Failed to set avatar ACL" });
    }
  });

  // Task routes
  app.get("/api/tasks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const realMember = await storage.getFamilyMemberByUserId(userId);
      
      if (!realMember) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Use acting member if available, otherwise use authenticated user
      let member = realMember;
      if (req.session.actingAsMemberId) {
        const actingMember = await storage.getFamilyMemberById(req.session.actingAsMemberId);
        
        // Security: Validate acting member belongs to same family
        if (!actingMember || actingMember.familyName !== realMember.familyName) {
          // Clear invalid session
          delete req.session.actingAsMemberId;
        } else {
          member = actingMember;
        }
      }
      
      const allTasks = await storage.getTasksByFamily(member.familyName);
      
      // For children: filter and enhance tasks based on Multi-Completion mode
      if (member.role === "child") {
        const tasksWithMeta = await Promise.allSettled(
          allTasks.map(async (task) => {
            try {
              // Get completion status for this member
              const completionStatus = await storage.getMemberCompletionStatus(task.id, member.id);
              // Only "approved" counts as truly completed for filtering purposes
              // "pending" and "rejected" should still be shown to children
              const hasCompleted = completionStatus === "approved";
              
              // Multi-Completion mode (maxCompletions != null) - Special rules for shared tasks
              if (task.maxCompletions !== null) {
                // Get active completions to show participants
                try {
                  const completions = await storage.getActiveCompletionsByTask(task.id);
                  // Calculate completion count from approved completions
                  const completionCount = completions.filter(c => c.status === "approved").length;
                  return {
                    ...task,
                    remainingSlots: task.maxCompletions - completionCount,
                    memberHasCompleted: hasCompleted,
                    memberCompletionStatus: completionStatus,
                    completions, // Include participant list for multi-tasks
                  };
                } catch (err) {
                  console.error(`Error getting completions for task ${task.id}:`, err);
                  return {
                    ...task,
                    remainingSlots: task.maxCompletions,
                    memberHasCompleted: hasCompleted,
                    memberCompletionStatus: completionStatus,
                    completions: [],
                  };
                }
              }
              
              // Normal mode (maxCompletions == null) - Standard tasks visible to everyone
              return {
                ...task,
                remainingSlots: null,
                memberHasCompleted: hasCompleted,
                memberCompletionStatus: completionStatus,
                completions: [], // No participants for non-multi tasks
              };
            } catch (err) {
              console.error(`Error processing task ${task.id}:`, err);
              return {
                ...task,
                remainingSlots: task.maxCompletions !== null ? task.maxCompletions : null,
                memberHasCompleted: false,
                memberCompletionStatus: null,
                completions: [],
              };
            }
          })
        );
        
        // Extract successful results from settled promises
        const resolvedTasks = tasksWithMeta
          .filter((r) => r.status === "fulfilled")
          .map((r) => (r as PromiseFulfilledResult<any>).value);
        
        // Filter logic for different task types:
        // 1. Archived tasks: Hide for everyone
        // 2. One-time completed tasks (recurrence = "none" AND status = "completed"): Hide for everyone
        // 3. Recurring tasks: Show even if completed (they will be grayed out in UI)
        // 4. Active tasks: Always show
        const filteredTasks = resolvedTasks.filter(
          (task) => 
            task.status !== "archived" && // Hide archived
            !(task.status === "completed" && task.recurrence === "none") // Hide one-time completed tasks
        );
        
        // Disable caching for task data
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.json(filteredTasks);
      } else {
        // Parents see all tasks with metadata
        const tasksWithMeta = await Promise.allSettled(
          allTasks.map(async (task) => {
            try {
              // Get completion status for this member
              const completionStatus = await storage.getMemberCompletionStatus(task.id, member.id);
              // Only "approved" counts as truly completed
              const hasCompleted = completionStatus === "approved";
              
              // For multi-completion tasks, check if parent has already completed it
              if (task.maxCompletions !== null) {
                // Get active completions to show participants
                try {
                  const completions = await storage.getActiveCompletionsByTask(task.id);
                  // Calculate completion count from approved completions
                  const completionCount = completions.filter(c => c.status === "approved").length;
                  return {
                    ...task,
                    remainingSlots: task.maxCompletions - completionCount,
                    memberHasCompleted: hasCompleted,
                    memberCompletionStatus: completionStatus,
                    completions, // Include participant list for multi-tasks
                  };
                } catch (err) {
                  console.error(`Error getting completions for task ${task.id}:`, err);
                  return {
                    ...task,
                    remainingSlots: task.maxCompletions,
                    memberHasCompleted: hasCompleted,
                    memberCompletionStatus: completionStatus,
                    completions: [],
                  };
                }
              }
              
              // For non-multi-completion tasks - use same logic as multi-completion
              return {
                ...task,
                remainingSlots: null,
                memberHasCompleted: hasCompleted,
                memberCompletionStatus: completionStatus,
                completions: [], // No participants for non-multi tasks
              };
            } catch (err) {
              console.error(`Error processing task ${task.id}:`, err);
              return {
                ...task,
                remainingSlots: task.maxCompletions !== null ? task.maxCompletions : null,
                memberHasCompleted: false,
                memberCompletionStatus: null,
                completions: [],
              };
            }
          })
        );
        
        // Extract successful results from settled promises
        const resolvedParentTasks = tasksWithMeta
          .filter((r) => r.status === "fulfilled")
          .map((r) => (r as PromiseFulfilledResult<any>).value);
        
        // Disable caching for task data
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.json(resolvedParentTasks);
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.post("/api/tasks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const member = await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Only parents can create tasks
      if (member.role !== "parent") {
        return res.status(403).json({ message: "Only parents can create tasks" });
      }
      
      const parsed = insertTaskSchema.parse(req.body);
      
      // Parse dueDate if provided as string
      const taskData = {
        ...parsed,
        dueDate: parsed.dueDate ? new Date(parsed.dueDate) : null,
      };
      
      const task = await storage.createTask(taskData);
      
      // Broadcast new task to family
      broadcastToFamily(member.familyName, {
        type: "task_created",
        task,
      });
      
      res.json(task);
    } catch (error: any) {
      console.error("Error creating task:", error);
      res.status(400).json({ message: error.message || "Failed to create task" });
    }
  });

  app.put("/api/tasks/:taskId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { taskId } = req.params;
      const member = await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }

      // Only parents can update tasks
      if (member.role !== "parent") {
        return res.status(403).json({ message: "Only parents can update tasks" });
      }

      // Verify task exists and belongs to the same family
      const existingTask = await storage.getTask(taskId);
      if (!existingTask) {
        return res.status(404).json({ message: "Task not found" });
      }

      if (existingTask.familyName !== member.familyName) {
        return res.status(403).json({ message: "Cannot update tasks from other families" });
      }

      // Handle dueDate conversion BEFORE Zod parsing
      const bodyData: any = { ...req.body };
      if (bodyData.dueDate !== undefined) {
        if (typeof bodyData.dueDate === 'string') {
          if (bodyData.dueDate.trim() === '') {
            bodyData.dueDate = null;
          } else {
            bodyData.dueDate = new Date(bodyData.dueDate);
          }
        }
      }
      
      // Parse and update the task
      const parsed = insertTaskSchema.partial().parse(bodyData);
      const updatedTask = await storage.updateTask(taskId, parsed);

      // Broadcast task update to family
      broadcastToFamily(member.familyName, {
        type: "task_updated",
        task: updatedTask,
      });

      res.json(updatedTask);
    } catch (error: any) {
      console.error("Error updating task:", error);
      res.status(400).json({ message: error.message || "Failed to update task" });
    }
  });

  app.delete("/api/tasks/:taskId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { taskId } = req.params;
      
      const member = await storage.getFamilyMemberByUserId(userId);
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Only parents can delete tasks
      if (member.role !== "parent") {
        return res.status(403).json({ message: "Only parents can delete tasks" });
      }
      
      // Get the task to verify it exists and belongs to the same family
      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      if (task.familyName !== member.familyName) {
        return res.status(403).json({ message: "Cannot delete tasks from another family" });
      }
      
      // Delete the task
      await storage.deleteTask(taskId);
      
      // Broadcast task deletion to family
      broadcastToFamily(member.familyName, {
        type: "task_deleted",
        taskId,
      });
      
      res.json({ success: true, message: "Task deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting task:", error);
      res.status(500).json({ message: "Failed to delete task" });
    }
  });

  // Manual task reset (for parents to reset recurring tasks manually)
  app.post("/api/tasks/:taskId/reset", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { taskId } = req.params;
      
      const member = await storage.getFamilyMemberByUserId(userId);
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Only parents can reset tasks
      if (member.role !== "parent") {
        return res.status(403).json({ message: "Only parents can reset tasks" });
      }
      
      // Get the task to verify it exists and belongs to the same family
      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      if (task.familyName !== member.familyName) {
        return res.status(403).json({ message: "Cannot reset tasks from another family" });
      }
      
      // Reset the task (delete all completions and reset counters)
      await storage.resetTask(taskId);
      
      // Get updated task to return
      const updatedTask = await storage.getTask(taskId);
      
      // Broadcast task reset to family
      broadcastToFamily(member.familyName, {
        type: "task_updated",
        task: updatedTask,
      });
      
      res.json({ success: true, message: "Task reset successfully", task: updatedTask });
    } catch (error: any) {
      console.error("Error resetting task:", error);
      res.status(500).json({ message: "Failed to reset task" });
    }
  });

  // Get presigned URL for task proof upload (client-side upload to Object Storage)
  app.post("/api/tasks/upload-proof-url", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const member = await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Check if tier allows photo proof uploads
      const family = await storage.getFamily(member.familyName);
      if (!family) {
        return res.status(404).json({ message: "Family not found" });
      }
      
      const tier = family.subscriptionTier as SubscriptionTier;
      if (!hasFeature(tier, 'photoProof')) {
        return res.status(403).json({
          message: "Photo proof upload requires a Family tier subscription or higher",
          currentTier: tier,
          requiredFeature: "photoProof",
        });
      }
      
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL("task-proofs");
      
      res.json({ uploadURL });
    } catch (error: any) {
      console.error("Error getting task proof upload URL:", error);
      res.status(500).json({ message: "Failed to get upload URL" });
    }
  });

  // Set ACL policy for uploaded task proof photo
  app.put("/api/tasks/:taskId/proof-photo", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { taskId } = req.params;
      const { photoUrl } = req.body;
      
      if (!photoUrl) {
        return res.status(400).json({ message: "photoUrl is required" });
      }
      
      // Use same member resolution logic as POST /complete to ensure consistency
      let member;
      if (req.session.actingAsMemberId) {
        member = await storage.getFamilyMember(req.session.actingAsMemberId);
        if (!member) {
          // If acting as member not found, clear the session and fall through
          delete req.session.actingAsMemberId;
        }
      }
      
      // If not acting as someone or actingAs member not found, use real user
      if (!member) {
        member = await storage.getFamilyMemberByUserId(userId);
      }
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      if (task.familyName !== member.familyName) {
        return res.status(403).json({ message: "Task not in your family" });
      }
      
      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        photoUrl,
        {
          owner: userId,
          visibility: "private", // Task proofs are private, only accessible by family members
        }
      );
      
      // Track this upload to prevent URL spoofing (same as old multer flow)
      uploadedPhotos.set(objectPath, {
        memberId: member.id,
        taskId: taskId,
        timestamp: Date.now(),
      });
      
      res.json({ photoUrl: objectPath });
    } catch (error: any) {
      console.error("Error setting task proof ACL:", error);
      res.status(500).json({ message: "Failed to set photo ACL" });
    }
  });

  app.post("/api/tasks/:taskId/complete", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { taskId } = req.params;
      const { proofPhotoUrl } = req.body;
      
      // Check if we're acting as another member
      let member;
      if (req.session.actingAsMemberId) {
        member = await storage.getFamilyMember(req.session.actingAsMemberId);
        if (!member) {
          // If acting as member not found, clear the session and fall through
          delete req.session.actingAsMemberId;
        }
      }
      
      // If not acting as someone or actingAs member not found, use real user
      if (!member) {
        member = await storage.getFamilyMemberByUserId(userId);
      }
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      if (task.familyName !== member.familyName) {
        return res.status(403).json({ message: "Forbidden: Task not in your family" });
      }
      
      if (task.status !== "active") {
        return res.status(422).json({ message: "Validation failed: Task is not active" });
      }
      
      // For multi-completion tasks, prevent the same member from completing twice
      if (task.maxCompletions !== null && task.maxCompletions > 1) {
        const hasAlreadyCompleted = await storage.hasActiveMemberCompletion(taskId, member.id);
        if (hasAlreadyCompleted) {
          return res.status(422).json({ message: "Validation failed: You have already completed this task" });
        }
      }
      
      // Validate photo proof
      if (task.requiresProof) {
        if (!proofPhotoUrl) {
          return res.status(422).json({ message: "Validation failed: Photo proof is required" });
        }
        
        // Verify the photo was uploaded for this task and family
        const uploadData = uploadedPhotos.get(proofPhotoUrl);
        if (!uploadData || uploadData.taskId !== taskId) {
          return res.status(422).json({ message: "Validation failed: Invalid or expired photo proof" });
        }
        
        // Verify the uploader and completer are both in the same family
        const uploader = await storage.getFamilyMember(uploadData.memberId);
        if (!uploader || uploader.familyName !== member.familyName) {
          return res.status(422).json({ message: "Validation failed: Photo proof from different family" });
        }
        
        // Remove from tracking after verification
        uploadedPhotos.delete(proofPhotoUrl);
      }
      
      // Create completion record (handles approval, points, and completionCount in transaction)
      const completion = await storage.createTaskCompletion({
        taskId: task.id,
        memberId: member.id,
        pointsEarned: task.points,
        proofPhotoUrl: proofPhotoUrl || null,
      });
      
      // Handle recurring tasks
      if (task.recurrenceDays || task.recurrence !== "none") {
        // Get updated task to check completion count after the completion was processed
        const updatedTask = await storage.getTask(taskId);
        
        // For multi-completion tasks, only set nextAvailableDate if max completions reached
        // Otherwise, keep the task available for other children to complete
        const shouldSetNextAvailableDate = 
          !updatedTask?.maxCompletions || 
          (updatedTask.completionCount >= updatedTask.maxCompletions);
        
        if (shouldSetNextAvailableDate) {
          // Calculate next available date based on recurrence
          const now = new Date();
          let nextAvailableDate: Date;
          
          if (task.recurrenceDays) {
            // Custom days interval - set to midnight of the target day
            nextAvailableDate = new Date(now);
            nextAvailableDate.setDate(nextAvailableDate.getDate() + task.recurrenceDays);
            nextAvailableDate.setHours(0, 0, 0, 0);
          } else {
            // Standard recurrence (daily/weekly/monthly)
            switch (task.recurrence) {
              case "daily":
                // Set to midnight of the next calendar day
                nextAvailableDate = new Date(now);
                nextAvailableDate.setDate(nextAvailableDate.getDate() + 1);
                nextAvailableDate.setHours(0, 0, 0, 0);
                break;
              case "weekly":
                // Set to midnight 7 days from now
                nextAvailableDate = new Date(now);
                nextAvailableDate.setDate(nextAvailableDate.getDate() + 7);
                nextAvailableDate.setHours(0, 0, 0, 0);
                break;
              case "monthly":
                // Set to midnight of same date next month
                nextAvailableDate = new Date(now);
                nextAvailableDate.setMonth(nextAvailableDate.getMonth() + 1);
                nextAvailableDate.setHours(0, 0, 0, 0);
                break;
              case "yearly":
                // Set to midnight of same date next year
                nextAvailableDate = new Date(now);
                nextAvailableDate.setFullYear(nextAvailableDate.getFullYear() + 1);
                nextAvailableDate.setHours(0, 0, 0, 0);
                break;
              default:
                // Default to midnight tomorrow
                nextAvailableDate = new Date(now);
                nextAvailableDate.setDate(nextAvailableDate.getDate() + 1);
                nextAvailableDate.setHours(0, 0, 0, 0);
            }
          }
          
          // Update the task's nextAvailableDate - task stays visible but unavailable
          await storage.updateTaskNextAvailableDate(taskId, nextAvailableDate);
        }
      } else if (task.maxCompletions === null) {
        // Only non-recurring, non-multi-completion tasks are marked as completed immediately
        // Multi-completion tasks manage their own status in _approveCompletionInternal
        await storage.updateTaskStatus(taskId, "completed");
      }
      
      // Get updated member data
      const updatedMember = await storage.getFamilyMember(member.id);
      
      // Broadcast appropriate message based on whether approval was required
      if (task.requiresApproval) {
        // Broadcast pending completion to family (so parents know to approve)
        broadcastToFamily(member.familyName, {
          type: "task_completion_pending",
          taskId: task.id,
          completionId: completion.id,
          member: updatedMember,
          pointsEarned: task.points,
        });
      } else {
        // Broadcast auto-approved completion
        broadcastToFamily(member.familyName, {
          type: "task_completion_approved",
          taskId: task.id,
          completionId: completion.id,
          member: updatedMember,
          pointsEarned: task.points,
        });
      }
      
      res.json({
        success: true,
        message: task.requiresApproval 
          ? "Task completion submitted! Awaiting parent approval."
          : `Great job! You earned ${task.points} points!`,
        completion,
        autoApproved: !task.requiresApproval,
      });
    } catch (error: any) {
      console.error("Error completing task:", error);
      res.status(500).json({ message: "Failed to complete task" });
    }
  });

  // Task approval routes
  app.get("/api/tasks/completions/pending", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const member = await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Only parents can view pending completions
      if (member.role !== "parent") {
        return res.status(403).json({ message: "Only parents can view pending completions" });
      }
      
      const pendingCompletions = await storage.getPendingCompletionsByFamily(member.familyName);
      res.json(pendingCompletions);
    } catch (error: any) {
      console.error("Error fetching pending completions:", error);
      res.status(500).json({ message: "Failed to fetch pending completions" });
    }
  });

  app.post("/api/tasks/completions/:completionId/approve", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { completionId } = req.params;
      
      const member = await storage.getFamilyMemberByUserId(userId);
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Only parents can approve completions
      if (member.role !== "parent") {
        return res.status(403).json({ message: "Only parents can approve task completions" });
      }
      
      // Get the completion to verify it exists and get details
      const completion = await storage.getTaskCompletion(completionId);
      if (!completion) {
        return res.status(404).json({ message: "Task completion not found" });
      }
      
      if (completion.status !== "pending") {
        return res.status(422).json({ message: "Task completion is not pending" });
      }
      
      // Get the child member to update their points
      const childMember = await storage.getFamilyMember(completion.memberId);
      if (!childMember) {
        return res.status(404).json({ message: "Child member not found" });
      }
      
      // Verify both are in the same family
      if (childMember.familyName !== member.familyName) {
        return res.status(403).json({ message: "Cannot approve completions from another family" });
      }
      
      // Award points to the child
      const newTotalEarned = childMember.totalEarned + completion.pointsEarned;
      const newTotalPoints = childMember.totalPoints + completion.pointsEarned;
      const newWeeklyPoints = childMember.weeklyPoints + completion.pointsEarned;
      const newMonthlyPoints = childMember.monthlyPoints + completion.pointsEarned;
      
      await storage.updateFamilyMemberPoints(
        childMember.id,
        newTotalEarned,
        newTotalPoints,
        newWeeklyPoints,
        newMonthlyPoints
      );
      
      // Add to points history
      const task = await storage.getTask(completion.taskId);
      await storage.addPointsHistory({
        memberId: childMember.id,
        points: completion.pointsEarned,
        reason: `Approved: ${task?.title || "Task"}`,
        taskId: completion.taskId,
      });
      
      // Mark completion as approved
      await storage.approveTaskCompletion(completionId, member.id);
      
      // Get updated member data
      const updatedChild = await storage.getFamilyMember(childMember.id);
      
      // Broadcast approval to family
      broadcastToFamily(member.familyName, {
        type: "task_completion_approved",
        completionId,
        taskId: completion.taskId,
        member: updatedChild,
        pointsEarned: completion.pointsEarned,
        approvedBy: member.displayName,
      });
      
      // Process achievement events
      await achievementEngine.processEvent({
        type: "task_approved",
        familyName: member.familyName,
        memberId: childMember.id,
        taskId: completion.taskId,
        pointsEarned: completion.pointsEarned,
      });
      
      res.json({
        success: true,
        message: "Task completion approved!",
        pointsAwarded: completion.pointsEarned,
        updatedMember: updatedChild,
      });
    } catch (error: any) {
      console.error("Error approving task completion:", error);
      res.status(500).json({ message: "Failed to approve task completion" });
    }
  });

  app.post("/api/tasks/completions/:completionId/reject", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { completionId } = req.params;
      const { reason } = req.body;
      
      const member = await storage.getFamilyMemberByUserId(userId);
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Only parents can reject completions
      if (member.role !== "parent") {
        return res.status(403).json({ message: "Only parents can reject task completions" });
      }
      
      // Get the completion to verify it exists
      const completion = await storage.getTaskCompletion(completionId);
      if (!completion) {
        return res.status(404).json({ message: "Task completion not found" });
      }
      
      if (completion.status !== "pending") {
        return res.status(422).json({ message: "Task completion is not pending" });
      }
      
      // Get the child member
      const childMember = await storage.getFamilyMember(completion.memberId);
      if (!childMember) {
        return res.status(404).json({ message: "Child member not found" });
      }
      
      // Verify both are in the same family
      if (childMember.familyName !== member.familyName) {
        return res.status(403).json({ message: "Cannot reject completions from another family" });
      }
      
      // Mark completion as rejected
      await storage.rejectTaskCompletion(completionId, member.id, reason || "Did not meet expectations");
      
      // Clear the task's nextAvailableDate so it becomes immediately available again
      // (For recurring tasks that were set to next recurrence date when completed)
      await storage.updateTaskNextAvailableDate(completion.taskId, null as any);
      
      // Broadcast rejection to family
      broadcastToFamily(member.familyName, {
        type: "task_completion_rejected",
        completionId,
        taskId: completion.taskId,
        memberId: childMember.id,
        rejectedBy: member.displayName,
        reason: reason || "Did not meet expectations",
      });
      
      // Process achievement events
      await achievementEngine.processEvent({
        type: "task_rejected",
        familyName: member.familyName,
        memberId: childMember.id,
        taskId: completion.taskId,
      });
      
      res.json({
        success: true,
        message: "Task completion rejected",
      });
    } catch (error: any) {
      console.error("Error rejecting task completion:", error);
      res.status(500).json({ message: "Failed to reject task completion" });
    }
  });

  // Reward routes
  app.get("/api/rewards", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const member = await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      const rewards = await storage.getRewardsByFamily(member.familyName);
      res.json(rewards);
    } catch (error) {
      console.error("Error fetching rewards:", error);
      res.status(500).json({ message: "Failed to fetch rewards" });
    }
  });

  app.post("/api/rewards", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const member = await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Only parents can create rewards
      if (member.role !== "parent") {
        return res.status(403).json({ message: "Only parents can create rewards" });
      }
      
      const parsed = insertRewardSchema.parse(req.body);
      const reward = await storage.createReward(parsed);
      
      // Broadcast new reward to family
      broadcastToFamily(member.familyName, {
        type: "reward_created",
        reward,
      });
      
      res.json(reward);
    } catch (error: any) {
      console.error("Error creating reward:", error);
      res.status(400).json({ message: error.message || "Failed to create reward" });
    }
  });

  // Update a reward
  app.put("/api/rewards/:rewardId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { rewardId } = req.params;
      
      const member = await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Only parents can edit rewards
      if (member.role !== "parent") {
        return res.status(403).json({ message: "Only parents can edit rewards" });
      }
      
      // Verify reward belongs to this family
      const rewards = await storage.getRewardsByFamily(member.familyName);
      const reward = rewards.find(r => r.id === rewardId);
      
      if (!reward) {
        return res.status(404).json({ message: "Reward not found" });
      }
      
      const updateData = insertRewardSchema.parse(req.body);
      const updatedReward = await storage.updateReward(rewardId, updateData);
      
      // Broadcast update to all family members
      broadcastToFamily(member.familyName, {
        type: "reward_updated",
        reward: updatedReward,
      });
      
      res.json(updatedReward);
    } catch (error: any) {
      console.error("Error updating reward:", error);
      res.status(400).json({ message: error.message || "Failed to update reward" });
    }
  });

  // Delete a reward
  app.delete("/api/rewards/:rewardId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { rewardId } = req.params;
      
      const member = await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Only parents can delete rewards
      if (member.role !== "parent") {
        return res.status(403).json({ message: "Only parents can delete rewards" });
      }
      
      // Verify reward belongs to this family
      const rewards = await storage.getRewardsByFamily(member.familyName);
      const reward = rewards.find(r => r.id === rewardId);
      
      if (!reward) {
        return res.status(404).json({ message: "Reward not found" });
      }
      
      await storage.deleteReward(rewardId);
      
      // Broadcast reward deletion to family
      broadcastToFamily(member.familyName, {
        type: "reward_deleted",
        rewardId,
      });
      
      res.json({ message: "Reward deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting reward:", error);
      res.status(500).json({ message: "Failed to delete reward" });
    }
  });

  // Redeem a reward
  app.post("/api/rewards/:rewardId/redeem", isAuthenticated, async (req: any, res) => {
    console.log('🎯 POST /api/rewards/:rewardId/redeem called');
    console.log('   rewardId:', req.params.rewardId);
    console.log('   userId:', req.user?.claims?.sub);
    
    try {
      const userId = req.user.claims.sub;
      const { rewardId } = req.params;
      
      console.log('   Checking for acting member...');
      // Use acting member if available, otherwise use authenticated user
      const actingMemberId = req.session.actingAsMemberId;
      const member = actingMemberId 
        ? await storage.getFamilyMemberById(actingMemberId)
        : await storage.getFamilyMemberByUserId(userId);
      
      console.log('   Member found:', member ? `${member.displayName} (${member.id})` : 'null');
      console.log('   Member role:', member?.role);
      
      if (!member) {
        console.log('   ❌ Member not found');
        return res.status(404).json({ message: "Family member not found" });
      }
      
      console.log('   Fetching rewards for family:', member.familyName);
      // Get the reward
      const rewards = await storage.getRewardsByFamily(member.familyName);
      console.log('   Found rewards:', rewards.length);
      const reward = rewards.find(r => r.id === rewardId);
      
      console.log('   Reward found:', reward ? `${reward.title} (${reward.id})` : 'null');
      
      if (!reward) {
        console.log('   ❌ Reward not found in family rewards');
        return res.status(404).json({ message: "Reward not found" });
      }
      
      if (!reward.isActive) {
        return res.status(400).json({ message: "Reward is not active" });
      }
      
      // Check if member has enough points
      if (member.totalPoints < reward.pointThreshold) {
        return res.status(400).json({ 
          message: `Not enough points. Need ${reward.pointThreshold}, have ${member.totalPoints}` 
        });
      }
      
      // Immediate redemption (auto-approved, points deducted immediately for everyone)
      console.log('   Redemption - deducting points and auto-approving');
      // Deduct points ONLY from available balance (totalPoints)
      // Weekly/Monthly points represent "earned this period" and should never decrease
      const newTotalEarned = member.totalEarned; // Lifetime achievement never decreases
      const newTotalPoints = member.totalPoints - reward.pointThreshold; // Only this decreases
      const newWeeklyPoints = member.weeklyPoints; // Stays the same - earned this week
      const newMonthlyPoints = member.monthlyPoints; // Stays the same - earned this month
      await storage.updateFamilyMemberPoints(
        member.id,
        newTotalEarned,
        newTotalPoints,
        newWeeklyPoints,
        newMonthlyPoints
      );
      
      // Create redemption record
      const redemption = await storage.createRewardRedemption({
        rewardId: reward.id,
        memberId: member.id,
        pointsSpent: reward.pointThreshold,
        originalPointsSpent: reward.pointThreshold,
        sharingStatus: "not_shared",
        status: "approved",
      });
      
      // Add to points history
      await storage.addPointsHistory({
        memberId: member.id,
        points: -reward.pointThreshold,
        reason: `Redeemed: ${reward.title}`,
        taskId: null,
      });
      
      // Increment rewards redeemed counter (kept for analytics)
      await storage.incrementRewardsRedeemed(member.id);
      
      // Broadcast redemption to family
      broadcastToFamily(member.familyName, {
        type: "reward_redeemed",
        redemption,
        member: { ...member, totalPoints: newTotalPoints },
      });
      
      res.json({ 
        redemption: {
          ...redemption,
          rewardTitle: reward.title,
        },
        newTotalPoints,
        message: `Successfully redeemed ${reward.title}!` 
      });
    } catch (error: any) {
      console.error("Error redeeming reward:", error);
      res.status(500).json({ message: "Failed to redeem reward" });
    }
  });

  // Get reward redemptions for current family
  app.get("/api/reward-redemptions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const actingMemberId = req.session.actingAsMemberId;
      const member = actingMemberId 
        ? await storage.getFamilyMemberById(actingMemberId)
        : await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      const redemptions = await storage.getRewardRedemptionsByFamily(member.familyName);
      
      // Get all rewards to attach reward titles
      const rewards = await storage.getRewardsByFamily(member.familyName);
      const rewardsMap = new Map(rewards.map(r => [r.id, r]));
      
      // Attach reward titles to redemptions
      const redemptionsWithTitles = redemptions.map(redemption => ({
        ...redemption,
        rewardTitle: rewardsMap.get(redemption.rewardId)?.title || "Belohnung",
      }));
      
      res.json(redemptionsWithTitles);
    } catch (error) {
      console.error("Error fetching redemptions:", error);
      res.status(500).json({ message: "Failed to fetch redemptions" });
    }
  });

  // Update reward redemption status (parents only)
  app.patch("/api/reward-redemptions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const { status } = req.body;

      // Get real member (not acting member) to check permissions
      const member = await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }

      // Only parents can update redemption status
      if (member.role !== "parent") {
        return res.status(403).json({ message: "Only parents can update reward status" });
      }

      // Validate status
      if (!["pending", "approved", "completed"].includes(status)) {
        return res.status(400).json({ message: "Invalid status. Must be: pending, approved, or completed" });
      }

      // Get the redemption to verify it belongs to the same family
      const familyRedemptions = await storage.getRewardRedemptionsByFamily(member.familyName);
      const redemption = familyRedemptions.find(r => r.id === id);

      if (!redemption) {
        return res.status(404).json({ message: "Redemption not found" });
      }

      // Update the redemption status
      await storage.updateRewardRedemptionStatus(id, status);

      // If approved, increment rewards redeemed counter (kept for analytics)
      if (status === "approved" && redemption.status !== "approved") {
        const fullMember = await storage.getFamilyMemberById(redemption.memberId);
        if (fullMember) {
          await storage.incrementRewardsRedeemed(fullMember.id);
        }
      }

      // Broadcast update to family
      broadcastToFamily(member.familyName, {
        type: "redemption_updated",
        redemptionId: id,
        status,
      });

      res.json({ message: "Redemption status updated successfully", status });
    } catch (error) {
      console.error("Error updating redemption:", error);
      res.status(500).json({ message: "Failed to update redemption" });
    }
  });

  // Create a reward request (children only)
  app.post("/api/reward-requests", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { title, description, pointThreshold } = req.body;
      
      // Use acting member if available, otherwise use authenticated user
      const actingMemberId = req.session.actingAsMemberId;
      const member = actingMemberId 
        ? await storage.getFamilyMemberById(actingMemberId)
        : await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Validate input
      if (!title || !pointThreshold || pointThreshold < 1) {
        return res.status(400).json({ message: "Invalid request data" });
      }
      
      // Create the request
      const request = await storage.createRewardRequest({
        familyName: member.familyName,
        requestedBy: member.id,
        title,
        description: description || null,
        pointThreshold,
        status: "pending",
      });
      
      // Broadcast to family (especially parents)
      broadcastToFamily(member.familyName, {
        type: "reward_request_created",
        request,
        requester: {
          id: member.id,
          displayName: member.displayName,
          avatarUrl: member.avatarUrl,
          color: member.color,
        },
      });
      
      res.status(201).json(request);
    } catch (error: any) {
      console.error("Error creating reward request:", error);
      res.status(500).json({ message: "Failed to create reward request" });
    }
  });

  // Get all reward requests for the current family
  app.get("/api/reward-requests", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const member = await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      const requests = await storage.getRewardRequestsByFamily(member.familyName);
      res.json(requests);
    } catch (error: any) {
      console.error("Error fetching reward requests:", error);
      res.status(500).json({ message: "Failed to fetch reward requests" });
    }
  });

  // Update a reward request (parents only)
  app.patch("/api/reward-requests/:requestId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { requestId } = req.params;
      const { title, description, pointThreshold } = req.body;
      
      // Get authenticated user's member (not acting member)
      const member = await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Only parents can edit requests
      if (member.role !== "parent") {
        return res.status(403).json({ message: "Only parents can edit reward requests" });
      }
      
      // Get the request
      const requests = await storage.getRewardRequestsByFamily(member.familyName);
      const request = requests.find(r => r.id === requestId);
      
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }
      
      if (request.status !== "pending") {
        return res.status(400).json({ message: "Only pending requests can be edited" });
      }
      
      // Validate input
      if (!title || !pointThreshold || pointThreshold < 1) {
        return res.status(400).json({ message: "Invalid request data" });
      }
      
      // Update the request
      await storage.updateRewardRequest(requestId, {
        title,
        description: description || null,
        pointThreshold,
      });
      
      // Broadcast the update
      broadcastToFamily(member.familyName, {
        type: "reward_request_updated",
        requestId,
      });
      
      res.json({ message: "Request updated successfully" });
    } catch (error: any) {
      console.error("Error updating reward request:", error);
      res.status(500).json({ message: "Failed to update reward request" });
    }
  });

  // Approve or decline a reward request (parents only)
  app.patch("/api/reward-requests/:requestId/:action", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { requestId, action } = req.params;
      
      if (action !== "approve" && action !== "decline") {
        return res.status(400).json({ message: "Invalid action" });
      }
      
      // Get authenticated user's member (not acting member)
      const member = await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Only parents can approve/decline requests
      if (member.role !== "parent") {
        return res.status(403).json({ message: "Only parents can review reward requests" });
      }
      
      // Get the request
      const requests = await storage.getRewardRequestsByFamily(member.familyName);
      const request = requests.find(r => r.id === requestId);
      
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }
      
      if (request.status !== "pending") {
        return res.status(400).json({ message: "Request has already been reviewed" });
      }
      
      const newStatus = action === "approve" ? "approved" : "declined";
      
      // Update the request status
      await storage.updateRewardRequestStatus(requestId, newStatus, member.id);
      
      // If approved, create the actual reward
      if (action === "approve") {
        const reward = await storage.createReward({
          familyName: member.familyName,
          title: request.title,
          description: request.description || null,
          pointThreshold: request.pointThreshold,
          isActive: true,
        });
        
        // Broadcast the new reward
        broadcastToFamily(member.familyName, {
          type: "reward_created",
          reward,
        });
      }
      
      // Broadcast the request update
      broadcastToFamily(member.familyName, {
        type: "reward_request_updated",
        requestId,
        status: newStatus,
      });
      
      res.json({ message: `Request ${newStatus}`, status: newStatus });
    } catch (error: any) {
      console.error("Error updating reward request:", error);
      res.status(500).json({ message: "Failed to update reward request" });
    }
  });

  // Reward sharing routes
  // Start sharing a reward
  app.post("/api/rewards/redemptions/:redemptionId/share", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { redemptionId } = req.params;
      
      // Use acting member if available
      const actingMemberId = req.session.actingAsMemberId;
      const member = actingMemberId 
        ? await storage.getFamilyMemberById(actingMemberId)
        : await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Get the redemption
      const redemption = await storage.getRewardRedemption(redemptionId);
      if (!redemption) {
        return res.status(404).json({ message: "Redemption not found" });
      }
      
      // Only the person who redeemed can start sharing
      if (redemption.memberId !== member.id) {
        return res.status(403).json({ message: "Only the original redeemer can start sharing" });
      }
      
      // Can't share if already sharing or finalized
      if (redemption.sharingStatus !== "not_shared") {
        return res.status(400).json({ message: "Reward is already being shared or has been finalized" });
      }
      
      // Start sharing
      await storage.startRewardSharing(redemptionId);
      
      // Broadcast to family
      broadcastToFamily(member.familyName, {
        type: "reward_sharing_started",
        redemptionId,
        memberId: member.id,
        memberName: member.displayName,
      });
      
      res.json({ message: "Reward sharing started!", redemptionId });
    } catch (error: any) {
      console.error("Error starting reward sharing:", error);
      res.status(500).json({ message: "Failed to start reward sharing" });
    }
  });

  // Join a shared reward
  app.post("/api/rewards/redemptions/:redemptionId/join", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { redemptionId } = req.params;
      
      // Use acting member if available
      const actingMemberId = req.session.actingAsMemberId;
      const member = actingMemberId 
        ? await storage.getFamilyMemberById(actingMemberId)
        : await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Get the redemption
      const redemption = await storage.getRewardRedemption(redemptionId);
      if (!redemption) {
        return res.status(404).json({ message: "Redemption not found" });
      }
      
      // Can only join if sharing is active
      if (redemption.sharingStatus !== "sharing_active") {
        return res.status(400).json({ message: "Sharing is not active for this reward" });
      }
      
      // Can't join your own redemption
      if (redemption.memberId === member.id) {
        return res.status(400).json({ message: "You can't join your own shared reward" });
      }
      
      // Check if member has enough points to participate
      // Get current participants to calculate cost per person
      const currentParticipants = await storage.getRewardSharingParticipants(redemptionId);
      const totalParticipants = currentParticipants.length + 2; // existing participants + new participant + original buyer
      const pointsPerPerson = Math.ceil(redemption.originalPointsSpent / totalParticipants);
      
      if (member.totalPoints < pointsPerPerson) {
        return res.status(400).json({ 
          message: `Du hast nicht genug Punkte zum Mitmachen. Du brauchst ${pointsPerPerson} Punkte, hast aber nur ${member.totalPoints}.`
        });
      }
      
      // Join the sharing
      const participant = await storage.joinRewardSharing(redemptionId, member.id);
      
      // Broadcast to family
      broadcastToFamily(member.familyName, {
        type: "reward_sharing_joined",
        redemptionId,
        memberId: member.id,
        memberName: member.displayName,
      });
      
      res.json({ 
        message: "You joined the shared reward!", 
        participant,
      });
    } catch (error: any) {
      console.error("Error joining shared reward:", error);
      res.status(500).json({ message: "Failed to join shared reward" });
    }
  });

  // Finalize a shared reward (calculate and distribute costs)
  app.post("/api/rewards/redemptions/:redemptionId/finalize", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { redemptionId } = req.params;
      
      // Use acting member if available
      const actingMemberId = req.session.actingAsMemberId;
      const member = actingMemberId 
        ? await storage.getFamilyMemberById(actingMemberId)
        : await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Get the redemption
      const redemption = await storage.getRewardRedemption(redemptionId);
      if (!redemption) {
        return res.status(404).json({ message: "Redemption not found" });
      }
      
      // Only the original redeemer can finalize
      if (redemption.memberId !== member.id) {
        return res.status(403).json({ message: "Only the original redeemer can finalize sharing" });
      }
      
      // Can only finalize if sharing is active
      if (redemption.sharingStatus !== "sharing_active") {
        return res.status(400).json({ message: "Sharing is not active for this reward" });
      }
      
      // Finalize sharing (this handles all point calculations)
      await storage.finalizeRewardSharing(redemptionId);
      
      // Get updated participants list
      const participants = await storage.getRewardSharingParticipants(redemptionId);
      
      // Broadcast to family
      broadcastToFamily(member.familyName, {
        type: "reward_sharing_finalized",
        redemptionId,
        participants,
      });
      
      res.json({ 
        message: "Sharing finalized! Points have been distributed.",
        participants,
      });
    } catch (error: any) {
      console.error("Error finalizing shared reward:", error);
      res.status(500).json({ message: error.message || "Failed to finalize shared reward" });
    }
  });

  // Get all active shared rewards for family
  app.get("/api/rewards/shared", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const actingMemberId = req.session.actingAsMemberId;
      const member = actingMemberId 
        ? await storage.getFamilyMemberById(actingMemberId)
        : await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      const sharedRewards = await storage.getActiveSharedRewards(member.familyName);
      
      res.json(sharedRewards);
    } catch (error: any) {
      console.error("Error getting shared rewards:", error);
      res.status(500).json({ message: "Failed to get shared rewards" });
    }
  });

  // Skins routes
  app.get("/api/skins", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const actingMemberId = req.session.actingAsMemberId;
      const member = actingMemberId 
        ? await storage.getFamilyMemberById(actingMemberId)
        : await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      const allSkins = await storage.getSkins();
      const discoveredSkinIds = member.discoveredSkinIds || [];
      
      // Calculate available discovery cards using tier-based system
      const availableCards = calculateAvailableCards(member.totalEarned, discoveredSkinIds.length);
      
      // Determine which package tiers are unlocked based on total earned points
      const unlockedTier = getUnlockedTier(member.totalEarned);
      
      // Enrich skins with discovery status for this member
      const skinsWithStatus = allSkins.map(skin => {
        const isDiscovered = discoveredSkinIds.includes(skin.id);
        const isActive = member.activeSkinId === skin.id;
        
        // Determine skin tier using centralized function
        const skinTier = getSkinTier(skin.id);
        
        // Can discover if: package is unlocked AND not already discovered AND has available cards
        const canDiscover = skinTier <= unlockedTier && !isDiscovered && availableCards > 0;
        
        return {
          ...skin,
          isDiscovered,
          isActive,
          canDiscover,
          tier: skinTier,
        };
      });
      
      // Debug log to check tier distribution
      const tierCounts = skinsWithStatus.reduce((acc, skin) => {
        acc[skin.tier] = (acc[skin.tier] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);
      console.log(`🎨 Skins API: totalEarned=${member.totalEarned}, unlockedTier=${unlockedTier}, tierCounts:`, tierCounts);
      
      res.json({
        skins: skinsWithStatus,
        totalEarned: member.totalEarned,
        availableCards,
        unlockedTier,
      });
    } catch (error: any) {
      console.error("Error fetching skins:", error);
      res.status(500).json({ message: "Failed to fetch skins" });
    }
  });

  app.post("/api/skins/discover", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { skinId } = req.body;
      
      const actingMemberId = req.session.actingAsMemberId;
      const member = actingMemberId 
        ? await storage.getFamilyMemberById(actingMemberId)
        : await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      const allSkins = await storage.getSkins();
      const skin = allSkins.find(s => s.id === skinId);
      
      if (!skin) {
        return res.status(404).json({ message: "Skin not found" });
      }
      
      const discoveredSkinIds = member.discoveredSkinIds || [];
      
      // Check if already discovered
      if (discoveredSkinIds.includes(skinId)) {
        return res.status(400).json({ message: "Skin already discovered" });
      }
      
      // Calculate available cards using tier-based system
      const availableCards = calculateAvailableCards(member.totalEarned, discoveredSkinIds.length);
      
      if (availableCards <= 0) {
        return res.status(403).json({ message: "No discovery cards available" });
      }
      
      // Check if skin's package tier is unlocked
      const unlockedTier = getUnlockedTier(member.totalEarned);
      
      // Determine skin tier using centralized function
      const skinTier = getSkinTier(skinId);
      
      if (skinTier > unlockedTier) {
        return res.status(403).json({ message: "Skin package not unlocked yet" });
      }
      
      // Add skin to discovered list
      const updatedDiscoveredSkins = [...discoveredSkinIds, skinId];
      await storage.updateFamilyMember(member.id, {
        discoveredSkinIds: updatedDiscoveredSkins,
      });
      
      // Award bonus points if this skin has them
      const bonusPoints = skin.bonusPoints || 0;
      if (bonusPoints > 0) {
        await storage.updateFamilyMemberPoints(
          member.id,
          member.totalEarned + bonusPoints,
          member.totalPoints + bonusPoints,
          member.weeklyPoints + bonusPoints,
          member.monthlyPoints + bonusPoints
        );
      }
      
      // Broadcast skin discovery to family
      broadcastToFamily(member.familyName, {
        type: "skin_discovered",
        memberId: member.id,
        skinId,
        bonusPoints,
      });
      
      res.json({ 
        message: "Skin discovered!", 
        skinId,
        bonusPoints,
        availableCards: availableCards - 1,
      });
    } catch (error: any) {
      console.error("Error discovering skin:", error);
      res.status(500).json({ message: "Failed to discover skin" });
    }
  });

  app.post("/api/skins/select", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { skinId } = req.body;
      
      const actingMemberId = req.session.actingAsMemberId;
      const member = actingMemberId 
        ? await storage.getFamilyMemberById(actingMemberId)
        : await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Allow null to reset to default avatar, otherwise verify skin is discovered
      if (skinId !== null) {
        const discoveredSkinIds = member.discoveredSkinIds || [];
        
        if (!discoveredSkinIds.includes(skinId)) {
          return res.status(403).json({ message: "Skin not discovered yet - discover it first!" });
        }
      }
      
      // When selecting a skin, always show the skin's default avatar
      // When clearing (skinId = null), preserve the useCustomAvatar flag
      await storage.updateFamilyMemberActiveSkin(member.id, {
        skinId,
        useCustomAvatar: skinId !== null ? false : undefined
      });
      
      // Broadcast skin change to family
      broadcastToFamily(member.familyName, {
        type: "skin_changed",
        memberId: member.id,
        skinId,
      });
      
      res.json({ message: skinId ? "Skin selected" : "Reset to default avatar", skinId });
    } catch (error: any) {
      console.error("Error selecting skin:", error);
      res.status(500).json({ message: "Failed to select skin" });
    }
  });

  // Analytics route - Family tier and above
  app.get("/api/analytics", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const member = await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Check if parent
      if (member.role !== "parent") {
        return res.status(403).json({ message: "Only parents can access analytics" });
      }
      
      // Get family tier and check if analytics is allowed
      const family = await storage.getFamily(member.familyName);
      if (!family) {
        return res.status(404).json({ message: "Family not found" });
      }
      
      // Check tier access (Family tier and above)
      if (!hasFeature(family.subscriptionTier as SubscriptionTier, "advancedAnalytics")) {
        return res.status(403).json({ 
          message: "Analytics is only available for Family tier and above",
          tier: family.subscriptionTier,
          requiredTier: "family"
        });
      }
      
      // Fetch analytics data
      const analytics = await storage.getAnalytics(member.familyName);
      
      res.json(analytics);
    } catch (error: any) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Chat endpoints (Family+ and Family Hero tier)
  app.get("/api/chat", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const member = await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Get family tier and check if chat is allowed
      const family = await storage.getFamily(member.familyName);
      if (!family) {
        return res.status(404).json({ message: "Family not found" });
      }
      
      // Check tier access (Family+ tier and above)
      if (!hasFeature(family.subscriptionTier as SubscriptionTier, "familyChat")) {
        return res.status(403).json({ 
          message: "Family chat is only available for Family+ tier and above",
          tier: family.subscriptionTier,
          requiredTier: "family_plus"
        });
      }
      
      // Fetch chat messages with clamped limit
      const rawLimit = parseInt(req.query.limit as string) || 50;
      const limit = Math.min(Math.max(rawLimit, 1), 100); // Clamp between 1 and 100
      const messages = await storage.getChatMessages(member.familyName, limit);
      
      res.json(messages);
    } catch (error: any) {
      console.error("Error fetching chat messages:", error);
      res.status(500).json({ message: "Failed to fetch chat messages" });
    }
  });

  app.post("/api/chat", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const member = await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Get family tier and check if chat is allowed
      const family = await storage.getFamily(member.familyName);
      if (!family) {
        return res.status(404).json({ message: "Family not found" });
      }
      
      // Check tier access (Family+ tier and above)
      if (!hasFeature(family.subscriptionTier as SubscriptionTier, "familyChat")) {
        return res.status(403).json({ 
          message: "Family chat is only available for Family+ tier and above",
          tier: family.subscriptionTier,
          requiredTier: "family_plus"
        });
      }
      
      // Validate request using schema
      const validationResult = insertChatMessageSchema.safeParse({
        familyName: member.familyName,
        memberId: member.id,
        message: req.body.message,
      });
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid message data",
          errors: validationResult.error.errors 
        });
      }
      
      // Additional validation for message length
      if (validationResult.data.message.length > 1000) {
        return res.status(400).json({ message: "Message too long (max 1000 characters)" });
      }
      
      // Create chat message
      const newMessage = await storage.createChatMessage(validationResult.data);
      
      // Broadcast to family via WebSocket
      broadcastToFamily(member.familyName, {
        type: "chat_message",
        message: {
          id: newMessage.id,
          message: newMessage.message,
          createdAt: newMessage.createdAt,
          memberId: member.id,
          memberName: member.displayName,
          memberColor: member.color,
          memberAvatarUrl: member.avatarUrl,
          memberActiveSkinId: member.activeSkinId,
        },
      });
      
      res.status(201).json(newMessage);
    } catch (error: any) {
      console.error("Error creating chat message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // Get pending approvals count (for parents)
  app.get("/api/tasks/pending-count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const member = await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Only parents can see pending count
      if (member.role !== "parent") {
        return res.json({ count: 0 });
      }
      
      const pendingCompletions = await storage.getPendingCompletionsByFamily(member.familyName);
      res.json({ count: pendingCompletions.length });
    } catch (error: any) {
      console.error("Error fetching pending approvals count:", error);
      res.status(500).json({ message: "Failed to fetch pending count" });
    }
  });

  // Get unread message count
  app.get("/api/chat/unread-count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const member = await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Get family tier and check if chat is allowed
      const family = await storage.getFamily(member.familyName);
      if (!family) {
        return res.status(404).json({ message: "Family not found" });
      }
      
      // Check tier access (Family+ tier and above)
      if (!hasFeature(family.subscriptionTier as SubscriptionTier, "familyChat")) {
        return res.json({ count: 0 }); // Return 0 if feature not available
      }
      
      const count = await storage.getUnreadMessageCount(member.id, member.familyName);
      res.json({ count });
    } catch (error: any) {
      console.error("Error getting unread message count:", error);
      res.status(500).json({ message: "Failed to get unread count" });
    }
  });

  // Mark chat messages as read
  app.post("/api/chat/mark-read", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const member = await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      await storage.updateLastReadChatAt(member.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error marking messages as read:", error);
      res.status(500).json({ message: "Failed to mark messages as read" });
    }
  });

  // Get pending reward redemptions count (for parents)
  app.get("/api/reward-redemptions/pending-count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const member = await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Only parents can see pending rewards count
      if (member.role !== "parent") {
        return res.json({ count: 0 });
      }
      
      const redemptions = await storage.getRewardRedemptionsByFamily(member.familyName);
      // Count redemptions that are not yet fulfilled (completed)
      const pendingCount = redemptions.filter(r => r.status !== "completed").length;
      
      res.json({ count: pendingCount });
    } catch (error: any) {
      console.error("Error fetching pending rewards count:", error);
      res.status(500).json({ message: "Failed to fetch pending rewards count" });
    }
  });

  // ===== Achievement System =====

  // Get achievement definitions for family
  app.get("/api/achievements", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const member = await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      const definitions = await storage.getAchievementDefinitionsByFamily(member.familyName);
      res.json(definitions);
    } catch (error: any) {
      console.error("Error fetching achievement definitions:", error);
      res.status(500).json({ message: "Failed to fetch achievement definitions" });
    }
  });

  // Seed default achievements for family (parent only)
  app.post("/api/achievements/seed", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const member = await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Only parents can seed achievements
      if (member.role !== "parent") {
        return res.status(403).json({ message: "Only parents can seed achievements" });
      }
      
      // Check if achievements already exist
      const existing = await storage.getAchievementDefinitionsByFamily(member.familyName);
      if (existing.length > 0) {
        return res.status(400).json({ message: "Achievements already exist for this family" });
      }
      
      // Create default achievements
      const definitions = await storage.seedDefaultAchievements(member.familyName);
      
      // Broadcast to family
      broadcastToFamily(member.familyName, {
        type: "achievements_seeded",
        count: definitions.length,
      });
      
      res.status(201).json({ 
        message: "Default achievements created successfully",
        achievements: definitions,
        count: definitions.length 
      });
    } catch (error: any) {
      console.error("Error seeding achievements:", error);
      res.status(500).json({ message: "Failed to seed achievements" });
    }
  });

  // Create achievement definition (parent only)
  app.post("/api/achievements", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const member = await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Only parents can create achievements
      if (member.role !== "parent") {
        return res.status(403).json({ message: "Only parents can create achievements" });
      }
      
      const parsed = insertAchievementDefinitionSchema.parse({
        ...req.body,
        familyName: member.familyName,
      });
      
      const definition = await storage.createAchievementDefinition(parsed);
      
      // Broadcast to family
      broadcastToFamily(member.familyName, {
        type: "achievement_created",
        definition,
      });
      
      res.status(201).json(definition);
    } catch (error: any) {
      console.error("Error creating achievement definition:", error);
      res.status(400).json({ message: error.message || "Failed to create achievement definition" });
    }
  });

  // Update achievement definition (parent only)
  app.patch("/api/achievements/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      
      const member = await storage.getFamilyMemberByUserId(userId);
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Only parents can update achievements
      if (member.role !== "parent") {
        return res.status(403).json({ message: "Only parents can update achievements" });
      }
      
      // Verify achievement belongs to this family
      const definitions = await storage.getAchievementDefinitionsByFamily(member.familyName);
      const existing = definitions.find(d => d.id === id);
      
      if (!existing) {
        return res.status(404).json({ message: "Achievement definition not found" });
      }
      
      const updated = await storage.updateAchievementDefinition(id, req.body);
      
      // Broadcast to family
      broadcastToFamily(member.familyName, {
        type: "achievement_updated",
        definition: updated,
      });
      
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating achievement definition:", error);
      res.status(400).json({ message: error.message || "Failed to update achievement definition" });
    }
  });

  // Delete achievement definition (parent only)
  app.delete("/api/achievements/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      
      const member = await storage.getFamilyMemberByUserId(userId);
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Only parents can delete achievements
      if (member.role !== "parent") {
        return res.status(403).json({ message: "Only parents can delete achievements" });
      }
      
      // Verify achievement belongs to this family
      const definitions = await storage.getAchievementDefinitionsByFamily(member.familyName);
      const existing = definitions.find(d => d.id === id);
      
      if (!existing) {
        return res.status(404).json({ message: "Achievement definition not found" });
      }
      
      await storage.deleteAchievementDefinition(id);
      
      // Broadcast to family
      broadcastToFamily(member.familyName, {
        type: "achievement_deleted",
        achievementId: id,
      });
      
      res.json({ message: "Achievement definition deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting achievement definition:", error);
      res.status(500).json({ message: "Failed to delete achievement definition" });
    }
  });

  // Get achievement awards history
  app.get("/api/achievements/awards", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const member = await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      const awards = await storage.getAchievementAwardsByFamily(member.familyName);
      res.json(awards);
    } catch (error: any) {
      console.error("Error fetching achievement awards:", error);
      res.status(500).json({ message: "Failed to fetch achievement awards" });
    }
  });

  // Get achievement awards for current member
  app.get("/api/achievements/my-awards", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Use acting member if available
      const actingMemberId = req.session.actingAsMemberId;
      const member = actingMemberId 
        ? await storage.getFamilyMemberById(actingMemberId)
        : await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      const awards = await storage.getAchievementAwardsByMember(member.id);
      res.json(awards);
    } catch (error: any) {
      console.error("Error fetching member achievement awards:", error);
      res.status(500).json({ message: "Failed to fetch achievement awards" });
    }
  });

  // ===== Family Goals =====
  
  // Get all family goals for the current family
  app.get("/api/family-goals", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Always use authenticated user
      const member = await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      const goals = await storage.getFamilyGoalsByFamily(member.familyName);
      res.json(goals);
    } catch (error: any) {
      console.error("Error fetching family goals:", error);
      res.status(500).json({ message: "Failed to fetch family goals" });
    }
  });

  // Get a specific family goal with contributions
  app.get("/api/family-goals/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      // Always use authenticated user
      const member = await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      const goal = await storage.getFamilyGoal(id);
      
      if (!goal || goal.familyName !== member.familyName) {
        return res.status(404).json({ message: "Family goal not found" });
      }
      
      // Calculate current period identifier
      const now = new Date();
      const period = goal.contributionPeriod === "weekly"
        ? `${now.getFullYear()}-W${String(Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 604800000)).padStart(2, '0')}`
        : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      const contributions = await storage.getGoalContributionsByGoalAndPeriod(id, period);
      
      res.json({ goal, contributions, currentPeriod: period });
    } catch (error: any) {
      console.error("Error fetching family goal:", error);
      res.status(500).json({ message: "Failed to fetch family goal" });
    }
  });

  // Create a new family goal (parents only)
  app.post("/api/family-goals", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Always use authenticated user - never trust actingMemberId from client
      const member = await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Only parents can create family goals
      if (member.role !== "parent") {
        return res.status(403).json({ message: "Only parents can create family goals" });
      }
      
      // Validate request body with Zod
      const validatedData = insertFamilyGoalSchema.parse({
        ...req.body,
        familyName: member.familyName, // Always use authenticated member's family
        isActive: true,
      });
      
      const goal = await storage.createFamilyGoal(validatedData);
      
      // Broadcast to family via WebSocket
      broadcastToFamily(member.familyName, {
        type: 'family-goal-created',
        goal,
      });
      
      res.status(201).json(goal);
    } catch (error: any) {
      console.error("Error creating family goal:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create family goal" });
    }
  });

  // Update a family goal (parents only)
  app.put("/api/family-goals/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      // Always use authenticated user
      const member = await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Only parents can update family goals
      if (member.role !== "parent") {
        return res.status(403).json({ message: "Only parents can update family goals" });
      }
      
      const goal = await storage.getFamilyGoal(id);
      
      if (!goal || goal.familyName !== member.familyName) {
        return res.status(404).json({ message: "Family goal not found" });
      }
      
      const { title, description, targetPoints, contributionAmount, contributionPeriod, iconEmoji, isActive } = req.body;
      
      const updatedGoal = await storage.updateFamilyGoal(id, {
        title,
        description,
        targetPoints,
        contributionAmount,
        contributionPeriod,
        iconEmoji,
        isActive,
      });
      
      // Broadcast to family via WebSocket
      broadcastToFamily(member.familyName, {
        type: 'family-goal-updated',
        goal: updatedGoal,
      });
      
      res.json(updatedGoal);
    } catch (error: any) {
      console.error("Error updating family goal:", error);
      res.status(500).json({ message: "Failed to update family goal" });
    }
  });

  // Delete a family goal (parents only)
  app.delete("/api/family-goals/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      // Always use authenticated user
      const member = await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Only parents can delete family goals
      if (member.role !== "parent") {
        return res.status(403).json({ message: "Only parents can delete family goals" });
      }
      
      const goal = await storage.getFamilyGoal(id);
      
      if (!goal || goal.familyName !== member.familyName) {
        return res.status(404).json({ message: "Family goal not found" });
      }
      
      // Get all contributions to this goal for refund calculation
      const contributions = await storage.getGoalContributionsByGoal(id);
      
      // Group contributions by member and sum up their total contributions
      const contributionsByMember = new Map<string, number>();
      for (const contribution of contributions) {
        const current = contributionsByMember.get(contribution.memberId) || 0;
        contributionsByMember.set(contribution.memberId, current + contribution.points);
      }
      
      // Use database transaction to ensure atomicity of refunds and deletion
      await db.transaction(async (tx) => {
        // Refund points to each contributor within the transaction
        const refundPromises = Array.from(contributionsByMember.entries()).map(async ([memberId, refundAmount]) => {
          // Get fresh member data within transaction
          const [contributor] = await tx
            .select()
            .from(familyMembers)
            .where(eq(familyMembers.id, memberId));
          
          if (contributor) {
            // Update all point fields to match storage layer behavior
            await tx
              .update(familyMembers)
              .set({
                totalEarned: contributor.totalEarned,
                totalPoints: contributor.totalPoints + refundAmount,
                weeklyPoints: contributor.weeklyPoints,
                monthlyPoints: contributor.monthlyPoints,
                updatedAt: new Date(),
              })
              .where(eq(familyMembers.id, memberId));
          }
        });
        
        // Wait for all refunds to complete
        await Promise.all(refundPromises);
        
        // Delete the goal (contributions will be cascade deleted)
        await tx
          .delete(familyGoals)
          .where(eq(familyGoals.id, id));
      });
      
      // Broadcast to family via WebSocket after successful transaction
      broadcastToFamily(member.familyName, {
        type: 'family-goal-deleted',
        goalId: id,
      });
      
      // Invalidate member queries for point updates
      if (contributionsByMember.size > 0) {
        broadcastToFamily(member.familyName, {
          type: 'member-updated',
        });
      }
      
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting family goal:", error);
      res.status(500).json({ message: "Failed to delete family goal" });
    }
  });

  // Contribute points to a family goal
  app.post("/api/family-goals/:id/contribute", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Get current member (either acting as or real authenticated user)
      let member;
      if (req.session.actingAsMemberId) {
        member = await storage.getFamilyMember(req.session.actingAsMemberId);
      } else {
        const userId = req.user.claims.sub;
        member = await storage.getFamilyMemberByUserId(userId);
      }
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      const goal = await storage.getFamilyGoal(id);
      
      if (!goal || goal.familyName !== member.familyName) {
        return res.status(404).json({ message: "Family goal not found" });
      }
      
      if (!goal.isActive) {
        return res.status(400).json({ message: "This goal is no longer active" });
      }
      
      // Calculate current period
      const now = new Date();
      const period = goal.contributionPeriod === "weekly"
        ? `${now.getFullYear()}-W${String(Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 604800000)).padStart(2, '0')}`
        : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      // Check if member has already contributed this period
      const existingContribution = await storage.getGoalContributionsByMemberAndGoal(id, member.id, period);
      
      if (existingContribution) {
        return res.status(400).json({ message: "You have already contributed to this goal this period" });
      }
      
      // Check if member has enough points
      if (member.totalPoints < goal.contributionAmount) {
        return res.status(400).json({ message: "Insufficient points to contribute" });
      }
      
      // Deduct points from member and create contribution
      const newTotalPoints = member.totalPoints - goal.contributionAmount;
      
      await storage.updateFamilyMemberPoints(
        member.id,
        member.totalEarned,
        newTotalPoints,
        member.weeklyPoints,
        member.monthlyPoints
      );
      
      await storage.addPointsHistory({
        memberId: member.id,
        points: -goal.contributionAmount,
        reason: `Contributed to family goal: ${goal.title}`,
      });
      
      const contribution = await storage.contributeToGoal(id, member.id, goal.contributionAmount, period);
      
      // Update goal's current points
      const newCurrentPoints = goal.currentPoints + goal.contributionAmount;
      await storage.updateGoalCurrentPoints(id, newCurrentPoints);
      
      // Check if goal is complete
      if (newCurrentPoints >= goal.targetPoints) {
        await storage.completeGoal(id);
        
        // Broadcast goal completed event
        broadcastToFamily(member.familyName, {
          type: 'family-goal-completed',
          goalId: id,
        });
      }
      
      // Broadcast contribution event
      broadcastToFamily(member.familyName, {
        type: 'family-goal-contribution',
        goalId: id,
        memberId: member.id,
        contribution,
      });
      
      res.status(201).json(contribution);
    } catch (error: any) {
      console.error("Error contributing to family goal:", error);
      res.status(500).json({ message: "Failed to contribute to family goal" });
    }
  });

  // ===== Admin Tools =====
  
  // Reset family subscription to Free (parent only, for testing)
  app.post("/api/admin/reset-subscription", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const member = await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Only parents can reset subscriptions
      if (member.role !== "parent") {
        return res.status(403).json({ message: "Only parents can reset subscriptions" });
      }
      
      const family = await storage.getFamily(member.familyName);
      if (!family) {
        return res.status(404).json({ message: "Family not found" });
      }
      
      // Reset to free tier
      await storage.updateFamily(member.familyName, {
        subscriptionTier: "free",
        billingSubscriptionId: null,
        billingCustomerId: null,
      });
      
      console.log(`🔄 Admin: Subscription reset to Free for family: ${member.familyName}`);
      
      // Broadcast subscription update to all family members via WebSocket
      broadcastToFamily(member.familyName, {
        type: 'subscription-updated',
        tier: 'free',
      });
      
      res.json({ 
        message: "Subscription reset to Free successfully",
        tier: "free"
      });
    } catch (error: any) {
      console.error("Error resetting subscription:", error);
      res.status(500).json({ message: "Failed to reset subscription" });
    }
  });

  // Verify checkout session and update subscription (workaround for webhook issues)
  app.post("/api/verify-checkout-session", isAuthenticated, async (req: any, res) => {
    try {
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ message: "Session ID required" });
      }
      
      const userId = req.user.claims.sub;
      const member = await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Fetch the checkout session from Stripe
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      
      console.log("🔍 Verifying checkout session:", {
        sessionId: session.id,
        paymentStatus: session.payment_status,
        metadata: session.metadata,
      });
      
      // Only process if payment was successful
      if (session.payment_status !== "paid") {
        return res.status(400).json({ message: "Payment not completed" });
      }
      
      const familyName = session.metadata?.familyName;
      const tier = session.metadata?.tier as "free" | "family" | "family_plus" | "family_hero";
      
      if (!familyName || !tier) {
        return res.status(400).json({ message: "Invalid session metadata" });
      }
      
      // Verify that this session belongs to the user's family
      if (familyName !== member.familyName) {
        return res.status(403).json({ message: "Session does not belong to your family" });
      }
      
      // Update the family subscription
      await storage.updateFamily(familyName, {
        subscriptionTier: tier,
        subscriptionStatus: "active",
        billingSubscriptionId: session.subscription as string,
      });
      
      console.log(`✅ Subscription verified and activated for ${familyName}: ${tier}`);
      
      // Broadcast subscription update to all family members
      broadcastToFamily(familyName, {
        type: 'subscription-updated',
        tier,
      });
      
      res.json({ 
        message: "Subscription activated successfully",
        tier 
      });
    } catch (error: any) {
      console.error("Error verifying checkout session:", error);
      res.status(500).json({ message: "Failed to verify checkout session" });
    }
  });

  // ===== Stripe Integration =====
  
  // Create Stripe Checkout Session
  app.post("/api/create-checkout-session", isAuthenticated, async (req: any, res) => {
    try {
      console.log("🔑 Stripe Key Check:", {
        hasSecret: !!process.env.STRIPE_SECRET_KEY,
        keyPrefix: process.env.STRIPE_SECRET_KEY?.substring(0, 7) // sk_test_ or sk_live_
      });
      
      const userId = req.user.claims.sub;
      const { tier } = req.body;
      
      if (!tier || !["family", "family_plus", "family_hero"].includes(tier)) {
        return res.status(400).json({ message: "Invalid subscription tier" });
      }
      
      const member = await storage.getFamilyMemberByUserId(userId);
      if (!member || member.role !== "parent") {
        return res.status(403).json({ message: "Only parents can manage subscriptions" });
      }
      
      const family = await storage.getFamily(member.familyName);
      if (!family) {
        return res.status(404).json({ message: "Family not found" });
      }
      
      const tierConfig = TIER_CONFIG[tier as SubscriptionTier];
      if (!tierConfig.stripePriceId) {
        return res.status(400).json({ message: "This tier is not available for purchase" });
      }
      
      // Create or retrieve Stripe customer
      let customerId = family.billingCustomerId;
      
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: req.user.claims.email,
          metadata: {
            familyName: family.familyName,
          },
        });
        customerId = customer.id;
        
        // Update family with customer ID
        await storage.updateFamily(family.familyName, {
          billingCustomerId: customerId,
        });
      }
      
      // Create checkout session
      // Construct base URL from request (most reliable in all contexts)
      // Falls back to REPLIT_DOMAINS if needed
      const host = req.get('host');
      const protocol = req.protocol || 'https';
      
      let baseUrl: string;
      if (host) {
        // Use actual request host (works everywhere: dev, production, webhooks)
        baseUrl = `${protocol}://${host}`;
      } else if (process.env.REPLIT_DOMAINS) {
        // Fallback to environment variable
        baseUrl = `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`;
      } else {
        // Last resort: localhost (should never happen in production)
        baseUrl = 'http://localhost:5000';
        console.warn("⚠️ Using localhost as baseUrl - this may cause redirect issues in production!");
      }
      
      console.log("🌐 Checkout session URLs:", {
        host,
        protocol,
        baseUrl,
        successUrl: `${baseUrl}/dashboard?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${baseUrl}/pricing?canceled=true`,
      });
      
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [
          {
            price: tierConfig.stripePriceId,
            quantity: 1,
          },
        ],
        success_url: `${baseUrl}/dashboard?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/pricing?canceled=true`,
        metadata: {
          familyName: family.familyName,
          tier: tier,
        },
      });
      
      console.log("✅ Checkout session created:", {
        sessionId: session.id,
        url: session.url,
        tier,
        familyName: family.familyName,
      });
      
      res.json({ sessionId: session.id, url: session.url });
    } catch (error: any) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ message: error.message || "Failed to create checkout session" });
    }
  });
  
  // NOTE: Stripe webhook is now handled in server/index.ts with express.raw() middleware
  
  const httpServer = createServer(app);

  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws: WebSocket, req: any) => {
    console.log("WebSocket client connected");
    
    let familyName: string | null = null;

    ws.on("message", (message: string) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === "join_family" && typeof data.familyName === "string") {
          const family = data.familyName;
          familyName = family;
          
          if (!wsClients.has(family)) {
            wsClients.set(family, new Set());
          }
          wsClients.get(family)!.add(ws);
          
          console.log(`Client joined family: ${family}`);
        }
      } catch (error) {
        console.error("Error handling WebSocket message:", error);
      }
    });

    ws.on("close", () => {
      if (familyName) {
        const clients = wsClients.get(familyName);
        if (clients) {
          clients.delete(ws);
          if (clients.size === 0) {
            wsClients.delete(familyName);
          }
        }
        console.log(`Client left family: ${familyName}`);
      }
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
    });
  });

  return httpServer;
}
