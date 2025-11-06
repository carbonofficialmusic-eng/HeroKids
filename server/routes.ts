import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import { join } from "path";
import { mkdir } from "fs/promises";
import { z } from "zod";
import Stripe from "stripe";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertFamilyMemberSchema, insertTaskSchema, insertRewardSchema, insertRewardRedemptionSchema, insertChatMessageSchema, type Family } from "@shared/schema";
import { getMaxMembers, hasFeature, canAddMember, getMaxSkins, TIER_CONFIG, getAllTiers } from "@shared/tier-config";
import type { SubscriptionTier } from "@shared/tier-config";
import "./types";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-10-29.clover",
});

// Configure multer for photo uploads
const uploadDir = join(process.cwd(), "uploads", "task-proofs");
const avatarUploadDir = join(process.cwd(), "uploads", "avatars");

// Ensure upload directories exist
mkdir(uploadDir, { recursive: true }).catch(console.error);
mkdir(avatarUploadDir, { recursive: true }).catch(console.error);

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + '-' + file.originalname);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: avatarUploadDir,
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, 'avatar-' + uniqueSuffix + '-' + file.originalname);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// WebSocket connection management
const wsClients = new Map<string, Set<WebSocket>>();

// Track uploaded photos to prevent URL spoofing
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

