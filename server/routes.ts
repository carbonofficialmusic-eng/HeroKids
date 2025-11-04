import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import { join } from "path";
import { mkdir } from "fs/promises";
import { z } from "zod";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertFamilyMemberSchema, insertTaskSchema, insertRewardSchema, insertRewardRedemptionSchema } from "@shared/schema";
import "./types";

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
          const tierLimits: Record<string, number> = {
            free: 2,
            family: 4,
            family_plus: 6,
            hero_pro: Infinity,
          };
          
          const currentCount = await storage.getFamilyMemberCount(familyName);
          const limit = tierLimits[family.subscriptionTier];
          
          if (currentCount >= limit) {
            return res.status(403).json({
              message: `Your ${family.subscriptionTier} plan is limited to ${limit} members. Upgrade to add more family members.`,
              currentTier: family.subscriptionTier,
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
          const tierLimits: Record<string, number> = {
            free: 2,
            family: 4,
            family_plus: 6,
            hero_pro: Infinity,
          };
          
          const currentCount = await storage.getFamilyMemberCount(parsed.familyName);
          const limit = tierLimits[family.subscriptionTier];
          
          if (currentCount >= limit) {
            return res.status(403).json({
              message: `Your ${family.subscriptionTier} plan is limited to ${limit} members. Upgrade to add more family members.`,
              currentTier: family.subscriptionTier,
              currentCount,
              limit,
            });
          }
        }
        
        // Create member linked to current user
        const member = await storage.createFamilyMember({
          ...parsed,
          userId, // Associate with authenticated user
        });
        
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

      // Parse and update the task
      const parsed = insertTaskSchema.partial().parse(req.body);
      const taskData = {
        ...parsed,
        dueDate: parsed.dueDate ? new Date(parsed.dueDate) : undefined,
      };
      
      const updatedTask = await storage.updateTask(taskId, taskData);

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
      
      // Create completion record
      const completion = await storage.createTaskCompletion({
        taskId: task.id,
        memberId: member.id,
        pointsEarned: task.points,
        proofPhotoUrl: proofPhotoUrl || null,
      });
      
      // Update member points
      const newTotalEarned = member.totalEarned + task.points; // Lifetime achievement (never decreases)
      const newTotalPoints = member.totalPoints + task.points; // Available balance
      const newWeeklyPoints = member.weeklyPoints + task.points;
      const newMonthlyPoints = member.monthlyPoints + task.points;
      
      await storage.updateFamilyMemberPoints(
        member.id,
        newTotalEarned,
        newTotalPoints,
        newWeeklyPoints,
        newMonthlyPoints
      );
      
      // Add to points history
      await storage.addPointsHistory({
        memberId: member.id,
        points: task.points,
        reason: `Completed: ${task.title}`,
        taskId: task.id,
      });
      
      // Handle recurring tasks
      if (task.recurrence !== "none") {
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
      
      // Broadcast completion to family
      broadcastToFamily(member.familyName, {
        type: "task_completed",
        taskId: task.id,
        member: updatedMember,
        pointsEarned: task.points,
      });
      
      res.json({
        success: true,
        pointsEarned: task.points,
        newTotalPoints: newTotalPoints,
        completion,
      });
    } catch (error: any) {
      console.error("Error completing task:", error);
      res.status(500).json({ message: "Failed to complete task" });
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
      
      // Find skins that should be unlocked but aren't yet
      const newlyUnlockedSkins = allSkins.filter(skin => 
        skin.unlockThreshold <= newRewardsCount && 
        !member.unlockedSkins.includes(skin.id)
      );
      
      // Unlock new skins
      for (const skin of newlyUnlockedSkins) {
        await storage.unlockSkin(member.id, skin.id);
      }
      
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
        
        // Find skins that should be unlocked but aren't yet
        const newlyUnlockedSkins = allSkins.filter(skin => 
          skin.unlockThreshold <= newRewardsCount && 
          !fullMember.unlockedSkins.includes(skin.id)
        );
        
        // Unlock new skins
        for (const skin of newlyUnlockedSkins) {
          await storage.unlockSkin(fullMember.id, skin.id);
        }
        
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
      
      // Verify skin exists and is unlocked
      if (!member.unlockedSkins.includes(skinId)) {
        return res.status(403).json({ message: "Skin not unlocked" });
      }
      
      await storage.updateFamilyMemberActiveSkin(member.id, skinId);
      
      // Broadcast skin change to family
      broadcastToFamily(member.familyName, {
        type: "skin_changed",
        memberId: member.id,
        skinId,
      });
      
      res.json({ message: "Skin selected", skinId });
    } catch (error: any) {
      console.error("Error selecting skin:", error);
      res.status(500).json({ message: "Failed to select skin" });
    }
  });

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
