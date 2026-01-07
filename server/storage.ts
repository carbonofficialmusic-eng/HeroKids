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
  type InsertSkin,
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
  deviceLinkCodes,
  childDeviceSessions,
  type DeviceLinkCode,
  type InsertDeviceLinkCode,
  type ChildDeviceSession,
  type InsertChildDeviceSession,
  starPlacements,
  type StarPlacement,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, gt, sql, inArray } from "drizzle-orm";
import { startOfDay } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import bcrypt from 'bcrypt';
import { TOTAL_HIDDEN_STARS, STARS_PER_LEGACY_AVATAR } from "@shared/skin-config";

/**
 * Default achievement templates - used by both seedDefaultAchievements and resetFamilyToFactory
 * Only "Weekly Champion" and "Perfect Week" are active by default
 */
const DEFAULT_ACHIEVEMENT_TEMPLATES = [
  {
    type: "first_weekly_finisher" as const,
    slug: "first-weekly-finisher",
    title: "Weekly Champion",
    description: "Be the first family member to complete all weekly tasks",
    bonusPoints: 50,
    isActive: true,
    config: {},
  },
  {
    type: "perfect_week" as const,
    slug: "perfect-week",
    title: "Perfect Week",
    description: "Complete all your weekly tasks without any rejections",
    bonusPoints: 100,
    isActive: true,
    config: {},
  },
  {
    type: "task_streak" as const,
    slug: "task-streak-7",
    title: "7-Day Streak",
    description: "Complete tasks for 7 days in a row",
    bonusPoints: 75,
    isActive: false,
    config: { days: 7 },
  },
  {
    type: "task_streak" as const,
    slug: "task-streak-14",
    title: "14-Day Streak",
    description: "Complete tasks for 14 days in a row",
    bonusPoints: 150,
    isActive: false,
    config: { days: 14 },
  },
  {
    type: "task_streak" as const,
    slug: "task-streak-30",
    title: "30-Day Streak",
    description: "Complete tasks for 30 days in a row",
    bonusPoints: 300,
    isActive: false,
    config: { days: 30 },
  },
  {
    type: "lifetime_milestone" as const,
    slug: "lifetime-500",
    title: "500 Points Milestone",
    description: "Earn a total of 500 points",
    bonusPoints: 100,
    isActive: false,
    config: { threshold: 500 },
  },
  {
    type: "lifetime_milestone" as const,
    slug: "lifetime-1000",
    title: "1000 Points Milestone",
    description: "Earn a total of 1000 points",
    bonusPoints: 200,
    isActive: false,
    config: { threshold: 1000 },
  },
  {
    type: "lifetime_milestone" as const,
    slug: "lifetime-2000",
    title: "2000 Points Milestone",
    description: "Earn a total of 2000 points",
    bonusPoints: 400,
    isActive: false,
    config: { threshold: 2000 },
  },
  {
    type: "weekly_leaderboard" as const,
    slug: "weekly-leaderboard-1st",
    title: "Weekly Leader",
    description: "Finish in 1st place on the weekly leaderboard",
    bonusPoints: 75,
    isActive: false,
    config: { rank: 1 },
  },
];

/**
 * Helper function to check if a date is today in a specific timezone
 */
