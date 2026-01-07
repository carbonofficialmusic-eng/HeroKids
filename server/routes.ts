import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { join, posix } from "path";
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcrypt";
import Stripe from "stripe";
import { formatInTimeZone } from "date-fns-tz";
import { storage } from "./storage";
import { db } from "./db";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { generateTokenPair, refreshAccessToken, revokeRefreshToken, registerPushToken, unregisterPushToken } from "./mobileAuth";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { achievementEngine } from "./achievementEngine";
import { wsClients, broadcastToFamily } from "./websocket";
import { insertFamilyMemberSchema, insertTaskSchema, insertRewardSchema, insertRewardRedemptionSchema, insertChatMessageSchema, insertAchievementDefinitionSchema, insertFamilyGoalSchema, type Family, familyGoals, familyMembers, childDeviceSessions } from "@shared/schema";
import { getMaxMembers, hasFeature, canAddMember, getMaxSkins, TIER_CONFIG, getAllTiers } from "@shared/tier-config";
import type { SubscriptionTier } from "@shared/tier-config";
import { calculateAvailableCards, canUnlockSkin, getSkinPosition, isLegacySkin, LEGACY_UNLOCK_THRESHOLD } from "@shared/skin-config";
import { eq } from "drizzle-orm";
import "./types";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-10-29.clover",
});

// Track uploaded photos to prevent URL spoofing (now using Object Storage instead of multer)
const uploadedPhotos = new Map<string, { memberId: string; taskId: string; timestamp: number }>();

// Rate limiting for sensitive endpoints
interface RateLimitEntry {
  count: number;
  resetTime: number;
}
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  Array.from(rateLimitStore.entries()).forEach(([key, entry]) => {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  });
}, 5 * 60 * 1000);

/**
 * Rate limiting middleware for sensitive endpoints
 * @param maxRequests - Maximum requests allowed in the window
 * @param windowMs - Time window in milliseconds
 */
function rateLimit(maxRequests: number, windowMs: number) {
  return (req: any, res: any, next: any) => {
    // Use IP + endpoint as key for rate limiting
    const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
    const key = `${clientIp}:${req.path}`;
    const now = Date.now();
    
    let entry = rateLimitStore.get(key);
    
    if (!entry || entry.resetTime < now) {
      // Create new entry or reset expired one
      entry = { count: 1, resetTime: now + windowMs };
      rateLimitStore.set(key, entry);
      return next();
    }
    
    entry.count++;
    
    if (entry.count > maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ 
        message: "Too many requests, please try again later",
        retryAfter 
      });
    }
    
    next();
  };
}

