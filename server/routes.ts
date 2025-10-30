import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import { join } from "path";
import { mkdir } from "fs/promises";
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
  for (const [photoUrl, data] of uploadedPhotos.entries()) {
    if (data.timestamp < oneHourAgo) {
      uploadedPhotos.delete(photoUrl);
    }
  }
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
        
        // Check subscription tier limits
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
        
        // Check subscription tier limits
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
        
        // Create member linked to current user
        const member = await storage.createFamilyMember({
          ...parsed,
          userId,
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
      const newTotalPoints = member.totalPoints + task.points;
      const newWeeklyPoints = member.weeklyPoints + task.points;
      const newMonthlyPoints = member.monthlyPoints + task.points;
      
      await storage.updateFamilyMemberPoints(
        member.id,
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

  // Redeem a reward
  app.post("/api/rewards/:rewardId/redeem", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { rewardId } = req.params;
      
      const member = await storage.getFamilyMemberByUserId(userId);
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
      
      // Deduct points
      const newTotalPoints = member.totalPoints - reward.pointThreshold;
      await storage.updateFamilyMemberPoints(
        member.id,
        newTotalPoints,
        member.weeklyPoints,
        member.monthlyPoints
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
      
      // Broadcast redemption to family
      broadcastToFamily(member.familyName, {
        type: "reward_redeemed",
        redemption,
        member: { ...member, totalPoints: newTotalPoints },
      });
      
      res.json({ 
        redemption, 
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

  const httpServer = createServer(app);

  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws: WebSocket, req: any) => {
    console.log("WebSocket client connected");
    
    let familyName: string | null = null;

    ws.on("message", (message: string) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === "join_family") {
          familyName = data.familyName;
          
          if (!wsClients.has(familyName)) {
            wsClients.set(familyName, new Set());
          }
          wsClients.get(familyName)!.add(ws);
          
          console.log(`Client joined family: ${familyName}`);
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
