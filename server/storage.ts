import {
  users,
  families,
  familyMembers,
  tasks,
  taskAssignments,
  taskCompletions,
  rewards,
  rewardRedemptions,
  rewardSharingParticipants,
  rewardRequests,
  pointsHistory,
  skins,
  chatMessages,
  achievementDefinitions,
  achievementMembers,
  achievementAwards,
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
  type RewardSharingParticipant,
  type InsertRewardSharingParticipant,
  type RewardRequest,
  type InsertRewardRequest,
  type InsertPointsHistory,
  type TaskCompletion,
  type Skin,
  type ChatMessage,
  type InsertChatMessage,
  type AchievementDefinition,
  type InsertAchievementDefinition,
  type AchievementMember,
  type InsertAchievementMember,
  type AchievementAward,
  type InsertAchievementAward,
  familyGoals,
  goalContributions,
  type FamilyGoal,
  type InsertFamilyGoal,
  type GoalContribution,
  type InsertGoalContribution,
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
  
  // Reward sharing operations
  getRewardRedemption(id: string): Promise<RewardRedemption | undefined>;
  startRewardSharing(redemptionId: string): Promise<void>;
  joinRewardSharing(redemptionId: string, memberId: string): Promise<RewardSharingParticipant>;
  finalizeRewardSharing(redemptionId: string): Promise<void>;
  getRewardSharingParticipants(redemptionId: string): Promise<Array<RewardSharingParticipant & { member: FamilyMember }>>;
  getActiveSharedRewards(familyName: string): Promise<Array<RewardRedemption & { participants: Array<RewardSharingParticipant & { member: FamilyMember }> }>>;

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

  // Achievement operations
  getAchievementDefinitionsByFamily(familyName: string): Promise<AchievementDefinition[]>;
  createAchievementDefinition(definition: InsertAchievementDefinition): Promise<AchievementDefinition>;
  updateAchievementDefinition(id: string, definition: Partial<InsertAchievementDefinition>): Promise<AchievementDefinition>;
  deleteAchievementDefinition(id: string): Promise<void>;
  seedDefaultAchievements(familyName: string): Promise<AchievementDefinition[]>;
  getOrCreateAchievementMember(familyName: string, memberId: string): Promise<AchievementMember>;
  updateAchievementMember(id: string, updates: Partial<Omit<InsertAchievementMember, 'familyName' | 'memberId'>>): Promise<void>;
  resetWeeklyAchievements(familyName: string): Promise<void>;
  awardAchievement(achievementDefinitionId: string, memberId: string, bonusPoints: number): Promise<AchievementAward>;
  getAchievementAwardsByFamily(familyName: string): Promise<Array<AchievementAward & { achievementDefinition: AchievementDefinition; member: FamilyMember }>>;
  getAchievementAwardsByMember(memberId: string): Promise<Array<AchievementAward & { achievementDefinition: AchievementDefinition }>>;

  // Chat operations (Family+ and Family Hero tier)
  getChatMessages(familyName: string, limit?: number): Promise<any[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  updateLastReadChatAt(memberId: string): Promise<void>;
  getUnreadMessageCount(memberId: string, familyName: string): Promise<number>;

  // Family Goals operations
  getFamilyGoalsByFamily(familyName: string): Promise<FamilyGoal[]>;
  getFamilyGoal(id: string): Promise<FamilyGoal | undefined>;
  createFamilyGoal(goal: InsertFamilyGoal): Promise<FamilyGoal>;
  updateFamilyGoal(id: string, goal: Partial<InsertFamilyGoal>): Promise<FamilyGoal>;
  deleteFamilyGoal(id: string): Promise<void>;
  contributeToGoal(goalId: string, memberId: string, points: number, period: string): Promise<GoalContribution>;
  getGoalContributionsByGoalAndPeriod(goalId: string, period: string): Promise<GoalContribution[]>;
  getGoalContributionsByMemberAndGoal(goalId: string, memberId: string, period: string): Promise<GoalContribution | undefined>;
  updateGoalCurrentPoints(goalId: string, currentPoints: number): Promise<void>;
  completeGoal(goalId: string): Promise<void>;
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
    
    // Reset completionCount for recurring multi-completion tasks that have passed their nextAvailableDate
    const now = new Date();
    const tasksToReset = allTasks.filter(task => {
      // Only reset recurring multi-completion tasks
      const isRecurring = task.recurrence !== 'none' || task.recurrenceDays !== null;
      const isMultiCompletion = task.maxCompletions !== null;
      const hasPassedAvailableDate = task.nextAvailableDate && task.nextAvailableDate <= now;
      const needsReset = task.completionCount > 0;
      
      return isRecurring && isMultiCompletion && hasPassedAvailableDate && needsReset;
    });
    
    // Reset each task in a transaction
    if (tasksToReset.length > 0) {
      console.log(`🔄 Resetting ${tasksToReset.length} recurring multi-completion task(s) after midnight`);
    }
    
    for (const task of tasksToReset) {
      await db
        .update(tasks)
        .set({ 
          completionCount: 0, 
          nextAvailableDate: null,
          updatedAt: new Date() 
        })
        .where(eq(tasks.id, task.id));
      
      console.log(`  ✅ Reset task "${task.title}" (was ${task.completionCount}/${task.maxCompletions}, now 0/${task.maxCompletions})`);
      
      // Update the in-memory task object as well
      task.completionCount = 0;
      task.nextAvailableDate = null;
    }
    
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
    // 1. Lock completion
    const [completion] = await tx.select().from(taskCompletions)
      .where(eq(taskCompletions.id, completionId))
      .for('update');
    
    if (!completion) throw new Error('Completion not found');
    
    if (!skipApprovalUpdate && completion.status === 'approved') {
      return; // Already approved (but proceed if skipApprovalUpdate=true for auto-approved tasks)
    }
    
    // 2. Lock task
    const [task] = await tx.select().from(tasks)
      .where(eq(tasks.id, completion.taskId))
      .for('update');
    
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
      // For recurring tasks: keep status as "active" even when maxCompletions reached
      // The nextAvailableDate (set in routes.ts) will make it unavailable until reset
      // For non-recurring tasks: set status to "completed" when maxCompletions reached
      const isRecurring = task.recurrence !== 'none' || task.recurrenceDays !== null;
      
      await tx.update(tasks)
        .set({
          completionCount: sql<number>`completion_count + 1`,
          status: isRecurring 
            ? task.status // Keep current status for recurring tasks
            : sql`CASE WHEN completion_count + 1 >= ${task.maxCompletions} THEN 'completed'::task_status ELSE status END`,
          updatedAt: new Date()
        })
        .where(eq(tasks.id, task.id));
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
        originalPointsSpent: rewardRedemptions.originalPointsSpent,
        status: rewardRedemptions.status,
        sharingStatus: rewardRedemptions.sharingStatus,
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

  // Reward sharing operations
  async getRewardRedemption(id: string): Promise<RewardRedemption | undefined> {
    const [redemption] = await db
      .select()
      .from(rewardRedemptions)
      .where(eq(rewardRedemptions.id, id))
      .limit(1);
    return redemption;
  }

  async startRewardSharing(redemptionId: string): Promise<void> {
    await db
      .update(rewardRedemptions)
      .set({ sharingStatus: "sharing_active" })
      .where(eq(rewardRedemptions.id, redemptionId));
  }

  async joinRewardSharing(redemptionId: string, memberId: string): Promise<RewardSharingParticipant> {
    try {
      // Check if member already joined
      const existing = await db
        .select()
        .from(rewardSharingParticipants)
        .where(
          and(
            eq(rewardSharingParticipants.redemptionId, redemptionId),
            eq(rewardSharingParticipants.memberId, memberId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // Already joined - return existing record
        return existing[0];
      }

      // Add participant (points will be calculated when finalized)
      const [participant] = await db
        .insert(rewardSharingParticipants)
        .values({
          redemptionId,
          memberId,
          pointsContributed: 0, // Will be calculated on finalize
        })
        .returning();

      return participant;
    } catch (error: any) {
      // Handle unique constraint violation gracefully
      if (error.code === '23505') { // PostgreSQL unique violation error code
        // Fetch and return the existing record
        const [existing] = await db
          .select()
          .from(rewardSharingParticipants)
          .where(
            and(
              eq(rewardSharingParticipants.redemptionId, redemptionId),
              eq(rewardSharingParticipants.memberId, memberId)
            )
          )
          .limit(1);
        
        if (existing) {
          return existing;
        }
      }
      throw error;
    }
  }

  async finalizeRewardSharing(redemptionId: string): Promise<void> {
    await db.transaction(async (tx) => {
      // Get redemption
      const [redemption] = await tx
        .select()
        .from(rewardRedemptions)
        .where(eq(rewardRedemptions.id, redemptionId))
        .limit(1);

      if (!redemption) {
        throw new Error("Redemption not found");
      }

      // Get all participants
      const participants = await tx
        .select()
        .from(rewardSharingParticipants)
        .where(eq(rewardSharingParticipants.redemptionId, redemptionId));

      // Require at least 1 participant (prevents exploit)
      if (participants.length === 0) {
        throw new Error("Cannot finalize sharing without any participants");
      }

      // Total participants = participants + original buyer
      const totalParticipants = participants.length + 1;
      const pointsPerPerson = Math.ceil(redemption.originalPointsSpent / totalParticipants);
      
      // Validate all participants have enough points BEFORE making any changes
      for (const participant of participants) {
        const [member] = await tx
          .select()
          .from(familyMembers)
          .where(eq(familyMembers.id, participant.memberId))
          .limit(1);

        if (!member) {
          throw new Error(`Member ${participant.memberId} not found`);
        }

        if (member.totalPoints < pointsPerPerson) {
          throw new Error(`Member ${member.displayName} doesn't have enough points (needs ${pointsPerPerson}, has ${member.totalPoints})`);
        }
      }

      // Calculate refund for original buyer
      const originalBuyerRefund = redemption.originalPointsSpent - pointsPerPerson;

      // Refund points to original buyer
      if (originalBuyerRefund > 0) {
        const [originalBuyer] = await tx
          .select()
          .from(familyMembers)
          .where(eq(familyMembers.id, redemption.memberId))
          .limit(1);

        if (originalBuyer) {
          await tx
            .update(familyMembers)
            .set({
              totalPoints: originalBuyer.totalPoints + originalBuyerRefund,
            })
            .where(eq(familyMembers.id, redemption.memberId));

          // Add to points history
          await tx.insert(pointsHistory).values({
            memberId: redemption.memberId,
            points: originalBuyerRefund,
            reason: `Refund from sharing reward (${totalParticipants} people)`,
          });
        }
      }

      // Deduct points from each participant
      for (const participant of participants) {
        const [member] = await tx
          .select()
          .from(familyMembers)
          .where(eq(familyMembers.id, participant.memberId))
          .limit(1);

        if (member) {
          await tx
            .update(familyMembers)
            .set({
              totalPoints: member.totalPoints - pointsPerPerson,
            })
            .where(eq(familyMembers.id, participant.memberId));

          // Update participant record
          await tx
            .update(rewardSharingParticipants)
            .set({ pointsContributed: pointsPerPerson })
            .where(eq(rewardSharingParticipants.id, participant.id));

          // Add to points history
          await tx.insert(pointsHistory).values({
            memberId: participant.memberId,
            points: -pointsPerPerson,
            reason: `Shared reward (${totalParticipants} people)`,
          });
        }
      }

      // Update redemption status and final points
      await tx
        .update(rewardRedemptions)
        .set({
          sharingStatus: "sharing_finalized",
          pointsSpent: pointsPerPerson,
        })
        .where(eq(rewardRedemptions.id, redemptionId));
    });
  }

  async getRewardSharingParticipants(redemptionId: string): Promise<Array<RewardSharingParticipant & { member: FamilyMember }>> {
    return await db
      .select({
        id: rewardSharingParticipants.id,
        redemptionId: rewardSharingParticipants.redemptionId,
        memberId: rewardSharingParticipants.memberId,
        pointsContributed: rewardSharingParticipants.pointsContributed,
        joinedAt: rewardSharingParticipants.joinedAt,
        member: familyMembers,
      })
      .from(rewardSharingParticipants)
      .innerJoin(familyMembers, eq(rewardSharingParticipants.memberId, familyMembers.id))
      .where(eq(rewardSharingParticipants.redemptionId, redemptionId));
  }

  async getActiveSharedRewards(familyName: string): Promise<Array<any>> {
    // Get all active shared rewards for this family with full details
    const redemptions = await db
      .select({
        id: rewardRedemptions.id,
        rewardId: rewardRedemptions.rewardId,
        memberId: rewardRedemptions.memberId,
        pointsSpent: rewardRedemptions.pointsSpent,
        originalPointsSpent: rewardRedemptions.originalPointsSpent,
        status: rewardRedemptions.status,
        sharingStatus: rewardRedemptions.sharingStatus,
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
      .where(
        and(
          eq(familyMembers.familyName, familyName),
          eq(rewardRedemptions.sharingStatus, "sharing_active")
        )
      );

    // Get participants for each redemption
    const results = await Promise.all(
      redemptions.map(async (r) => {
        const participants = await this.getRewardSharingParticipants(r.id);
        return {
          ...r,
          participants,
        };
      })
    );

    return results;
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

  // Achievement operations
  async getAchievementDefinitionsByFamily(familyName: string): Promise<AchievementDefinition[]> {
    return await db
      .select()
      .from(achievementDefinitions)
      .where(eq(achievementDefinitions.familyName, familyName))
      .orderBy(achievementDefinitions.createdAt);
  }

  async createAchievementDefinition(definition: InsertAchievementDefinition): Promise<AchievementDefinition> {
    const [created] = await db
      .insert(achievementDefinitions)
      .values({
        ...definition,
        updatedAt: new Date(),
      })
      .returning();
    return created;
  }

  async updateAchievementDefinition(id: string, definition: Partial<InsertAchievementDefinition>): Promise<AchievementDefinition> {
    const [updated] = await db
      .update(achievementDefinitions)
      .set({
        ...definition,
        updatedAt: new Date(),
      })
      .where(eq(achievementDefinitions.id, id))
      .returning();
    return updated;
  }

  async deleteAchievementDefinition(id: string): Promise<void> {
    await db
      .delete(achievementDefinitions)
      .where(eq(achievementDefinitions.id, id));
  }

  async seedDefaultAchievements(familyName: string): Promise<AchievementDefinition[]> {
    const defaultAchievements: InsertAchievementDefinition[] = [
      {
        familyName,
        type: "first_weekly_finisher",
        slug: "first-weekly-finisher",
        title: "Weekly Champion",
        description: "Be the first family member to complete all weekly tasks",
        bonusPoints: 50,
        isActive: true,
        config: {},
      },
      {
        familyName,
        type: "perfect_week",
        slug: "perfect-week",
        title: "Perfect Week",
        description: "Complete all your weekly tasks without any rejections",
        bonusPoints: 100,
        isActive: true,
        config: {},
      },
      {
        familyName,
        type: "task_streak",
        slug: "task-streak-7",
        title: "7-Day Streak",
        description: "Complete tasks for 7 days in a row",
        bonusPoints: 75,
        isActive: true,
        config: { days: 7 },
      },
      {
        familyName,
        type: "task_streak",
        slug: "task-streak-14",
        title: "14-Day Streak",
        description: "Complete tasks for 14 days in a row",
        bonusPoints: 150,
        isActive: true,
        config: { days: 14 },
      },
      {
        familyName,
        type: "task_streak",
        slug: "task-streak-30",
        title: "30-Day Streak",
        description: "Complete tasks for 30 days in a row",
        bonusPoints: 300,
        isActive: true,
        config: { days: 30 },
      },
      {
        familyName,
        type: "lifetime_milestone",
        slug: "lifetime-500",
        title: "500 Points Milestone",
        description: "Earn a total of 500 points",
        bonusPoints: 100,
        isActive: true,
        config: { threshold: 500 },
      },
      {
        familyName,
        type: "lifetime_milestone",
        slug: "lifetime-1000",
        title: "1000 Points Milestone",
        description: "Earn a total of 1000 points",
        bonusPoints: 200,
        isActive: true,
        config: { threshold: 1000 },
      },
      {
        familyName,
        type: "lifetime_milestone",
        slug: "lifetime-2000",
        title: "2000 Points Milestone",
        description: "Earn a total of 2000 points",
        bonusPoints: 400,
        isActive: true,
        config: { threshold: 2000 },
      },
      {
        familyName,
        type: "weekly_leaderboard",
        slug: "weekly-leaderboard-1st",
        title: "Weekly Leader",
        description: "Finish in 1st place on the weekly leaderboard",
        bonusPoints: 75,
        isActive: true,
        config: { rank: 1 },
      },
    ];

    const created: AchievementDefinition[] = [];
    for (const achievement of defaultAchievements) {
      const [result] = await db
        .insert(achievementDefinitions)
        .values({
          ...achievement,
          updatedAt: new Date(),
        })
        .returning();
      created.push(result);
    }

    return created;
  }

  async getOrCreateAchievementMember(familyName: string, memberId: string): Promise<AchievementMember> {
    const [existing] = await db
      .select()
      .from(achievementMembers)
      .where(
        and(
          eq(achievementMembers.familyName, familyName),
          eq(achievementMembers.memberId, memberId)
        )
      );

    if (existing) {
      return existing;
    }

    const [created] = await db
      .insert(achievementMembers)
      .values({
        familyName,
        memberId,
      })
      .returning();
    return created;
  }

  async updateAchievementMember(id: string, updates: Partial<Omit<InsertAchievementMember, 'familyName' | 'memberId'>>): Promise<void> {
    await db
      .update(achievementMembers)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(achievementMembers.id, id));
  }

  async resetWeeklyAchievements(familyName: string): Promise<void> {
    await db
      .update(achievementMembers)
      .set({
        weeklyCompletionCount: 0,
        weeklyRejectionCount: 0,
        firstWeeklyFinisher: false,
        lastWeeklyReset: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(achievementMembers.familyName, familyName));
  }

  async awardAchievement(achievementDefinitionId: string, memberId: string, bonusPoints: number): Promise<AchievementAward> {
    return await db.transaction(async (tx) => {
      const [member] = await tx
        .select()
        .from(familyMembers)
        .where(eq(familyMembers.id, memberId))
        .for('update');

      if (!member) {
        throw new Error('Member not found');
      }

      await tx
        .update(familyMembers)
        .set({
          totalEarned: member.totalEarned + bonusPoints,
          totalPoints: member.totalPoints + bonusPoints,
          weeklyPoints: member.weeklyPoints + bonusPoints,
          monthlyPoints: member.monthlyPoints + bonusPoints,
          updatedAt: new Date(),
        })
        .where(eq(familyMembers.id, memberId));

      const [pointsHistoryEntry] = await tx
        .insert(pointsHistory)
        .values({
          memberId,
          points: bonusPoints,
          reason: `Achievement bonus`,
          taskId: null,
        })
        .returning();

      const [award] = await tx
        .insert(achievementAwards)
        .values({
          achievementDefinitionId,
          memberId,
          pointsHistoryId: pointsHistoryEntry.id,
          bonusPoints,
        })
        .returning();

      return award;
    });
  }

  async getAchievementAwardsByFamily(familyName: string): Promise<Array<AchievementAward & { achievementDefinition: AchievementDefinition; member: FamilyMember }>> {
    const awards = await db
      .select({
        id: achievementAwards.id,
        achievementDefinitionId: achievementAwards.achievementDefinitionId,
        memberId: achievementAwards.memberId,
        pointsHistoryId: achievementAwards.pointsHistoryId,
        bonusPoints: achievementAwards.bonusPoints,
        awardedAt: achievementAwards.awardedAt,
        achievementDefinition: achievementDefinitions,
        member: familyMembers,
      })
      .from(achievementAwards)
      .innerJoin(achievementDefinitions, eq(achievementAwards.achievementDefinitionId, achievementDefinitions.id))
      .innerJoin(familyMembers, eq(achievementAwards.memberId, familyMembers.id))
      .where(eq(achievementDefinitions.familyName, familyName))
      .orderBy(desc(achievementAwards.awardedAt));

    return awards as any;
  }

  async getAchievementAwardsByMember(memberId: string): Promise<Array<AchievementAward & { achievementDefinition: AchievementDefinition }>> {
    const awards = await db
      .select({
        id: achievementAwards.id,
        achievementDefinitionId: achievementAwards.achievementDefinitionId,
        memberId: achievementAwards.memberId,
        pointsHistoryId: achievementAwards.pointsHistoryId,
        bonusPoints: achievementAwards.bonusPoints,
        awardedAt: achievementAwards.awardedAt,
        achievementDefinition: achievementDefinitions,
      })
      .from(achievementAwards)
      .innerJoin(achievementDefinitions, eq(achievementAwards.achievementDefinitionId, achievementDefinitions.id))
      .where(eq(achievementAwards.memberId, memberId))
      .orderBy(desc(achievementAwards.awardedAt));

    return awards as any;
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

  // Family Goals operations
  async getFamilyGoalsByFamily(familyName: string): Promise<FamilyGoal[]> {
    return await db
      .select()
      .from(familyGoals)
      .where(eq(familyGoals.familyName, familyName))
      .orderBy(desc(familyGoals.createdAt));
  }

  async getFamilyGoal(id: string): Promise<FamilyGoal | undefined> {
    const [goal] = await db
      .select()
      .from(familyGoals)
      .where(eq(familyGoals.id, id));
    return goal;
  }

  async createFamilyGoal(goalData: InsertFamilyGoal): Promise<FamilyGoal> {
    const [goal] = await db.insert(familyGoals).values(goalData).returning();
    return goal;
  }

  async updateFamilyGoal(id: string, updates: Partial<InsertFamilyGoal>): Promise<FamilyGoal> {
    const [goal] = await db
      .update(familyGoals)
      .set(updates)
      .where(eq(familyGoals.id, id))
      .returning();
    return goal;
  }

  async deleteFamilyGoal(id: string): Promise<void> {
    await db.delete(familyGoals).where(eq(familyGoals.id, id));
  }

  async contributeToGoal(goalId: string, memberId: string, points: number, period: string): Promise<GoalContribution> {
    const [contribution] = await db
      .insert(goalContributions)
      .values({
        goalId,
        memberId,
        points,
        period,
      })
      .returning();
    return contribution;
  }

  async getGoalContributionsByGoalAndPeriod(goalId: string, period: string): Promise<GoalContribution[]> {
    return await db
      .select()
      .from(goalContributions)
      .where(
        and(
          eq(goalContributions.goalId, goalId),
          eq(goalContributions.period, period)
        )
      );
  }

  async getGoalContributionsByMemberAndGoal(goalId: string, memberId: string, period: string): Promise<GoalContribution | undefined> {
    const [contribution] = await db
      .select()
      .from(goalContributions)
      .where(
        and(
          eq(goalContributions.goalId, goalId),
          eq(goalContributions.memberId, memberId),
          eq(goalContributions.period, period)
        )
      );
    return contribution;
  }

  async updateGoalCurrentPoints(goalId: string, currentPoints: number): Promise<void> {
    await db
      .update(familyGoals)
      .set({ currentPoints })
      .where(eq(familyGoals.id, goalId));
  }

  async completeGoal(goalId: string): Promise<void> {
    await db
      .update(familyGoals)
      .set({ isActive: false, completedAt: new Date() })
      .where(eq(familyGoals.id, goalId));
  }
}

export const storage = new DatabaseStorage();