// Helper function to get the current member from a request (supports Replit Auth, Device sessions, and Mobile JWT)
async function getCurrentMemberFromRequest(req: any): Promise<{ member: any; isDeviceSession: boolean; isMobileSession: boolean } | null> {
  // Mobile JWT session: member is directly available
  if (req.user?.authMethod === "mobile" && req.user?.member) {
    return { member: req.user.member, isDeviceSession: false, isMobileSession: true };
  }
  
  // Device-linked session: member is directly available
  if (req.user?.authMethod === "device" && req.user?.member) {
    return { member: req.user.member, isDeviceSession: true, isMobileSession: false };
  }
  
  // Normal Replit Auth flow
  const userId = req.user?.claims?.sub;
  if (!userId) return null;
  
  const member = await storage.getFamilyMemberByUserId(userId);
  return member ? { member, isDeviceSession: false, isMobileSession: false } : null;
}

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
    
    // Security: Sanitize path to prevent directory traversal attacks
    // Use decoded objectPath parameter and normalize to catch encoded traversal attempts
    const rawObjectPath = req.params.objectPath;
    
    // Check for null bytes (common attack vector)
    if (!rawObjectPath || rawObjectPath.includes('\0')) {
      console.warn(`Blocked invalid object path: null byte or empty`);
      return res.status(400).json({ message: "Invalid path" });
    }
    
    // Normalize the path segment to resolve any ".." or "." sequences
    // This handles URL-encoded attacks like %2e%2e which decode to ".."
    const normalizedSegment = posix.normalize(rawObjectPath);
    
    // After normalization, reject if:
    // 1. Path contains ".." (trying to escape)
    // 2. Path starts with "/" (absolute path attempt)
    // 3. Path starts with ".." (relative escape attempt)
    if (normalizedSegment.includes('..') || 
        normalizedSegment.startsWith('/') || 
        normalizedSegment.startsWith('..')) {
      console.warn(`Blocked directory traversal attempt: ${rawObjectPath} -> ${normalizedSegment}`);
      return res.status(400).json({ message: "Invalid path" });
    }
    
    // Construct the sanitized path using the NORMALIZED segment, not the raw input
    const sanitizedPath = '/objects/' + normalizedSegment;
    
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(sanitizedPath);
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
      // Check if this is a mobile JWT session
      if (req.user.authMethod === "mobile" && req.user.member) {
        const member = req.user.member;
        res.json({
          id: `mobile:${member.id}`,
          email: null,
          firstName: member.displayName,
          lastName: null,
          profileImageUrl: member.avatarUrl,
          authMethod: "mobile",
          memberId: member.id,
          familyName: member.familyName,
          role: member.role,
        });
        return;
      }
      
      // Check if this is a device-linked session
      if (req.user.authMethod === "device" && req.user.member) {
        const member = req.user.member;
        // Return a user-like object for device sessions
        res.json({
          id: `device:${member.id}`,
          email: null,
          firstName: member.displayName,
          lastName: null,
          profileImageUrl: member.avatarUrl,
          authMethod: "device",
          memberId: member.id,
          familyName: member.familyName,
          role: member.role,
        });
        return;
      }
      
      // Normal Replit Auth flow
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // ============================================
  // Mobile API Routes (for React Native app)
  // ============================================

  // Mobile login using device link code (same as web device linking, but returns JWT)
  // Rate limited: 5 attempts per minute to prevent brute force
  app.post("/api/mobile/auth/login", rateLimit(5, 60 * 1000), async (req, res) => {
    try {
      const { code, deviceId } = req.body;
      
      if (!code) {
        return res.status(400).json({ message: "Device link code is required" });
      }

      // Find and validate the device link code
      const linkCode = await storage.getDeviceLinkCodeByCode(code.toUpperCase());
      if (!linkCode) {
        return res.status(401).json({ message: "Invalid or expired code" });
      }
      
      // Check if code is expired or already consumed
      const now = new Date();
      if (linkCode.expiresAt < now || linkCode.consumedAt) {
        return res.status(401).json({ message: "Invalid or expired code" });
      }

      // Get the member
      const member = await storage.getFamilyMember(linkCode.memberId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }

      // Mark code as consumed
      await storage.consumeDeviceLinkCode(linkCode.id);

      // Generate JWT tokens
      const tokens = await generateTokenPair(member, deviceId);

      res.json({
        ...tokens,
        member: {
          id: member.id,
          displayName: member.displayName,
          role: member.role,
          familyName: member.familyName,
          avatarUrl: member.avatarUrl,
          activeSkinId: member.activeSkinId,
        },
      });
    } catch (error) {
      console.error("Mobile login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Mobile login using PIN (for returning users in single-device mode)
  // Rate limited: 5 attempts per minute to prevent brute force
  app.post("/api/mobile/auth/login-pin", rateLimit(5, 60 * 1000), async (req, res) => {
    try {
      const { memberId, pin, deviceId } = req.body;
      
      if (!memberId || !pin) {
        return res.status(400).json({ message: "Member ID and PIN are required" });
      }

      const member = await storage.getFamilyMember(memberId);
      if (!member || !member.pinCode) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Verify PIN
      const isValid = await bcrypt.compare(pin, member.pinCode);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid PIN" });
      }

      // Generate JWT tokens
      const tokens = await generateTokenPair(member, deviceId);

      res.json({
        ...tokens,
        member: {
          id: member.id,
          displayName: member.displayName,
          role: member.role,
          familyName: member.familyName,
          avatarUrl: member.avatarUrl,
          activeSkinId: member.activeSkinId,
        },
      });
    } catch (error) {
      console.error("Mobile PIN login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Refresh access token
  // Rate limited: 20 per minute (legitimate usage should be infrequent)
  app.post("/api/mobile/auth/refresh", rateLimit(20, 60 * 1000), async (req, res) => {
    try {
      const { refreshToken, deviceId } = req.body;
      
      if (!refreshToken) {
        return res.status(400).json({ message: "Refresh token is required" });
      }

      const tokens = await refreshAccessToken(refreshToken, deviceId);
      if (!tokens) {
        return res.status(401).json({ message: "Invalid or expired refresh token" });
      }

      res.json(tokens);
    } catch (error) {
      console.error("Token refresh error:", error);
      res.status(500).json({ message: "Token refresh failed" });
    }
  });

  // Mobile logout (revoke refresh token)
  app.post("/api/mobile/auth/logout", async (req, res) => {
    try {
      const { refreshToken } = req.body;
      
      if (refreshToken) {
        await revokeRefreshToken(refreshToken);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Mobile logout error:", error);
      res.status(500).json({ message: "Logout failed" });
    }
  });

  // Register push notification token
  app.post("/api/mobile/push/register", isAuthenticated, async (req: any, res) => {
    try {
      const memberResult = await getCurrentMemberFromRequest(req);
      if (!memberResult) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { token, platform, deviceId } = req.body;
      
      if (!token || !platform) {
        return res.status(400).json({ message: "Token and platform are required" });
      }

      if (!["ios", "android", "expo"].includes(platform)) {
        return res.status(400).json({ message: "Invalid platform" });
      }

      await registerPushToken(memberResult.member.id, token, platform, deviceId);

      res.json({ success: true });
    } catch (error) {
      console.error("Push token registration error:", error);
      res.status(500).json({ message: "Failed to register push token" });
    }
  });

  // Unregister push notification token
  app.post("/api/mobile/push/unregister", isAuthenticated, async (req: any, res) => {
    try {
      const memberResult = await getCurrentMemberFromRequest(req);
      if (!memberResult) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({ message: "Token is required" });
      }

      await unregisterPushToken(memberResult.member.id, token);

      res.json({ success: true });
    } catch (error) {
      console.error("Push token unregistration error:", error);
      res.status(500).json({ message: "Failed to unregister push token" });
    }
  });

  // Mobile API info endpoint (no auth required)
  app.get("/api/mobile/info", (req, res) => {
    res.json({
      version: "1.0.0",
      minAppVersion: "1.0.0",
      features: ["push_notifications", "offline_mode"],
      endpoints: {
        login: "/api/mobile/auth/login",
        loginPin: "/api/mobile/auth/login-pin",
        refresh: "/api/mobile/auth/refresh",
        logout: "/api/mobile/auth/logout",
        pushRegister: "/api/mobile/push/register",
        pushUnregister: "/api/mobile/push/unregister",
      },
    });
  });

  // Family routes
  app.get("/api/families/current", isAuthenticated, async (req: any, res) => {
    try {
      let member;
      
      // Device-linked session: member is directly available
      if (req.user.authMethod === "device" && req.user.member) {
        member = req.user.member;
      } else {
        // Normal Replit Auth flow
        const userId = req.user.claims.sub;
        member = await storage.getFamilyMemberByUserId(userId);
      }
      
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
      let member;
      
      // Device-linked session: member is directly available
      if (req.user.authMethod === "device" && req.user.member) {
        member = req.user.member;
      } else {
        // Normal Replit Auth flow
        const userId = req.user.claims.sub;
        member = await storage.getFamilyMemberByUserId(userId);
      }
      
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
    language: z.enum(["de", "en", "fr", "es", "ja", "zh", "ko", "sv"]).optional(),
    timezone: z.string().optional(),
    weeklyPrize: z.string().nullable().optional(),
    monthlyPrize: z.string().nullable().optional(),
    yearlyPrize: z.string().nullable().optional(),
    skinCardCost: z.number().int().min(40).max(80).refine(val => val % 5 === 0, {
      message: "skinCardCost must be a multiple of 5"
    }).optional(),
  }).refine(data => 
    data.showLeaderboard !== undefined || 
    data.singleDeviceMode !== undefined ||
    data.language !== undefined ||
    data.timezone !== undefined ||
    data.weeklyPrize !== undefined ||
    data.monthlyPrize !== undefined ||
    data.yearlyPrize !== undefined ||
    data.skinCardCost !== undefined, {
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
      if (req.session?.actingAsMemberId) {
        const actingAsMember = await storage.getFamilyMember(req.session.actingAsMemberId);
        if (actingAsMember) {
          return res.json(actingAsMember);
        }
        // If acting as member not found, clear the session and fall through
        delete req.session.actingAsMemberId;
      }
      
      // Device-linked session: member is directly available
      if (req.user.authMethod === "device" && req.user.member) {
        return res.json(req.user.member);
      }
      
      // Normal Replit Auth flow
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
      // Device-linked session: member is directly available
      if (req.user.authMethod === "device" && req.user.member) {
        return res.json(req.user.member);
      }
      
      // Normal Replit Auth flow
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
      const result = await getCurrentMemberFromRequest(req);
      if (!result) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      const members = await storage.getFamilyMembersByFamily(result.member.familyName);
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

  // Set ACL policy for uploaded avatar - supports Device Sessions
  app.put("/api/avatar", isAuthenticated, async (req: any, res) => {
    try {
      const { avatarUrl } = req.body;
      
      if (!avatarUrl) {
        return res.status(400).json({ message: "avatarUrl is required" });
      }
      
      // Get owner ID for ACL (either userId or device member ID)
      let ownerId: string;
      if (req.user.authMethod === "device" && req.user.member) {
        ownerId = `device:${req.user.member.id}`;
      } else {
        ownerId = req.user.claims.sub;
      }
      
      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        avatarUrl,
        {
          owner: ownerId,
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
      let realMember;
      
      // Device-linked session: member is directly available
      if (req.user.authMethod === "device" && req.user.member) {
        realMember = req.user.member;
      } else {
        // Normal Replit Auth flow
        const userId = req.user.claims.sub;
        realMember = await storage.getFamilyMemberByUserId(userId);
      }
      
      if (!realMember) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Use acting member if available, otherwise use authenticated user (only for non-device sessions)
      let member = realMember;
      if (req.session?.actingAsMemberId && !req.user.authMethod) {
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
                    completionCount, // Explicit count for UI display
                    memberHasCompleted: hasCompleted,
                    memberCompletionStatus: completionStatus,
                    completions, // Include participant list for multi-tasks
                  };
                } catch (err) {
                  console.error(`Error getting completions for task ${task.id}:`, err);
                  return {
                    ...task,
                    remainingSlots: task.maxCompletions,
                    completionCount: 0,
                    memberHasCompleted: hasCompleted,
                    memberCompletionStatus: completionStatus,
                    completions: [],
                  };
                }
              }
              
              // Normal mode (maxCompletions == null) - Standard tasks: if ANYONE completes it, it's done for everyone
              // Use family-wide completion status for normal tasks
              const familyCompletionStatus = await storage.getTaskCompletionStatusForFamily(task.id);
              const familyHasCompleted = familyCompletionStatus === "approved";
              
              return {
                ...task,
                remainingSlots: null,
                memberHasCompleted: familyHasCompleted, // True if ANY family member completed
                memberCompletionStatus: familyCompletionStatus, // Family-wide status
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
              
              // For non-multi-completion tasks - if ANYONE completes it, it's done for everyone
              const familyCompletionStatus = await storage.getTaskCompletionStatusForFamily(task.id);
              const familyHasCompleted = familyCompletionStatus === "approved";
              
              return {
                ...task,
                remainingSlots: null,
                memberHasCompleted: familyHasCompleted, // True if ANY family member completed
                memberCompletionStatus: familyCompletionStatus, // Family-wide status
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

  // Get presigned URL for task proof upload (client-side upload to Object Storage) - supports Device Sessions
  app.post("/api/tasks/upload-proof-url", isAuthenticated, async (req: any, res) => {
    try {
      // Support both Replit Auth and Device Sessions
      const result = await getCurrentMemberFromRequest(req);
      if (!result) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const member = result.member;
      
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

  // Set ACL policy for uploaded task proof photo - supports Device Sessions
  app.put("/api/tasks/:taskId/proof-photo", isAuthenticated, async (req: any, res) => {
    try {
      const { taskId } = req.params;
      const { photoUrl } = req.body;
      
      if (!photoUrl) {
        return res.status(400).json({ message: "photoUrl is required" });
      }
      
      // Support both Replit Auth and Device Sessions
      const result = await getCurrentMemberFromRequest(req);
      if (!result) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      let member = result.member;
      
      // For Replit Auth, also check if acting as another member
      if (!result.isDeviceSession && req.session?.actingAsMemberId) {
        const actingMember = await storage.getFamilyMember(req.session.actingAsMemberId);
        if (!actingMember) {
          delete req.session.actingAsMemberId;
        } else {
          member = actingMember;
        }
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
          owner: member.id, // Use member.id for Device Sessions compatibility
          visibility: "public", // Task proofs are public so parents can view them in approvals
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
      const { taskId } = req.params;
      const { proofPhotoUrl } = req.body;
      
      // Support both Replit Auth and Device Sessions
      const result = await getCurrentMemberFromRequest(req);
      if (!result) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      let member = result.member;
      
      // For Replit Auth, also check if acting as another member
      if (!result.isDeviceSession && req.session?.actingAsMemberId) {
        const actingMember = await storage.getFamilyMember(req.session.actingAsMemberId);
        if (!actingMember) {
          delete req.session.actingAsMemberId;
        } else {
          member = actingMember;
        }
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
        
        // Create notification for each parent
        await storage.createNotificationForParents(member.familyName, {
          familyName: member.familyName,
          type: "task_pending",
          title: `${member.displayName} completed "${task.title}"`,
          message: `Waiting for approval (+${task.points} points)`,
          relatedTaskId: task.id,
          relatedMemberId: member.id,
        });
        
        // Broadcast notification update
        broadcastToFamily(member.familyName, { type: "notification_update" });
      } else {
        // Broadcast auto-approved completion
        broadcastToFamily(member.familyName, {
          type: "task_completion_approved",
          taskId: task.id,
          completionId: completion.id,
          member: updatedMember,
          pointsEarned: task.points,
        });
        
        // Create notification for each parent
        await storage.createNotificationForParents(member.familyName, {
          familyName: member.familyName,
          type: "task_completed",
          title: `${member.displayName} earned ${task.points} points`,
          message: `Task "${task.title}" completed`,
          relatedTaskId: task.id,
          relatedMemberId: member.id,
        });
        
        // Broadcast notification update
        broadcastToFamily(member.familyName, { type: "notification_update" });
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
      
      // Create notification for the child who completed the task
      await storage.createNotification({
        familyName: member.familyName,
        type: "task_approved",
        title: `Task approved!`,
        message: `"${task?.title || "Task"}" was approved. You earned ${completion.pointsEarned} points!`,
        relatedMemberId: member.id,
        relatedTaskId: completion.taskId,
        targetMemberId: childMember.id,
      });
      
      // Broadcast notification update to refresh child's bell
      broadcastToFamily(member.familyName, {
        type: 'notification_update',
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
      
      // Get the task for the notification message
      const task = await storage.getTask(completion.taskId);
      
      // Create notification for the child who completed the task
      await storage.createNotification({
        familyName: member.familyName,
        type: "task_rejected",
        title: `Task needs revision`,
        message: `"${task?.title || "Task"}" was not approved: ${reason || "Did not meet expectations"}`,
        relatedMemberId: member.id,
        relatedTaskId: completion.taskId,
        targetMemberId: childMember.id,
      });
      
      // Broadcast notification update to refresh child's bell
      broadcastToFamily(member.familyName, {
        type: 'notification_update',
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
      const result = await getCurrentMemberFromRequest(req);
      if (!result) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      const rewards = await storage.getRewardsByFamily(result.member.familyName);
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

  // Redeem a reward - supports Device Sessions
  app.post("/api/rewards/:rewardId/redeem", isAuthenticated, async (req: any, res) => {
    console.log('🎯 POST /api/rewards/:rewardId/redeem called');
    console.log('   rewardId:', req.params.rewardId);
    
    try {
      const { rewardId } = req.params;
      
      // Support both Replit Auth and Device Sessions
      const result = await getCurrentMemberFromRequest(req);
      if (!result) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      let member = result.member;
      
      // For Replit Auth, also check if acting as another member
      if (!result.isDeviceSession && req.session?.actingAsMemberId) {
        const actingMember = await storage.getFamilyMemberById(req.session.actingAsMemberId);
        if (actingMember) {
          member = actingMember;
        }
      }
      
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
      
      // If one-time-only reward, deactivate it after redemption
      if (reward.oneTimeOnly) {
        await storage.updateReward(reward.id, { isActive: false });
      }
      
      // Broadcast redemption to family
      broadcastToFamily(member.familyName, {
        type: "reward_redeemed",
        redemption,
        member: { ...member, totalPoints: newTotalPoints },
        rewardDeactivated: reward.oneTimeOnly,
      });
      
      // Create notification for each parent
      await storage.createNotificationForParents(member.familyName, {
        familyName: member.familyName,
        type: "reward_redeemed",
        title: `${member.displayName} redeemed a reward`,
        message: `"${reward.title}" for ${reward.pointThreshold} points`,
        relatedRewardId: reward.id,
        relatedMemberId: member.id,
      });
      
      // Broadcast notification update
      broadcastToFamily(member.familyName, { type: "notification_update" });
      
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

  // Get reward redemptions for current family - supports Device Sessions
  app.get("/api/reward-redemptions", isAuthenticated, async (req: any, res) => {
    try {
      // Support both Replit Auth and Device Sessions
      const result = await getCurrentMemberFromRequest(req);
      if (!result) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      let member = result.member;
      
      // For Replit Auth, also check if acting as another member
      if (!result.isDeviceSession && req.session?.actingAsMemberId) {
        const actingMember = await storage.getFamilyMemberById(req.session.actingAsMemberId);
        if (actingMember) {
          member = actingMember;
        }
      }
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      const redemptions = await storage.getRewardRedemptionsByFamily(member.familyName);
      
      // Get all rewards to attach reward titles
      const rewards = await storage.getRewardsByFamily(member.familyName);
      const rewardsMap = new Map(rewards.map(r => [r.id, r]));
      
      // Attach reward titles and participants (for shared rewards) to redemptions
      const redemptionsWithDetails = await Promise.all(redemptions.map(async (redemption) => {
        const base = {
          ...redemption,
          rewardTitle: rewardsMap.get(redemption.rewardId)?.title || "Belohnung",
        };
        
        // Include participants for shared rewards (active or finalized)
        if (redemption.sharingStatus === "sharing_active" || redemption.sharingStatus === "sharing_finalized") {
          const participants = await storage.getRewardSharingParticipants(redemption.id);
          return {
            ...base,
            sharingParticipants: participants.map(p => ({
              id: p.id,
              memberId: p.memberId,
              displayName: p.member.displayName,
              avatarUrl: p.member.avatarUrl,
              activeSkinId: p.member.activeSkinId,
              color: p.member.color,
              pointsContributed: p.pointsContributed,
            })),
          };
        }
        
        return base;
      }));
      
      res.json(redemptionsWithDetails);
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

  // Cancel a reward redemption and refund points (parents only)
  app.delete("/api/reward-redemptions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      const result = await getCurrentMemberFromRequest(req);
      if (!result) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      let member = result.member;
      
      if (!result.isDeviceSession && req.session?.actingAsMemberId) {
        const actingMember = await storage.getFamilyMemberById(req.session.actingAsMemberId);
        if (actingMember) {
          member = actingMember;
        }
      }
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }

      if (member.role !== "parent") {
        return res.status(403).json({ message: "Only parents can cancel redemptions" });
      }

      const familyRedemptions = await storage.getRewardRedemptionsByFamily(member.familyName);
      const redemption = familyRedemptions.find(r => r.id === id);

      if (!redemption) {
        return res.status(404).json({ message: "Redemption not found" });
      }

      const { memberId, pointsRefunded, rewardId } = await storage.cancelRewardRedemption(id);

      const refundedMember = await storage.getFamilyMemberById(memberId);

      const reward = await storage.getRewardById(rewardId);
      if (reward && reward.oneTimeOnly && !reward.isActive) {
        await storage.updateReward(rewardId, { isActive: true });
      }

      broadcastToFamily(member.familyName, {
        type: "redemption_cancelled",
        redemptionId: id,
        memberId,
        pointsRefunded,
        member: refundedMember,
        rewardReactivated: reward?.oneTimeOnly || false,
      });

      res.json({ 
        message: "Redemption cancelled and points refunded", 
        pointsRefunded,
        memberId,
      });
    } catch (error) {
      console.error("Error cancelling redemption:", error);
      res.status(500).json({ message: "Failed to cancel redemption" });
    }
  });

  // Create a reward request (children only) - supports Device Sessions
  app.post("/api/reward-requests", isAuthenticated, async (req: any, res) => {
    try {
      const { title, description, pointThreshold } = req.body;
      
      // Support both Replit Auth and Device Sessions
      const result = await getCurrentMemberFromRequest(req);
      if (!result) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      let member = result.member;
      
      // For Replit Auth, also check if acting as another member
      if (!result.isDeviceSession && req.session?.actingAsMemberId) {
        const actingMember = await storage.getFamilyMemberById(req.session.actingAsMemberId);
        if (actingMember) {
          member = actingMember;
        }
      }
      
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

  // Get all reward requests for the current family - supports Device Sessions
  app.get("/api/reward-requests", isAuthenticated, async (req: any, res) => {
    try {
      // Support both Replit Auth and Device Sessions
      const result = await getCurrentMemberFromRequest(req);
      if (!result) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const member = result.member;
      
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

  // Reward sharing routes - supports Device Sessions
  // Start sharing a reward
  app.post("/api/rewards/redemptions/:redemptionId/share", isAuthenticated, async (req: any, res) => {
    try {
      const { redemptionId } = req.params;
      
      // Support both Replit Auth and Device Sessions
      const result = await getCurrentMemberFromRequest(req);
      if (!result) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      let member = result.member;
      
      // For Replit Auth, also check if acting as another member
      if (!result.isDeviceSession && req.session?.actingAsMemberId) {
        const actingMember = await storage.getFamilyMemberById(req.session.actingAsMemberId);
        if (actingMember) {
          member = actingMember;
        }
      }
      
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
      
      // Create notification for each parent about reward sharing offer
      const reward = await storage.getRewardById(redemption.rewardId);
      await storage.createNotificationForParents(member.familyName, {
        familyName: member.familyName,
        type: "reward_sharing",
        title: `${member.displayName} offers a reward for sharing`,
        message: reward ? `"${reward.title}" is available to share` : "A reward is available to share",
        relatedMemberId: member.id,
        relatedRewardId: redemption.rewardId,
        isRead: false,
      });
      
      // Broadcast to family
      broadcastToFamily(member.familyName, {
        type: "reward_sharing_started",
        redemptionId,
        memberId: member.id,
        memberName: member.displayName,
      });
      
      // Also broadcast notification update
      broadcastToFamily(member.familyName, {
        type: "notification_update",
      });
      
      res.json({ message: "Reward sharing started!", redemptionId });
    } catch (error: any) {
      console.error("Error starting reward sharing:", error);
      res.status(500).json({ message: "Failed to start reward sharing" });
    }
  });

  // Join a shared reward - supports Device Sessions
  app.post("/api/rewards/redemptions/:redemptionId/join", isAuthenticated, async (req: any, res) => {
    try {
      const { redemptionId } = req.params;
      
      // Support both Replit Auth and Device Sessions
      const result = await getCurrentMemberFromRequest(req);
      if (!result) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      let member = result.member;
      
      // For Replit Auth, also check if acting as another member
      if (!result.isDeviceSession && req.session?.actingAsMemberId) {
        const actingMember = await storage.getFamilyMemberById(req.session.actingAsMemberId);
        if (actingMember) {
          member = actingMember;
        }
      }
      
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

  // Finalize a shared reward (calculate and distribute costs) - supports Device Sessions
  app.post("/api/rewards/redemptions/:redemptionId/finalize", isAuthenticated, async (req: any, res) => {
    try {
      const { redemptionId } = req.params;
      
      // Support both Replit Auth and Device Sessions
      const result = await getCurrentMemberFromRequest(req);
      if (!result) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      let member = result.member;
      
      // For Replit Auth, also check if acting as another member
      if (!result.isDeviceSession && req.session?.actingAsMemberId) {
        const actingMember = await storage.getFamilyMemberById(req.session.actingAsMemberId);
        if (actingMember) {
          member = actingMember;
        }
      }
      
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

  // Cancel sharing (only works if no one joined yet) - supports Device Sessions
  app.post("/api/rewards/redemptions/:redemptionId/cancel-sharing", isAuthenticated, async (req: any, res) => {
    try {
      const { redemptionId } = req.params;
      
      // Support both Replit Auth and Device Sessions
      const result = await getCurrentMemberFromRequest(req);
      if (!result) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      let member = result.member;
      
      // For Replit Auth, also check if acting as another member
      if (!result.isDeviceSession && req.session?.actingAsMemberId) {
        const actingMember = await storage.getFamilyMemberById(req.session.actingAsMemberId);
        if (actingMember) {
          member = actingMember;
        }
      }
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Get the redemption
      const redemption = await storage.getRewardRedemption(redemptionId);
      if (!redemption) {
        return res.status(404).json({ message: "Redemption not found" });
      }
      
      // Only the original redeemer can cancel
      if (redemption.memberId !== member.id) {
        return res.status(403).json({ message: "Only the original redeemer can cancel sharing" });
      }
      
      // Cancel sharing
      await storage.cancelRewardSharing(redemptionId);
      
      // Broadcast to family
      broadcastToFamily(member.familyName, {
        type: "reward_sharing_cancelled",
        redemptionId,
      });
      
      res.json({ 
        message: "Sharing cancelled. You can now redeem this reward solo.",
      });
    } catch (error: any) {
      console.error("Error cancelling shared reward:", error);
      res.status(500).json({ message: error.message || "Failed to cancel sharing" });
    }
  });

  // Get all active shared rewards for family - supports Device Sessions
  app.get("/api/rewards/shared", isAuthenticated, async (req: any, res) => {
    try {
      // Support both Replit Auth and Device Sessions
      const result = await getCurrentMemberFromRequest(req);
      if (!result) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      let member = result.member;
      
      // For Replit Auth, also check if acting as another member
      if (!result.isDeviceSession && req.session?.actingAsMemberId) {
        const actingMember = await storage.getFamilyMemberById(req.session.actingAsMemberId);
        if (actingMember) {
          member = actingMember;
        }
      }
      
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

  // Skins routes - supports both Replit Auth and Device Sessions
  app.get("/api/skins", isAuthenticated, async (req: any, res) => {
    try {
      // Support both Replit Auth and Device Sessions
      const result = await getCurrentMemberFromRequest(req);
      if (!result) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // For Replit Auth, also check if acting as another member
      let member = result.member;
      if (!result.isDeviceSession && req.session.actingAsMemberId) {
        member = await storage.getFamilyMemberById(req.session.actingAsMemberId);
      }
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Get family to retrieve skinCardCost
      const family = await storage.getFamily(member.familyName);
      const skinCardCost = family?.skinCardCost ?? 60;
      
      const allSkins = await storage.getSkins();
      const discoveredSkinIds = member.discoveredSkinIds || [];
      const earnedLegacySkinIds = member.earnedLegacySkinIds || [];
      
      // Calculate available discovery cards using new linear system with family's skinCardCost
      const availableCards = calculateAvailableCards(member.totalEarned, discoveredSkinIds.length, skinCardCost);
      
      // Enrich skins with discovery status for this member
      const skinsWithStatus = allSkins.map(skin => {
        // Legacy skins are "discovered" if they're in earnedLegacySkinIds (via stars)
        // Regular skins are "discovered" if they're in discoveredSkinIds (via manual discovery)
        const isDiscovered = isLegacySkin(skin.id) 
          ? earnedLegacySkinIds.includes(skin.id)
          : discoveredSkinIds.includes(skin.id);
        const isActive = member.activeSkinId === skin.id;
        
        // Check if skin can be unlocked based on position and points (using family's skinCardCost)
        // Legacy skins cannot be discovered manually - they are unlocked via stars only
        const canDiscover = !isDiscovered && !isLegacySkin(skin.id) && canUnlockSkin(skin.id, member.totalEarned, discoveredSkinIds.length, skinCardCost);
        
        // Get position for ordering (legacy skins have tier 14)
        const tier = isLegacySkin(skin.id) ? 14 : 1;
        
        return {
          ...skin,
          isDiscovered,
          isActive,
          canDiscover,
          tier,
          position: getSkinPosition(skin.id),
        };
      });
      
      console.log(`🎨 Skins API: totalEarned=${member.totalEarned}, discovered=${discoveredSkinIds.length}, available=${availableCards}`);
      
      // Initialize star placements for all members and get star data
      let starStats = { starsFound: 0, totalStars: 0, earnedLegacySkinIds: [] as string[] };
      let starPlacements: Record<string, boolean> = {};
      
      await storage.initializeStarPlacements(member.id);
      starStats = await storage.getMemberStarStats(member.id);
      const placements = await storage.getStarPlacementsByMember(member.id);
      for (const p of placements) {
        starPlacements[p.skinId] = p.found;
      }
      
      res.json({
        skins: skinsWithStatus,
        totalEarned: member.totalEarned,
        availableCards,
        unlockedTier: 999, // Legacy compatibility - all skins are now position-based
        starStats,
        starPlacements, // { skinId: wasFound } - for mini-star indicators
      });
    } catch (error: any) {
      console.error("Error fetching skins:", error);
      res.status(500).json({ message: "Failed to fetch skins" });
    }
  });

  app.post("/api/skins/discover", isAuthenticated, async (req: any, res) => {
    try {
      const { skinId } = req.body;
      
      // Support both Replit Auth and Device Sessions
      const result = await getCurrentMemberFromRequest(req);
      if (!result) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // For Replit Auth, also check if acting as another member
      let member = result.member;
      if (!result.isDeviceSession && req.session.actingAsMemberId) {
        member = await storage.getFamilyMemberById(req.session.actingAsMemberId);
      }
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Get family to retrieve skinCardCost
      const family = await storage.getFamily(member.familyName);
      const skinCardCost = family?.skinCardCost ?? 60;
      
      const allSkins = await storage.getSkins();
      const skin = allSkins.find(s => s.id === skinId);
      
      if (!skin) {
        return res.status(404).json({ message: "Skin not found" });
      }
      
      // Legacy skins cannot be discovered manually - they are unlocked via stars only
      if (isLegacySkin(skinId)) {
        return res.status(403).json({ message: "Legacy skins are unlocked through star collection, not discovery" });
      }
      
      const discoveredSkinIds = member.discoveredSkinIds || [];
      
      // Check if already discovered
      if (discoveredSkinIds.includes(skinId)) {
        return res.status(400).json({ message: "Skin already discovered" });
      }
      
      // Check if skin can be unlocked using new position-based system with family's skinCardCost
      if (!canUnlockSkin(skinId, member.totalEarned, discoveredSkinIds.length, skinCardCost)) {
        return res.status(403).json({ message: "Not enough points to unlock this skin" });
      }
      
      // Add skin to discovered list
      const updatedDiscoveredSkins = [...discoveredSkinIds, skinId];
      await storage.updateFamilyMember(member.id, {
        discoveredSkinIds: updatedDiscoveredSkins,
      });
      
      // Check for hidden star on this skin card
      const starResult = await storage.markStarAsFound(member.id, skinId);
      
      // Broadcast skin discovery to family (with star info if found)
      broadcastToFamily(member.familyName, {
        type: "skin_discovered",
        memberId: member.id,
        skinId,
        starFound: starResult.wasStarFound,
        totalStarsFound: starResult.totalStarsFound,
        legacySkinAwarded: starResult.legacySkinAwarded,
      });
      
      // Calculate remaining available cards after discovery (using family's skinCardCost)
      const remainingCards = calculateAvailableCards(member.totalEarned, updatedDiscoveredSkins.length, skinCardCost);
      
      res.json({ 
        message: "Skin discovered!", 
        skinId,
        availableCards: remainingCards,
        starFound: starResult.wasStarFound,
        totalStarsFound: starResult.totalStarsFound,
        legacySkinAwarded: starResult.legacySkinAwarded,
      });
    } catch (error: any) {
      console.error("Error discovering skin:", error);
      res.status(500).json({ message: "Failed to discover skin" });
    }
  });

  app.post("/api/skins/select", isAuthenticated, async (req: any, res) => {
    try {
      const { skinId } = req.body;
      
      // Support both Replit Auth and Device Sessions
      const result = await getCurrentMemberFromRequest(req);
      if (!result) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // For Replit Auth, also check if acting as another member
      let member = result.member;
      if (!result.isDeviceSession && req.session.actingAsMemberId) {
        member = await storage.getFamilyMemberById(req.session.actingAsMemberId);
      }
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Allow null to reset to default avatar, otherwise verify skin is discovered or earned
      if (skinId !== null) {
        const discoveredSkinIds = member.discoveredSkinIds || [];
        const earnedLegacySkinIds = member.earnedLegacySkinIds || [];
        
        // Check both discovered skins and earned legacy skins (from star collection)
        if (!discoveredSkinIds.includes(skinId) && !earnedLegacySkinIds.includes(skinId)) {
          return res.status(403).json({ message: "Skin not discovered yet - discover it first!" });
        }
      }
      
      // Update the active skin - preserve the user's background preference
      // If user has custom photo enabled, they keep seeing their photo while the skin background changes
      // Only enable background if it was never set before (null/undefined), otherwise respect user's choice
      const shouldEnableBackground = skinId !== null && member.useThemeBackground == null ? true : undefined;
      await storage.updateFamilyMemberActiveSkin(member.id, {
        skinId,
        useCustomAvatar: undefined, // Don't change the useCustomAvatar setting
        useThemeBackground: shouldEnableBackground // Only set if never explicitly configured
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

  // Toggle theme background (show/hide skin background)
  app.post("/api/skins/background", isAuthenticated, async (req: any, res) => {
    try {
      const { useThemeBackground } = req.body;
      
      if (typeof useThemeBackground !== 'boolean') {
        return res.status(400).json({ message: "useThemeBackground must be a boolean" });
      }
      
      const result = await getCurrentMemberFromRequest(req);
      if (!result) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      let member = result.member;
      if (!result.isDeviceSession && req.session.actingAsMemberId) {
        member = await storage.getFamilyMemberById(req.session.actingAsMemberId);
      }
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      await storage.updateFamilyMemberThemeBackground(member.id, useThemeBackground);
      
      // Broadcast background change to family
      broadcastToFamily(member.familyName, {
        type: "background_changed",
        memberId: member.id,
        useThemeBackground,
      });
      
      res.json({ message: useThemeBackground ? "Background enabled" : "Background disabled", useThemeBackground });
    } catch (error: any) {
      console.error("Error toggling background:", error);
      res.status(500).json({ message: "Failed to toggle background" });
    }
  });

  // Star Collection System routes
  app.get("/api/stars", isAuthenticated, async (req: any, res) => {
    try {
      const result = await getCurrentMemberFromRequest(req);
      if (!result) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      let member = result.member;
      if (!result.isDeviceSession && req.session?.actingAsMemberId) {
        const actingMember = await storage.getFamilyMemberById(req.session.actingAsMemberId);
        if (actingMember) {
          member = actingMember;
        }
      }
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Initialize star placements for all members if not already done
      await storage.initializeStarPlacements(member.id);
      
      const starStats = await storage.getMemberStarStats(member.id);
      const starPlacements = await storage.getStarPlacementsByMember(member.id);
      
      // Create a map of skinId -> found status for discovered skins
      const starMap: Record<string, boolean> = {};
      for (const placement of starPlacements) {
        starMap[placement.skinId] = placement.found;
      }
      
      res.json({
        starsFound: starStats.starsFound,
        totalStars: starStats.totalStars,
        earnedLegacySkinIds: starStats.earnedLegacySkinIds,
        starPlacements: starMap, // { skinId: wasFound } - for showing mini-stars on found skin cards
      });
    } catch (error: any) {
      console.error("Error fetching star stats:", error);
      res.status(500).json({ message: "Failed to fetch star stats" });
    }
  });

  app.post("/api/stars/initialize", isAuthenticated, async (req: any, res) => {
    try {
      const result = await getCurrentMemberFromRequest(req);
      if (!result) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      let member = result.member;
      if (!result.isDeviceSession && req.session?.actingAsMemberId) {
        const actingMember = await storage.getFamilyMemberById(req.session.actingAsMemberId);
        if (actingMember) {
          member = actingMember;
        }
      }
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Initialize star placements for all members (parents can also collect stars)
      await storage.initializeStarPlacements(member.id);
      const starStats = await storage.getMemberStarStats(member.id);
      
      res.json({
        message: "Star placements initialized",
        starsFound: starStats.starsFound,
        totalStars: starStats.totalStars,
        earnedLegacySkinIds: starStats.earnedLegacySkinIds,
      });
    } catch (error: any) {
      console.error("Error initializing stars:", error);
      res.status(500).json({ message: "Failed to initialize stars" });
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

  // Chat endpoints (Family+ and Family Hero tier) - supports Device Sessions
  app.get("/api/chat", isAuthenticated, async (req: any, res) => {
    try {
      // Support both Replit Auth and Device Sessions
      const result = await getCurrentMemberFromRequest(req);
      if (!result) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const member = result.member;
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Get family tier and check if chat is allowed
      const family = await storage.getFamily(member.familyName);
      if (!family) {
        return res.status(404).json({ message: "Family not found" });
      }
      
      // Check tier access (Family tier and above)
      if (!hasFeature(family.subscriptionTier as SubscriptionTier, "familyChat")) {
        return res.status(403).json({ 
          message: "Family chat is only available for Family tier and above",
          tier: family.subscriptionTier,
          requiredTier: "family"
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
      // Support both Replit Auth and Device Sessions
      const result = await getCurrentMemberFromRequest(req);
      if (!result) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const member = result.member;
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Get family tier and check if chat is allowed
      const family = await storage.getFamily(member.familyName);
      if (!family) {
        return res.status(404).json({ message: "Family not found" });
      }
      
      // Check tier access (Family tier and above)
      if (!hasFeature(family.subscriptionTier as SubscriptionTier, "familyChat")) {
        return res.status(403).json({ 
          message: "Family chat is only available for Family tier and above",
          tier: family.subscriptionTier,
          requiredTier: "family"
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

  // Get pending approvals count (for parents) - supports Device Sessions
  app.get("/api/tasks/pending-count", isAuthenticated, async (req: any, res) => {
    try {
      // Support both Replit Auth and Device Sessions
      const result = await getCurrentMemberFromRequest(req);
      if (!result) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const member = result.member;
      
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

  // Get unread message count - supports Device Sessions
  app.get("/api/chat/unread-count", isAuthenticated, async (req: any, res) => {
    try {
      // Support both Replit Auth and Device Sessions
      const result = await getCurrentMemberFromRequest(req);
      if (!result) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const member = result.member;
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Get family tier and check if chat is allowed
      const family = await storage.getFamily(member.familyName);
      if (!family) {
        return res.status(404).json({ message: "Family not found" });
      }
      
      // Check tier access (Family tier and above)
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

  // Mark chat messages as read - supports Device Sessions
  app.post("/api/chat/mark-read", isAuthenticated, async (req: any, res) => {
    try {
      // Support both Replit Auth and Device Sessions
      const result = await getCurrentMemberFromRequest(req);
      if (!result) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const member = result.member;
      
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

  // Get pending reward redemptions count (for parents) - supports Device Sessions
  app.get("/api/reward-redemptions/pending-count", isAuthenticated, async (req: any, res) => {
    try {
      // Support both Replit Auth and Device Sessions
      const result = await getCurrentMemberFromRequest(req);
      if (!result) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const member = result.member;
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Only parents can see pending rewards count
      if (member.role !== "parent") {
        return res.json({ count: 0 });
      }
      
      const redemptions = await storage.getRewardRedemptionsByFamily(member.familyName);
      // Count redemptions that need parent attention:
      // 1. Not yet fulfilled (status !== "completed")
      // 2. OR sharing is still active (even if status is completed, sharing needs to be finalized)
      const pendingCount = redemptions.filter(r => 
        r.status !== "completed" || r.sharingStatus === "sharing_active"
      ).length;
      
      res.json({ count: pendingCount });
    } catch (error: any) {
      console.error("Error fetching pending rewards count:", error);
      res.status(500).json({ message: "Failed to fetch pending rewards count" });
    }
  });

  // ===== Achievement System =====

  // Get achievement definitions for family - supports Device Sessions
  app.get("/api/achievements", isAuthenticated, async (req: any, res) => {
    try {
      const result = await getCurrentMemberFromRequest(req);
      if (!result) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const member = result.member;
      
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

  // Get achievement awards history - supports Device Sessions
  app.get("/api/achievements/awards", isAuthenticated, async (req: any, res) => {
    try {
      const result = await getCurrentMemberFromRequest(req);
      if (!result) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const member = result.member;
      
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

  // Get achievement awards for current member - supports Device Sessions
  app.get("/api/achievements/my-awards", isAuthenticated, async (req: any, res) => {
    try {
      // Support both Replit Auth and Device Sessions
      const result = await getCurrentMemberFromRequest(req);
      if (!result) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      let member = result.member;
      
      // For Replit Auth, also check if acting as another member
      if (!result.isDeviceSession && req.session?.actingAsMemberId) {
        const actingMember = await storage.getFamilyMemberById(req.session.actingAsMemberId);
        if (actingMember) {
          member = actingMember;
        }
      }
      
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
  
  // Get all family goals for the current family - supports Device Sessions
  app.get("/api/family-goals", isAuthenticated, async (req: any, res) => {
    try {
      const result = await getCurrentMemberFromRequest(req);
      if (!result) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const member = result.member;
      
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

  // Get a specific family goal with contributions - supports Device Sessions
  app.get("/api/family-goals/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      const result = await getCurrentMemberFromRequest(req);
      if (!result) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const member = result.member;
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      const goal = await storage.getFamilyGoal(id);
      
      if (!goal || goal.familyName !== member.familyName) {
        return res.status(404).json({ message: "Family goal not found" });
      }
      
      // Get family timezone for correct period calculation
      const family = await storage.getFamily(member.familyName);
      const familyTimezone = family?.timezone || "Europe/Berlin";
      
      // Calculate current period identifier using family's timezone
      const now = new Date();
      const period = goal.contributionPeriod === "weekly"
        ? formatInTimeZone(now, familyTimezone, "RRRR-'W'II")
        : formatInTimeZone(now, familyTimezone, "yyyy-MM");
      
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

  // Contribute points to a family goal - supports Device Sessions
  app.post("/api/family-goals/:id/contribute", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Support both Replit Auth and Device Sessions
      const result = await getCurrentMemberFromRequest(req);
      if (!result) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      let member = result.member;
      
      // For Replit Auth, also check if acting as another member
      if (!result.isDeviceSession && req.session?.actingAsMemberId) {
        const actingMember = await storage.getFamilyMemberById(req.session.actingAsMemberId);
        if (actingMember) {
          member = actingMember;
        }
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
      
      // Get family timezone for correct period calculation
      const family = await storage.getFamily(member.familyName);
      const familyTimezone = family?.timezone || "Europe/Berlin";
      
      // Calculate current period using family's timezone
      const now = new Date();
      const period = goal.contributionPeriod === "weekly"
        ? formatInTimeZone(now, familyTimezone, "RRRR-'W'II")
        : formatInTimeZone(now, familyTimezone, "yyyy-MM");
      
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

  // ===== Notification Routes (member-based - each member has their own notifications) =====
  
  // Get all notifications for the current member
  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const result = await getCurrentMemberFromRequest(req);
      if (!result) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const member = result.member;
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      const limit = req.query.limit ? parseInt(req.query.limit) : 50;
      const notificationsList = await storage.getNotificationsForMember(member.id, limit);
      
      res.json(notificationsList);
    } catch (error: any) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  // Get unread notification count for the current member
  app.get("/api/notifications/unread-count", isAuthenticated, async (req: any, res) => {
    try {
      const result = await getCurrentMemberFromRequest(req);
      if (!result) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const member = result.member;
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      const count = await storage.getUnreadNotificationCountForMember(member.id);
      res.json({ count });
    } catch (error: any) {
      console.error("Error fetching unread notification count:", error);
      res.status(500).json({ message: "Failed to fetch notification count" });
    }
  });

  // Mark a single notification as read
  app.patch("/api/notifications/:id/read", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const result = await getCurrentMemberFromRequest(req);
      if (!result) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const member = result.member;
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      await storage.markNotificationAsRead(id);
      
      // Broadcast to update notification counts (but each user still has their own count)
      broadcastToFamily(member.familyName, {
        type: 'notification_update',
      });
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  // Mark all notifications as read for current member
  app.patch("/api/notifications/read-all", isAuthenticated, async (req: any, res) => {
    try {
      const result = await getCurrentMemberFromRequest(req);
      if (!result) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const member = result.member;
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      await storage.markAllNotificationsAsReadForMember(member.id);
      
      // Broadcast to update notification counts
      broadcastToFamily(member.familyName, {
        type: 'notification_update',
      });
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  // Delete a single notification
  app.delete("/api/notifications/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const result = await getCurrentMemberFromRequest(req);
      if (!result) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const member = result.member;
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      await storage.deleteNotification(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting notification:", error);
      res.status(500).json({ message: "Failed to delete notification" });
    }
  });

  // Delete all notifications for current member
  app.delete("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const result = await getCurrentMemberFromRequest(req);
      if (!result) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const member = result.member;
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      await storage.deleteAllNotificationsForMember(member.id);
      
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting all notifications:", error);
      res.status(500).json({ message: "Failed to delete all notifications" });
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
      const tier = session.metadata?.tier as "free" | "family" | "family_hero";
      
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

  // Public endpoint to verify checkout session (no auth required)
  // Used when user returns from Stripe but session has expired
  app.post("/api/verify-checkout-public", async (req: any, res) => {
    try {
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ message: "Session ID required" });
      }
      
      // Fetch the checkout session from Stripe
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      
      console.log("🔍 Public verification of checkout session:", {
        sessionId: session.id,
        paymentStatus: session.payment_status,
        metadata: session.metadata,
      });
      
      // Only process if payment was successful
      if (session.payment_status !== "paid") {
        return res.status(400).json({ message: "Payment not completed", status: session.payment_status });
      }
      
      const familyName = session.metadata?.familyName;
      const tier = session.metadata?.tier as "free" | "family" | "family_hero";
      
      if (!familyName || !tier) {
        return res.status(400).json({ message: "Invalid session metadata" });
      }
      
      // Update the family subscription
      await storage.updateFamily(familyName, {
        subscriptionTier: tier,
        subscriptionStatus: "active",
        billingSubscriptionId: session.subscription as string,
      });
      
      console.log(`✅ Public verification: Subscription activated for ${familyName}: ${tier}`);
      
      // Broadcast subscription update to all family members
      broadcastToFamily(familyName, {
        type: 'subscription-updated',
        tier,
      });
      
      res.json({ 
        success: true,
        message: "Subscription activated successfully",
        tier,
        familyName 
      });
    } catch (error: any) {
      console.error("Error in public checkout verification:", error);
      res.status(500).json({ message: "Failed to verify checkout session" });
    }
  });

  // ===== Stripe Integration =====
  
  // Create Stripe Checkout Session
  app.post("/api/create-checkout-session", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { tier } = req.body;
      
      if (!tier || !["family", "family_hero"].includes(tier)) {
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
  
  // ========================================
  // Device Linking - Allow children to link their account to a new device
  // ========================================

  // Generate a 6-character alphanumeric code
  function generateLinkCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing chars like 0/O, 1/I
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Generate secure token and its bcrypt hash
  async function generateDeviceToken(): Promise<{ token: string; hash: string }> {
    const token = crypto.randomBytes(32).toString('hex');
    const hash = await bcrypt.hash(token, 10);
    return { token, hash };
  }

  // Parent: Generate a link code for a child member
  // Rate limited: 10 per minute (code generation should be infrequent)
  app.post("/api/device-link/generate-code", isAuthenticated, rateLimit(10, 60 * 1000), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const parentMember = await storage.getFamilyMemberByUserId(userId);

      if (!parentMember || parentMember.role !== "parent") {
        return res.status(403).json({ message: "Only parents can generate link codes" });
      }

      const { memberId, pin } = req.body;
      if (!memberId) {
        return res.status(400).json({ message: "Member ID is required" });
      }

      // Verify parent's PIN
      if (!pin) {
        return res.status(400).json({ message: "PIN is required" });
      }
      
      if (!parentMember.pinCode) {
        return res.status(400).json({ message: "No PIN set. Please set a PIN first." });
      }

      const isPinValid = await bcrypt.compare(pin, parentMember.pinCode);
      if (!isPinValid) {
        return res.status(401).json({ message: "Invalid PIN" });
      }

      // Get the child member
      const childMember = await storage.getFamilyMember(memberId);
      if (!childMember) {
        return res.status(404).json({ message: "Member not found" });
      }

      // Ensure they're in the same family
      if (childMember.familyName !== parentMember.familyName) {
        return res.status(403).json({ message: "Member not in your family" });
      }

      // Ensure it's a child account
      if (childMember.role !== "child") {
        return res.status(400).json({ message: "Can only link child accounts" });
      }

      // Check for existing active code and invalidate it
      const existingCode = await storage.getActiveDeviceLinkCodeForMember(memberId);
      if (existingCode) {
        await storage.deleteDeviceLinkCode(existingCode.id);
      }

      // Generate new code (valid for 15 minutes)
      const code = generateLinkCode();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      const linkCode = await storage.createDeviceLinkCode({
        memberId,
        createdByParentId: parentMember.id,
        code,
        expiresAt,
      });

      res.json({
        code: linkCode.code,
        expiresAt: linkCode.expiresAt,
        memberName: childMember.displayName,
      });
    } catch (error) {
      console.error("Error generating link code:", error);
      res.status(500).json({ message: "Failed to generate link code" });
    }
  });

  // Public: Verify a link code and create device session (no auth required)
  // Rate limited: 5 per minute to prevent brute force code guessing
  app.post("/api/device-link/verify-code", rateLimit(5, 60 * 1000), async (req: any, res) => {
    try {
      console.log("[Device-Link] Verify code request received:", { code: req.body?.code, deviceLabel: req.body?.deviceLabel });
      const { code, deviceLabel } = req.body;
      if (!code) {
        return res.status(400).json({ message: "Code is required" });
      }

      const linkCode = await storage.getDeviceLinkCodeByCode(code.toUpperCase());
      if (!linkCode) {
        return res.status(404).json({ message: "Invalid code" });
      }

      // Check if expired
      if (new Date() > linkCode.expiresAt) {
        return res.status(400).json({ message: "Code has expired" });
      }

      // Check if already consumed
      if (linkCode.consumedAt) {
        return res.status(400).json({ message: "Code has already been used" });
      }

      // Get the member
      const member = await storage.getFamilyMember(linkCode.memberId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }

      // Generate device session token
      const { token, hash } = await generateDeviceToken();

      // Create device session
      const session = await storage.createChildDeviceSession({
        memberId: member.id,
        tokenHash: hash,
        deviceLabel: deviceLabel || null,
      });

      // Mark link code as consumed
      await storage.consumeDeviceLinkCode(linkCode.id);

      // Set secure cookie with the token
      // Use sameSite: 'lax' to allow cookie to be sent on same-site navigation
      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie('child_device_token', token, {
        httpOnly: true,
        secure: isProduction, // Only require HTTPS in production
        sameSite: 'lax', // Allow cookie on same-site navigation
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        path: '/',
      });

      res.json({
        success: true,
        memberId: member.id,
        memberName: member.displayName,
        familyName: member.familyName,
      });
    } catch (error) {
      console.error("Error verifying link code:", error);
      res.status(500).json({ message: "Failed to verify code" });
    }
  });

  // Check if current request has a valid child device session
  app.get("/api/device-link/session", async (req: any, res) => {
    try {
      const token = req.cookies?.child_device_token;
      console.log("[Device-Link] Session check - token present:", !!token, "cookies:", Object.keys(req.cookies || {}));
      if (!token) {
        return res.json({ authenticated: false });
      }

      // Get all active sessions and verify token against each (bcrypt compare)
      const session = await storage.findValidChildDeviceSession(token);

      if (!session) {
        // Clear invalid cookie
        res.clearCookie('child_device_token', { path: '/' });
        return res.json({ authenticated: false });
      }

      // Update last seen
      await storage.updateDeviceSessionLastSeen(session.id);

      // Get member details
      const member = await storage.getFamilyMember(session.memberId);
      if (!member) {
        return res.json({ authenticated: false });
      }

      res.json({
        authenticated: true,
        memberId: member.id,
        memberName: member.displayName,
        familyName: member.familyName,
        role: member.role,
        avatarUrl: member.avatarUrl,
        color: member.color,
        activeSkinId: member.activeSkinId,
        discoveredSkinIds: member.discoveredSkinIds,
        useCustomAvatar: member.useCustomAvatar,
        totalPoints: member.totalPoints,
        totalEarned: member.totalEarned,
        weeklyPoints: member.weeklyPoints,
        monthlyPoints: member.monthlyPoints,
      });
    } catch (error) {
      console.error("Error checking device session:", error);
      res.status(500).json({ message: "Failed to check session" });
    }
  });

  // Child device: Logout (clear session)
  app.post("/api/device-link/logout", async (req: any, res) => {
    try {
      const token = req.cookies?.child_device_token;
      if (token) {
        const hash = crypto.createHash('sha256').update(token).digest('hex');
        const session = await storage.getChildDeviceSessionByTokenHash(hash);
        if (session) {
          await storage.revokeDeviceSession(session.id);
        }
      }

      res.clearCookie('child_device_token', { path: '/' });
      res.json({ success: true });
    } catch (error) {
      console.error("Error logging out device:", error);
      res.status(500).json({ message: "Failed to logout" });
    }
  });

  // Parent: Get linked devices for a child member
  app.get("/api/device-link/devices/:memberId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const parentMember = await storage.getFamilyMemberByUserId(userId);

      if (!parentMember || parentMember.role !== "parent") {
        return res.status(403).json({ message: "Only parents can view linked devices" });
      }

      const { memberId } = req.params;
      const childMember = await storage.getFamilyMember(memberId);

      if (!childMember || childMember.familyName !== parentMember.familyName) {
        return res.status(404).json({ message: "Member not found" });
      }

      const sessions = await storage.getActiveDeviceSessionsForMember(memberId);
      
      res.json(sessions.map(s => ({
        id: s.id,
        deviceLabel: s.deviceLabel,
        lastSeenAt: s.lastSeenAt,
        createdAt: s.createdAt,
      })));
    } catch (error) {
      console.error("Error fetching linked devices:", error);
      res.status(500).json({ message: "Failed to fetch linked devices" });
    }
  });

  // Parent: Revoke a device session
  app.delete("/api/device-link/devices/:sessionId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const parentMember = await storage.getFamilyMemberByUserId(userId);

      if (!parentMember || parentMember.role !== "parent") {
        return res.status(403).json({ message: "Only parents can revoke device access" });
      }

      const { sessionId } = req.params;
      
      // Get session to verify it belongs to a family member
      const sessions = await db.select()
        .from(familyMembers)
        .innerJoin(childDeviceSessions, eq(childDeviceSessions.memberId, familyMembers.id))
        .where(eq(childDeviceSessions.id, sessionId));

      if (sessions.length === 0) {
        return res.status(404).json({ message: "Session not found" });
      }

      const session = sessions[0];
      if (session.family_members.familyName !== parentMember.familyName) {
        return res.status(403).json({ message: "Session not in your family" });
      }

      await storage.revokeDeviceSession(sessionId);
      
      // Broadcast to family that device was revoked
      broadcastToFamily(parentMember.familyName, { type: "device_revoked", sessionId });

      res.json({ success: true });
    } catch (error) {
      console.error("Error revoking device session:", error);
      res.status(500).json({ message: "Failed to revoke device access" });
    }
  });

  // ========================================
  // End of Device Linking
  // ========================================

  // ========================================
  // Admin Dashboard Routes
  // ========================================

  // Admin authentication middleware
  const isAdmin = (req: any, res: any, next: any) => {
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      return res.status(500).json({ message: "Admin password not configured" });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Admin authentication required" });
    }

    const token = authHeader.substring(7);
    if (token !== adminPassword) {
      return res.status(401).json({ message: "Invalid admin credentials" });
    }

    next();
  };

  // Admin login verification
  app.post("/api/admin/login", async (req, res) => {
    try {
      const { password } = req.body;
      const adminPassword = process.env.ADMIN_PASSWORD;

      console.log("Admin login attempt, password length:", password?.length, "expected length:", adminPassword?.length);

      if (!adminPassword) {
        return res.status(500).json({ message: "Admin password not configured" });
      }

      // Trim whitespace from both passwords for comparison
      const trimmedPassword = (password || "").trim();
      const trimmedAdminPassword = adminPassword.trim();

      if (trimmedPassword === trimmedAdminPassword) {
        res.json({ success: true, token: adminPassword });
      } else {
        console.log("Password mismatch - received:", JSON.stringify(password), "expected:", JSON.stringify(adminPassword));
        res.status(401).json({ message: "Invalid admin password" });
      }
    } catch (error) {
      console.error("Admin login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Get all families with member counts and stats
  app.get("/api/admin/families", isAdmin, async (req, res) => {
    try {
      const allFamilies = await storage.getFamilies();
      
      // Get member counts for each family
      const familiesWithStats = await Promise.all(
        allFamilies.map(async (family) => {
          const members = await storage.getFamilyMembersByFamily(family.familyName);
          const tasks = await storage.getTasksByFamily(family.familyName);
          const rewards = await storage.getRewardsByFamily(family.familyName);
          
          const parentCount = members.filter(m => m.role === "parent").length;
          const childCount = members.filter(m => m.role === "child").length;
          const totalPoints = members.reduce((sum, m) => sum + m.totalEarned, 0);
          
          return {
            ...family,
            memberCount: members.length,
            parentCount,
            childCount,
            taskCount: tasks.length,
            rewardCount: rewards.length,
            totalPointsEarned: totalPoints,
          };
        })
      );

      res.json(familiesWithStats);
    } catch (error) {
      console.error("Error fetching admin families:", error);
      res.status(500).json({ message: "Failed to fetch families" });
    }
  });

  // Get single family details with all members
  app.get("/api/admin/families/:familyName", isAdmin, async (req, res) => {
    try {
      const { familyName } = req.params;
      const family = await storage.getFamily(familyName);

      if (!family) {
        return res.status(404).json({ message: "Family not found" });
      }

      const members = await storage.getFamilyMembersByFamily(familyName);
      const tasks = await storage.getTasksByFamily(familyName);
      const rewards = await storage.getRewardsByFamily(familyName);

      res.json({
        family,
        members,
        taskCount: tasks.length,
        rewardCount: rewards.length,
      });
    } catch (error) {
      console.error("Error fetching admin family details:", error);
      res.status(500).json({ message: "Failed to fetch family details" });
    }
  });

  // Get admin dashboard stats
  app.get("/api/admin/stats", isAdmin, async (req, res) => {
    try {
      const allFamilies = await storage.getFamilies();
      
      let totalMembers = 0;
      let totalTasks = 0;
      let totalRewards = 0;
      let totalPointsEarned = 0;
      const tierCounts: Record<string, number> = {
        free: 0,
        family: 0,
        family_plus: 0,
        family_hero: 0,
      };

      for (const family of allFamilies) {
        tierCounts[family.subscriptionTier] = (tierCounts[family.subscriptionTier] || 0) + 1;
        const members = await storage.getFamilyMembersByFamily(family.familyName);
        totalMembers += members.length;
        totalPointsEarned += members.reduce((sum, m) => sum + m.totalEarned, 0);
        const tasks = await storage.getTasksByFamily(family.familyName);
        totalTasks += tasks.length;
        const rewards = await storage.getRewardsByFamily(family.familyName);
        totalRewards += rewards.length;
      }

      res.json({
        totalFamilies: allFamilies.length,
        totalMembers,
        totalTasks,
        totalRewards,
        totalPointsEarned,
        tierCounts,
      });
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Update family subscription tier (admin override)
  app.patch("/api/admin/families/:familyName/tier", isAdmin, async (req, res) => {
    try {
      const { familyName } = req.params;
      const { tier } = req.body;

      if (!["free", "family", "family_plus", "family_hero"].includes(tier)) {
        return res.status(400).json({ message: "Invalid tier" });
      }

      await storage.updateFamilyTier(familyName, tier);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating family tier:", error);
      res.status(500).json({ message: "Failed to update tier" });
    }
  });

  // Remove member from family (admin action)
  app.delete("/api/admin/families/:familyName/members/:memberId", isAdmin, async (req, res) => {
    try {
      const { familyName, memberId } = req.params;
      
      const member = await storage.getFamilyMember(memberId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }
      
      if (member.familyName !== familyName) {
        return res.status(400).json({ message: "Member not in this family" });
      }

      // Check if this is the last parent
      const allMembers = await storage.getFamilyMembersByFamily(familyName);
      const parents = allMembers.filter(m => m.role === "parent");
      
      if (member.role === "parent" && parents.length <= 1) {
        return res.status(400).json({ message: "Cannot remove the last parent from a family" });
      }
      
      await storage.deleteFamilyMember(memberId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing member:", error);
      res.status(500).json({ message: "Failed to remove member" });
    }
  });

  // Add points to a member (admin action for testing)
  app.post("/api/admin/members/:memberId/points", isAdmin, async (req, res) => {
    try {
      const { memberId } = req.params;
      const { points } = req.body;
      
      if (typeof points !== 'number' || points <= 0) {
        return res.status(400).json({ message: "Points must be a positive number" });
      }
      
      const member = await storage.getFamilyMember(memberId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }
      
      // Update all point fields
      await storage.updateFamilyMemberPoints(
        memberId,
        member.totalEarned + points,
        member.totalPoints + points,
        member.weeklyPoints + points,
        member.monthlyPoints + points
      );
      
      // Broadcast update via WebSocket
      broadcastToFamily(member.familyName, { 
        type: "points_updated", 
        memberId,
        addedPoints: points
      });
      
      res.json({ success: true, newTotalPoints: member.totalPoints + points });
    } catch (error) {
      console.error("Error adding points:", error);
      res.status(500).json({ message: "Failed to add points" });
    }
  });

  // Send admin message to a family (broadcasts via WebSocket only - no chat storage)
  app.post("/api/admin/families/:familyName/message", isAdmin, async (req, res) => {
    try {
      const { familyName } = req.params;
      const { message } = req.body;
      
      if (!message || typeof message !== "string") {
        return res.status(400).json({ message: "Message is required" });
      }

      // Get family to verify it exists
      const family = await storage.getFamily(familyName);
      if (!family) {
        return res.status(404).json({ message: "Family not found" });
      }

      // Broadcast admin notification to family via WebSocket
      broadcastToFamily(familyName, { 
        type: "admin_message", 
        message,
        senderName: "HeroKids Admin",
        timestamp: new Date().toISOString()
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error sending admin message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // Get analytics data for charts
  app.get("/api/admin/analytics", isAdmin, async (req, res) => {
    try {
      const allFamilies = await storage.getFamilies();
      const allMembers = await storage.getAllFamilyMembers();
      
      // Get all task completions for activity data
      const completionsByFamily: Record<string, number> = {};
      for (const family of allFamilies) {
        const completions = await storage.getTaskCompletionsByFamily(family.familyName);
        completionsByFamily[family.familyName] = completions.length;
      }
      
      // 1. New registrations per week (last 12 weeks)
      const now = new Date();
      const weeklyRegistrations: { week: string; count: number }[] = [];
      for (let i = 11; i >= 0; i--) {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - (i * 7) - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);
        
        const count = allMembers.filter(m => {
          const created = m.createdAt ? new Date(m.createdAt) : null;
          return created && created >= weekStart && created < weekEnd;
        }).length;
        
        const weekLabel = `KW${Math.ceil((weekStart.getTime() - new Date(weekStart.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1}`;
        weeklyRegistrations.push({ week: weekLabel, count });
      }
      
      // 2. New registrations per month (last 6 months)
      const monthlyRegistrations: { month: string; count: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        
        const count = allMembers.filter(m => {
          const created = m.createdAt ? new Date(m.createdAt) : null;
          return created && created >= monthStart && created < monthEnd;
        }).length;
        
        const monthLabel = monthStart.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
        monthlyRegistrations.push({ month: monthLabel, count });
      }
      
      // 3. Most active families (top 10 by completed tasks)
      const activeFamilies = Object.entries(completionsByFamily)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([name, completions]) => ({ name, completions }));
      
      // 4. Average points per child
      const children = allMembers.filter(m => m.role === 'child');
      const avgPointsPerChild = children.length > 0 
        ? Math.round(children.reduce((sum, c) => sum + c.totalEarned, 0) / children.length)
        : 0;
      
      // Points distribution by role
      const parents = allMembers.filter(m => m.role === 'parent');
      const pointsByRole = [
        { role: 'Kinder', avgPoints: avgPointsPerChild, count: children.length },
        { role: 'Eltern', avgPoints: parents.length > 0 ? Math.round(parents.reduce((sum, p) => sum + p.totalEarned, 0) / parents.length) : 0, count: parents.length },
      ];
      
      // 5. Current subscription tier distribution
      const tierDistribution = [
        { tier: 'Free', count: allFamilies.filter(f => f.subscriptionTier === 'free').length },
        { tier: 'Family', count: allFamilies.filter(f => f.subscriptionTier === 'family').length },
        { tier: 'Family+', count: allFamilies.filter(f => f.subscriptionTier === 'family_plus').length },
        { tier: 'Hero', count: allFamilies.filter(f => f.subscriptionTier === 'family_hero').length },
      ];
      
      res.json({
        weeklyRegistrations,
        monthlyRegistrations,
        activeFamilies,
        avgPointsPerChild,
        pointsByRole,
        tierDistribution,
        totalChildren: children.length,
        totalParents: parents.length,
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Get skin statistics
  app.get("/api/admin/skins/stats", isAdmin, async (req, res) => {
    try {
      const allSkins = await storage.getSkins();
      const allMembers = await storage.getAllFamilyMembers();
      
      // Count how many times each skin is actively used
      const skinUsage: Record<string, { count: number; skin: any }> = {};
      
      for (const skin of allSkins) {
        skinUsage[skin.id] = { count: 0, skin };
      }
      
      for (const member of allMembers) {
        if (member.activeSkinId && skinUsage[member.activeSkinId]) {
          skinUsage[member.activeSkinId].count++;
        }
      }
      
      // Sort by usage count
      const sortedStats = Object.values(skinUsage)
        .sort((a, b) => b.count - a.count)
        .map(({ count, skin }) => ({
          id: skin.id,
          name: skin.name,
          description: skin.description,
          pointsRequired: skin.pointsRequired,
          bonusPoints: skin.bonusPoints,
          usageCount: count,
        }));
      
      res.json({
        totalSkins: allSkins.length,
        stats: sortedStats,
      });
    } catch (error) {
      console.error("Error fetching skin stats:", error);
      res.status(500).json({ message: "Failed to fetch skin stats" });
    }
  });

  // Add new skin
  app.post("/api/admin/skins", isAdmin, async (req, res) => {
    try {
      const { name, description, pointsRequired, imageUrl, bonusPoints } = req.body;
      
      if (!name || !imageUrl) {
        return res.status(400).json({ message: "name and imageUrl are required" });
      }
      
      const id = `custom_${name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
      
      const newSkin = await storage.createSkin({
        id,
        name,
        description: description || null,
        pointsRequired: pointsRequired || 0,
        imageUrl,
        bonusPoints: bonusPoints || 0,
      });
      
      res.json(newSkin);
    } catch (error) {
      console.error("Error adding skin:", error);
      res.status(500).json({ message: "Failed to add skin" });
    }
  });

  // Delete skin
  app.delete("/api/admin/skins/:skinId", isAdmin, async (req, res) => {
    try {
      const { skinId } = req.params;
      await storage.deleteSkin(skinId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting skin:", error);
      res.status(500).json({ message: "Failed to delete skin" });
    }
  });

  // ========================================
  // Data Migration Routes (for syncing dev to production)
  // ========================================
  
  // Export all data as JSON (for backup/migration)
  app.get("/api/admin/export", isAdmin, async (req, res) => {
    try {
      const data = await storage.exportAllData();
      res.json(data);
    } catch (error) {
      console.error("Error exporting data:", error);
      res.status(500).json({ message: "Failed to export data" });
    }
  });
  
  // Import data from JSON (for restoring to production)
  app.post("/api/admin/import", isAdmin, async (req, res) => {
    try {
      const { data, skipExisting = true } = req.body;
      
      if (!data) {
        return res.status(400).json({ message: "No data provided" });
      }
      
      const result = await storage.importAllData(data, skipExisting);
      res.json({ 
        message: "Data imported successfully", 
        ...result 
      });
    } catch (error: any) {
      console.error("Error importing data:", error);
      res.status(500).json({ message: "Failed to import data", error: error.message });
    }
  });

  // Delete multiple families at once (for cleaning up test families)
  app.post("/api/admin/delete-families", isAdmin, async (req, res) => {
    try {
      const { familyNames } = req.body;
      
      if (!familyNames || !Array.isArray(familyNames) || familyNames.length === 0) {
        return res.status(400).json({ message: "No family names provided" });
      }
      
      let deleted = 0;
      const errors: string[] = [];
      
      for (const familyName of familyNames) {
        try {
          await storage.deleteFamily(familyName);
          deleted++;
        } catch (err: any) {
          errors.push(`${familyName}: ${err.message}`);
        }
      }
      
      res.json({ 
        message: `Deleted ${deleted} of ${familyNames.length} families`,
        deleted,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error: any) {
      console.error("Error deleting families:", error);
      res.status(500).json({ message: "Failed to delete families", error: error.message });
    }
  });

  // Reinitialize stars for all members with discovered skins (fix for test families)
  app.post("/api/admin/reinitialize-stars", isAdmin, async (req, res) => {
    try {
      const { familyName } = req.body;
      
      // Get all members (optionally filtered by family)
      let members;
      if (familyName) {
        members = await storage.getFamilyMembersByFamily(familyName);
      } else {
        // Get all members from all families
        const allFamilies = await storage.getFamilies();
        members = [];
        for (const family of allFamilies) {
          const familyMembers = await storage.getFamilyMembersByFamily(family.familyName);
          members.push(...familyMembers);
        }
      }
      
      const results: Array<{ memberId: string; name: string; placed: number }> = [];
      
      for (const member of members) {
        const discoveredCount = member.discoveredSkinIds?.length || 0;
        // Only reinitialize if member has discovered skins
        if (discoveredCount > 0) {
          const result = await storage.reinitializeStarsOnDiscoveredSkins(member.id);
          results.push({ memberId: member.id, name: member.displayName, placed: result.placed });
        }
      }
      
      res.json({ 
        message: `Reinitialized stars for ${results.length} members`, 
        results 
      });
    } catch (error: any) {
      console.error("Error reinitializing stars:", error);
      res.status(500).json({ message: "Failed to reinitialize stars", error: error.message });
    }
  });
  
  // ========================================
  // End of Admin Dashboard Routes
  // ========================================
  
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
