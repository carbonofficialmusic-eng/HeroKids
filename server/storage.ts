import {
  users,
  families,
  familyMembers,
  tasks,
  taskAssignments,
  taskCompletions,
  rewards,
  rewardRedemptions,
  rewardRequests,
  pointsHistory,
  skins,
  chatMessages,
  type User,
  type UpsertUser,
  type Family,
  type InsertFamily,
  type FamilyMember,
  type InsertFamilyMember,
  type Task,
  type InsertTask,
  type InsertTaskAssignment,
  type InsertTaskCompletion,
  type Reward,
  type InsertReward,
  type RewardRedemption,
  type InsertRewardRedemption,
  type RewardRequest,
  type InsertRewardRequest,
  type InsertPointsHistory,
  type TaskCompletion,
  type Skin,
  type ChatMessage,
  type InsertChatMessage,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, gt, sql, inArray } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Family operations
  getFamily(familyName: string): Promise<Family | undefined>;
  getFamilies(): Promise<Family[]>;
  getFamilyByJoinCode(joinCode: string): Promise<Family | undefined>;
  createFamily(family: InsertFamily): Promise<Family>;
  updateFamily(familyName: string, updates: Partial<InsertFamily>): Promise<Family>;
  updateFamilyTier(familyName: string, tier: "free" | "family" | "family_plus" | "family_hero"): Promise<void>;
  updateFamilySettings(familyName: string, settings: Partial<Pick<Family, "showLeaderboard" | "singleDeviceMode" | "language" | "weeklyPrize" | "monthlyPrize" | "yearlyPrize">>): Promise<void>;

  // Family member operations
  getFamilyMember(id: string): Promise<FamilyMember | undefined>;
  getFamilyMemberById(id: string): Promise<FamilyMember | undefined>;
  getFamilyMemberByUserId(userId: string): Promise<FamilyMember | undefined>;
  getFamilyMemberByJoinCode(joinCode: string): Promise<FamilyMember | undefined>;
  getFamilyMembersByFamily(familyName: string): Promise<FamilyMember[]>;
  getFamilyMemberCount(familyName: string): Promise<number>;
  createFamilyMember(member: InsertFamilyMember): Promise<FamilyMember>;
  updateFamilyMember(id: string, updates: Partial<InsertFamilyMember>): Promise<FamilyMember>;
  linkUserToFamilyMember(id: string, userId: string, updates: { displayName: string; avatarUrl: string; color: string }): Promise<FamilyMember>;
  deleteFamilyMember(id: string): Promise<void>;
  updateFamilyMemberPoints(
    id: string,
    totalEarned: number,
    totalPoints: number,
    weeklyPoints: number,
    monthlyPoints: number
  ): Promise<void>;
  resetAllWeeklyPoints(): Promise<void>;
  resetAllMonthlyPoints(): Promise<void>;
  setPinCode(memberId: string, pinCode: string): Promise<void>;
  clearPinCode(memberId: string): Promise<void>;
  validatePin(memberId: string, pinCode: string): Promise<boolean>;

  // Task operations
  getTask(id: string): Promise<Task | undefined>;
  getTasksByFamily(familyName: string): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, task: Partial<InsertTask>): Promise<Task>;
  updateTaskStatus(id: string, status: "active" | "completed" | "archived"): Promise<void>;
  updateTaskNextAvailableDate(id: string, nextAvailableDate: Date): Promise<void>;
  deleteTask(id: string): Promise<void>;

  // Task assignment operations
  createTaskAssignment(assignment: InsertTaskAssignment): Promise<void>;
  getTaskAssignmentsByMember(memberId: string): Promise<string[]>;
  getTaskAssignmentsByTask(taskId: string): Promise<string[]>;

  // Task completion operations
  createTaskCompletion(completion: InsertTaskCompletion): Promise<TaskCompletion>;
  hasActiveMemberCompletion(taskId: string, memberId: string, txClient?: any): Promise<boolean>;
  getTaskCompletionsByMember(memberId: string): Promise<TaskCompletion[]>;
  getPendingCompletionsByFamily(familyName: string): Promise<any[]>;
  approveTaskCompletion(completionId: string, approvedBy: string): Promise<void>;
  rejectTaskCompletion(completionId: string, approvedBy: string, rejectionReason: string): Promise<void>;
  getTaskCompletion(completionId: string): Promise<TaskCompletion | undefined>;

  // Reward operations
  getRewardsByFamily(familyName: string): Promise<Reward[]>;
  createReward(reward: InsertReward): Promise<Reward>;
  updateReward(id: string, reward: InsertReward): Promise<Reward>;
  deleteReward(id: string): Promise<void>;
  
  // Reward redemption operations
  createRewardRedemption(redemption: InsertRewardRedemption): Promise<RewardRedemption>;
  getRewardRedemptionsByFamily(familyName: string): Promise<any[]>;
  getRewardRedemptionsByMember(memberId: string): Promise<RewardRedemption[]>;
  updateRewardRedemptionStatus(id: string, status: string): Promise<void>;

  // Reward request operations
  createRewardRequest(request: InsertRewardRequest): Promise<RewardRequest>;
  getRewardRequestsByFamily(familyName: string): Promise<any[]>;
  updateRewardRequest(id: string, data: { title: string; description: string | null; pointThreshold: number }): Promise<void>;
  updateRewardRequestStatus(id: string, status: string, reviewedBy: string): Promise<void>;

  // Points history operations
  addPointsHistory(history: InsertPointsHistory): Promise<void>;

  // Skin operations
  getSkins(): Promise<any[]>;
  updateFamilyMemberActiveSkin(memberId: string, skinId: string | null): Promise<void>;
  unlockSkin(memberId: string, skinId: string): Promise<void>;
  incrementRewardsRedeemed(memberId: string): Promise<number>;

  // Factory reset operation
  resetFamilyToFactory(familyName: string): Promise<void>;

  // Analytics operations
  getAnalytics(familyName: string): Promise<any>;

  // Chat operations (Family+ and Family Hero tier)
  getChatMessages(familyName: string, limit?: number): Promise<any[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  updateLastReadChatAt(memberId: string): Promise<void>;
  getUnreadMessageCount(memberId: string, familyName: string): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Family operations
  async getFamily(familyName: string): Promise<Family | undefined> {
    const [family] = await db
      .select()
      .from(families)
      .where(eq(families.familyName, familyName));
    return family;
  }

  async createFamily(familyData: InsertFamily): Promise<Family> {
    const [family] = await db.insert(families).values(familyData).returning();
    return family;
  }

  async updateFamilyTier(
    familyName: string,
    tier: "free" | "family" | "family_plus" | "family_hero"
  ): Promise<void> {
    await db
      .update(families)
      .set({ subscriptionTier: tier, updatedAt: new Date() })
      .where(eq(families.familyName, familyName));
  }

  async updateFamilySettings(
    familyName: string,
    settings: Partial<Pick<Family, "showLeaderboard" | "singleDeviceMode" | "language" | "weeklyPrize" | "monthlyPrize" | "yearlyPrize">>
  ): Promise<void> {
    await db
      .update(families)
      .set({ ...settings, updatedAt: new Date() })
      .where(eq(families.familyName, familyName));
  }

  async getFamilies(): Promise<Family[]> {
    return await db.select().from(families);
  }

  async updateFamily(familyName: string, updates: Partial<InsertFamily>): Promise<Family> {
    const [family] = await db
      .update(families)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(families.familyName, familyName))
      .returning();
    return family;
  }

  async getFamilyByJoinCode(joinCode: string): Promise<Family | undefined> {
    const [family] = await db
      .select()
      .from(families)
      .where(eq(families.joinCode, joinCode));
    return family;
  }

  // Family member operations
  async getFamilyMember(id: string): Promise<FamilyMember | undefined> {
    const [member] = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.id, id));
    return member;
  }

  async getFamilyMemberByUserId(userId: string): Promise<FamilyMember | undefined> {
    const [member] = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, userId));
    return member;
  }

  async getFamilyMemberByJoinCode(joinCode: string): Promise<FamilyMember | undefined> {
    // This method is deprecated - join codes are now at the family level
    // Kept for backwards compatibility only
    return undefined;
  }

  async linkUserToFamilyMember(
    id: string,
    userId: string,
    updates: { displayName: string; avatarUrl: string; color: string }
  ): Promise<FamilyMember> {
    const [member] = await db
      .update(familyMembers)
      .set({
        userId,
        displayName: updates.displayName,
        avatarUrl: updates.avatarUrl,
        color: updates.color,
      })
      .where(eq(familyMembers.id, id))
      .returning();
    return member;
  }

  async getFamilyMembersByFamily(familyName: string): Promise<FamilyMember[]> {
    return await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.familyName, familyName))
      .orderBy(desc(familyMembers.totalPoints));
  }

  async getFamilyMemberCount(familyName: string): Promise<number> {
    const members = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.familyName, familyName));
    return members.length;
  }

  async createFamilyMember(memberData: InsertFamilyMember): Promise<FamilyMember> {
    const [member] = await db
      .insert(familyMembers)
      .values(memberData)
      .returning();
    
    // New members start with no skins unlocked
    // They will unlock skins as they redeem rewards (Dino at 3, Police at 6, etc.)
    
    return member;
  }

  async getFamilyMemberById(id: string): Promise<FamilyMember | undefined> {
    const [member] = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.id, id));
    return member;
  }

  async updateFamilyMember(id: string, updates: Partial<InsertFamilyMember>): Promise<FamilyMember> {
    // Prevent direct pinCode updates - must use setPinCode or clearPinCode
    const { pinCode, ...safeUpdates } = updates;
    if (pinCode !== undefined) {
      throw new Error("Direct pinCode updates not allowed. Use setPinCode or clearPinCode methods.");
    }
    
    const [updated] = await db
      .update(familyMembers)
      .set({ ...safeUpdates, updatedAt: new Date() })
      .where(eq(familyMembers.id, id))
      .returning();
    return updated as FamilyMember;
  }


  async deleteFamilyMember(id: string): Promise<void> {
    await db.delete(familyMembers).where(eq(familyMembers.id, id));
  }

  async updateFamilyMemberPoints(
    id: string,
    totalEarned: number,
    totalPoints: number,
    weeklyPoints: number,
    monthlyPoints: number
  ): Promise<void> {
    await db
      .update(familyMembers)
      .set({ totalEarned, totalPoints, weeklyPoints, monthlyPoints, updatedAt: new Date() })
      .where(eq(familyMembers.id, id));
  }

  async resetAllWeeklyPoints(): Promise<void> {
    await db
      .update(familyMembers)
      .set({ weeklyPoints: 0, updatedAt: new Date() });
  }

  async resetAllMonthlyPoints(): Promise<void> {
    await db
      .update(familyMembers)
      .set({ monthlyPoints: 0, updatedAt: new Date() });
  }

  async setPinCode(memberId: string, pinCode: string): Promise<void> {
    const bcrypt = await import("bcrypt");
    const hashedPin = await bcrypt.hash(pinCode, 10);
    await db
      .update(familyMembers)
      .set({ pinCode: hashedPin, updatedAt: new Date() })
      .where(eq(familyMembers.id, memberId));
  }

  async clearPinCode(memberId: string): Promise<void> {
    await db
      .update(familyMembers)
      .set({ pinCode: null, updatedAt: new Date() })
      .where(eq(familyMembers.id, memberId));
  }

  async validatePin(memberId: string, pinCode: string): Promise<boolean> {
    const member = await this.getFamilyMember(memberId);
    if (!member || !member.pinCode) {
      return false;
    }
    const bcrypt = await import("bcrypt");
    return await bcrypt.compare(pinCode, member.pinCode);
  }

  // Task operations
  async getTask(id: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task;
  }

  async getTasksByFamily(familyName: string): Promise<Task[]> {
    // Return all active tasks, including those with future nextAvailableDate
    // The frontend will display unavailable tasks as greyed out with a done indicator
    const allTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.familyName, familyName))
      .orderBy(desc(tasks.createdAt));
    
    return allTasks;
  }

  async createTask(taskData: InsertTask): Promise<Task> {
    const [task] = await db.insert(tasks).values(taskData).returning();
    return task;
  }

  async updateTask(id: string, taskUpdate: Partial<InsertTask>): Promise<Task> {
    // Validation: prevent lowering maxCompletions below current completionCount
    if (taskUpdate.maxCompletions !== undefined && taskUpdate.maxCompletions !== null) {
      const [existing] = await db.select().from(tasks).where(eq(tasks.id, id));
      if (existing && taskUpdate.maxCompletions < existing.completionCount) {
        throw new Error('Cannot set maxCompletions below current completion count');
      }
    }
    
    const [updated] = await db
      .update(tasks)
      .set({ ...taskUpdate, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    return updated as Task;
  }

  async updateTaskStatus(
    id: string,
    status: "active" | "completed" | "archived"
  ): Promise<void> {
    await db
      .update(tasks)
      .set({ status, updatedAt: new Date() })
      .where(eq(tasks.id, id));
  }

  async updateTaskNextAvailableDate(
    id: string,
    nextAvailableDate: Date
  ): Promise<void> {
    await db
      .update(tasks)
      .set({ nextAvailableDate, updatedAt: new Date() })
      .where(eq(tasks.id, id));
  }

  async deleteTask(id: string): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  // Task assignment operations
  async createTaskAssignment(assignmentData: InsertTaskAssignment): Promise<void> {
    await db.insert(taskAssignments).values(assignmentData);
  }

  async getTaskAssignmentsByMember(memberId: string): Promise<string[]> {
    const assignments = await db
      .select()
      .from(taskAssignments)
      .where(eq(taskAssignments.memberId, memberId));
    return assignments.map((a) => a.taskId);
  }

  async getTaskAssignmentsByTask(taskId: string): Promise<string[]> {
    const assignments = await db
      .select()
      .from(taskAssignments)
      .where(eq(taskAssignments.taskId, taskId));
    return assignments.map((a) => a.memberId);
  }

  // Task completion operations
  async hasActiveMemberCompletion(taskId: string, memberId: string, txClient?: any): Promise<boolean> {
    const client = txClient || db;
    
    const [result] = await client
      .select({ count: sql<number>`count(*)` })
      .from(taskCompletions)
      .where(
        and(
          eq(taskCompletions.taskId, taskId),
          eq(taskCompletions.memberId, memberId),
          inArray(taskCompletions.status, ["pending", "approved"])
        )
      );
    return Number(result?.count || 0) > 0;
  }

  async createTaskCompletion(completionData: InsertTaskCompletion): Promise<TaskCompletion> {
    return await db.transaction(async (tx) => {
      // 1. Lock task: SELECT * FROM tasks WHERE id = taskId FOR UPDATE
      const task = await tx.select().from(tasks).where(eq(tasks.id, completionData.taskId)).for('update');
      if (!task[0]) throw new Error('Task not found');
      
      // 2. If maxCompletions mode: validate
      if (task[0].maxCompletions !== null) {
        // Check if member already completed
        const hasCompleted = await this.hasActiveMemberCompletion(
          completionData.taskId, 
          completionData.memberId,
          tx
        );
        if (hasCompleted) throw new Error('Member already completed this task');
        
        // Check if slots exhausted
        if (task[0].completionCount >= task[0].maxCompletions) {
          throw new Error('All completion slots filled');
        }
      }
      
      // 3. Insert completion
      const [completion] = await tx.insert(taskCompletions)
        .values({
          ...completionData,
          status: task[0].requiresApproval ? 'pending' : 'approved'
        })
        .returning();
      
      // 4. If auto-approved: run approval logic immediately
      if (!task[0].requiresApproval) {
        await this._approveCompletionInternal(tx, completion.id, completion.memberId, true);
      }
      
      return completion;
    });
  }

  async getTaskCompletionsByMember(memberId: string): Promise<TaskCompletion[]> {
    return await db
      .select()
      .from(taskCompletions)
      .where(eq(taskCompletions.memberId, memberId))
      .orderBy(desc(taskCompletions.completedAt));
  }

  async getTaskCompletion(completionId: string): Promise<TaskCompletion | undefined> {
    const [completion] = await db
      .select()
      .from(taskCompletions)
      .where(eq(taskCompletions.id, completionId));
    return completion;
  }

  async getPendingCompletionsByFamily(familyName: string): Promise<any[]> {
    const completions = await db
      .select({
        id: taskCompletions.id,
        taskId: taskCompletions.taskId,
        taskTitle: tasks.title,
        taskPoints: tasks.points,
        memberId: taskCompletions.memberId,
        memberName: familyMembers.displayName,
        memberAvatar: familyMembers.avatarUrl,
        proofPhotoUrl: taskCompletions.proofPhotoUrl,
        pointsEarned: taskCompletions.pointsEarned,
        completedAt: taskCompletions.completedAt,
        status: taskCompletions.status,
      })
      .from(taskCompletions)
      .innerJoin(tasks, eq(taskCompletions.taskId, tasks.id))
      .innerJoin(familyMembers, eq(taskCompletions.memberId, familyMembers.id))
      .where(
        and(
          eq(familyMembers.familyName, familyName),
          eq(taskCompletions.status, "pending")
        )
      )
      .orderBy(desc(taskCompletions.completedAt));
    
    return completions;
  }

  private async _approveCompletionInternal(tx: any, completionId: string, approvedBy: string, skipApprovalUpdate: boolean = false): Promise<void> {
    console.log(`🔍 [_approveCompletionInternal] START: completionId=${completionId}, skipApprovalUpdate=${skipApprovalUpdate}`);
    
    // 1. Lock completion
    const [completion] = await tx.select().from(taskCompletions)
      .where(eq(taskCompletions.id, completionId))
      .for('update');
    
    if (!completion) throw new Error('Completion not found');
    console.log(`🔍 [_approveCompletionInternal] Completion status: ${completion.status}`);
    
    if (!skipApprovalUpdate && completion.status === 'approved') {
      console.log(`🔍 [_approveCompletionInternal] EARLY RETURN: Already approved`);
      return; // Already approved (but proceed if skipApprovalUpdate=true for auto-approved tasks)
    }
    
    // 2. Lock task
    const [task] = await tx.select().from(tasks)
      .where(eq(tasks.id, completion.taskId))
      .for('update');
    
    console.log(`🔍 [_approveCompletionInternal] Task BEFORE update: maxCompletions=${task.maxCompletions}, completionCount=${task.completionCount}`);
    
    // 3. Update completion (only if not already approved)
    if (!skipApprovalUpdate) {
      await tx.update(taskCompletions)
        .set({
          status: 'approved',
          approvedBy,
          approvedAt: new Date()
        })
        .where(eq(taskCompletions.id, completionId));
    }
    
    // 4. If maxCompletions mode: increment counter and check threshold
    if (task.maxCompletions !== null) {
      console.log(`🔍 [_approveCompletionInternal] INCREMENTING completionCount: ${task.completionCount} + 1 = ${task.completionCount + 1} / ${task.maxCompletions}`);
      await tx.update(tasks)
        .set({
          completionCount: sql<number>`completion_count + 1`,
          status: sql`CASE WHEN completion_count + 1 >= ${task.maxCompletions} THEN 'completed'::task_status ELSE status END`,
          updatedAt: new Date()
        })
        .where(eq(tasks.id, task.id));
      
      // Verify update
      const [updatedTask] = await tx.select().from(tasks).where(eq(tasks.id, task.id));
      console.log(`🔍 [_approveCompletionInternal] Task AFTER update: completionCount=${updatedTask.completionCount}, status=${updatedTask.status}`);
    } else {
      console.log(`🔍 [_approveCompletionInternal] SKIPPING multi-completion (maxCompletions=null)`);
    }
    
    // 5. Award points to member (existing logic from old approveTaskCompletion)
    const [member] = await tx.select().from(familyMembers)
      .where(eq(familyMembers.id, completion.memberId))
      .for('update');
    
    await tx.update(familyMembers)
      .set({
        totalEarned: member.totalEarned + completion.pointsEarned,
        totalPoints: member.totalPoints + completion.pointsEarned,
        weeklyPoints: member.weeklyPoints + completion.pointsEarned,
        monthlyPoints: member.monthlyPoints + completion.pointsEarned
      })
      .where(eq(familyMembers.id, completion.memberId));
    
    // Add points history
    await tx.insert(pointsHistory).values({
      memberId: completion.memberId,
      points: completion.pointsEarned,
      reason: 'task_completion',
      taskId: completion.taskId
    });
  }

  async approveTaskCompletion(completionId: string, approvedBy: string): Promise<void> {
    await db.transaction(async (tx) => {
      await this._approveCompletionInternal(tx, completionId, approvedBy);
    });
  }

  async rejectTaskCompletion(completionId: string, approvedBy: string, rejectionReason: string): Promise<void> {
    await db
      .update(taskCompletions)
      .set({
        status: "rejected",
        approvedBy,
        approvedAt: new Date(),
        rejectionReason,
      })
      .where(eq(taskCompletions.id, completionId));
  }

  // Reward operations
  async getRewardsByFamily(familyName: string): Promise<Reward[]> {
    return await db
      .select()
      .from(rewards)
      .where(eq(rewards.familyName, familyName))
      .orderBy(rewards.pointThreshold);
  }

  async createReward(rewardData: InsertReward): Promise<Reward> {
    const [reward] = await db.insert(rewards).values(rewardData).returning();
    return reward;
  }

  async updateReward(id: string, rewardData: InsertReward): Promise<Reward> {
    const [reward] = await db
      .update(rewards)
      .set(rewardData)
      .where(eq(rewards.id, id))
      .returning();
    return reward;
  }

  async deleteReward(id: string): Promise<void> {
    await db.delete(rewards).where(eq(rewards.id, id));
  }
  
  // Reward redemption operations
  async createRewardRedemption(redemptionData: InsertRewardRedemption): Promise<RewardRedemption> {
    const [redemption] = await db
      .insert(rewardRedemptions)
      .values(redemptionData)
      .returning();
    return redemption;
  }

  async getRewardRedemptionsByFamily(familyName: string): Promise<any[]> {
    return await db
      .select({
        id: rewardRedemptions.id,
        rewardId: rewardRedemptions.rewardId,
        memberId: rewardRedemptions.memberId,
        pointsSpent: rewardRedemptions.pointsSpent,
        status: rewardRedemptions.status,
        redeemedAt: rewardRedemptions.redeemedAt,
        reward: {
          id: rewards.id,
          title: rewards.title,
          description: rewards.description,
          pointThreshold: rewards.pointThreshold,
        },
        member: {
          id: familyMembers.id,
          displayName: familyMembers.displayName,
          avatarUrl: familyMembers.avatarUrl,
          color: familyMembers.color,
          unlockedSkins: familyMembers.unlockedSkins,
          activeSkinId: familyMembers.activeSkinId,
        },
      })
      .from(rewardRedemptions)
      .innerJoin(rewards, eq(rewardRedemptions.rewardId, rewards.id))
      .innerJoin(familyMembers, eq(rewardRedemptions.memberId, familyMembers.id))
      .where(eq(familyMembers.familyName, familyName))
      .orderBy(desc(rewardRedemptions.redeemedAt));
  }

  async getRewardRedemptionsByMember(memberId: string): Promise<RewardRedemption[]> {
    return await db
      .select()
      .from(rewardRedemptions)
      .where(eq(rewardRedemptions.memberId, memberId))
      .orderBy(desc(rewardRedemptions.redeemedAt));
  }

  async updateRewardRedemptionStatus(id: string, status: string): Promise<void> {
    await db
      .update(rewardRedemptions)
      .set({ status })
      .where(eq(rewardRedemptions.id, id));
  }

  // Reward request operations
  async createRewardRequest(requestData: InsertRewardRequest): Promise<RewardRequest> {
    const [request] = await db.insert(rewardRequests).values(requestData).returning();
    return request;
  }

  async getRewardRequestsByFamily(familyName: string): Promise<any[]> {
    return await db
      .select({
        id: rewardRequests.id,
        title: rewardRequests.title,
        description: rewardRequests.description,
        pointThreshold: rewardRequests.pointThreshold,
        status: rewardRequests.status,
        createdAt: rewardRequests.createdAt,
        reviewedAt: rewardRequests.reviewedAt,
        requester: {
          id: familyMembers.id,
          displayName: familyMembers.displayName,
          avatarUrl: familyMembers.avatarUrl,
          color: familyMembers.color,
        },
      })
      .from(rewardRequests)
      .innerJoin(familyMembers, eq(rewardRequests.requestedBy, familyMembers.id))
      .where(eq(rewardRequests.familyName, familyName))
      .orderBy(desc(rewardRequests.createdAt));
  }

  async updateRewardRequest(id: string, data: { title: string; description: string | null; pointThreshold: number }): Promise<void> {
    await db
      .update(rewardRequests)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(rewardRequests.id, id));
  }

  async updateRewardRequestStatus(id: string, status: string, reviewedBy: string): Promise<void> {
    await db
      .update(rewardRequests)
      .set({ status, reviewedBy, reviewedAt: new Date(), updatedAt: new Date() })
      .where(eq(rewardRequests.id, id));
  }

  // Points history operations
  async addPointsHistory(historyData: InsertPointsHistory): Promise<void> {
    await db.insert(pointsHistory).values(historyData);
  }

  // Skin operations
  async getSkins(): Promise<Skin[]> {
    return await db.select().from(skins).orderBy(skins.pointsRequired);
  }

  async updateFamilyMemberActiveSkin(memberId: string, skinId: string | null): Promise<void> {
    await db
      .update(familyMembers)
      .set({ activeSkinId: skinId })
      .where(eq(familyMembers.id, memberId));
  }

  async unlockSkin(memberId: string, skinId: string): Promise<void> {
    const [member] = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.id, memberId));
    
    if (!member) {
      throw new Error("Member not found");
    }
    
    // Don't unlock if already unlocked
    if (member.unlockedSkins.includes(skinId)) {
      return;
    }
    
    // Get skin details to verify unlock threshold
    const [skin] = await db
      .select()
      .from(skins)
      .where(eq(skins.id, skinId));
    
    if (!skin) {
      throw new Error(`Skin ${skinId} not found`);
    }
    
    // Verify member meets the unlock threshold
    if (member.totalEarned < skin.pointsRequired) {
      throw new Error(`Cannot unlock ${skin.name} - requires ${skin.pointsRequired} points, member has ${member.totalEarned}`);
    }
    
    // Unlock the skin
    const updatedSkins = [...member.unlockedSkins, skinId];
    await db
      .update(familyMembers)
      .set({ unlockedSkins: updatedSkins })
      .where(eq(familyMembers.id, memberId));
  }

  async incrementRewardsRedeemed(memberId: string): Promise<number> {
    const [member] = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.id, memberId));
    
    const newCount = (member?.rewardsRedeemed || 0) + 1;
    
    await db
      .update(familyMembers)
      .set({ rewardsRedeemed: newCount })
      .where(eq(familyMembers.id, memberId));
    
    return newCount;
  }

  async resetFamilyToFactory(familyName: string): Promise<void> {
    // Wrap entire operation in a transaction to ensure atomicity
    await db.transaction(async (tx) => {
      // Get all family members first (we need their IDs)
      const members = await tx
        .select()
        .from(familyMembers)
        .where(eq(familyMembers.familyName, familyName));
      const memberIds = members.map(m => m.id);

      if (memberIds.length === 0) {
        return; // No members, nothing to reset
      }

      // Get all family tasks (we'll need task IDs for assignments)
      const familyTasks = await tx
        .select()
        .from(tasks)
        .where(eq(tasks.familyName, familyName));
      const taskIds = familyTasks.map(t => t.id);

      // Delete all game data for this family in the correct order
      // (respecting foreign key constraints - children first, then parents)

      // 1. Delete task completions for all members
      for (const memberId of memberIds) {
        await tx.delete(taskCompletions)
          .where(eq(taskCompletions.memberId, memberId));
      }

      // 2. Delete task assignments for all tasks in this family
      for (const taskId of taskIds) {
        await tx.delete(taskAssignments)
          .where(eq(taskAssignments.taskId, taskId));
      }

      // 3. Delete all tasks for this family
      await tx.delete(tasks)
        .where(eq(tasks.familyName, familyName));

      // 4. Delete reward redemptions for all members
      for (const memberId of memberIds) {
        await tx.delete(rewardRedemptions)
          .where(eq(rewardRedemptions.memberId, memberId));
      }

      // 5. Delete all reward requests for this family
      await tx.delete(rewardRequests)
        .where(eq(rewardRequests.familyName, familyName));

      // 6. Delete all rewards for this family
      await tx.delete(rewards)
        .where(eq(rewards.familyName, familyName));

      // 7. Delete points history for all members
      for (const memberId of memberIds) {
        await tx.delete(pointsHistory)
          .where(eq(pointsHistory.memberId, memberId));
      }

      // 8. Delete all chat messages for this family
      await tx.delete(chatMessages)
        .where(eq(chatMessages.familyName, familyName));

      // 9. Reset all family member stats to zero
      for (const memberId of memberIds) {
        await tx.update(familyMembers)
          .set({
            totalEarned: 0,
            totalPoints: 0,
            weeklyPoints: 0,
            monthlyPoints: 0,
            rewardsRedeemed: 0,
            unlockedSkins: [],
            discoveredSkinIds: [],
            activeSkinId: null,
            updatedAt: new Date(),
          })
          .where(eq(familyMembers.id, memberId));
      }

      // 10. Create default tasks for the family (customized baseline)
      const defaultTasks = [
        {
          id: crypto.randomUUID(),
          familyName,
          title: "Complete Homework",
          description: "Finish all assigned homework for today",
          points: 40,
          recurrence: "daily" as const,
          recurrenceDays: null,
          nextAvailableDate: null,
          requiresProof: false,
          requiresApproval: false,
          iconEmoji: "📚",
          status: "active" as const,
          createdBy: memberIds[0], // Assign to first member (typically the parent who created the family)
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: crypto.randomUUID(),
          familyName,
          title: "Clean Your Room",
          description: "Pick up toys, make bed, organize desk",
          points: 30,
          recurrence: "none" as const,
          recurrenceDays: null,
          nextAvailableDate: null,
          requiresProof: false,
          requiresApproval: false,
          iconEmoji: "🧹",
          status: "active" as const,
          createdBy: memberIds[0],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: crypto.randomUUID(),
          familyName,
          title: "Write a Good Mark in School",
          description: "Get a good grade on schoolwork or test",
          points: 40,
          recurrence: "none" as const,
          recurrenceDays: null,
          nextAvailableDate: null,
          requiresProof: false,
          requiresApproval: false,
          iconEmoji: "✏️",
          status: "active" as const,
          createdBy: memberIds[0],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: crypto.randomUUID(),
          familyName,
          title: "Take Out Trash",
          description: "Take trash bins to the curb",
          points: 15,
          recurrence: "daily" as const,
          recurrenceDays: null,
          nextAvailableDate: null,
          requiresProof: false,
          requiresApproval: false,
          iconEmoji: "🗑️",
          status: "active" as const,
          createdBy: memberIds[0],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      for (const task of defaultTasks) {
        await tx.insert(tasks).values(task);
      }
    });
  }

  async getAnalytics(familyName: string): Promise<any> {
    // Get all family members
    const members = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.familyName, familyName));

    // Get task completions for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const completions = await db
      .select({
        id: taskCompletions.id,
        memberId: taskCompletions.memberId,
        pointsEarned: taskCompletions.pointsEarned,
        completedAt: taskCompletions.completedAt,
        memberName: familyMembers.displayName,
      })
      .from(taskCompletions)
      .innerJoin(familyMembers, eq(taskCompletions.memberId, familyMembers.id))
      .where(eq(familyMembers.familyName, familyName))
      .orderBy(desc(taskCompletions.completedAt))
      .limit(100);

    // Get all tasks for completion rate calculation
    const allTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.familyName, familyName));

    const allAssignments = await db
      .select()
      .from(taskAssignments)
      .innerJoin(tasks, eq(taskAssignments.taskId, tasks.id))
      .where(eq(tasks.familyName, familyName));

    // Calculate metrics
    const totalTasksCompleted = completions.length;
    const totalTasksAssigned = allAssignments.length;
    const completionRate = totalTasksAssigned > 0 
      ? Math.round((totalTasksCompleted / totalTasksAssigned) * 100)
      : 0;

    // Group completions by day for trend data
    const dailyPoints: Record<string, number> = {};
    completions.forEach(completion => {
      if (completion.completedAt) {
        const date = new Date(completion.completedAt).toISOString().split('T')[0];
        dailyPoints[date] = (dailyPoints[date] || 0) + completion.pointsEarned;
      }
    });

    // Convert to array for chart
    const pointsTrend = Object.entries(dailyPoints)
      .map(([date, points]) => ({ date, points }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30); // Last 30 days

    // Top performers (sorted by monthly points, excluding members who opted out)
    const topPerformers = members
      .filter(member => !member.excludeFromLeaderboard) // Exclude members who don't want to compete
      .map(member => ({
        id: member.id,
        name: member.displayName,
        monthlyPoints: member.monthlyPoints,
        totalPoints: member.totalPoints,
        color: member.color,
      }))
      .sort((a, b) => b.monthlyPoints - a.monthlyPoints);

    // Recent activity (last 10 completions)
    const recentActivity = completions.slice(0, 10).map(completion => ({
      memberName: completion.memberName,
      pointsEarned: completion.pointsEarned,
      completedAt: completion.completedAt,
    }));

    // Family stats
    const totalPoints = members.reduce((sum, m) => sum + m.totalEarned, 0);
    const totalMembers = members.length;

    return {
      completionRate,
      pointsTrend,
      topPerformers,
      recentActivity,
      stats: {
        totalPoints,
        totalMembers,
        totalTasksCompleted,
        totalTasksAssigned,
      },
    };
  }

  // Chat operations
  async getChatMessages(familyName: string, limit: number = 50): Promise<any[]> {
    const messages = await db
      .select({
        id: chatMessages.id,
        message: chatMessages.message,
        createdAt: chatMessages.createdAt,
        memberId: chatMessages.memberId,
        memberName: familyMembers.displayName,
        memberColor: familyMembers.color,
        memberAvatarUrl: familyMembers.avatarUrl,
        memberActiveSkinId: familyMembers.activeSkinId,
      })
      .from(chatMessages)
      .innerJoin(familyMembers, eq(chatMessages.memberId, familyMembers.id))
      .where(eq(chatMessages.familyName, familyName))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);

    // Return in reverse order (oldest first)
    return messages.reverse();
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const [newMessage] = await db.insert(chatMessages).values(message).returning();
    return newMessage;
  }

  async updateLastReadChatAt(memberId: string): Promise<void> {
    await db
      .update(familyMembers)
      .set({ lastReadChatAt: new Date() })
      .where(eq(familyMembers.id, memberId));
  }

  async getUnreadMessageCount(memberId: string, familyName: string): Promise<number> {
    const [member] = await db
      .select({ lastReadChatAt: familyMembers.lastReadChatAt })
      .from(familyMembers)
      .where(eq(familyMembers.id, memberId));

    if (!member) return 0;

    const lastReadAt = member.lastReadChatAt || new Date(0);

    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.familyName, familyName),
          gt(chatMessages.createdAt, lastReadAt),
          sql`${chatMessages.memberId} != ${memberId}` // Don't count own messages
        )
      );

    return Number(result?.count || 0);
  }
}

export const storage = new DatabaseStorage();