function broadcastToFamily(familyName: string, message: any) {
  const clients = wsClients.get(familyName);
  if (clients) {
    const messageStr = JSON.stringify(message);
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve uploaded files
  app.use('/uploads', (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  });
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

  // Auth middleware
  await setupAuth(app);

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
      
      res.json(family);
    } catch (error) {
      console.error("Error fetching family settings:", error);
      res.status(500).json({ message: "Failed to fetch family settings" });
    }
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
      
      const { showLeaderboard } = req.body;
      
      if (typeof showLeaderboard !== "boolean") {
        return res.status(400).json({ message: "showLeaderboard must be a boolean" });
      }
      
      await storage.updateFamilySettings(member.familyName, { showLeaderboard });
      
      // Broadcast settings change to all family members
      broadcastToFamily(member.familyName, {
        type: "settings_updated",
        settings: { showLeaderboard },
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
      
      const { memberId } = req.body;
      
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
      
      // Set the session to act as this member
      req.session.actingAsMemberId = memberId;
      
      res.json({ message: "Switched member successfully", member: targetMember });
    } catch (error) {
      console.error("Error switching member:", error);
      res.status(500).json({ message: "Failed to switch member" });
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
        
        // Generate a cryptographically secure join code
        const crypto = await import('crypto');
        const joinCode = crypto.randomBytes(4).toString('hex').substring(0, 6).toUpperCase();
        
        // Create member with join code (no userId yet)
        const member = await storage.createFamilyMember({
          ...parsed,
          familyName,
          joinCode,
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
          family = await storage.createFamily({
            familyName: parsed.familyName,
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
      });
      
      const parsed = joinFamilySchema.parse(req.body);
      
      // Normalize join code to uppercase for case-insensitive comparison
      const normalizedJoinCode = parsed.joinCode.toUpperCase();
      
      // Check if user already has a family member profile
      const existingMember = await storage.getFamilyMemberByUserId(userId);
      
      if (existingMember) {
        return res.status(400).json({ message: "You are already part of a family" });
      }
      
      // Find the member record with this join code
      const memberWithCode = await storage.getFamilyMemberByJoinCode(normalizedJoinCode);
      
      if (!memberWithCode) {
        return res.status(404).json({ message: "Invalid join code" });
      }
      
      // Check if this member slot is already claimed
      if (memberWithCode.userId) {
        return res.status(400).json({ message: "This join code has already been used" });
      }
      
      // Update the member with the user's ID and profile info
      const updatedMember = await storage.linkUserToFamilyMember(
        memberWithCode.id,
        userId,
        { 
          displayName: parsed.displayName, 
          avatarUrl: parsed.avatarUrl, 
          color: parsed.color 
        }
      );
      
      // Broadcast member joined to family
      broadcastToFamily(updatedMember.familyName, {
        type: "member_joined",
        member: updatedMember,
      });
      
      res.json(updatedMember);
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
      
      // Update the member
      const updates = {
        displayName: req.body.displayName,
        avatarUrl: req.body.avatarUrl,
        color: req.body.color,
        role: req.body.role,
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

  // Avatar upload endpoint
  app.post("/api/upload-avatar", isAuthenticated, avatarUpload.single('avatar'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No avatar file provided" });
      }
      
      // Generate URL for the uploaded file
      const avatarUrl = `/uploads/avatars/${req.file.filename}`;
      
      res.json({ avatarUrl });
    } catch (error: any) {
      console.error("Error uploading avatar:", error);
      res.status(500).json({ message: "Failed to upload avatar" });
    }
  });

  // Task routes
  app.get("/api/tasks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const member = await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      const tasks = await storage.getTasksByFamily(member.familyName);
      res.json(tasks);
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

  // Photo upload endpoint for task proof
  app.post("/api/tasks/:taskId/upload-proof", isAuthenticated, upload.single('photo'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { taskId } = req.params;
      
      if (!req.file) {
        return res.status(422).json({ message: "No photo file provided" });
      }
      
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
      
      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      if (task.familyName !== member.familyName) {
        return res.status(403).json({ message: "Task not in your family" });
      }
      
      // Generate URL for the uploaded file
      const photoUrl = `/uploads/task-proofs/${req.file.filename}`;
      
      // Track this upload to prevent URL spoofing
      uploadedPhotos.set(photoUrl, {
        memberId: member.id,
        taskId: taskId,
        timestamp: Date.now(),
      });
      
      res.json({ photoUrl });
    } catch (error: any) {
      console.error("Error uploading proof photo:", error);
      res.status(500).json({ message: "Failed to upload photo" });
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
      
      // Create completion record with pending status (no points awarded yet)
      const completion = await storage.createTaskCompletion({
        taskId: task.id,
        memberId: member.id,
        pointsEarned: task.points,
        proofPhotoUrl: proofPhotoUrl || null,
        status: "pending",
      });
      
      // DO NOT update member points here - they will be awarded upon parent approval
      
      // Handle recurring tasks with custom days interval
      if (task.recurrenceDays) {
        // Calculate next available date based on custom interval
        const now = new Date();
        const nextAvailableDate = new Date(now.getTime() + task.recurrenceDays * 24 * 60 * 60 * 1000);
        
        // Update the task's nextAvailableDate instead of marking completed
        await storage.updateTaskNextAvailableDate(taskId, nextAvailableDate);
      } else if (task.recurrence !== "none") {
        // Handle old-style recurring tasks (daily/weekly/monthly)
        // Calculate next due date based on recurrence
        let nextDueDate: Date | null = null;
        const now = new Date();
        
        if (task.dueDate) {
          const currentDue = new Date(task.dueDate);
          switch (task.recurrence) {
            case "daily":
              nextDueDate = new Date(currentDue.setDate(currentDue.getDate() + 1));
              break;
            case "weekly":
              nextDueDate = new Date(currentDue.setDate(currentDue.getDate() + 7));
              break;
            case "monthly":
              nextDueDate = new Date(currentDue.setMonth(currentDue.getMonth() + 1));
              break;
          }
        } else {
          // For tasks without due dates, set next occurrence based on current time
          switch (task.recurrence) {
            case "daily":
              nextDueDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
              break;
            case "weekly":
              nextDueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
              break;
            case "monthly":
              nextDueDate = new Date(now);
              nextDueDate.setMonth(nextDueDate.getMonth() + 1);
              break;
          }
        }
        
        // Mark current instance as completed first to prevent duplicates
        await storage.updateTaskStatus(taskId, "completed");
        
        // Create new instance of the recurring task
        const newTask = await storage.createTask({
          familyName: task.familyName,
          createdBy: task.createdBy,
          title: task.title,
          description: task.description,
          points: task.points,
          dueDate: nextDueDate,
          recurrence: task.recurrence,
          status: "active",
          requiresProof: task.requiresProof,
          iconEmoji: task.iconEmoji,
        });
        
        // Copy all task assignments to the new instance
        const assignedMemberIds = await storage.getTaskAssignmentsByTask(taskId);
        for (const memberId of assignedMemberIds) {
          await storage.createTaskAssignment({
            taskId: newTask.id,
            memberId: memberId,
          });
        }
      } else {
        // Non-recurring tasks are simply marked as completed
        await storage.updateTaskStatus(taskId, "completed");
      }
      
      // Get updated member data
      const updatedMember = await storage.getFamilyMember(member.id);
      
      // Broadcast pending completion to family (so parents know to approve)
      broadcastToFamily(member.familyName, {
        type: "task_completion_pending",
        taskId: task.id,
        completionId: completion.id,
        member: updatedMember,
        pointsEarned: task.points,
      });
      
      res.json({
        success: true,
        message: "Task completion submitted! Awaiting parent approval.",
        completion,
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
      
      // Broadcast rejection to family
      broadcastToFamily(member.familyName, {
        type: "task_completion_rejected",
        completionId,
        taskId: completion.taskId,
        memberId: childMember.id,
        rejectedBy: member.displayName,
        reason: reason || "Did not meet expectations",
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
    try {
      const userId = req.user.claims.sub;
      const { rewardId } = req.params;
      
      // Use acting member if available, otherwise use authenticated user
      const actingMemberId = req.session.actingAsMemberId;
      const member = actingMemberId 
        ? await storage.getFamilyMemberById(actingMemberId)
        : await storage.getFamilyMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Family member not found" });
      }
      
      // Get the reward
      const rewards = await storage.getRewardsByFamily(member.familyName);
      const reward = rewards.find(r => r.id === rewardId);
      
      if (!reward) {
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
        status: "pending",
      });
      
      // Add to points history
      await storage.addPointsHistory({
        memberId: member.id,
        points: -reward.pointThreshold,
        reason: `Redeemed: ${reward.title}`,
        taskId: null,
      });
      
      // Increment rewards redeemed counter and check for skin unlocks
      const newRewardsCount = await storage.incrementRewardsRedeemed(member.id);
      const allSkins = await storage.getSkins();
      
      // Get family tier to check skin limits
      const family = await storage.getFamily(member.familyName);
      const tier = family?.subscriptionTier as SubscriptionTier || "free";
      const maxSkins = getMaxSkins(tier);
      let currentUnlockedCount = member.unlockedSkins.length;
      
      // Find skins that should be unlocked but aren't yet (respecting tier limits)
      const eligibleSkins = allSkins.filter(skin => 
        skin.unlockThreshold <= newRewardsCount && 
        !member.unlockedSkins.includes(skin.id)
      );
      
      // Unlock new skins (up to tier limit)
      const actuallyUnlockedSkins = [];
      for (const skin of eligibleSkins) {
        // Check if we've reached the tier limit
        if (currentUnlockedCount < maxSkins) {
          await storage.unlockSkin(member.id, skin.id);
          actuallyUnlockedSkins.push(skin);
          currentUnlockedCount++;
        }
      }
      const newlyUnlockedSkins = actuallyUnlockedSkins;
      
      // Auto-select first skin if none selected
      if (newlyUnlockedSkins.length > 0 && !member.activeSkinId) {
        await storage.updateFamilyMemberActiveSkin(member.id, newlyUnlockedSkins[0].id);
      }
      
      // Broadcast redemption to family
      broadcastToFamily(member.familyName, {
        type: "reward_redeemed",
        redemption,
        member: { ...member, totalPoints: newTotalPoints },
      });
      
      // Broadcast skin unlocks if any
      if (newlyUnlockedSkins.length > 0) {
        broadcastToFamily(member.familyName, {
          type: "skins_unlocked",
          memberId: member.id,
          skins: newlyUnlockedSkins.map(s => ({ id: s.id, name: s.name })),
        });
      }
      
      res.json({ 
        redemption: {
          ...redemption,
          rewardTitle: reward.title,
        },
        newTotalPoints,
        unlockedSkins: newlyUnlockedSkins,
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
      res.json(redemptions);
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

      // If approved, increment rewards redeemed and check for skin unlocks
      if (status === "approved" && redemption.status !== "approved") {
        // Fetch full member data to access unlockedSkins and activeSkinId
        let fullMember = await storage.getFamilyMemberById(redemption.memberId);
        if (!fullMember) {
          return res.status(404).json({ message: "Member not found" });
        }
        
        const newRewardsCount = await storage.incrementRewardsRedeemed(fullMember.id);
        const allSkins = await storage.getSkins();
        
        // Get family tier to check skin limits
        const family = await storage.getFamily(fullMember.familyName);
        const tier = family?.subscriptionTier as SubscriptionTier || "free";
        const maxSkins = getMaxSkins(tier);
        let currentUnlockedCount = fullMember.unlockedSkins.length;
        
        // Find skins that should be unlocked but aren't yet (respecting tier limits)
        const eligibleSkins = allSkins.filter(skin => 
          skin.unlockThreshold <= newRewardsCount && 
          fullMember && !fullMember.unlockedSkins.includes(skin.id)
        );
        
        // Unlock new skins (up to tier limit)
        const actuallyUnlockedSkins = [];
        for (const skin of eligibleSkins) {
          // Check if we've reached the tier limit
          if (currentUnlockedCount < maxSkins) {
            await storage.unlockSkin(fullMember.id, skin.id);
            actuallyUnlockedSkins.push(skin);
            currentUnlockedCount++;
          }
        }
        const newlyUnlockedSkins = actuallyUnlockedSkins;
        
        // Refresh member data after unlocking to get updated unlockedSkins and activeSkinId
        if (newlyUnlockedSkins.length > 0) {
          const refreshedMember = await storage.getFamilyMemberById(redemption.memberId);
          if (refreshedMember) {
            fullMember = refreshedMember;
          }
        }
        
        // Auto-select first skin if none selected (only after refresh so we have current state)
        if (newlyUnlockedSkins.length > 0 && !fullMember.activeSkinId) {
          await storage.updateFamilyMemberActiveSkin(fullMember.id, newlyUnlockedSkins[0].id);
        }
        
        // Broadcast skin unlocks if any
        if (newlyUnlockedSkins.length > 0) {
          broadcastToFamily(member.familyName, {
            type: "skins_unlocked",
            memberId: fullMember.id,
            skins: newlyUnlockedSkins.map(s => ({ id: s.id, name: s.name })),
          });
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
      
      // Enrich skins with unlock status for this member
      const skinsWithStatus = allSkins.map(skin => ({
        ...skin,
        isUnlocked: member.unlockedSkins.includes(skin.id),
        isActive: member.activeSkinId === skin.id,
        canUnlock: member.rewardsRedeemed >= skin.unlockThreshold,
      }));
      
      res.json({
        skins: skinsWithStatus,
        rewardsRedeemed: member.rewardsRedeemed,
      });
    } catch (error: any) {
      console.error("Error fetching skins:", error);
      res.status(500).json({ message: "Failed to fetch skins" });
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
      
      // Allow null to reset to default avatar, otherwise verify skin is unlocked
      if (skinId !== null && !member.unlockedSkins.includes(skinId)) {
        return res.status(403).json({ message: "Skin not unlocked" });
      }
      
      await storage.updateFamilyMemberActiveSkin(member.id, skinId);
      
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

  // ===== Stripe Integration =====
  
  // Create Stripe Checkout Session
  app.post("/api/create-checkout-session", isAuthenticated, async (req: any, res) => {
    try {
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
      // Construct base URL with proper scheme
      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
        : 'http://localhost:5000';
      
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
        success_url: `${baseUrl}/?subscription=success`,
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
  
  // Stripe Webhook Handler (requires raw body)
  app.post("/api/stripe-webhook", async (req: any, res) => {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    console.log("🔔 Webhook received:", { 
      hasSignature: !!sig, 
      hasSecret: !!webhookSecret,
      hasRawBody: !!req.rawBody 
    });
    
    if (!webhookSecret) {
      console.warn("STRIPE_WEBHOOK_SECRET not configured");
      return res.status(400).send("Webhook secret not configured");
    }
    
    if (!req.rawBody) {
      console.error("No raw body available for webhook");
      return res.status(400).send("No raw body available");
    }
    
    let event: Stripe.Event;
    
    try {
      // Use the rawBody that was saved by the express.json verify callback
      event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
      console.log("✅ Webhook event verified:", event.type);
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
      
      // Handle the event
      try {
        switch (event.type) {
          case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;
            const familyName = session.metadata?.familyName;
            const tier = session.metadata?.tier as SubscriptionTier;
            
            if (familyName && tier) {
              await storage.updateFamily(familyName, {
                subscriptionTier: tier,
                subscriptionStatus: "active",
                billingSubscriptionId: session.subscription as string,
              });
              
              console.log(`✅ Subscription activated for ${familyName}: ${tier}`);
            }
            break;
          }
          
          case "customer.subscription.updated": {
            const subscription = event.data.object as Stripe.Subscription;
            const customerId = subscription.customer as string;
            
            // Find family by customer ID
            const families = await storage.getFamilies();
            const family = families.find((f: Family) => f.billingCustomerId === customerId);
            
            if (family) {
              await storage.updateFamily(family.familyName, {
                subscriptionStatus: subscription.status as any,
              });
              
              console.log(`📝 Subscription updated for ${family.familyName}: ${subscription.status}`);
            }
            break;
          }
          
          case "customer.subscription.deleted": {
            const subscription = event.data.object as Stripe.Subscription;
            const customerId = subscription.customer as string;
            
            // Find family by customer ID
            const families = await storage.getFamilies();
            const family = families.find((f: Family) => f.billingCustomerId === customerId);
            
            if (family) {
              await storage.updateFamily(family.familyName, {
                subscriptionTier: "free",
                subscriptionStatus: "canceled",
              });
              
              console.log(`❌ Subscription canceled for ${family.familyName}`);
            }
            break;
          }
          
          default:
            console.log(`Unhandled event type: ${event.type}`);
        }
        
        res.json({ received: true });
      } catch (error: any) {
        console.error("Error handling webhook event:", error);
        res.status(500).json({ message: "Webhook handler error" });
      }
    }
  );

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
