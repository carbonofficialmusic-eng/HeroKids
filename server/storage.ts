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
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Family operations
  getFamily(familyName: string): Promise<Family | undefined>;
  createFamily(family: InsertFamily): Promise<Family>;
  updateFamilyTier(familyName: string, tier: "free" | "family" | "family_plus" | "family_hero"): Promise<void>;
  updateFamilySettings(familyName: string, settings: { showLeaderboard: boolean }): Promise<void>;

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

  // Task operations
  getTask(id: string): Promise<Task | undefined>;
  getTasksByFamily(familyName: string): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, task: Partial<InsertTask>): Promise<Task>;
  updateTaskStatus(id: string, status: "active" | "completed" | "archived"): Promise<void>;
  updateTaskNextAvailableDate(id: string, nextAvailableDate: Date): Promise<void>;

  // Task assignment operations
  createTaskAssignment(assignment: InsertTaskAssignment): Promise<void>;
  getTaskAssignmentsByMember(memberId: string): Promise<string[]>;
  getTaskAssignmentsByTask(taskId: string): Promise<string[]>;

  // Task completion operations
  createTaskCompletion(completion: InsertTaskCompletion): Promise<TaskCompletion>;
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
    settings: { showLeaderboard: boolean }
  ): Promise<void> {
    await db
      .update(families)
      .set({ showLeaderboard: settings.showLeaderboard, updatedAt: new Date() })
      .where(eq(families.familyName, familyName));
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
    const [member] = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.joinCode, joinCode));
    return member;
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
    const [updated] = await db
      .update(familyMembers)
      .set({ ...updates, updatedAt: new Date() })
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

  // Task operations
  async getTask(id: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task;
  }

  async getTasksByFamily(familyName: string): Promise<Task[]> {
    const allTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.familyName, familyName))
      .orderBy(desc(tasks.createdAt));
    
    // Filter out tasks that are not yet available (nextAvailableDate is in the future)
    const now = new Date();
    return allTasks.filter(task => {
      if (!task.nextAvailableDate) {
        return true; // No nextAvailableDate means task is always available
      }
      // Show task only if nextAvailableDate is in the past or today
      return new Date(task.nextAvailableDate) <= now;
    });
  }

  async createTask(taskData: InsertTask): Promise<Task> {
    const [task] = await db.insert(tasks).values(taskData).returning();
    return task;
  }

  async updateTask(id: string, taskUpdate: Partial<InsertTask>): Promise<Task> {
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
  async createTaskCompletion(completionData: InsertTaskCompletion): Promise<TaskCompletion> {
    const [completion] = await db
      .insert(taskCompletions)
      .values(completionData)
      .returning();
    return completion;
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

  async approveTaskCompletion(completionId: string, approvedBy: string): Promise<void> {
    await db
      .update(taskCompletions)
      .set({
        status: "approved",
        approvedBy,
        approvedAt: new Date(),
      })
      .where(eq(taskCompletions.id, completionId));
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
    return await db.select().from(skins).orderBy(skins.unlockThreshold);
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
    if (member.rewardsRedeemed < skin.unlockThreshold) {
      throw new Error(`Cannot unlock ${skin.name} - requires ${skin.unlockThreshold} rewards, member has ${member.rewardsRedeemed}`);
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

      // 8. Reset all family member stats to zero
      for (const memberId of memberIds) {
        await tx.update(familyMembers)
          .set({
            totalEarned: 0,
            totalPoints: 0,
            weeklyPoints: 0,
            monthlyPoints: 0,
            rewardsRedeemed: 0,
            unlockedSkins: [],
            activeSkinId: null,
            updatedAt: new Date(),
          })
          .where(eq(familyMembers.id, memberId));
      }

      // 9. Create default tasks for the family
      const defaultTasks = [
        {
          id: crypto.randomUUID(),
          familyName,
          title: "Clean your room",
          description: "Tidy up your bedroom and make your bed",
          points: 20,
          category: "Cleaning" as const,
          recurrence: "daily" as const,
          recurrenceDays: null,
          nextAvailableDate: null,
          requiresPhoto: false,
          createdBy: memberIds[0], // Assign to first member (typically the parent who created the family)
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: crypto.randomUUID(),
          familyName,
          title: "Do the dishes",
          description: "Wash, dry, and put away all dishes",
          points: 15,
          category: "Cleaning" as const,
          recurrence: "daily" as const,
          recurrenceDays: null,
          nextAvailableDate: null,
          requiresPhoto: false,
          createdBy: memberIds[0],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: crypto.randomUUID(),
          familyName,
          title: "Vacuum the house",
          description: "Vacuum all carpets and rugs in the house",
          points: 30,
          category: "Cleaning" as const,
          recurrence: "none" as const,
          recurrenceDays: 3, // Recurs every 3 days
          nextAvailableDate: null,
          requiresPhoto: false,
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
      .where(and(
        eq(familyMembers.familyName, familyName),
        desc(taskCompletions.completedAt)
      ))
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

    // Top performers (sorted by monthly points)
    const topPerformers = members
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
}

export const storage = new DatabaseStorage();