function isToday(date: Date, timezone: string): boolean {
  const now = new Date();
  
  // Format both dates in the target timezone
  const todayString = now.toLocaleDateString('en-US', { timeZone: timezone });
  const dateString = date.toLocaleDateString('en-US', { timeZone: timezone });
  
  return todayString === dateString;
}

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
  updateFamilySettings(familyName: string, settings: Partial<Pick<Family, "showLeaderboard" | "singleDeviceMode" | "language" | "timezone" | "weeklyPrize" | "monthlyPrize" | "yearlyPrize">>): Promise<void>;
  deleteFamily(familyName: string): Promise<void>;

  // Family member operations
  getFamilyMember(id: string): Promise<FamilyMember | undefined>;
  getFamilyMemberById(id: string): Promise<FamilyMember | undefined>;
  getFamilyMemberByUserId(userId: string): Promise<FamilyMember | undefined>;
  getFamilyMemberByJoinCode(joinCode: string): Promise<FamilyMember | undefined>;
  getFamilyMembersByFamily(familyName: string): Promise<FamilyMember[]>;
  getAllFamilyMembers(): Promise<FamilyMember[]>;
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
  resetWeeklyPointsForFamily(familyName: string): Promise<void>;
  resetMonthlyPointsForFamily(familyName: string): Promise<void>;
  resetDailyTasksForFamily(familyName: string): Promise<void>;
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
  getTaskCompletionsByFamily(familyName: string): Promise<TaskCompletion[]>;
  getPendingCompletionsByFamily(familyName: string): Promise<any[]>;
  approveTaskCompletion(completionId: string, approvedBy: string): Promise<void>;
  rejectTaskCompletion(completionId: string, approvedBy: string, rejectionReason: string): Promise<void>;
  getTaskCompletion(completionId: string): Promise<TaskCompletion | undefined>;

  // Reward operations
  getRewardsByFamily(familyName: string): Promise<Reward[]>;
  getRewardById(id: string): Promise<Reward | undefined>;
  createReward(reward: InsertReward): Promise<Reward>;
  updateReward(id: string, reward: Partial<InsertReward> | { isActive: boolean }): Promise<Reward>;
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
  cancelRewardSharing(redemptionId: string): Promise<void>;
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
  createSkin(skin: InsertSkin): Promise<Skin>;
  deleteSkin(skinId: string): Promise<void>;
  updateFamilyMemberActiveSkin(memberId: string, options: { skinId: string | null; useCustomAvatar?: boolean }): Promise<void>;
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
  getGoalContributionsByGoal(goalId: string): Promise<GoalContribution[]>;
  getGoalContributionsByMemberAndGoal(goalId: string, memberId: string, period: string): Promise<GoalContribution | undefined>;
  updateGoalCurrentPoints(goalId: string, currentPoints: number): Promise<void>;
  completeGoal(goalId: string): Promise<void>;

  // Star Placement operations (gamification: hidden stars per child, unlock HeroKids Legacy avatars)
  getStarPlacementsByMember(memberId: string): Promise<StarPlacement[]>;
  initializeStarPlacements(memberId: string): Promise<void>;
  reinitializeStarsOnDiscoveredSkins(memberId: string): Promise<{ placed: number }>;
  markStarAsFound(memberId: string, skinId: string): Promise<{ wasStarFound: boolean; totalStarsFound: number; legacySkinAwarded: string | null }>;
  getMemberStarStats(memberId: string): Promise<{ starsFound: number; totalStars: number; earnedLegacySkinIds: string[] }>;
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
    settings: Partial<Pick<Family, "showLeaderboard" | "singleDeviceMode" | "language" | "timezone" | "weeklyPrize" | "monthlyPrize" | "yearlyPrize">>
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

  async deleteFamily(familyName: string): Promise<void> {
    // Delete all related data in the correct order to respect foreign key constraints
    const members = await this.getFamilyMembersByFamily(familyName);
    const memberIds = members.map(m => m.id);

    if (memberIds.length > 0) {
      // Delete star placements for all members
      for (const memberId of memberIds) {
        await db.delete(starPlacements).where(eq(starPlacements.memberId, memberId));
      }

      // Delete device sessions for all members
      await db.delete(childDeviceSessions).where(inArray(childDeviceSessions.memberId, memberIds));

      // Delete link codes for all members
      await db.delete(deviceLinkCodes).where(inArray(deviceLinkCodes.memberId, memberIds));

      // Delete achievement awards for all members
      await db.delete(achievementAwards).where(inArray(achievementAwards.memberId, memberIds));

      // Delete achievement members for all members
      await db.delete(achievementMembers).where(inArray(achievementMembers.memberId, memberIds));

      // Delete reward redemptions by member
      await db.delete(rewardRedemptions).where(inArray(rewardRedemptions.memberId, memberIds));

      // Delete task completions by member
      await db.delete(taskCompletions).where(inArray(taskCompletions.memberId, memberIds));
    }

    // Delete goal contributions
    const goalsForFamily = await this.getFamilyGoalsByFamily(familyName);
    for (const goal of goalsForFamily) {
      await db.delete(goalContributions).where(eq(goalContributions.goalId, goal.id));
    }

    // Delete family goals
    await db.delete(familyGoals).where(eq(familyGoals.familyName, familyName));

    // Delete chat messages
    await db.delete(chatMessages).where(eq(chatMessages.familyName, familyName));

    // Delete reward requests
    await db.delete(rewardRequests).where(eq(rewardRequests.familyName, familyName));

    // Delete achievement definitions
    await db.delete(achievementDefinitions).where(eq(achievementDefinitions.familyName, familyName));

    // Delete rewards
    await db.delete(rewards).where(eq(rewards.familyName, familyName));

    // Delete tasks
    await db.delete(tasks).where(eq(tasks.familyName, familyName));

    // Delete family members
    await db.delete(familyMembers).where(eq(familyMembers.familyName, familyName));

    // Finally delete the family
    await db.delete(families).where(eq(families.familyName, familyName));

    console.log(`Deleted family: ${familyName} and all related data`);
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

  async getAllFamilyMembers(): Promise<FamilyMember[]> {
    return await db.select().from(familyMembers);
  }

  async getFamilyMemberCount(familyName: string): Promise<number> {
    const members = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.familyName, familyName));
    return members.length;
  }

  // The first skin that all new members get for free as a teaser
  private readonly STARTER_SKIN_ID = "junior-champion";

  async createFamilyMember(memberData: InsertFamilyMember): Promise<FamilyMember> {
    // New members start with the first skin unlocked as a teaser
    const memberWithStarterSkin = {
      ...memberData,
      discoveredSkinIds: [this.STARTER_SKIN_ID],
    };
    
    const [member] = await db
      .insert(familyMembers)
      .values(memberWithStarterSkin as any)
      .returning();
    
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
    
    // Use transaction with row locking to prevent race conditions with avatar history
    return await db.transaction(async (tx) => {
      // Lock the row first to prevent concurrent updates from reading stale data
      const [currentMember] = await tx
        .select()
        .from(familyMembers)
        .where(eq(familyMembers.id, id))
        .for('update');
      
      if (!currentMember) {
        throw new Error(`Family member with id ${id} not found`);
      }
      
      // Manage avatar history if a new avatar is being uploaded
      let finalUpdates: any = { ...safeUpdates, updatedAt: new Date() };
      if (safeUpdates.avatarUrl) {
        const currentHistory = ((currentMember as any).avatarHistory as string[] | null) || [];
        
        // Add new avatar to front of history, keep only last 3
        const newHistory = [safeUpdates.avatarUrl, ...currentHistory.filter(url => url !== safeUpdates.avatarUrl)].slice(0, 3);
        finalUpdates.avatarHistory = newHistory;
      }
      
      const [updated] = await tx
        .update(familyMembers)
        .set(finalUpdates)
        .where(eq(familyMembers.id, id))
        .returning();
      return updated as FamilyMember;
    });
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

  async resetWeeklyPointsForFamily(familyName: string): Promise<void> {
    await db
      .update(familyMembers)
      .set({ weeklyPoints: 0, updatedAt: new Date() })
      .where(eq(familyMembers.familyName, familyName));
  }

  async resetMonthlyPointsForFamily(familyName: string): Promise<void> {
    await db
      .update(familyMembers)
      .set({ monthlyPoints: 0, updatedAt: new Date() })
      .where(eq(familyMembers.familyName, familyName));
  }

  async resetDailyTasksForFamily(familyName: string): Promise<void> {
    // Reset daily recurring tasks by deleting previous day's completions
    // Uses date-fns-tz for timezone-aware start-of-day calculation
    await db.transaction(async (tx) => {
      // Get family timezone
      const [family] = await tx
        .select()
        .from(families)
        .where(eq(families.familyName, familyName));
      
      if (!family) return;
      
      const familyTimezone = family.timezone || "Europe/Berlin";
      
      // Calculate start of today in family's timezone using date-fns-tz
      // This correctly handles DST transitions and all timezone offsets
      const now = new Date();
      const familyNow = toZonedTime(now, familyTimezone); // Current time in family's TZ
      const startOfDayLocal = startOfDay(familyNow); // Midnight in family's TZ
      const startOfDayUTC = fromZonedTime(startOfDayLocal, familyTimezone); // Convert to UTC
      
      // Lock all daily tasks for this family to prevent concurrent modifications
      const dailyTasks = await tx
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.familyName, familyName),
            eq(tasks.recurrence, "daily")
          )
        )
        .for('update'); // Row-level write lock prevents concurrent task updates
      
      // Delete ONLY completions from previous days (preserve today's completions)
      if (dailyTasks.length > 0) {
        const taskIds = dailyTasks.map(t => t.id);
        
        await tx
          .delete(taskCompletions)
          .where(
            and(
              inArray(taskCompletions.taskId, taskIds),
              sql`${taskCompletions.completedAt} < ${startOfDayUTC}`
            )
          );
        
        // For each task, recompute completion_count from remaining completions
        // This includes any completions from today that were preserved
        for (const task of dailyTasks) {
          const remainingCompletions = await tx
            .select({ count: sql<number>`count(*)` })
            .from(taskCompletions)
            .where(
              and(
                eq(taskCompletions.taskId, task.id),
                inArray(taskCompletions.status, ["pending", "approved"])
              )
            );
          
          const actualCount = Number(remainingCompletions[0]?.count || 0);
          
          // Update task with recomputed count and reset nextAvailableDate
          await tx
            .update(tasks)
            .set({ 
              completionCount: actualCount,
              nextAvailableDate: null,
              updatedAt: new Date() 
            })
            .where(eq(tasks.id, task.id));
        }
      }
    });
  }

  async resetTask(taskId: string): Promise<void> {
    // Manual task reset - deletes ALL completions and resets counters
    // Used by parents to manually reset a task if automatic reset fails
    await db.transaction(async (tx) => {
      // Delete all completions for this task
      await tx
        .delete(taskCompletions)
        .where(eq(taskCompletions.taskId, taskId));
      
      // Reset task counters and nextAvailableDate
      await tx
        .update(tasks)
        .set({ 
          completionCount: 0,
          nextAvailableDate: null,
          updatedAt: new Date() 
        })
        .where(eq(tasks.id, taskId));
    });
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
    // NOTE: Daily tasks are reset by the scheduler at midnight (see scheduler.ts)
    // Only reset non-daily tasks here (weekly, monthly, custom recurrence)
    const now = new Date();
    const tasksToReset = allTasks.filter(task => {
      // Only reset recurring multi-completion tasks
      const isRecurring = task.recurrence !== 'none' || task.recurrenceDays !== null;
      const isMultiCompletion = task.maxCompletions !== null;
      const needsReset = task.completionCount > 0;
      
      // Reset ONLY if task has nextAvailableDate and it has passed (fully completed)
      // Do NOT reset daily tasks here - they are handled by the scheduler at midnight
      const hasPassedAvailableDate = task.nextAvailableDate && task.nextAvailableDate <= now;
      
      return isRecurring && isMultiCompletion && needsReset && hasPassedAvailableDate;
    });
    
    // Reset each task
    if (tasksToReset.length > 0) {
      console.log(`🔄 Resetting ${tasksToReset.length} recurring multi-completion task(s) (nextAvailableDate passed)`);
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
    
    // Get task info to check if it's a daily recurring task
    const [task] = await client
      .select({
        recurrence: tasks.recurrence,
        familyName: tasks.familyName
      })
      .from(tasks)
      .where(eq(tasks.id, taskId));
    
    if (!task) return false;
    
    // For daily recurring tasks, only check completions from TODAY (in family timezone)
    if (task.recurrence === 'daily') {
      // Get family timezone
      const [family] = await client
        .select({ timezone: families.timezone })
        .from(families)
        .where(eq(families.familyName, task.familyName));
      
      const familyTimezone = family?.timezone || 'Europe/Berlin';
      
      // Get all active completions for this member and task
      const completions = await client
        .select({ completedAt: taskCompletions.completedAt })
        .from(taskCompletions)
        .where(
          and(
            eq(taskCompletions.taskId, taskId),
            eq(taskCompletions.memberId, memberId),
            inArray(taskCompletions.status, ["pending", "approved"])
          )
        );
      
      // Check if any completion is from today in the family's timezone
      return completions.some((c: { completedAt: Date }) => isToday(c.completedAt, familyTimezone));
    }
    
    // For non-daily tasks, use the original logic (any active completion)
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

  async getMemberCompletionStatus(taskId: string, memberId: string, txClient?: any): Promise<"pending" | "approved" | "rejected" | null> {
    const client = txClient || db;
    
    // Get task info to check if it's a daily recurring task
    const [task] = await client
      .select({
        recurrence: tasks.recurrence,
        familyName: tasks.familyName
      })
      .from(tasks)
      .where(eq(tasks.id, taskId));
    
    if (!task) return null;
    
    // For daily recurring tasks, only check completions from TODAY (in family timezone)
    if (task.recurrence === 'daily') {
      // Get family timezone
      const [family] = await client
        .select({ timezone: families.timezone })
        .from(families)
        .where(eq(families.familyName, task.familyName));
      
      const familyTimezone = family?.timezone || 'Europe/Berlin';
      
      // Get all completions for this member and task
      const completions = await client
        .select({ 
          status: taskCompletions.status,
          completedAt: taskCompletions.completedAt
        })
        .from(taskCompletions)
        .where(
          and(
            eq(taskCompletions.taskId, taskId),
            eq(taskCompletions.memberId, memberId),
            inArray(taskCompletions.status, ["pending", "approved", "rejected"])
          )
        )
        .orderBy(desc(taskCompletions.completedAt));
      
      // Find the most recent completion from today
      const todayCompletion = completions.find((c: { status: string; completedAt: Date }) => isToday(c.completedAt, familyTimezone));
      return todayCompletion?.status || null;
    }
    
    // For non-daily tasks, use the original logic (latest completion)
    const [completion] = await client
      .select({ status: taskCompletions.status })
      .from(taskCompletions)
      .where(
        and(
          eq(taskCompletions.taskId, taskId),
          eq(taskCompletions.memberId, memberId),
          inArray(taskCompletions.status, ["pending", "approved", "rejected"])
        )
      )
      .orderBy(desc(taskCompletions.completedAt))
      .limit(1);
    
    return completion?.status || null;
  }

  /**
   * For normal tasks (maxCompletions == null): Check if ANYONE in the family has completed the task.
   * Returns the most favorable status (approved > pending > rejected > null).
   * For daily tasks, only checks today's completions.
   */
  async getTaskCompletionStatusForFamily(taskId: string, txClient?: any): Promise<"pending" | "approved" | "rejected" | null> {
    const client = txClient || db;
    
    // Get task info
    const [task] = await client
      .select({
        recurrence: tasks.recurrence,
        familyName: tasks.familyName
      })
      .from(tasks)
      .where(eq(tasks.id, taskId));
    
    if (!task) return null;
    
    // For daily recurring tasks, only check completions from TODAY (in family timezone)
    if (task.recurrence === 'daily') {
      // Get family timezone
      const [family] = await client
        .select({ timezone: families.timezone })
        .from(families)
        .where(eq(families.familyName, task.familyName));
      
      const familyTimezone = family?.timezone || 'Europe/Berlin';
      
      // Get ALL completions for this task (from any family member)
      const completions = await client
        .select({ 
          status: taskCompletions.status,
          completedAt: taskCompletions.completedAt
        })
        .from(taskCompletions)
        .where(
          and(
            eq(taskCompletions.taskId, taskId),
            inArray(taskCompletions.status, ["pending", "approved", "rejected"])
          )
        )
        .orderBy(desc(taskCompletions.completedAt));
      
      // Filter to today's completions
      const todayCompletions = completions.filter((c: { status: string; completedAt: Date }) => 
        isToday(c.completedAt, familyTimezone)
      );
      
      // Return the most favorable status: approved > pending > rejected > null
      if (todayCompletions.some((c: { status: string }) => c.status === "approved")) return "approved";
      if (todayCompletions.some((c: { status: string }) => c.status === "pending")) return "pending";
      if (todayCompletions.some((c: { status: string }) => c.status === "rejected")) return "rejected";
      return null;
    }
    
    // For non-daily tasks: check if anyone has completed it
    const completions = await client
      .select({ status: taskCompletions.status })
      .from(taskCompletions)
      .where(
        and(
          eq(taskCompletions.taskId, taskId),
          inArray(taskCompletions.status, ["pending", "approved", "rejected"])
        )
      )
      .orderBy(desc(taskCompletions.completedAt));
    
    // Return the most favorable status
    if (completions.some((c: { status: string }) => c.status === "approved")) return "approved";
    if (completions.some((c: { status: string }) => c.status === "pending")) return "pending";
    if (completions.some((c: { status: string }) => c.status === "rejected")) return "rejected";
    return null;
  }

  async createTaskCompletion(completionData: InsertTaskCompletion): Promise<TaskCompletion> {
    return await db.transaction(async (tx) => {
      // 1. Lock task: SELECT * FROM tasks WHERE id = taskId FOR UPDATE
      const task = await tx.select().from(tasks).where(eq(tasks.id, completionData.taskId)).for('update');
      if (!task[0]) throw new Error('Task not found');
      
      // 2. Check if member already has an active completion (pending or approved)
      // This prevents duplicate submissions for both normal and multi-completion tasks
      const hasCompleted = await this.hasActiveMemberCompletion(
        completionData.taskId, 
        completionData.memberId,
        tx
      );
      if (hasCompleted) throw new Error('Member already completed this task');
      
      // 3. If maxCompletions mode: validate slot availability
      if (task[0].maxCompletions !== null) {
        // Check if slots exhausted
        if (task[0].completionCount >= task[0].maxCompletions) {
          throw new Error('All completion slots filled');
        }
      }
      
      // 4. Insert completion
      const [completion] = await tx.insert(taskCompletions)
        .values({
          ...completionData,
          status: task[0].requiresApproval ? 'pending' : 'approved'
        })
        .returning();
      
      // 5. If auto-approved: run approval logic immediately
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

  async getTaskCompletionsByFamily(familyName: string): Promise<TaskCompletion[]> {
    return await db
      .select({
        id: taskCompletions.id,
        taskId: taskCompletions.taskId,
        memberId: taskCompletions.memberId,
        proofPhotoUrl: taskCompletions.proofPhotoUrl,
        pointsEarned: taskCompletions.pointsEarned,
        status: taskCompletions.status,
        approvedBy: taskCompletions.approvedBy,
        approvedAt: taskCompletions.approvedAt,
        rejectionReason: taskCompletions.rejectionReason,
        completedAt: taskCompletions.completedAt,
      })
      .from(taskCompletions)
      .innerJoin(familyMembers, eq(taskCompletions.memberId, familyMembers.id))
      .where(eq(familyMembers.familyName, familyName))
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

  async getActiveCompletionsByTask(taskId: string): Promise<any[]> {
    // Get task info to check if it's a daily recurring task
    const [task] = await db
      .select({
        recurrence: tasks.recurrence,
        familyName: tasks.familyName
      })
      .from(tasks)
      .where(eq(tasks.id, taskId));
    
    if (!task) return [];
    
    // For daily recurring tasks, only get completions from TODAY (in family timezone)
    if (task.recurrence === 'daily') {
      // Get family timezone
      const [family] = await db
        .select({ timezone: families.timezone })
        .from(families)
        .where(eq(families.familyName, task.familyName));
      
      const familyTimezone = family?.timezone || 'Europe/Berlin';
      
      // Get all active completions for this task
      const allCompletions = await db
        .select({
          id: taskCompletions.id,
          memberId: taskCompletions.memberId,
          memberDisplayName: familyMembers.displayName,
          memberAvatarUrl: familyMembers.avatarUrl,
          memberActiveSkinId: familyMembers.activeSkinId,
          memberUseCustomAvatar: familyMembers.useCustomAvatar,
          memberColor: familyMembers.color,
          status: taskCompletions.status,
          completedAt: taskCompletions.completedAt,
        })
        .from(taskCompletions)
        .innerJoin(familyMembers, eq(taskCompletions.memberId, familyMembers.id))
        .where(
          and(
            eq(taskCompletions.taskId, taskId),
            inArray(taskCompletions.status, ["pending", "approved"])
          )
        )
        .orderBy(taskCompletions.completedAt);
      
      // Filter to only today's completions
      return allCompletions.filter((c) => 
        c.completedAt && isToday(c.completedAt, familyTimezone)
      );
    }
    
    // For non-daily tasks, get all active completions
    const completions = await db
      .select({
        id: taskCompletions.id,
        memberId: taskCompletions.memberId,
        memberDisplayName: familyMembers.displayName,
        memberAvatarUrl: familyMembers.avatarUrl,
        memberActiveSkinId: familyMembers.activeSkinId,
        memberUseCustomAvatar: familyMembers.useCustomAvatar,
        memberColor: familyMembers.color,
        status: taskCompletions.status,
        completedAt: taskCompletions.completedAt,
      })
      .from(taskCompletions)
      .innerJoin(familyMembers, eq(taskCompletions.memberId, familyMembers.id))
      .where(
        and(
          eq(taskCompletions.taskId, taskId),
          inArray(taskCompletions.status, ["pending", "approved"])
        )
      )
      .orderBy(taskCompletions.completedAt);
    
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
    
    // 4. Handle task status updates based on completion
    const isRecurring = task.recurrence !== 'none' || task.recurrenceDays !== null;
    
    if (task.maxCompletions !== null) {
      // Multi-Completion mode: increment counter and check threshold
      // For recurring tasks: keep status as "active" even when maxCompletions reached
      // The nextAvailableDate (set in routes.ts) will make it unavailable until reset
      // For non-recurring tasks: set status to "completed" when maxCompletions reached
      await tx.update(tasks)
        .set({
          completionCount: sql<number>`completion_count + 1`,
          status: isRecurring 
            ? task.status // Keep current status for recurring tasks
            : sql`CASE WHEN completion_count + 1 >= ${task.maxCompletions} THEN 'completed'::task_status ELSE status END`,
          updatedAt: new Date()
        })
        .where(eq(tasks.id, task.id));
    } else {
      // Normal mode (no maxCompletions): Set one-time tasks to "completed" immediately
      // Recurring tasks remain "active" to allow future completions
      if (!isRecurring) {
        await tx.update(tasks)
          .set({
            status: 'completed',
            updatedAt: new Date()
          })
          .where(eq(tasks.id, task.id));
      }
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

  async getRewardById(id: string): Promise<Reward | undefined> {
    const [reward] = await db
      .select()
      .from(rewards)
      .where(eq(rewards.id, id))
      .limit(1);
    return reward;
  }

  async createReward(rewardData: InsertReward): Promise<Reward> {
    const [reward] = await db.insert(rewards).values(rewardData).returning();
    return reward;
  }

  async updateReward(id: string, rewardData: Partial<InsertReward> | { isActive: boolean }): Promise<Reward> {
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
          useCustomAvatar: familyMembers.useCustomAvatar,
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

  async cancelRewardSharing(redemptionId: string): Promise<void> {
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

      if (redemption.sharingStatus !== "sharing_active") {
        throw new Error("Sharing is not active for this reward");
      }

      // Delete all participants (they haven't paid points yet - that happens at finalize)
      await tx
        .delete(rewardSharingParticipants)
        .where(eq(rewardSharingParticipants.redemptionId, redemptionId));

      // Reset sharing status back to not_shared
      await tx
        .update(rewardRedemptions)
        .set({
          sharingStatus: "not_shared",
        })
        .where(eq(rewardRedemptions.id, redemptionId));
    });
  }

  async cancelRewardRedemption(redemptionId: string): Promise<{ memberId: string; pointsRefunded: number; rewardId: string }> {
    return await db.transaction(async (tx) => {
      const [redemption] = await tx
        .select()
        .from(rewardRedemptions)
        .where(eq(rewardRedemptions.id, redemptionId))
        .limit(1);

      if (!redemption) {
        throw new Error("Redemption not found");
      }

      const pointsToRefund = redemption.pointsSpent;
      const memberId = redemption.memberId;
      const rewardId = redemption.rewardId;

      if (redemption.sharingStatus === "sharing_active" || redemption.sharingStatus === "sharing_finalized") {
        await tx
          .delete(rewardSharingParticipants)
          .where(eq(rewardSharingParticipants.redemptionId, redemptionId));
        
        if (redemption.sharingStatus === "sharing_finalized") {
          const participants = await tx
            .select()
            .from(rewardSharingParticipants)
            .where(eq(rewardSharingParticipants.redemptionId, redemptionId));
          
          for (const participant of participants) {
            if (participant.pointsContributed && participant.pointsContributed > 0) {
              await tx
                .update(familyMembers)
                .set({
                  totalPoints: sql`${familyMembers.totalPoints} + ${participant.pointsContributed}`,
                })
                .where(eq(familyMembers.id, participant.memberId));
            }
          }
        }
      }

      await tx
        .update(familyMembers)
        .set({
          totalPoints: sql`${familyMembers.totalPoints} + ${pointsToRefund}`,
        })
        .where(eq(familyMembers.id, memberId));

      await tx
        .delete(rewardRedemptions)
        .where(eq(rewardRedemptions.id, redemptionId));

      return { memberId, pointsRefunded: pointsToRefund, rewardId };
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
          useCustomAvatar: familyMembers.useCustomAvatar,
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

  async createSkin(skinData: InsertSkin): Promise<Skin> {
    const [skin] = await db.insert(skins).values(skinData).returning();
    return skin;
  }

  async deleteSkin(skinId: string): Promise<void> {
    await db.delete(skins).where(eq(skins.id, skinId));
  }

  async updateFamilyMemberActiveSkin(
    memberId: string, 
    options: { skinId: string | null; useCustomAvatar?: boolean }
  ): Promise<void> {
    const updateData: any = { 
      activeSkinId: options.skinId,
      updatedAt: new Date()
    };
    
    if (options.useCustomAvatar !== undefined) {
      updateData.useCustomAvatar = options.useCustomAvatar;
    }
    
    await db
      .update(familyMembers)
      .set(updateData)
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

      // 9. Delete all achievement awards for members (must be before achievement definitions due to FK)
      for (const memberId of memberIds) {
        await tx.delete(achievementAwards)
          .where(eq(achievementAwards.memberId, memberId));
      }

      // 10. Delete all achievement members for this family
      await tx.delete(achievementMembers)
        .where(eq(achievementMembers.familyName, familyName));

      // 11. Delete all achievement definitions for this family
      await tx.delete(achievementDefinitions)
        .where(eq(achievementDefinitions.familyName, familyName));

      // 12. Delete all family goals (goalContributions will cascade delete automatically)
      await tx.delete(familyGoals)
        .where(eq(familyGoals.familyName, familyName));

      // 13. Delete all star placements for family members (so they get redistributed)
      for (const memberId of memberIds) {
        await tx.delete(starPlacements)
          .where(eq(starPlacements.memberId, memberId));
      }

      // 14. Reset all family member stats to zero (including PIN codes, starsFound, Legacy skins, and profile photos)
      // Give everyone the starter skin as a teaser, and assign a random default avatar icon
      const STARTER_SKIN = "junior-champion";
      const DEFAULT_AVATARS = ["default:fox", "default:bear", "default:rabbit", "default:cat", "default:penguin", "default:lion"];
      
      for (const memberId of memberIds) {
        // Pick a random default avatar for each member
        const randomAvatar = DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)];
        
        await tx.update(familyMembers)
          .set({
            totalEarned: 0,
            totalPoints: 0,
            weeklyPoints: 0,
            monthlyPoints: 0,
            rewardsRedeemed: 0,
            unlockedSkins: [],
            discoveredSkinIds: [STARTER_SKIN],
            earnedLegacySkinIds: [], // Reset HeroKids Legacy avatars earned through stars
            activeSkinId: null, // No skin selected - use avatarUrl instead
            avatarUrl: randomAvatar, // Set random default avatar icon (resolved by frontend)
            useCustomAvatar: true, // Use the default avatar icon
            pinCode: null,
            starsFound: 0,
            updatedAt: new Date(),
          })
          .where(eq(familyMembers.id, memberId));
      }

      // 15. Create default achievements using shared template (only Weekly Champion and Perfect Week enabled)
      // Note: Default tasks removed - families now start fresh and parents create tasks in their language
      for (const template of DEFAULT_ACHIEVEMENT_TEMPLATES) {
        await tx.insert(achievementDefinitions).values({
          ...template,
          familyName,
          updatedAt: new Date(),
        });
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
    const created: AchievementDefinition[] = [];
    for (const template of DEFAULT_ACHIEVEMENT_TEMPLATES) {
      const [result] = await db
        .insert(achievementDefinitions)
        .values({
          ...template,
          familyName,
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

  async getGoalContributionsByGoal(goalId: string): Promise<GoalContribution[]> {
    return await db
      .select()
      .from(goalContributions)
      .where(eq(goalContributions.goalId, goalId));
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

  // Device Link Codes
  async createDeviceLinkCode(data: InsertDeviceLinkCode): Promise<DeviceLinkCode> {
    const [code] = await db.insert(deviceLinkCodes).values(data).returning();
    return code;
  }

  async getDeviceLinkCodeByCode(code: string): Promise<DeviceLinkCode | undefined> {
    const [linkCode] = await db
      .select()
      .from(deviceLinkCodes)
      .where(eq(deviceLinkCodes.code, code));
    return linkCode;
  }

  async getActiveDeviceLinkCodeForMember(memberId: string): Promise<DeviceLinkCode | undefined> {
    const now = new Date();
    const [linkCode] = await db
      .select()
      .from(deviceLinkCodes)
      .where(
        and(
          eq(deviceLinkCodes.memberId, memberId),
          gt(deviceLinkCodes.expiresAt, now),
          sql`${deviceLinkCodes.consumedAt} IS NULL`
        )
      );
    return linkCode;
  }

  async consumeDeviceLinkCode(codeId: string): Promise<void> {
    await db
      .update(deviceLinkCodes)
      .set({ consumedAt: new Date() })
      .where(eq(deviceLinkCodes.id, codeId));
  }

  async deleteDeviceLinkCode(codeId: string): Promise<void> {
    await db
      .delete(deviceLinkCodes)
      .where(eq(deviceLinkCodes.id, codeId));
  }

  // Child Device Sessions
  async createChildDeviceSession(data: InsertChildDeviceSession): Promise<ChildDeviceSession> {
    const [session] = await db.insert(childDeviceSessions).values(data).returning();
    return session;
  }

  async getChildDeviceSessionByTokenHash(tokenHash: string): Promise<ChildDeviceSession | undefined> {
    const [session] = await db
      .select()
      .from(childDeviceSessions)
      .where(
        and(
          eq(childDeviceSessions.tokenHash, tokenHash),
          sql`${childDeviceSessions.revokedAt} IS NULL`
        )
      );
    return session;
  }

  async getActiveDeviceSessionsForMember(memberId: string): Promise<ChildDeviceSession[]> {
    return await db
      .select()
      .from(childDeviceSessions)
      .where(
        and(
          eq(childDeviceSessions.memberId, memberId),
          sql`${childDeviceSessions.revokedAt} IS NULL`
        )
      )
      .orderBy(desc(childDeviceSessions.lastSeenAt));
  }

  async updateDeviceSessionLastSeen(sessionId: string): Promise<void> {
    await db
      .update(childDeviceSessions)
      .set({ lastSeenAt: new Date() })
      .where(eq(childDeviceSessions.id, sessionId));
  }

  async revokeDeviceSession(sessionId: string): Promise<void> {
    await db
      .update(childDeviceSessions)
      .set({ revokedAt: new Date() })
      .where(eq(childDeviceSessions.id, sessionId));
  }

  async revokeAllDeviceSessionsForMember(memberId: string): Promise<void> {
    await db
      .update(childDeviceSessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(childDeviceSessions.memberId, memberId),
          sql`${childDeviceSessions.revokedAt} IS NULL`
        )
      );
  }

  async findValidChildDeviceSession(token: string): Promise<ChildDeviceSession | undefined> {
    // Get all active sessions and verify token against each with bcrypt
    const sessions = await db
      .select()
      .from(childDeviceSessions)
      .where(sql`${childDeviceSessions.revokedAt} IS NULL`);
    
    for (const session of sessions) {
      const isValid = await bcrypt.compare(token, session.tokenHash);
      if (isValid) {
        return session;
      }
    }
    return undefined;
  }

  // Star Placement operations
  // HeroKids Legacy skin IDs (Tier 14) - unlocked by collecting 4 stars each (12 skins total)
  private readonly LEGACY_SKIN_IDS = [
    "shield-blaze",
    "comet-dash", 
    "wave-glider",
    "forest-guard",
    "luna-beacon",
    "sunrise-spark",
    "bloom-guardian",
    "breeze-captain",
    "storm-runner",
    "star-guardian",
    "thunder-bolt",
    "heart-shield"
  ];

  async getStarPlacementsByMember(memberId: string): Promise<StarPlacement[]> {
    return await db
      .select()
      .from(starPlacements)
      .where(eq(starPlacements.memberId, memberId));
  }

  async initializeStarPlacements(memberId: string): Promise<void> {
    // Get all standard (non-legacy) skins from database, excluding the starter skin
    const allSkins = await db.select({ id: skins.id }).from(skins);
    const standardSkinIds = allSkins
      .map(s => s.id)
      .filter(id => !this.LEGACY_SKIN_IDS.includes(id) && id !== this.STARTER_SKIN_ID);
    
    if (standardSkinIds.length < TOTAL_HIDDEN_STARS) {
      console.warn(`Only ${standardSkinIds.length} standard skins available for star placement (need ${TOTAL_HIDDEN_STARS})`);
    }

    // Check if member already has star placements
    const existing = await this.getStarPlacementsByMember(memberId);
    
    // If member has correct number of stars or more, skip initialization
    if (existing.length >= TOTAL_HIDDEN_STARS) {
      return; // Already fully initialized
    }
    
    // If member has some stars but less than TOTAL_HIDDEN_STARS, add more
    // This handles the migration from 32 to 48 stars
    if (existing.length > 0 && existing.length < TOTAL_HIDDEN_STARS) {
      const existingSkinIds = existing.map(p => p.skinId);
      const availableSkinIds = standardSkinIds.filter(id => !existingSkinIds.includes(id));
      const starsToAdd = TOTAL_HIDDEN_STARS - existing.length;
      
      console.log(`Upgrading member ${memberId} stars: ${existing.length} -> ${TOTAL_HIDDEN_STARS} (adding ${starsToAdd})`);
      
      const shuffled = [...availableSkinIds].sort(() => Math.random() - 0.5);
      const newPositions = shuffled.slice(0, Math.min(starsToAdd, shuffled.length));
      
      for (const skinId of newPositions) {
        await db.insert(starPlacements).values({
          memberId,
          skinId,
          found: false,
        }).onConflictDoNothing();
      }
      return;
    }

    // Fresh initialization - no existing placements
    const shuffled = [...standardSkinIds].sort(() => Math.random() - 0.5);
    const selectedPositions = shuffled.slice(0, Math.min(TOTAL_HIDDEN_STARS, shuffled.length));

    // Insert star placements
    for (const skinId of selectedPositions) {
      await db.insert(starPlacements).values({
        memberId,
        skinId,
        found: false,
      }).onConflictDoNothing();
    }
  }

  async reinitializeStarsOnDiscoveredSkins(memberId: string): Promise<{ placed: number }> {
    // Get member's discovered skins
    const member = await this.getFamilyMember(memberId);
    if (!member) {
      return { placed: 0 };
    }

    const discoveredSkinIds = member.discoveredSkinIds || [];
    
    // Filter out Legacy skins and starter skin - stars can only be on non-starter standard skins
    const standardDiscoveredIds = discoveredSkinIds.filter(id => 
      !this.LEGACY_SKIN_IDS.includes(id) && id !== this.STARTER_SKIN_ID
    );
    
    if (standardDiscoveredIds.length === 0) {
      console.log(`Member ${memberId} has no discovered standard skins (besides starter) - using all standard skins`);
      // Fall back to normal initialization if no discovered skins
      await db.delete(starPlacements).where(eq(starPlacements.memberId, memberId));
      await db.update(familyMembers).set({ starsFound: 0 }).where(eq(familyMembers.id, memberId));
      
      // Reset and use normal initialization (excluding starter and legacy)
      const allSkins = await db.select({ id: skins.id }).from(skins);
      const allStandardIds = allSkins.map(s => s.id).filter(id => 
        !this.LEGACY_SKIN_IDS.includes(id) && id !== this.STARTER_SKIN_ID
      );
      const shuffled = [...allStandardIds].sort(() => Math.random() - 0.5);
      const selectedPositions = shuffled.slice(0, Math.min(TOTAL_HIDDEN_STARS, shuffled.length));
      
      for (const skinId of selectedPositions) {
        await db.insert(starPlacements).values({ memberId, skinId, found: false }).onConflictDoNothing();
      }
      return { placed: selectedPositions.length };
    }

    // Delete existing star placements
    await db.delete(starPlacements).where(eq(starPlacements.memberId, memberId));
    
    // Reset starsFound counter
    await db.update(familyMembers).set({ starsFound: 0 }).where(eq(familyMembers.id, memberId));

    // Randomly select discovered skins for star placement (excluding starter)
    const shuffled = [...standardDiscoveredIds].sort(() => Math.random() - 0.5);
    const selectedPositions = shuffled.slice(0, Math.min(TOTAL_HIDDEN_STARS, shuffled.length));

    // Insert new star placements on discovered skins
    for (const skinId of selectedPositions) {
      await db.insert(starPlacements).values({
        memberId,
        skinId,
        found: false,
      }).onConflictDoNothing();
    }

    console.log(`Reinitialized ${selectedPositions.length} stars for member ${member.displayName} on discovered skins`);
    return { placed: selectedPositions.length };
  }

  async markStarAsFound(memberId: string, skinId: string): Promise<{ wasStarFound: boolean; totalStarsFound: number; legacySkinAwarded: string | null }> {
    // Check if there's a star at this position that hasn't been found
    const [placement] = await db
      .select()
      .from(starPlacements)
      .where(
        and(
          eq(starPlacements.memberId, memberId),
          eq(starPlacements.skinId, skinId),
          eq(starPlacements.found, false)
        )
      );

    if (!placement) {
      // No unfound star at this position
      const member = await this.getFamilyMember(memberId);
      return { 
        wasStarFound: false, 
        totalStarsFound: member?.starsFound || 0,
        legacySkinAwarded: null
      };
    }

    // Mark star as found
    await db
      .update(starPlacements)
      .set({ found: true, foundAt: new Date() })
      .where(eq(starPlacements.id, placement.id));

    // Increment starsFound counter
    await db
      .update(familyMembers)
      .set({ 
        starsFound: sql`${familyMembers.starsFound} + 1`,
        updatedAt: new Date()
      })
      .where(eq(familyMembers.id, memberId));

    // Get updated member data
    const member = await this.getFamilyMember(memberId);
    const newStarsFound = member?.starsFound || 1;
    const earnedLegacySkinIds = member?.earnedLegacySkinIds || [];

    // Check if a new Legacy skin should be awarded (every STARS_PER_LEGACY_AVATAR stars)
    const legacySkinsEarned = Math.floor(newStarsFound / STARS_PER_LEGACY_AVATAR);
    const currentLegacyCount = earnedLegacySkinIds.length;

    let legacySkinAwarded: string | null = null;

    if (legacySkinsEarned > currentLegacyCount && currentLegacyCount < this.LEGACY_SKIN_IDS.length) {
      // Award the next Legacy skin
      legacySkinAwarded = this.LEGACY_SKIN_IDS[currentLegacyCount];
      
      // Add to earnedLegacySkinIds
      await db
        .update(familyMembers)
        .set({
          earnedLegacySkinIds: sql`array_append(${familyMembers.earnedLegacySkinIds}, ${legacySkinAwarded})`,
          updatedAt: new Date()
        })
        .where(eq(familyMembers.id, memberId));
    }

    return {
      wasStarFound: true,
      totalStarsFound: newStarsFound,
      legacySkinAwarded
    };
  }

  async getMemberStarStats(memberId: string): Promise<{ starsFound: number; totalStars: number; earnedLegacySkinIds: string[] }> {
    const member = await this.getFamilyMember(memberId);
    const placements = await this.getStarPlacementsByMember(memberId);
    
    // Count actual found stars from placements (not member counter which can be out of sync)
    let actualStarsFound = placements.filter(p => p.found).length;
    
    const currentLegacySkinIds = member?.earnedLegacySkinIds || [];
    const currentLegacyCount = currentLegacySkinIds.length;
    
    // LEGACY MIGRATION: If user has Legacy skins but 0 stars found, 
    // they earned those skins before the star system existed.
    // Retroactively mark stars as found based on their earned Legacy count.
    if (actualStarsFound === 0 && currentLegacyCount > 0 && placements.length > 0) {
      const starsToMark = currentLegacyCount * STARS_PER_LEGACY_AVATAR;
      const unfoundPlacements = placements.filter(p => !p.found).slice(0, starsToMark);
      
      console.log(`Legacy migration for ${member?.displayName}: marking ${unfoundPlacements.length} stars as found (has ${currentLegacyCount} Legacy skins)`);
      
      for (const placement of unfoundPlacements) {
        await db.update(starPlacements)
          .set({ found: true })
          .where(eq(starPlacements.id, placement.id));
      }
      
      actualStarsFound = unfoundPlacements.length;
      
      // Update member's starsFound counter
      await db.update(familyMembers)
        .set({ starsFound: actualStarsFound, updatedAt: new Date() })
        .where(eq(familyMembers.id, memberId));
      
      return {
        starsFound: actualStarsFound,
        totalStars: placements.length,
        earnedLegacySkinIds: currentLegacySkinIds
      };
    }
    
    // Calculate how many legacy skins should be earned based on actual stars
    const expectedLegacyCount = Math.min(
      Math.floor(actualStarsFound / STARS_PER_LEGACY_AVATAR),
      this.LEGACY_SKIN_IDS.length
    );
    
    // If member counter or legacy skins are out of sync, fix them
    const memberStarsFound = member?.starsFound || 0;
    const needsStarFix = memberStarsFound !== actualStarsFound;
    const needsLegacyFix = currentLegacyCount < expectedLegacyCount;
    
    if ((needsStarFix || needsLegacyFix) && member) {
      const updates: any = { updatedAt: new Date() };
      
      if (needsStarFix) {
        console.log(`Fixing star count for ${member.displayName}: ${memberStarsFound} -> ${actualStarsFound}`);
        updates.starsFound = actualStarsFound;
      }
      
      if (needsLegacyFix) {
        // Award missing legacy skins
        const correctLegacySkinIds = this.LEGACY_SKIN_IDS.slice(0, expectedLegacyCount);
        console.log(`Fixing legacy skins for ${member.displayName}: ${currentLegacyCount} -> ${expectedLegacyCount}`);
        updates.earnedLegacySkinIds = correctLegacySkinIds;
      }
      
      await db.update(familyMembers)
        .set(updates)
        .where(eq(familyMembers.id, memberId));
      
      return {
        starsFound: actualStarsFound,
        totalStars: placements.length,
        earnedLegacySkinIds: needsLegacyFix ? this.LEGACY_SKIN_IDS.slice(0, expectedLegacyCount) : currentLegacySkinIds
      };
    }
    
    return {
      starsFound: actualStarsFound,
      totalStars: placements.length,
      earnedLegacySkinIds: currentLegacySkinIds
    };
  }

  // Data Migration Methods
  async exportAllData(): Promise<any> {
    const [
      allFamilies,
      allMembers,
      allTasks,
      allRewards,
      allRewardRedemptions,
      allTaskCompletions,
      allChatMessages,
      allAchievementDefs,
      allAchievementAwards,
      allFamilyGoals,
      allStarPlacements,
    ] = await Promise.all([
      db.select().from(families),
      db.select().from(familyMembers),
      db.select().from(tasks),
      db.select().from(rewards),
      db.select().from(rewardRedemptions),
      db.select().from(taskCompletions),
      db.select().from(chatMessages),
      db.select().from(achievementDefinitions),
      db.select().from(achievementAwards),
      db.select().from(familyGoals),
      db.select().from(starPlacements),
    ]);

    return {
      exportDate: new Date().toISOString(),
      families: allFamilies,
      familyMembers: allMembers,
      tasks: allTasks,
      rewards: allRewards,
      rewardRedemptions: allRewardRedemptions,
      taskCompletions: allTaskCompletions,
      chatMessages: allChatMessages,
      achievementDefinitions: allAchievementDefs,
      achievementAwards: allAchievementAwards,
      familyGoals: allFamilyGoals,
      starPlacements: allStarPlacements,
    };
  }

  async importAllData(data: any, skipExisting: boolean = true): Promise<{ imported: any; skipped: any }> {
    const imported: any = {};
    const skipped: any = {};

    // Helper to safely insert records
    const safeInsert = async (table: any, records: any[], tableName: string, idField: string = 'id') => {
      let insertedCount = 0;
      let skippedCount = 0;

      for (const record of records) {
        try {
          if (skipExisting) {
            // Check if record already exists
            const existing = await db.select().from(table).where(eq(table[idField], record[idField])).limit(1);
            if (existing.length > 0) {
              skippedCount++;
              continue;
            }
          }
          await db.insert(table).values(record).onConflictDoNothing();
          insertedCount++;
        } catch (error: any) {
          console.log(`Skipping ${tableName} record ${record[idField]}: ${error.message}`);
          skippedCount++;
        }
      }

      imported[tableName] = insertedCount;
      skipped[tableName] = skippedCount;
    };

    // Import in order of dependencies
    if (data.families?.length) {
      await safeInsert(families, data.families, 'families', 'familyName');
    }
    if (data.familyMembers?.length) {
      await safeInsert(familyMembers, data.familyMembers, 'familyMembers');
    }
    if (data.tasks?.length) {
      await safeInsert(tasks, data.tasks, 'tasks');
    }
    if (data.rewards?.length) {
      await safeInsert(rewards, data.rewards, 'rewards');
    }
    if (data.rewardRedemptions?.length) {
      await safeInsert(rewardRedemptions, data.rewardRedemptions, 'rewardRedemptions');
    }
    if (data.taskCompletions?.length) {
      await safeInsert(taskCompletions, data.taskCompletions, 'taskCompletions');
    }
    if (data.chatMessages?.length) {
      await safeInsert(chatMessages, data.chatMessages, 'chatMessages');
    }
    if (data.achievementDefinitions?.length) {
      await safeInsert(achievementDefinitions, data.achievementDefinitions, 'achievementDefinitions');
    }
    if (data.achievementAwards?.length) {
      await safeInsert(achievementAwards, data.achievementAwards, 'achievementAwards');
    }
    if (data.familyGoals?.length) {
      await safeInsert(familyGoals, data.familyGoals, 'familyGoals');
    }
    if (data.starPlacements?.length) {
      await safeInsert(starPlacements, data.starPlacements, 'starPlacements');
    }

    return { imported, skipped };
  }
}

export const storage = new DatabaseStorage();
