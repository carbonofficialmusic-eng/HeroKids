import {
  users,
  authRateLimits,
  families,
  familyMembers,
  tasks,
  taskAssignments,
  taskCompletions,
  dailyTaskProgress,
  rewards,
  rewardRedemptions,
  rewardSharingParticipants,
  rewardRequests,
  pointsHistory,
  skins,
  chatMessages,
  chatConversationReads,
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
  mobileRefreshTokens,
  childDeviceSessions,
  tvPairings,
  tvSessions,
  type DeviceLinkCode,
  type InsertDeviceLinkCode,
  type ChildDeviceSession,
  type InsertChildDeviceSession,
  type TvPairing,
  type TvSession,
  starPlacements,
  type StarPlacement,
  pinboardNotes,
  notifications,
  emailReadinessChecks,
  accountLinkRepairHistory,
  pointTransactions,
  shoppingListItems,
  devicePushTokens,
  googleCalendarConnections,
  appConfig,
  type Notification,
  type InsertNotification,
  type NotificationType,
  type EmailReadinessCheck,
  type InsertEmailReadinessCheck,
  type AccountLinkRepairHistory,
  type InsertAccountLinkRepairHistory,
  type InsertPointTransaction,
  type ShoppingListItem,
  type InsertShoppingListItem,
} from "@workspace/db";
import { calculateConversationUnreadCounts } from "./chat-unread";
import { clampAvailablePoints } from "@shared/point-balance";
import { db } from "./db";
import { eq, and, desc, gt, gte, lt, sql, inArray, isNull, isNotNull, ne } from "drizzle-orm";
import { startOfDay } from 'date-fns';
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import bcrypt from 'bcrypt';
import { randomUUID } from "node:crypto";
import { MIXED_SKIN_ORDER, STARTER_SKIN_ID, TOTAL_HIDDEN_STARS, STARS_PER_LEGACY_AVATAR } from "@shared/skin-config";
import { getProfilePhotoObjectPaths } from "@shared/avatar-preferences";
import {
  calculateTaskCompletionCapacity,
  isIndividualRecurringCompletionActive,
  isRecurringTaskSchedule,
  lockTaskRowsInOrder,
  resolveCompletionDecision,
  shouldResetRecurringMultiCompletionTask,
  type TaskCompletionCapacity,
} from "./task-mode-policy";
import { allocateRewardShares } from "@shared/reward-sharing";
import { allocateDailyTaskPoints } from "./daily-task-allocation";
import { getPendingProofAttachments } from "./pendingCompletionAttachments";
import { z } from "zod/v4";
import { createStartSkinOptions, createStartStarPositions, getFreeStarterId, isStartPending } from "./start-skin-policy";

type CategoryNames = NonNullable<Family["categoryNames"]>;

const categoryNamesSchema = z.object({
  household: z.string().optional(),
  school: z.string().optional(),
  selfCare: z.string().optional(),
  pets: z.string().optional(),
  other: z.string().optional(),
}).strict().nullable();

function normalizeCategoryNames(value: unknown): CategoryNames | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = categoryNamesSchema.safeParse(value);
  if (!parsed.success) {
    throw new TypeError(`Invalid family categoryNames: ${parsed.error.issues[0]?.message || "invalid value"}`);
  }
  return parsed.data;
}

/**
 * Default achievement templates - used by both seedDefaultAchievements and resetFamilyToFactory
 * Active by default: Monthly Champion, Perfect Week, 7-Day Streak, Lifetime Milestones (500/1000/2000), Star Collector
 */
const DEFAULT_ACHIEVEMENT_TEMPLATES = [
  {
    type: "monthly_leaderboard" as const,
    slug: "monthly-leaderboard-1st",
    title: "Monthly Champion",
    description: "Finish in 1st place on the monthly leaderboard",
    bonusPoints: 200,
    rewardType: "points" as const,
    isActive: true,
    config: { rank: 1 },
  },
  {
    type: "perfect_week" as const,
    slug: "perfect-week",
    title: "Perfect Week",
    description: "Complete all your weekly recurring tasks without any rejections",
    bonusPoints: 100,
    rewardType: "custom" as const,
    isActive: false,
    config: {},
  },
  {
    type: "lifetime_milestone" as const,
    slug: "lifetime-500",
    title: "500 Points Milestone",
    description: "Earn a total of 500 points",
    bonusPoints: 100,
    rewardType: "custom" as const,
    isActive: false,
    config: { threshold: 500 },
  },
  {
    type: "lifetime_milestone" as const,
    slug: "lifetime-1000",
    title: "1000 Points Milestone",
    description: "Earn a total of 1000 points",
    bonusPoints: 200,
    rewardType: "custom" as const,
    isActive: false,
    config: { threshold: 1000 },
  },
  {
    type: "lifetime_milestone" as const,
    slug: "lifetime-2000",
    title: "2000 Points Milestone",
    description: "Earn a total of 2000 points",
    bonusPoints: 400,
    rewardType: "custom" as const,
    isActive: false,
    config: { threshold: 2000 },
  },
  {
    type: "star_collector" as const,
    slug: "star-collector",
    title: "Star Collector",
    description: "Find 4 hidden stars on skin cards",
    bonusPoints: 40,
    rewardType: "points" as const,
    isActive: true,
    config: { starsRequired: 4 },
  },
  {
    type: "legacy_collector" as const,
    slug: "legacy-collector",
    title: "Legacy Collector",
    description: "Unlock 10 of 12 HeroKids Legacy skins",
    bonusPoints: 500,
    rewardType: "custom" as const,
    isActive: false,
    config: { requiredLegacySkins: 10 },
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
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  getUserByAppleId(appleId: string): Promise<User | undefined>;
  upsertAppleUser(profile: { appleId: string; email?: string; firstName?: string; lastName?: string }): Promise<User>;
  getUserByEmailVerificationToken(tokenHash: string): Promise<User | undefined>;
  getUserByPendingEmailVerificationToken(tokenHash: string): Promise<User | undefined>;
  getUserByPasswordResetToken(tokenHash: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  createLocalUser(user: UpsertUser): Promise<User>;
  upsertGoogleUser(profile: { googleId: string; email: string; firstName: string; lastName?: string; profileImageUrl?: string }): Promise<User>;
  updateUserAuthFields(id: string, updates: Partial<UpsertUser>): Promise<User>;
  updateUserLastLogin(id: string): Promise<void>;
  incrementAuthRateLimit(key: string, maxRequests: number, windowMs: number): Promise<{ allowed: boolean; retryAfter: number }>;

  // Family operations
  getFamily(familyName: string): Promise<Family | undefined>;
  getFamilies(): Promise<Family[]>;
  getFamilyByJoinCode(joinCode: string): Promise<Family | undefined>;
  createFamily(family: InsertFamily): Promise<Family>;
  updateFamily(familyName: string, updates: Partial<InsertFamily>): Promise<Family>;
  startFamilyTrial(familyName: string): Promise<Family | null>;
  updateFamilyTier(familyName: string, tier: "free" | "family" | "family_plus" | "family_hero"): Promise<void>;
  updateFamilySettings(familyName: string, settings: Partial<Pick<Family, "showLeaderboard" | "singleDeviceMode" | "language" | "timezone" | "weeklyPrize" | "monthlyPrize" | "yearlyPrize" | "skinCardCost" | "categoryNames">>): Promise<void>;
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
  unlinkUserFromFamilyMember(id: string): Promise<FamilyMember>;
  createAccountLinkRepairHistory(history: InsertAccountLinkRepairHistory): Promise<AccountLinkRepairHistory>;
  getRecentAccountLinkRepairHistoryByFamily(familyName: string, limit?: number): Promise<AccountLinkRepairHistory[]>;
  deleteFamilyMember(id: string): Promise<void>;
  awardPointsAtomically(
    memberIds: string[],
    points: number,
    sourceType: "parent_bonus" | "admin_adjustment",
    reason: string,
    actorMemberId?: string | null,
    sourceId?: string | null,
  ): Promise<FamilyMember[]>;
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

  // Shopping list item operations
  getShoppingListItems(taskId: string): Promise<ShoppingListItem[]>;
  createShoppingListItems(items: InsertShoppingListItem[]): Promise<ShoppingListItem[]>;
  replaceShoppingListItems(taskId: string, items: InsertShoppingListItem[]): Promise<ShoppingListItem[]>;
  toggleShoppingListItem(itemId: string, memberId: string): Promise<ShoppingListItem>;
  toggleShoppingListItemAtomically(itemId: string, memberId: string): Promise<{
    item: ShoppingListItem;
    allCompleted: boolean;
    task: Task;
  }>;
  uncheckShoppingListItem(itemId: string): Promise<ShoppingListItem>;
  getShoppingListItem(itemId: string): Promise<ShoppingListItem | undefined>;

  // Task assignment operations
  createTaskAssignment(assignment: InsertTaskAssignment): Promise<void>;
  replaceTaskAssignments(taskId: string, memberIds: string[]): Promise<void>;
  getTaskAssignmentsByMember(memberId: string): Promise<string[]>;
  getTaskAssignmentsByTask(taskId: string): Promise<string[]>;

  // Task completion operations
  createTaskCompletion(completion: InsertTaskCompletion, options?: { forceApproval?: boolean }): Promise<TaskCompletion>;
  createShoppingListTaskCompletions(taskId: string, memberIds: string[]): Promise<TaskCompletion[]>;
  getTaskCompletionCapacity(taskId: string): Promise<TaskCompletionCapacity>;
  hasActiveMemberCompletion(taskId: string, memberId: string, txClient?: any): Promise<boolean>;
  getTaskCompletionsByMember(memberId: string): Promise<TaskCompletion[]>;
  getTaskCompletionsByFamily(familyName: string): Promise<TaskCompletion[]>;
  getTaskCompletionsByTask(taskId: string): Promise<TaskCompletion[]>;
  getDailyTaskProgress(taskId: string, memberId: string): Promise<number>;
  submitDailyTaskExecution(completion: InsertTaskCompletion): Promise<{ executionCount: number; target: number; completed: boolean; completion?: TaskCompletion }>;
  getCompletionsWithOldProofPhotos(daysOld: number): Promise<TaskCompletion[]>;
  clearCompletionProofPhoto(completionId: string): Promise<void>;
  // Data cleanup
  cleanupExpiredAuthRateLimits(): Promise<number>;
  cleanupExpiredDeviceLinkCodes(): Promise<number>;
  cleanupExpiredMobileRefreshTokens(): Promise<number>;
  cleanupOldNotifications(daysOld: number): Promise<number>;
  cleanupOldEmailReadinessChecks(keepCount: number): Promise<number>;
  getPendingCompletionsByFamily(familyName: string): Promise<any[]>;
  approveTaskCompletion(completionId: string, approvedBy: string): Promise<void>;
  approveTaskCompletions(completionIds: string[], approvedBy: string, pointsEarnedOverride?: number): Promise<void>;
  autoApproveTaskCompletions(completionIds: string[], pointsEarnedOverride?: number): Promise<void>;
  rejectTaskCompletion(completionId: string, approvedBy: string, rejectionReason: string): Promise<void>;
  rejectTaskCompletions(completionIds: string[], approvedBy: string, rejectionReason: string): Promise<void>;
  getTaskCompletion(completionId: string): Promise<TaskCompletion | undefined>;
  deleteTaskCompletionsByTask(taskId: string): Promise<void>;
  deletePendingTaskCompletionsByTask(taskId: string): Promise<void>;
  updateTaskCompletionPoints(completionId: string, points: number): Promise<void>;

  // Reward operations
  getRewardsByFamily(familyName: string): Promise<Reward[]>;
  getRewardById(id: string): Promise<Reward | undefined>;
  createReward(reward: InsertReward): Promise<Reward>;
  updateReward(id: string, reward: Partial<InsertReward> | { isActive: boolean }): Promise<Reward>;
  deleteReward(id: string): Promise<void>;
  
  // Reward redemption operations
  createRewardRedemption(redemption: InsertRewardRedemption): Promise<RewardRedemption>;
  redeemRewardAtomically(memberId: string, reward: Reward, actorMemberId?: string | null, operationId?: string | null): Promise<RewardRedemption>;
  getRewardRedemptionsByFamily(familyName: string): Promise<any[]>;
  getRewardRedemptionsByMember(memberId: string): Promise<RewardRedemption[]>;
  updateRewardRedemptionStatus(id: string, status: string): Promise<void>;
  cancelRewardRedemption(id: string): Promise<{ memberId: string; pointsRefunded: number; rewardId: string; rewardReactivated: boolean }>;
  
  // Reward sharing operations
  getRewardRedemption(id: string): Promise<RewardRedemption | undefined>;
  startRewardSharing(redemptionId: string): Promise<void>;
  joinRewardSharing(redemptionId: string, memberId: string): Promise<RewardSharingParticipant>;
  finalizeRewardSharing(redemptionId: string): Promise<void>;
  cancelRewardSharing(redemptionId: string): Promise<void>;
  leaveRewardSharing(redemptionId: string, memberId: string): Promise<void>;
  getRewardSharingParticipants(redemptionId: string): Promise<Array<RewardSharingParticipant & { member: FamilyMember }>>;
  getActiveSharedRewards(familyName: string): Promise<Array<RewardRedemption & { participants: Array<RewardSharingParticipant & { member: FamilyMember }> }>>;

  // Reward request operations
  createRewardRequest(request: InsertRewardRequest): Promise<RewardRequest>;
  getRewardRequestsByFamily(familyName: string): Promise<any[]>;
  updateRewardRequest(id: string, data: { title: string; description: string | null; pointThreshold: number }): Promise<void>;
  updateRewardRequestStatus(id: string, status: string, reviewedBy: string): Promise<void>;

  // Points history operations
  addPointsHistory(history: InsertPointsHistory): Promise<void>;
  getPointTransactionsByMember(memberId: string, limit?: number): Promise<any[]>;
  getPointTransactionsByFamily(familyName: string, limit?: number): Promise<any[]>;

  // Skin operations
  getSkins(): Promise<any[]>;
  createSkin(skin: InsertSkin): Promise<Skin>;
  deleteSkin(skinId: string): Promise<void>;
  updateFamilyMemberActiveSkin(memberId: string, options: { skinId: string | null; useCustomAvatar?: boolean; useThemeBackground?: boolean }): Promise<void>;
  updateFamilyMemberThemeBackground(memberId: string, useThemeBackground: boolean): Promise<void>;
  unlockSkin(memberId: string, skinId: string): Promise<void>;
  incrementRewardsRedeemed(memberId: string): Promise<number>;

  // Factory reset operation
  resetFamilyToFactory(familyName: string): Promise<{
    profilePhotoPaths: string[];
    googleRefreshTokenEncrypted: string | null;
  }>;

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
  backfillOneTimeAchievementAtomically(achievementDefinitionId: string, memberId: string, bonusPoints: number): Promise<{ award: AchievementAward; created: boolean }>;
  getAchievementAwardsByFamily(familyName: string): Promise<Array<AchievementAward & { achievementDefinition: AchievementDefinition; member: FamilyMember }>>;
  getAchievementAwardsByMember(memberId: string): Promise<Array<AchievementAward & { achievementDefinition: AchievementDefinition }>>;

  // Chat operations (Family+ and Enterprise tier)
  getChatMessages(familyName: string, viewerMemberId: string, limit?: number): Promise<any[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  updateLastReadChatAt(memberId: string, conversationKey: string): Promise<void>;
  getUnreadMessageCounts(memberId: string, familyName: string): Promise<{ count: number; conversations: Record<string, number> }>;

  // Family Goals operations
  getFamilyGoalsByFamily(familyName: string): Promise<FamilyGoal[]>;
  getFamilyGoal(id: string): Promise<FamilyGoal | undefined>;
  createFamilyGoal(goal: InsertFamilyGoal): Promise<FamilyGoal>;
  updateFamilyGoal(id: string, goal: Partial<InsertFamilyGoal>): Promise<FamilyGoal>;
  deleteFamilyGoal(id: string): Promise<void>;
  contributeToGoal(goalId: string, memberId: string, points: number, period: string): Promise<GoalContribution>;
  contributeToGoalAtomically(goalId: string, memberId: string, familyTimezone: string, actorMemberId?: string | null): Promise<{ contribution: GoalContribution; goal: FamilyGoal; completed: boolean }>;
  getGoalContributionsByGoalAndPeriod(goalId: string, period: string): Promise<GoalContribution[]>;
  getGoalContributionsByGoal(goalId: string): Promise<GoalContribution[]>;
  getGoalContributionsByMemberAndGoal(goalId: string, memberId: string, period: string): Promise<GoalContribution | undefined>;
  updateGoalCurrentPoints(goalId: string, currentPoints: number): Promise<void>;
  completeGoal(goalId: string): Promise<void>;

  // Star Placement operations (gamification: hidden stars per child, unlock HeroKids Legacy avatars)
  getStarPlacementsByMember(memberId: string): Promise<StarPlacement[]>;
  initializeStarPlacements(memberId: string): Promise<void>;
  fixMemberStars(memberId: string): Promise<{ totalPlacements: number; added: number; message: string }>;
  markStarAsFound(memberId: string, skinId: string): Promise<{ wasStarFound: boolean; totalStarsFound: number; legacySkinAwarded: string | null }>;
  getMemberStarStats(memberId: string): Promise<{ starsFound: number; totalStars: number; earnedLegacySkinIds: string[] }>;

  // Notification operations (member-based - each member has their own notifications)
  getNotificationsForMember(memberId: string, limit?: number): Promise<Notification[]>;
  getUnreadNotificationCountForMember(memberId: string): Promise<number>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  createNotificationForParents(familyName: string, notificationData: Omit<InsertNotification, 'targetMemberId'>, excludeMemberId?: string): Promise<void>;
  createNotificationForSiblings(familyName: string, notificationData: Omit<InsertNotification, 'targetMemberId'>, excludeMemberId: string): Promise<void>;
  markNotificationAsRead(notificationId: string): Promise<void>;
  markAllNotificationsAsReadForMember(memberId: string): Promise<void>;
  deleteNotification(notificationId: string): Promise<void>;
  deleteAllNotificationsForMember(memberId: string): Promise<void>;
  deleteNotificationsByTypeAndTask(familyName: string, type: NotificationType, taskId: string): Promise<void>;
  deleteNotificationsByTarget(familyName: string, type: NotificationType, targetMemberId: string): Promise<void>;

  createEmailReadinessCheck(check: InsertEmailReadinessCheck): Promise<EmailReadinessCheck>;
  getRecentEmailReadinessChecks(limit?: number): Promise<EmailReadinessCheck[]>;

  // Device push token operations
  upsertDevicePushToken(memberId: string, token: string, platform?: string): Promise<void>;
  removeDevicePushToken(token: string): Promise<void>;
  getDevicePushTokensForMember(memberId: string): Promise<string[]>;
  getDevicePushTokensForMembers(memberIds: string[]): Promise<string[]>;

  // App config operations
  getAppConfig(key: string): Promise<string | null>;
  setAppConfig(key: string, value: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  /**
   * Apply one atomic balance mutation inside an existing transaction.
   *
   * The member row is the lock.  We intentionally do not clamp available
   * points to lifetime points here: old anomalies must remain observable in
   * the ledger instead of being silently rewritten by a later transaction.
   */
  async mutatePointBalance(
    tx: any,
    input: {
      memberId: string;
      deltas: {
        totalEarned?: number;
        totalPoints?: number;
        weeklyPoints?: number;
        monthlyPoints?: number;
      };
      sourceType: string;
      sourceId?: string | null;
      reason: string;
      actorMemberId?: string | null;
      idempotencyKey?: string | null;
      metadata?: Record<string, unknown> | null;
    },
  ): Promise<FamilyMember | undefined> {
    const deltas = {
      totalEarned: input.deltas.totalEarned ?? 0,
      totalPoints: input.deltas.totalPoints ?? 0,
      weeklyPoints: input.deltas.weeklyPoints ?? 0,
      monthlyPoints: input.deltas.monthlyPoints ?? 0,
    };
    for (const value of Object.values(deltas)) {
      if (!Number.isSafeInteger(value)) {
        throw new Error("Point mutations must use integer deltas");
      }
    }
    if (!input.sourceType || input.sourceType.length > 64 || !input.reason) {
      throw new Error("Point mutation source and reason are required");
    }
    if (input.idempotencyKey && !input.idempotencyKey.includes(input.memberId)) {
      throw new Error("Point mutation idempotency keys must include the member id");
    }

    const [member] = await tx
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.id, input.memberId))
      .for("update")
      .limit(1);
    if (!member) return undefined;

    // Check after acquiring the member lock as well. This closes the race
    // where two requests both check an as-yet-unwritten idempotency key.
    if (input.idempotencyKey) {
      const [existing] = await tx
        .select()
        .from(pointTransactions)
        .where(eq(pointTransactions.idempotencyKey, input.idempotencyKey))
        .limit(1);
      if (existing) return member;
    }

    const next = {
      totalEarned: member.totalEarned + deltas.totalEarned,
      totalPoints: member.totalPoints + deltas.totalPoints,
      weeklyPoints: member.weeklyPoints + deltas.weeklyPoints,
      monthlyPoints: member.monthlyPoints + deltas.monthlyPoints,
    };
    if (Object.values(next).some(value => !Number.isSafeInteger(value)) ||
        next.totalEarned < 0 || next.totalPoints < 0 ||
        next.weeklyPoints < 0 || next.monthlyPoints < 0) {
      throw new Error("Point mutation would create a negative or invalid balance");
    }

    await tx
      .update(familyMembers)
      .set({ ...next, updatedAt: new Date() })
      .where(eq(familyMembers.id, member.id));

    const ledger: InsertPointTransaction = {
      familyName: member.familyName,
      memberId: member.id,
      ...Object.fromEntries(Object.entries(deltas).map(([key, value]) => [`delta${key[0].toUpperCase()}${key.slice(1)}`, value])),
      beforeTotalEarned: member.totalEarned,
      afterTotalEarned: next.totalEarned,
      beforeTotalPoints: member.totalPoints,
      afterTotalPoints: next.totalPoints,
      beforeWeeklyPoints: member.weeklyPoints,
      afterWeeklyPoints: next.weeklyPoints,
      beforeMonthlyPoints: member.monthlyPoints,
      afterMonthlyPoints: next.monthlyPoints,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      reason: input.reason,
      actorMemberId: input.actorMemberId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      metadata: input.metadata ?? null,
    } as InsertPointTransaction;

    await tx.insert(pointTransactions).values(ledger);
    return { ...member, ...next, updatedAt: new Date() };
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = lower(${email})`)
      .orderBy(desc(users.isEmailVerified), desc(users.lastLoginAt), desc(users.updatedAt), desc(users.createdAt));
    return user;
  }

  async incrementAuthRateLimit(key: string, maxRequests: number, windowMs: number): Promise<{ allowed: boolean; retryAfter: number }> {
    const now = new Date();
    const resetTime = new Date(now.getTime() + windowMs);
    const [entry] = await db
      .insert(authRateLimits)
      .values({ key, count: 1, resetTime })
      .onConflictDoUpdate({
        target: authRateLimits.key,
        set: {
          count: sql<number>`CASE WHEN ${authRateLimits.resetTime} < ${now} THEN 1 ELSE ${authRateLimits.count} + 1 END`,
          resetTime: sql<Date>`CASE WHEN ${authRateLimits.resetTime} < ${now} THEN ${resetTime} ELSE ${authRateLimits.resetTime} END`,
        },
      })
      .returning();

    if (Math.random() < 0.01) {
      await db.delete(authRateLimits).where(lt(authRateLimits.resetTime, now));
    }

    return {
      allowed: entry.count <= maxRequests,
      retryAfter: Math.max(1, Math.ceil((entry.resetTime.getTime() - Date.now()) / 1000)),
    };
  }

  async getUserByEmailVerificationToken(tokenHash: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.emailVerificationTokenHash, tokenHash));
    return user;
  }

  async getUserByPendingEmailVerificationToken(tokenHash: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.pendingEmailVerificationTokenHash, tokenHash));
    return user;
  }

  async getUserByPasswordResetToken(tokenHash: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.passwordResetTokenHash, tokenHash));
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

  async createLocalUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        email: userData.email?.toLowerCase(),
      })
      .returning();
    return user;
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.googleId, googleId));
    return user;
  }

  async upsertGoogleUser(profile: { googleId: string; email: string; firstName: string; lastName?: string; profileImageUrl?: string }): Promise<User> {
    const email = profile.email.toLowerCase();
    // Check if there's already a user with this email — link the Google ID to it
    const existing = await this.getUserByEmail(email);
    if (existing) {
      const [updated] = await db
        .update(users)
        .set({
          googleId: profile.googleId,
          isEmailVerified: true,
          profileImageUrl: profile.profileImageUrl ?? existing.profileImageUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existing.id))
        .returning();
      return updated;
    }
    // New user via Google
    const [user] = await db
      .insert(users)
      .values({
        email,
        googleId: profile.googleId,
        firstName: profile.firstName,
        lastName: profile.lastName ?? null,
        profileImageUrl: profile.profileImageUrl ?? null,
        isEmailVerified: true,
      })
      .returning();
    return user;
  }

  async getUserByAppleId(appleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.appleId, appleId));
    return user;
  }

  async upsertAppleUser(profile: { appleId: string; email?: string; firstName?: string; lastName?: string }): Promise<User> {
    // If we have an email, try to link to existing user
    if (profile.email) {
      const email = profile.email.toLowerCase();
      const existing = await this.getUserByEmail(email);
      if (existing) {
        const [updated] = await db
          .update(users)
          .set({ appleId: profile.appleId, isEmailVerified: true, updatedAt: new Date() })
          .where(eq(users.id, existing.id))
          .returning();
        return updated;
      }
      // New user with email
      const [user] = await db
        .insert(users)
        .values({
          email,
          appleId: profile.appleId,
          firstName: profile.firstName ?? "Apple",
          lastName: profile.lastName ?? null,
          isEmailVerified: true,
        })
        .returning();
      return user;
    }
    // No email (Apple hides it after first sign-in) — create/return by appleId only
    const existing = await this.getUserByAppleId(profile.appleId);
    if (existing) return existing;
    const [user] = await db
      .insert(users)
      .values({
        appleId: profile.appleId,
        firstName: profile.firstName ?? "Apple User",
        lastName: profile.lastName ?? null,
        isEmailVerified: false,
      })
      .returning();
    return user;
  }

  async updateUserAuthFields(id: string, updates: Partial<UpsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async updateUserLastLogin(id: string): Promise<void> {
    await db
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, id));
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
    const categoryNames = normalizeCategoryNames(familyData.categoryNames);
    const { categoryNames: _categoryNames, ...familyDataWithoutCategoryNames } = familyData;
    const normalizedFamilyData = categoryNames === undefined
      ? familyDataWithoutCategoryNames
      : { ...familyDataWithoutCategoryNames, categoryNames };
    const [family] = await db.insert(families).values(normalizedFamilyData).returning();
    return family;
  }

  async updateFamilyTier(
    familyName: string,
    tier: "free" | "family" | "family_plus" | "family_hero"
  ): Promise<void> {
    await db
      .update(families)
      .set({
        subscriptionTier: tier,
        // Mark as admin-granted so RC cancel-sync won't auto-revert it;
        // clear the flag when setting back to free (no longer needs protection).
        isAdminGranted: tier !== "free",
        updatedAt: new Date(),
      })
      .where(eq(families.familyName, familyName));
  }

  async updateFamilySettings(
    familyName: string,
    settings: Partial<Pick<Family, "showLeaderboard" | "singleDeviceMode" | "language" | "timezone" | "weeklyPrize" | "monthlyPrize" | "yearlyPrize" | "skinCardCost" | "categoryNames">>
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
    const categoryNames = normalizeCategoryNames(updates.categoryNames);
    const { categoryNames: _categoryNames, ...updatesWithoutCategoryNames } = updates;
    const [family] = await db
      .update(families)
      .set({
        ...updatesWithoutCategoryNames,
        ...(categoryNames === undefined ? {} : { categoryNames }),
        updatedAt: new Date(),
      })
      .where(eq(families.familyName, familyName))
      .returning();
    return family;
  }

  async startFamilyTrial(familyName: string): Promise<Family | null> {
    const now = new Date();
    const [family] = await db.update(families)
      .set({ trialStartedAt: now, trialEndsAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000) })
      .where(and(
        eq(families.familyName, familyName),
        eq(families.subscriptionTier, "free"),
        isNull(families.trialStartedAt),
      ))
      .returning();
    return family ?? null;
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
    return await db.transaction(async (tx) => {
      const [targetMember] = await tx
        .select()
        .from(familyMembers)
        .where(eq(familyMembers.id, id))
        .for("update");

      if (!targetMember) {
        throw new Error(`Family member with id ${id} not found`);
      }

      if (targetMember.userId && targetMember.userId !== userId) {
        throw new Error("This family member is already linked to another account.");
      }

      const [existingLinkedMember] = await tx
        .select()
        .from(familyMembers)
        .where(eq(familyMembers.userId, userId))
        .for("update");

      if (existingLinkedMember && existingLinkedMember.id !== id) {
        throw new Error("This account is already linked to another family member.");
      }

      const [member] = await tx
        .update(familyMembers)
        .set({
          userId,
          displayName: updates.displayName,
          avatarUrl: updates.avatarUrl,
          color: updates.color,
          updatedAt: new Date(),
        })
        .where(eq(familyMembers.id, id))
        .returning();
      return member;
    });
  }

  async unlinkUserFromFamilyMember(id: string): Promise<FamilyMember> {
    const [member] = await db
      .update(familyMembers)
      .set({ userId: sql`NULL`, updatedAt: new Date() })
      .where(eq(familyMembers.id, id))
      .returning();

    if (!member) {
      throw new Error(`Family member with id ${id} not found`);
    }

    return member;
  }

  async createAccountLinkRepairHistory(historyData: InsertAccountLinkRepairHistory): Promise<AccountLinkRepairHistory> {
    const [history] = await db
      .insert(accountLinkRepairHistory)
      .values(historyData)
      .returning();
    return history;
  }

  async getRecentAccountLinkRepairHistoryByFamily(familyName: string, limit = 10): Promise<AccountLinkRepairHistory[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 25);
    return await db
      .select()
      .from(accountLinkRepairHistory)
      .where(eq(accountLinkRepairHistory.familyName, familyName))
      .orderBy(desc(accountLinkRepairHistory.repairedAt))
      .limit(safeLimit);
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
    // Only this creation boundary enrols profiles. Nullable columns leave old
    // profiles untouched; caller-supplied progress can never bypass the flow.
    const memberWithStarterSkin = {
      ...memberData,
      startSkinOptions: createStartSkinOptions(),
      freeStarterSkinId: null,
      firstTaskCreatedAt: null,
      startCompletedAt: null,
      discoveredSkinIds: [],
      unlockedSkins: [],
      earnedLegacySkinIds: [],
      starsFound: 0,
      activeSkinId: null,
    };
    
    return db.transaction(async tx => {
      const [member] = await tx.insert(familyMembers)
        .values(memberWithStarterSkin as any).returning();
      await tx.insert(starPlacements).values(createStartStarPositions()
        .map(skinId => ({ memberId: member.id, skinId, found: false })));
      return member;
    });
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
    const {
      pinCode,
      totalEarned,
      totalPoints,
      weeklyPoints,
      monthlyPoints,
      startSkinOptions,
      freeStarterSkinId,
      firstTaskCreatedAt,
      startCompletedAt,
      ...safeUpdates
    } = updates as Partial<InsertFamilyMember> & Record<string, unknown>;
    if (pinCode !== undefined) {
      throw new Error("Direct pinCode updates not allowed. Use setPinCode or clearPinCode methods.");
    }
    if (totalEarned !== undefined || totalPoints !== undefined ||
        weeklyPoints !== undefined || monthlyPoints !== undefined) {
      throw new Error("Direct point balance updates are not allowed. Use an accounting intent method.");
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

  async awardPointsAtomically(
    memberIds: string[],
    points: number,
    sourceType: "parent_bonus" | "admin_adjustment",
    reason: string,
    actorMemberId: string | null = null,
    sourceId: string | null = null,
  ): Promise<FamilyMember[]> {
    if (!Number.isSafeInteger(points) || points <= 0) {
      throw new Error("Points must be a positive integer");
    }
    const ids = Array.from(new Set(memberIds)).sort();
    return await db.transaction(async (tx) => {
      const updated: FamilyMember[] = [];
      for (const memberId of ids) {
        const idempotencyKey = sourceId ? `${sourceType}:${sourceId}:${memberId}` : null;
        const [lockedMember] = await tx
          .select()
          .from(familyMembers)
          .where(eq(familyMembers.id, memberId))
          .for("update")
          .limit(1);
        if (!lockedMember) throw new Error("Family member not found");
        const [existing] = idempotencyKey
          ? await tx
              .select()
              .from(pointTransactions)
              .where(eq(pointTransactions.idempotencyKey, idempotencyKey))
              .limit(1)
          : [];
        if (existing) {
          updated.push(lockedMember);
          continue;
        }
        const member = await this.mutatePointBalance(tx, {
          memberId,
          deltas: {
            totalEarned: points,
            totalPoints: points,
            weeklyPoints: points,
            monthlyPoints: points,
          },
          sourceType,
          sourceId,
          reason,
          actorMemberId,
          idempotencyKey,
        });
        if (!member) throw new Error("Family member not found");
        await tx.insert(pointsHistory).values({ memberId, points, reason });
        updated.push(member);
      }
      return updated;
    });
  }

  async contributeToGoalAtomically(
    goalId: string,
    memberId: string,
    familyTimezone: string,
    actorMemberId: string | null = null,
  ): Promise<{ contribution: GoalContribution; goal: FamilyGoal; completed: boolean }> {
    return await db.transaction(async (tx) => {
      const [goal] = await tx
        .select()
        .from(familyGoals)
        .where(eq(familyGoals.id, goalId))
        .for("update")
        .limit(1);
      if (!goal) throw new Error("Family goal not found");
      if (!goal.isActive) throw new Error("This goal is no longer active");
      const now = new Date();
      const period = goal.contributionPeriod === "weekly"
        ? formatInTimeZone(now, familyTimezone, "RRRR-'W'II")
        : formatInTimeZone(now, familyTimezone, "yyyy-MM");

      const [member] = await tx
        .select()
        .from(familyMembers)
        .where(eq(familyMembers.id, memberId))
        .for("update")
        .limit(1);
      if (!member || member.familyName !== goal.familyName) {
        throw new Error("Family goal member mismatch");
      }
      const [existing] = await tx
        .select()
        .from(goalContributions)
        .where(and(
          eq(goalContributions.goalId, goalId),
          eq(goalContributions.memberId, memberId),
          eq(goalContributions.period, period),
        ))
        .limit(1);
      if (existing) throw new Error("You have already contributed to this goal this period");
      if (member.totalPoints < goal.contributionAmount) {
        throw new Error("Insufficient points to contribute");
      }

      const ledgerKey = `family-goal-contribution:${goalId}:${memberId}:${period}`;
      await this.mutatePointBalance(tx, {
        memberId,
        deltas: { totalPoints: -goal.contributionAmount },
        sourceType: "family_goal_contribution",
        sourceId: goalId,
        reason: `Contributed to family goal: ${goal.title}`,
        actorMemberId,
        idempotencyKey: ledgerKey,
      });
      const [contribution] = await tx
        .insert(goalContributions)
        .values({
          goalId,
          memberId,
          points: goal.contributionAmount,
          period,
        })
        .returning();
      await tx.insert(pointsHistory).values({
        memberId,
        points: -goal.contributionAmount,
        reason: `Contributed to family goal: ${goal.title}`,
      });

      const nextCurrentPoints = goal.currentPoints + goal.contributionAmount;
      const completed = nextCurrentPoints >= goal.targetPoints;
      const [updatedGoal] = await tx
        .update(familyGoals)
        .set({
          currentPoints: nextCurrentPoints,
          ...(completed ? { isActive: false, completedAt: new Date() } : {}),
        })
        .where(eq(familyGoals.id, goalId))
        .returning();
      return { contribution, goal: updatedGoal, completed };
    });
  }

  async resetAllWeeklyPoints(): Promise<void> {
    await this.resetPeriodicPoints("weekly");
  }

  async resetAllMonthlyPoints(): Promise<void> {
    await this.resetPeriodicPoints("monthly");
  }

  async resetWeeklyPointsForFamily(familyName: string): Promise<void> {
    await this.resetPeriodicPoints("weekly", familyName);
  }

  async resetMonthlyPointsForFamily(familyName: string): Promise<void> {
    await this.resetPeriodicPoints("monthly", familyName);
  }

  private async resetPeriodicPoints(period: "weekly" | "monthly", familyName?: string): Promise<void> {
    await db.transaction(async (tx) => {
      const members = await tx
        .select()
        .from(familyMembers)
        .where(familyName ? eq(familyMembers.familyName, familyName) : undefined)
        .orderBy(familyMembers.id);
      for (const member of members) {
        const [lockedMember] = await tx
          .select()
          .from(familyMembers)
          .where(eq(familyMembers.id, member.id))
          .for("update")
          .limit(1);
        if (!lockedMember) continue;
        const delta = period === "weekly" ? -lockedMember.weeklyPoints : -lockedMember.monthlyPoints;
        if (delta === 0) continue;
        await this.mutatePointBalance(tx, {
          memberId: member.id,
          deltas: period === "weekly" ? { weeklyPoints: delta } : { monthlyPoints: delta },
          sourceType: "periodic_reset",
          sourceId: period,
          reason: `${period} points reset`,
        });
      }
    });
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
      
      // Determine if today is a weekday (1=Mon … 5=Fri, 6=Sat, 7=Sun in ISO weekday)
      const isoWeekday = familyNow.getDay(); // 0=Sun, 1=Mon … 6=Sat
      const isWeekday = isoWeekday >= 1 && isoWeekday <= 5;
      
      // Lock all daily + weekdays tasks for this family to prevent concurrent modifications
      // Weekdays tasks are only reset Mon–Fri; on weekends they are left unchanged
      const tasksToReset = await tx
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.familyName, familyName),
            isWeekday
              ? sql`${tasks.recurrence} IN ('daily', 'weekdays')`
              : eq(tasks.recurrence, "daily")
          )
        )
        .orderBy(tasks.id)
        .for('update'); // Row-level write lock prevents concurrent task updates
      
      // Delete ONLY completions from previous days (preserve today's completions)
      if (tasksToReset.length > 0) {
        const taskIds = tasksToReset.map(t => t.id);
        const todayLocalDate = formatInTimeZone(now, familyTimezone, "yyyy-MM-dd");
        
        await tx
          .delete(taskCompletions)
          .where(
            and(
              inArray(taskCompletions.taskId, taskIds),
              sql`${taskCompletions.completedAt} < ${startOfDayUTC}`
            )
          );

        await tx
          .delete(dailyTaskProgress)
          .where(and(
            inArray(dailyTaskProgress.taskId, taskIds),
            lt(dailyTaskProgress.localDate, todayLocalDate),
          ));
        
        // For each task, recompute completion_count from remaining completions
        // This includes any completions from today that were preserved
        for (const task of tasksToReset) {
          const remainingCompletions = await tx
            .select({ count: sql<number>`count(*)` })
            .from(taskCompletions)
            .where(
              and(
                eq(taskCompletions.taskId, task.id),
                eq(taskCompletions.status, "approved")
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
      // Keep reset lock ordering consistent with submissions and decisions:
      // lock the task before touching any completion rows.
      await tx.select({ id: tasks.id })
        .from(tasks)
        .where(eq(tasks.id, taskId))
        .for("update");

      // Delete all completions for this task
      await tx
        .delete(taskCompletions)
        .where(eq(taskCompletions.taskId, taskId));

      // Daily multi-execution progress is stored separately from completions.
      // Clear it as part of the same reset so every assigned and unassigned
      // member starts the task period at zero again.
      await tx
        .delete(dailyTaskProgress)
        .where(eq(dailyTaskProgress.taskId, taskId));
      
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
    if (!task) return undefined;

    // Individual multi-member tasks store their selected members in the
    // assignment table. Expose that selection through the task representation
    // as well, so editors can round-trip it without a second endpoint.
    if (!task.isSharedTask) {
      const assignmentIds = await this.getTaskAssignmentsByTask(id);
      return { ...task, sharedMemberIds: assignmentIds };
    }
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

    // Custom-interval tasks store recurrence="none" plus recurrenceDays.
    // Older completion paths may have marked these recurring tasks as
    // completed. Reactivate them once their next period has started while
    // keeping nextAvailableDate so member completion checks can ignore the
    // previous period's records.
    const recurringTasksToReactivate = allTasks.filter(task => {
      const isRecurring = isRecurringTaskSchedule(task.recurrence, task.recurrenceDays);
      return task.status === "completed" &&
        isRecurring &&
        !!task.nextAvailableDate &&
        task.nextAvailableDate <= now;
    });

    const reactivationCandidates = new Set(recurringTasksToReactivate.map(task => task.id));

    const tasksToReset = allTasks.filter(task => {
      // Only reset recurring multi-completion tasks
      const isRecurring = isRecurringTaskSchedule(task.recurrence, task.recurrenceDays);
      const isMultiCompletion = task.maxCompletions !== null;
      const needsReset = task.completionCount > 0;
      
      // Reset ONLY if task has nextAvailableDate and it has passed (fully completed)
      // Do NOT reset daily tasks here - they are handled by the scheduler at midnight
      const hasPassedAvailableDate = task.nextAvailableDate && task.nextAvailableDate <= now;
      
      return isRecurring && isMultiCompletion && needsReset && hasPassedAvailableDate;
    });
    
    // Lock and reread each selected task before mutating it. The original
    // expired boundary must still be current, so a concurrent completion or
    // reset cannot have its newer count/date overwritten by this stale view.
    if (tasksToReset.length > 0) {
      console.log(`🔄 Resetting ${tasksToReset.length} recurring multi-completion task(s) (nextAvailableDate passed)`);
    }

    const resetCandidatesById = new Map(tasksToReset.map(task => [task.id, task]));
    const candidateTaskIds = [...new Set([
      ...recurringTasksToReactivate.map(task => task.id),
      ...tasksToReset.map(task => task.id),
    ])].sort();
    for (const taskId of candidateTaskIds) {
      const originalTask = allTasks.find(task => task.id === taskId);
      if (!originalTask) continue;
      const currentTask = await db.transaction(async (tx) => {
        const [current] = await tx.select().from(tasks)
          .where(eq(tasks.id, taskId))
          .for("update");
        if (!current) return undefined;

        const originalBoundary = originalTask.nextAvailableDate
          ? new Date(originalTask.nextAvailableDate)
          : null;
        const currentBoundary = current.nextAvailableDate
          ? new Date(current.nextAvailableDate)
          : null;
        const sameExpiredBoundary = !!originalBoundary
          && !!currentBoundary
          && originalBoundary.getTime() === currentBoundary.getTime()
          && originalBoundary <= now
          && currentBoundary <= now;
        const shouldReactivate = reactivationCandidates.has(taskId)
          && current.status === "completed"
          && isRecurringTaskSchedule(current.recurrence, current.recurrenceDays)
          && sameExpiredBoundary;
        const originalResetCandidate = resetCandidatesById.get(taskId);
        const shouldReset = !!originalResetCandidate
          && shouldResetRecurringMultiCompletionTask(originalResetCandidate, current, now);

        const updates: Partial<Task> = {};
        if (shouldReactivate) updates.status = "active";
        if (shouldReset) {
          updates.completionCount = 0;
          updates.nextAvailableDate = null;
        }
        if (Object.keys(updates).length > 0) {
          updates.updatedAt = new Date();
          await tx.update(tasks).set(updates).where(eq(tasks.id, taskId));
        }
        return { task: { ...current, ...updates }, didReset: shouldReset };
      });

      if (!currentTask) continue;
      Object.assign(originalTask, currentTask.task);
      if (currentTask.didReset) {
        const originalCount = resetCandidatesById.get(taskId)!.completionCount;
        console.log(`  ✅ Reset task "${currentTask.task.title}" (was ${originalCount}/${currentTask.task.maxCompletions}, now 0/${currentTask.task.maxCompletions})`);
      }
    }
    
    if (allTasks.length === 0) return allTasks;

    // Keep the persisted representation unambiguous: team tasks use
    // sharedMemberIds, while individual multi-member tasks use rows in
    // taskAssignments. The latter still expose their selected IDs in the
    // task payload for editing.
    const assignments = await db
      .select({ taskId: taskAssignments.taskId, memberId: taskAssignments.memberId })
      .from(taskAssignments)
      .where(inArray(taskAssignments.taskId, allTasks.map(task => task.id)));
    const assignmentMap = new Map<string, string[]>();
    for (const assignment of assignments) {
      const ids = assignmentMap.get(assignment.taskId) || [];
      ids.push(assignment.memberId);
      assignmentMap.set(assignment.taskId, ids);
    }

    return allTasks.map(task => {
      const assignmentIds = assignmentMap.get(task.id) || [];
      // Empty legacy shared metadata is not a team audience. Normalize it for
      // consumers so clients cannot render team-only controls for a
      // family-wide task.
      if (task.isSharedTask && (task.sharedMemberIds?.length || 0) === 0 && assignmentIds.length === 0) {
        return { ...task, isSharedTask: false, sharedMemberIds: [] };
      }
      if (task.isSharedTask && (task.sharedMemberIds?.length || 0) === 0 && assignmentIds.length > 0) {
        return { ...task, sharedMemberIds: assignmentIds };
      }
      return task.isSharedTask
        ? task
        : { ...task, sharedMemberIds: assignmentIds };
    });
  }

  async createTask(taskData: InsertTask): Promise<Task> {
    const [task] = await db.insert(tasks).values(taskData).returning();
    return task;
  }

  async updateTask(id: string, taskUpdate: Partial<InsertTask>): Promise<Task> {
    const [existingTask] = await db.select().from(tasks).where(eq(tasks.id, id));
    // Validation: prevent lowering maxCompletions below current completionCount
    if (taskUpdate.maxCompletions !== undefined && taskUpdate.maxCompletions !== null) {
      if (existingTask && taskUpdate.maxCompletions < existingTask.completionCount) {
        throw new Error('Cannot set maxCompletions below current completion count');
      }
    }
    
    return db.transaction(async (tx) => {
      const [updated] = await tx
        .update(tasks)
        .set({ ...taskUpdate, updatedAt: new Date() })
        .where(eq(tasks.id, id))
        .returning();
      if (taskUpdate.dailyTarget !== undefined && taskUpdate.dailyTarget !== existingTask?.dailyTarget) {
        const maxPartialProgress = Math.max(0, taskUpdate.dailyTarget - 1);
        await tx.update(dailyTaskProgress)
          .set({
            executionCount: sql`LEAST(${dailyTaskProgress.executionCount}, ${maxPartialProgress})`,
            updatedAt: new Date(),
          })
          .where(eq(dailyTaskProgress.taskId, id));
      }
      return updated as Task;
    });
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

  // Shopping list item operations
  async getShoppingListItems(taskId: string): Promise<ShoppingListItem[]> {
    return await db
      .select()
      .from(shoppingListItems)
      .where(eq(shoppingListItems.taskId, taskId))
      .orderBy(shoppingListItems.sortOrder);
  }

  async getShoppingListItem(itemId: string): Promise<ShoppingListItem | undefined> {
    const [item] = await db.select().from(shoppingListItems).where(eq(shoppingListItems.id, itemId));
    return item;
  }

  async createShoppingListItems(items: InsertShoppingListItem[]): Promise<ShoppingListItem[]> {
    if (items.length === 0) return [];
    return await db.insert(shoppingListItems).values(items).returning();
  }

  async replaceShoppingListItems(taskId: string, items: InsertShoppingListItem[]): Promise<ShoppingListItem[]> {
    // Only delete unchecked items to preserve completion attribution for already-checked items
    await db.delete(shoppingListItems).where(
      and(
        eq(shoppingListItems.taskId, taskId),
        isNull(shoppingListItems.completedByMemberId),
      )
    );
    if (items.length === 0) return [];
    return await db.insert(shoppingListItems).values(items).returning();
  }

  async toggleShoppingListItem(itemId: string, memberId: string): Promise<ShoppingListItem> {
    const [current] = await db.select().from(shoppingListItems).where(eq(shoppingListItems.id, itemId));
    if (!current) throw new Error("Shopping list item not found");

    if (current.completedByMemberId) {
      // Already checked — uncheck it
      const [updated] = await db
        .update(shoppingListItems)
        .set({ completedByMemberId: null, completedAt: null })
        .where(eq(shoppingListItems.id, itemId))
        .returning();
      return updated;
    } else {
      // Check it off
      const [updated] = await db
        .update(shoppingListItems)
        .set({ completedByMemberId: memberId, completedAt: new Date() })
        .where(eq(shoppingListItems.id, itemId))
        .returning();
      return updated;
    }
  }

  async toggleShoppingListItemAtomically(
    itemId: string,
    memberId: string,
  ): Promise<{ item: ShoppingListItem; allCompleted: boolean; task: Task }> {
    const [itemRef] = await db.select({ taskId: shoppingListItems.taskId })
      .from(shoppingListItems)
      .where(eq(shoppingListItems.id, itemId));
    if (!itemRef) throw new Error("Shopping list item not found");

    return db.transaction(async (tx) => {
      // Every shopping-list mutation/decision serializes on the parent task.
      const [task] = await tx.select().from(tasks)
        .where(eq(tasks.id, itemRef.taskId))
        .for("update");
      if (!task) throw new Error("Task not found");
      if (task.status !== "active") throw new Error("Task is not active");
      if (!task.isShoppingList) throw new Error("Task is not a shopping list");

      const [currentItem] = await tx.select().from(shoppingListItems)
        .where(eq(shoppingListItems.id, itemId))
        .for("update");
      if (!currentItem || currentItem.taskId !== task.id) {
        throw new Error("Shopping list item not found");
      }

      const [updatedItem] = await tx.update(shoppingListItems)
        .set(currentItem.completedByMemberId
          ? { completedByMemberId: null, completedAt: null }
          : { completedByMemberId: memberId, completedAt: new Date() })
        .where(eq(shoppingListItems.id, itemId))
        .returning();
      const allItems = await tx.select().from(shoppingListItems)
        .where(eq(shoppingListItems.taskId, task.id))
        .orderBy(shoppingListItems.sortOrder);
      const allCompleted = allItems.length > 0
        && allItems.every((item: ShoppingListItem) => item.completedByMemberId !== null);

      if (!allCompleted) {
        // Unchecking any item invalidates the collective pending set in this
        // same transaction. An approval that won the task lock first makes the
        // task inactive; an uncheck that wins first removes its pending rows.
        await tx.delete(taskCompletions).where(and(
          eq(taskCompletions.taskId, task.id),
          eq(taskCompletions.status, "pending"),
        ));
      } else {
        const contributorIds = allItems
          .map((item: ShoppingListItem) => item.completedByMemberId!)
          .filter((id: string, index: number, ids: string[]) => ids.indexOf(id) === index);
        const legacyRecipients = task.isSharedTask && task.sharedMemberIds?.length
          ? task.sharedMemberIds
          : [];
        const assignments = legacyRecipients.length > 0
          ? []
          : await tx.select({ memberId: taskAssignments.memberId })
            .from(taskAssignments)
            .where(eq(taskAssignments.taskId, task.id));
        const assignedMemberIds = legacyRecipients.length > 0
          ? legacyRecipients
          : assignments.map((assignment: { memberId: string }) => assignment.memberId);
        const recipientIds = assignedMemberIds.length > 0 ? assignedMemberIds : contributorIds;

        await this._createShoppingListTaskCompletionsInTransaction(tx, task, recipientIds);
        if (!task.requiresApproval) {
          await tx.update(tasks)
            .set({ status: "completed", updatedAt: new Date() })
            .where(eq(tasks.id, task.id));
          task.status = "completed";
        }
      }

      return { item: updatedItem, allCompleted, task };
    });
  }

  async uncheckShoppingListItem(itemId: string): Promise<ShoppingListItem> {
    const [updated] = await db
      .update(shoppingListItems)
      .set({ completedByMemberId: null, completedAt: null })
      .where(eq(shoppingListItems.id, itemId))
      .returning();
    return updated;
  }

  // Task assignment operations
  async createTaskAssignment(assignmentData: InsertTaskAssignment): Promise<void> {
    await db.insert(taskAssignments).values(assignmentData);
  }

  async replaceTaskAssignments(taskId: string, memberIds: string[]): Promise<void> {
    const uniqueMemberIds = Array.from(new Set(memberIds));
    await db.transaction(async (tx) => {
      await tx.delete(taskAssignments).where(eq(taskAssignments.taskId, taskId));
      if (uniqueMemberIds.length > 0) {
        await tx.insert(taskAssignments).values(
          uniqueMemberIds.map(memberId => ({ taskId, memberId }))
        );
      }
    });
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

  private async countPendingTaskCompletions(taskId: string, client: any): Promise<number> {
    const [pending] = await client
      .select({ count: sql<number>`count(DISTINCT COALESCE(${taskCompletions.dailyRoundId}, ${taskCompletions.id}))` })
      .from(taskCompletions)
      .where(and(
        eq(taskCompletions.taskId, taskId),
        eq(taskCompletions.status, "pending"),
      ));
    return Number(pending?.count || 0);
  }

  private async calculateTaskCompletionCapacity(
    task: Pick<Task, "id" | "maxCompletions" | "completionCount">,
    client: any,
  ): Promise<TaskCompletionCapacity> {
    const pendingCompletionCount = await this.countPendingTaskCompletions(task.id, client);
    return calculateTaskCompletionCapacity({
      maxCompletions: task.maxCompletions,
      completionCount: task.completionCount,
      pendingCompletionCount,
    });
  }

  async getTaskCompletionCapacity(taskId: string): Promise<TaskCompletionCapacity> {
    return db.transaction(async (tx) => {
      const [task] = await tx
        .select()
        .from(tasks)
        .where(eq(tasks.id, taskId))
        .for("update");
      if (!task) throw new Error("Task not found");
      return this.calculateTaskCompletionCapacity(task, tx);
    });
  }

  // Task completion operations
  async hasActiveMemberCompletion(taskId: string, memberId: string, txClient?: any): Promise<boolean> {
    const client = txClient || db;
    
    // Get task info to check recurrence type and period boundaries
    const [task] = await client
      .select({
        recurrence: tasks.recurrence,
        recurrenceDays: tasks.recurrenceDays,
        familyName: tasks.familyName,
        nextAvailableDate: tasks.nextAvailableDate,
        isSharedTask: tasks.isSharedTask,
      })
      .from(tasks)
      .where(eq(tasks.id, taskId));
    
    if (!task) return false;
    
    // For IMMEDIATE tasks: Only block if there's a PENDING completion
    // After approval, the task should be immediately available again
    if (task.recurrence === 'immediate') {
      const [result] = await client
        .select({ count: sql<number>`count(*)` })
        .from(taskCompletions)
        .where(
          and(
            eq(taskCompletions.taskId, taskId),
            eq(taskCompletions.memberId, memberId),
            eq(taskCompletions.status, "pending") // Only pending blocks immediate tasks
          )
        );
      return Number(result?.count || 0) > 0;
    }
    
    // For daily/weekdays recurring tasks, only check completions from TODAY (in family timezone)
    if (task.recurrence === 'daily' || task.recurrence === 'weekdays') {
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
    
    // For recurring tasks (recurrenceDays, weekly, monthly, yearly):
    // Be period-aware — if nextAvailableDate has passed, a new period started
    // and old completions from before the period boundary should NOT block.
    const isRecurring = task.recurrence !== 'none' || task.recurrenceDays != null;
    if (isRecurring && !task.isSharedTask) {
      const [assignment] = await client
        .select({ memberId: taskAssignments.memberId })
        .from(taskAssignments)
        .where(and(
          eq(taskAssignments.taskId, taskId),
          eq(taskAssignments.memberId, memberId),
        ))
        .limit(1);
      if (assignment) {
        const [family] = await client
          .select({ timezone: families.timezone })
          .from(families)
          .where(eq(families.familyName, task.familyName));
        const [latestCompletion] = await client
          .select({
            status: taskCompletions.status,
            completedAt: taskCompletions.completedAt,
          })
          .from(taskCompletions)
          .where(and(
            eq(taskCompletions.taskId, taskId),
            eq(taskCompletions.memberId, memberId),
            inArray(taskCompletions.status, ["pending", "approved", "rejected"]),
          ))
          .orderBy(desc(taskCompletions.completedAt))
          .limit(1);
        if (!latestCompletion?.completedAt) return false;
        return isIndividualRecurringCompletionActive({
          status: latestCompletion.status,
          completedAt: latestCompletion.completedAt,
          now: new Date(),
          recurrence: task.recurrence,
          recurrenceDays: task.recurrenceDays,
          timezone: family?.timezone || "Europe/Berlin",
        });
      }
    }
    if (
      isRecurring
      && task.isSharedTask
      && task.nextAvailableDate
      && new Date(task.nextAvailableDate) > new Date()
    ) {
      // A future team boundary is written once every member has submitted the
      // current round. From then on the latest member status defines whether
      // that contribution is still active: a rejection must supersede older
      // approved rows so the member can retry.
      const [latestCompletion] = await client
        .select({ status: taskCompletions.status })
        .from(taskCompletions)
        .where(and(
          eq(taskCompletions.taskId, taskId),
          eq(taskCompletions.memberId, memberId),
          inArray(taskCompletions.status, ["pending", "approved", "rejected"]),
        ))
        .orderBy(desc(taskCompletions.completedAt))
        .limit(1);
      return latestCompletion?.status === "pending" || latestCompletion?.status === "approved";
    }
    if (isRecurring && task.nextAvailableDate) {
      const now = new Date();
      const nextDate = new Date(task.nextAvailableDate);
      
      if (nextDate <= now) {
        // New period has started — only count completions that happened IN this new period
        // (i.e. completedAt >= nextAvailableDate)
        const [result] = await client
          .select({ count: sql<number>`count(*)` })
          .from(taskCompletions)
          .where(
            and(
              eq(taskCompletions.taskId, taskId),
              eq(taskCompletions.memberId, memberId),
              inArray(taskCompletions.status, ["pending", "approved"]),
              gte(taskCompletions.completedAt, nextDate)
            )
          );
        return Number(result?.count || 0) > 0;
      }
      // nextAvailableDate is still in the future — task is locked, any active completion blocks
    }
    
    // Fallback: any active completion for this member blocks re-submission
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

  async getMemberCompletionStatus(taskId: string, memberId: string, txClient?: any, skipApprovedReset?: boolean): Promise<"pending" | "approved" | "rejected" | null> {
    const client = txClient || db;
    
    // Get task info including nextAvailableDate for period-aware completion checks
    const [task] = await client
      .select({
        recurrence: tasks.recurrence,
        recurrenceDays: tasks.recurrenceDays,
        familyName: tasks.familyName,
        nextAvailableDate: tasks.nextAvailableDate,
        isSharedTask: tasks.isSharedTask,
      })
      .from(tasks)
      .where(eq(tasks.id, taskId));
    
    if (!task) return null;
    
    // For IMMEDIATE tasks: check the most recent completion
    // - pending  → show amber "waiting" state and block re-submission
    // - rejected → show blue "try again" badge (same as standard recurrence)
    // - approved → return null so task is immediately available again
    // - nothing  → return null (available)
    if (task.recurrence === 'immediate') {
      const [latestCompletion] = await client
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

      if (!latestCompletion) return null;
      if (latestCompletion.status === "pending") return "pending";
      if (latestCompletion.status === "rejected") return "rejected";
      // approved → immediately available again for single tasks
      // For multi-assignment tasks (skipApprovedReset=true): keep "approved" so the
      // "waiting for others" state is shown until all members complete
      return skipApprovedReset ? "approved" : null;
    }
    
    // For daily/weekdays recurring tasks, only check completions from TODAY (in family timezone)
    if (task.recurrence === 'daily' || task.recurrence === 'weekdays') {
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
    
    // For weekly/monthly/yearly/custom recurring tasks: use nextAvailableDate to determine
    // whether we are in a new period. Old completions from previous periods must be ignored.
    const isRecurring = task.recurrence !== 'none' || task.recurrenceDays !== null;
    if (isRecurring) {
      if (!task.isSharedTask) {
        const [assignment] = await client
          .select({ memberId: taskAssignments.memberId })
          .from(taskAssignments)
          .where(and(
            eq(taskAssignments.taskId, taskId),
            eq(taskAssignments.memberId, memberId),
          ))
          .limit(1);
        if (assignment) {
          const [family] = await client
            .select({ timezone: families.timezone })
            .from(families)
            .where(eq(families.familyName, task.familyName));
          const [latestCompletion] = await client
            .select({
              status: taskCompletions.status,
              completedAt: taskCompletions.completedAt,
            })
            .from(taskCompletions)
            .where(and(
              eq(taskCompletions.taskId, taskId),
              eq(taskCompletions.memberId, memberId),
              inArray(taskCompletions.status, ["pending", "approved", "rejected"]),
            ))
            .orderBy(desc(taskCompletions.completedAt))
            .limit(1);
          if (!latestCompletion?.completedAt) return null;
          if (latestCompletion.status === "rejected") return "rejected";
          return isIndividualRecurringCompletionActive({
            status: latestCompletion.status,
            completedAt: latestCompletion.completedAt,
            now: new Date(),
            recurrence: task.recurrence,
            recurrenceDays: task.recurrenceDays,
            timezone: family?.timezone || "Europe/Berlin",
          }) ? latestCompletion.status : null;
        }
      }
      const now = new Date();
      const nextDate = task.nextAvailableDate ? new Date(task.nextAvailableDate) : null;
      
      if (!nextDate) {
        // nextAvailableDate not yet set — e.g. multi-completion task where requiresApproval=true
        // and not all slots are filled yet (completion count never reached max).
        // Still check if THIS member has an active submission so the UI can show "pending" state.
        const [memberCompletion] = await client
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
        return memberCompletion?.status || null;
      }
      
      if (nextDate > now) {
        // nextAvailableDate is in the future: task is locked for this period
        // Return the most recent completion (which caused the lock)
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
      
      // nextAvailableDate has passed — we are in a new period.
      // Only count completions that happened AFTER nextAvailableDate (i.e. this new period).
      const [recentCompletion] = await client
        .select({ status: taskCompletions.status })
        .from(taskCompletions)
        .where(
          and(
            eq(taskCompletions.taskId, taskId),
            eq(taskCompletions.memberId, memberId),
            inArray(taskCompletions.status, ["pending", "approved", "rejected"]),
            gte(taskCompletions.completedAt, nextDate!)
          )
        )
        .orderBy(desc(taskCompletions.completedAt))
        .limit(1);
      return recentCompletion?.status || null;
    }
    
    // For one-time tasks (recurrence = 'none', no recurrenceDays): use the latest completion
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
   * For immediate tasks, only returns "pending" (approved completions don't block).
   */
  async getTaskCompletionStatusForFamily(taskId: string, txClient?: any): Promise<"pending" | "approved" | "rejected" | null> {
    const client = txClient || db;
    
    // Get task info including nextAvailableDate for period-aware completion checks
    const [task] = await client
      .select({
        recurrence: tasks.recurrence,
        recurrenceDays: tasks.recurrenceDays,
        familyName: tasks.familyName,
        nextAvailableDate: tasks.nextAvailableDate,
      })
      .from(tasks)
      .where(eq(tasks.id, taskId));
    
    if (!task) return null;
    
    // For IMMEDIATE tasks: Only return "pending" if there are pending completions
    // After approval, return null so task appears available again
    if (task.recurrence === 'immediate') {
      const [pendingResult] = await client
        .select({ count: sql<number>`count(*)` })
        .from(taskCompletions)
        .where(
          and(
            eq(taskCompletions.taskId, taskId),
            eq(taskCompletions.status, "pending")
          )
        );
      return Number(pendingResult?.count || 0) > 0 ? "pending" : null;
    }
    
    // For daily/weekdays recurring tasks, only check completions from TODAY (in family timezone)
    if (task.recurrence === 'daily' || task.recurrence === 'weekdays') {
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
    
    // For weekly/monthly/yearly/custom recurring tasks: use nextAvailableDate to determine period
    const isRecurring = task.recurrence !== 'none' || task.recurrenceDays !== null;
    if (isRecurring) {
      const now = new Date();
      const nextDate = task.nextAvailableDate ? new Date(task.nextAvailableDate) : null;
      
      if (!nextDate) {
        // nextAvailableDate not yet set (e.g. first submission still pending approval).
        // Check for any active completions so the UI can show "pending" state.
        const pendingCompletions = await client
          .select({ status: taskCompletions.status })
          .from(taskCompletions)
          .where(
            and(
              eq(taskCompletions.taskId, taskId),
              inArray(taskCompletions.status, ["pending", "approved", "rejected"])
            )
          )
          .orderBy(desc(taskCompletions.completedAt));
        if (pendingCompletions.some((c: { status: string }) => c.status === "approved")) return "approved";
        if (pendingCompletions.some((c: { status: string }) => c.status === "pending")) return "pending";
        if (pendingCompletions.some((c: { status: string }) => c.status === "rejected")) return "rejected";
        return null;
      }
      
      if (nextDate > now) {
        // nextAvailableDate is in the future: task is locked, show current period's completions
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
        if (completions.some((c: { status: string }) => c.status === "approved")) return "approved";
        if (completions.some((c: { status: string }) => c.status === "pending")) return "pending";
        if (completions.some((c: { status: string }) => c.status === "rejected")) return "rejected";
        return null;
      }
      
      // nextAvailableDate has passed — new period started. Only count completions after that date.
      const completions = await client
        .select({ status: taskCompletions.status })
        .from(taskCompletions)
        .where(
          and(
            eq(taskCompletions.taskId, taskId),
            inArray(taskCompletions.status, ["pending", "approved", "rejected"]),
            gte(taskCompletions.completedAt, nextDate!)
          )
        )
        .orderBy(desc(taskCompletions.completedAt));
      if (completions.some((c: { status: string }) => c.status === "approved")) return "approved";
      if (completions.some((c: { status: string }) => c.status === "pending")) return "pending";
      if (completions.some((c: { status: string }) => c.status === "rejected")) return "rejected";
      return null;
    }
    
    // For one-time tasks (recurrence = 'none', no recurrenceDays): check all completions
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

  async createTaskCompletion(completionData: InsertTaskCompletion, options?: { forceApproval?: boolean }): Promise<TaskCompletion> {
    return await db.transaction(async (tx) => {
      // 1. Lock task: SELECT * FROM tasks WHERE id = taskId FOR UPDATE
      const task = await tx.select().from(tasks).where(eq(tasks.id, completionData.taskId)).for('update');
      if (!task[0]) throw new Error('Task not found');
      if (task[0].status !== "active") throw new Error("Task is not active");

      // A task without explicit assignees is one family-wide task.  Do this
      // check before the member-specific duplicate guard so another family
      // member cannot submit a second completion for the same period.
      const [assignment] = await tx
        .select({ memberId: taskAssignments.memberId })
        .from(taskAssignments)
        .where(eq(taskAssignments.taskId, completionData.taskId))
        .limit(1);
       const hasLegacyTeamMembers = task[0].isSharedTask
         && (task[0].sharedMemberIds?.length || 0) > 0;
       const isFamilyWide = !assignment && !hasLegacyTeamMembers;
      if (isFamilyWide) {
        const familyStatus = await this.getTaskCompletionStatusForFamily(completionData.taskId, tx);
        if (familyStatus === "pending" || familyStatus === "approved") {
          throw new Error('Member already completed this task');
        }
      }
      
      // 2. Check if member already has an active completion (pending or approved)
      // This prevents duplicate submissions for both normal and multi-completion tasks
      const hasCompleted = await this.hasActiveMemberCompletion(
        completionData.taskId, 
        completionData.memberId,
        tx
      );
      if (hasCompleted) throw new Error('Member already completed this task');
      
      // 3. If maxCompletions mode: pending submissions reserve slots. The
      // task row is already locked, so concurrent members cannot both claim
      // the same final slot.
      if (task[0].maxCompletions !== null) {
        const capacity = await this.calculateTaskCompletionCapacity(task[0], tx);
        if (!capacity.canReserve) {
          throw new Error('All completion slots filled');
        }
      }
      
      // 4. Insert completion
      const approvalRequired = task[0].requiresApproval || options?.forceApproval === true;
      const [completion] = await tx.insert(taskCompletions)
        .values({
          ...completionData,
          status: approvalRequired ? 'pending' : 'approved'
        })
        .returning();
      
      // 5. If auto-approved: run approval logic immediately
      if (!approvalRequired) {
        await this._approveCompletionInternal(tx, completion.id, completion.memberId, {
          skipApprovalUpdate: true,
          prelockedTask: task[0],
        });
      }
      
      return completion;
    });
  }

  async createShoppingListTaskCompletions(taskId: string, memberIds: string[]): Promise<TaskCompletion[]> {
    return db.transaction(async (tx) => {
      const [task] = await tx.select().from(tasks).where(eq(tasks.id, taskId)).for("update");
      if (!task) throw new Error("Task not found");
      if (task.status !== "active") throw new Error("Task is not active");
      if (!task.isShoppingList) throw new Error("Task is not a shopping list");
      return this._createShoppingListTaskCompletionsInTransaction(tx, task, memberIds);
    });
  }

  private async _createShoppingListTaskCompletionsInTransaction(
    tx: any,
    task: Task,
    memberIds: string[],
  ): Promise<TaskCompletion[]> {
    const taskId = task.id;
    const uniqueMemberIds = [...new Set(memberIds)];
    if (uniqueMemberIds.length === 0) return [];

    // All items were checked again, so old pending collective rows are
    // intentionally reset/replaced in the same locked transaction.
    await tx.delete(taskCompletions).where(and(
      eq(taskCompletions.taskId, taskId),
      eq(taskCompletions.status, "pending"),
    ));

    const [assignment] = await tx
      .select({ memberId: taskAssignments.memberId })
      .from(taskAssignments)
      .where(eq(taskAssignments.taskId, taskId))
      .limit(1);
    const hasLegacyTeamMembers = task.isSharedTask && (task.sharedMemberIds?.length || 0) > 0;
    if (!assignment && !hasLegacyTeamMembers) {
      const familyStatus = await this.getTaskCompletionStatusForFamily(taskId, tx);
      if (familyStatus === "pending" || familyStatus === "approved") {
        throw new Error("Member already completed this task");
      }
    }

    for (const memberId of uniqueMemberIds) {
      if (await this.hasActiveMemberCompletion(taskId, memberId, tx)) {
        throw new Error("Member already completed this task");
      }
    }

    if (task.maxCompletions !== null) {
      const capacity = await this.calculateTaskCompletionCapacity(task, tx);
      if (capacity.remainingSlots !== null && capacity.remainingSlots < uniqueMemberIds.length) {
        throw new Error("All completion slots filled");
      }
    }

    const approvalRequired = task.requiresApproval;
    const createdCompletions: TaskCompletion[] = [];
    for (const memberId of uniqueMemberIds) {
      const [completion] = await tx.insert(taskCompletions).values({
        taskId,
        memberId,
        pointsEarned: task.points,
        proofPhotoUrl: null,
        status: approvalRequired ? "pending" : "approved",
        approvedBy: null,
        rejectionReason: null,
      }).returning();
      if (!approvalRequired) {
        await this._approveCompletionInternal(tx, completion.id, completion.memberId, {
          skipApprovalUpdate: true,
          prelockedTask: task,
        });
      }
      createdCompletions.push(completion);
    }
    return createdCompletions;
  }

  async getDailyTaskProgress(taskId: string, memberId: string): Promise<number> {
    const [task] = await db.select({
      familyName: tasks.familyName,
      isSharedTask: tasks.isSharedTask,
      sharedMemberIds: tasks.sharedMemberIds,
    }).from(tasks).where(eq(tasks.id, taskId));
    if (!task) return 0;
    const [family] = await db.select({ timezone: families.timezone }).from(families).where(eq(families.familyName, task.familyName));
    const localDate = formatInTimeZone(new Date(), family?.timezone || "Europe/Berlin", "yyyy-MM-dd");
    const progressRows = await db.select().from(dailyTaskProgress).where(and(
      eq(dailyTaskProgress.taskId, taskId),
      eq(dailyTaskProgress.localDate, localDate),
    ));
    const [assignment] = await db
      .select({ memberId: taskAssignments.memberId })
      .from(taskAssignments)
      .where(eq(taskAssignments.taskId, taskId))
      .limit(1);
    // Unassigned tasks have one shared family counter. Legacy rows may still
    // be keyed by the member who acted, so aggregate those rows here.
    // A task is family-wide when it has no explicit assignment.  Some older
    // rows have isSharedTask=true even though the legacy member array is empty;
    // that is still the unassigned/family-wide mode, not a team task.
    const hasLegacyTeamMembers = task.isSharedTask && (task.sharedMemberIds?.length || 0) > 0;
    if (!assignment && !hasLegacyTeamMembers) {
      return progressRows.reduce((total, row) => total + (row.executionCount || 0), 0);
    }
    return progressRows.find(row => row.memberId === memberId)?.executionCount || 0;
  }

  async submitDailyTaskExecution(completionData: InsertTaskCompletion): Promise<{ executionCount: number; target: number; completed: boolean; completion?: TaskCompletion }> {
    return db.transaction(async (tx) => {
      const [task] = await tx.select().from(tasks).where(eq(tasks.id, completionData.taskId)).for("update");
      if (!task) throw new Error("Task not found");
      if (task.status !== "active") throw new Error("Task is not active");
      const target = Math.min(3, Math.max(1, task.dailyTarget || 1));
      const [family] = await tx.select({ timezone: families.timezone }).from(families).where(eq(families.familyName, task.familyName));
      const localDate = formatInTimeZone(new Date(), family?.timezone || "Europe/Berlin", "yyyy-MM-dd");
      const progressRows = await tx.select().from(dailyTaskProgress).where(and(
        eq(dailyTaskProgress.taskId, task.id),
        eq(dailyTaskProgress.localDate, localDate),
      )).for("update");
      const [assignment] = await tx
        .select({ memberId: taskAssignments.memberId })
        .from(taskAssignments)
        .where(eq(taskAssignments.taskId, task.id))
        .limit(1);
      // Treat the legacy shared flag as an assignment only when it actually
      // contains selected members. Empty/null legacy arrays mean unassigned.
      const hasLegacyTeamMembers = task.isSharedTask && (task.sharedMemberIds?.length || 0) > 0;
      const isFamilyWide = !assignment && !hasLegacyTeamMembers;
      const existing = progressRows.find(row => row.memberId === completionData.memberId);
      let previousCount = isFamilyWide
        ? progressRows.reduce((total, row) => total + (row.executionCount || 0), 0)
        : existing?.executionCount || 0;
      if (previousCount >= target) {
        // Do not invent a contribution or silently repair an inconsistent
        // legacy counter. A pending/approved round blocks further submission.
        const activeStatus = isFamilyWide
          ? await this.getTaskCompletionStatusForFamily(task.id, tx)
          : null;
        if (!isFamilyWide || activeStatus === "pending" || activeStatus === "approved") {
          throw new Error("Member already completed this task");
        }
        throw new Error("Daily task progress is inconsistent; reset required");
      }
      const executionCount = previousCount + 1;
      const memberCount = isFamilyWide ? (existing?.executionCount || 0) + 1 : executionCount;
      const firstExecutedAt = existing?.executionCount ? existing.updatedAt : new Date();
      if (existing) {
        await tx.update(dailyTaskProgress).set({
          executionCount: memberCount,
          // Retain the first execution for deterministic rounding ties.
          updatedAt: firstExecutedAt,
        }).where(eq(dailyTaskProgress.id, existing.id));
      } else {
        await tx.insert(dailyTaskProgress).values({
          taskId: task.id, memberId: completionData.memberId, localDate,
          executionCount: memberCount, updatedAt: firstExecutedAt,
        });
      }
      if (executionCount < target) return { executionCount, target, completed: false };

      const active = isFamilyWide
        ? ["pending", "approved"].includes(await this.getTaskCompletionStatusForFamily(task.id, tx) || "")
        : await this.hasActiveMemberCompletion(task.id, completionData.memberId, tx);
      if (active) throw new Error("Member already completed this task");
      if (task.maxCompletions !== null) {
        const capacity = await this.calculateTaskCompletionCapacity(task, tx);
        if (!capacity.canReserve) throw new Error("All completion slots filled");
      }
      if (isFamilyWide && !task.isShoppingList) {
        const contributions = progressRows
          .filter((row: any) => row.memberId !== completionData.memberId && row.executionCount > 0)
          .map((row: any) => ({ memberId: row.memberId, executionCount: row.executionCount, firstExecutedAt: row.updatedAt }));
        contributions.push({ memberId: completionData.memberId, executionCount: memberCount, firstExecutedAt });
        const shares = allocateDailyTaskPoints(task.points, contributions);
        const dailyRoundId = randomUUID();
        const completedAt = new Date();
        const completions: TaskCompletion[] = await tx.insert(taskCompletions).values(shares.map(share => ({
          taskId: task.id,
          memberId: share.memberId,
          pointsEarned: share.points,
          dailyRoundId,
          dailyExecutionCount: share.executionCount,
          completedAt,
          proofPhotoUrl: share.memberId === completionData.memberId ? completionData.proofPhotoUrl : null,
          status: task.requiresApproval ? "pending" as const : "approved" as const,
        }))).returning();
        if (!task.requiresApproval) {
          for (let index = 0; index < completions.length; index++) {
            await this._approveCompletionInternal(tx, completions[index].id, null, {
              skipApprovalUpdate: true, prelockedTask: task, skipCompletionCount: index > 0,
            });
          }
        }
        return {
          executionCount, target, completed: true,
          completion: completions.find(row => row.memberId === completionData.memberId)!,
        };
      }
      const [completion] = await tx.insert(taskCompletions).values({
        ...completionData,
        status: task.requiresApproval ? "pending" : "approved",
      }).returning();
      if (!task.requiresApproval) {
        await this._approveCompletionInternal(tx, completion.id, completion.memberId, {
          skipApprovalUpdate: true,
          prelockedTask: task,
        });
      }
      return { executionCount, target, completed: true, completion };
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
        dailyRoundId: taskCompletions.dailyRoundId,
        dailyExecutionCount: taskCompletions.dailyExecutionCount,
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

  async getTaskCompletionsByTask(taskId: string): Promise<TaskCompletion[]> {
    return await db
      .select()
      .from(taskCompletions)
      .where(eq(taskCompletions.taskId, taskId))
      .orderBy(desc(taskCompletions.completedAt));
  }

  async getCompletionsWithOldProofPhotos(daysOld: number): Promise<TaskCompletion[]> {
    const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    return await db
      .select()
      .from(taskCompletions)
      .where(
        and(
          isNotNull(taskCompletions.proofPhotoUrl),
          inArray(taskCompletions.status, ["approved", "rejected"]),
          lt(taskCompletions.completedAt, cutoff)
        )
      );
  }

  async clearCompletionProofPhoto(completionId: string): Promise<void> {
    await db
      .update(taskCompletions)
      .set({ proofPhotoUrl: null })
      .where(eq(taskCompletions.id, completionId));
  }

  async cleanupExpiredAuthRateLimits(): Promise<number> {
    const result = await db
      .delete(authRateLimits)
      .where(lt(authRateLimits.resetTime, new Date()));
    return (result as any).rowCount ?? 0;
  }

  async cleanupExpiredDeviceLinkCodes(): Promise<number> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // older than 24h
    const result = await db
      .delete(deviceLinkCodes)
      .where(lt(deviceLinkCodes.expiresAt, cutoff));
    return (result as any).rowCount ?? 0;
  }

  async cleanupExpiredMobileRefreshTokens(): Promise<number> {
    const result = await db
      .delete(mobileRefreshTokens)
      .where(lt(mobileRefreshTokens.expiresAt, new Date()));
    return (result as any).rowCount ?? 0;
  }

  async cleanupOldNotifications(daysOld: number): Promise<number> {
    const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    const result = await db
      .delete(notifications)
      .where(lt(notifications.createdAt, cutoff));
    return (result as any).rowCount ?? 0;
  }

  async cleanupOldEmailReadinessChecks(keepCount: number): Promise<number> {
    // Keep the most recent N rows — delete everything older
    const recent = await db
      .select({ id: emailReadinessChecks.id })
      .from(emailReadinessChecks)
      .orderBy(desc(emailReadinessChecks.checkedAt))
      .limit(keepCount);
    if (recent.length < keepCount) return 0; // not enough rows to trim
    const keepIds = recent.map((r) => r.id);
    const result = await db
      .delete(emailReadinessChecks)
      .where(sql`${emailReadinessChecks.id} NOT IN (${sql.join(keepIds.map((id) => sql`${id}`), sql`, `)})`);
    return (result as any).rowCount ?? 0;
  }

  async getTaskCompletion(completionId: string): Promise<TaskCompletion | undefined> {
    const [completion] = await db
      .select()
      .from(taskCompletions)
      .where(eq(taskCompletions.id, completionId));
    return completion;
  }

  async deleteTaskCompletionsByTask(taskId: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, taskId)).for("update");
      await tx.delete(taskCompletions).where(eq(taskCompletions.taskId, taskId));
    });
  }

  async deletePendingTaskCompletionsByTask(taskId: string): Promise<void> {
    await db.transaction(async (tx) => {
      const [task] = await tx.select({ status: tasks.status }).from(tasks).where(eq(tasks.id, taskId)).for("update");
      if (!task) throw new Error("Task not found");
      if (task.status !== "active") throw new Error("Task is not active");
      await tx.delete(taskCompletions).where(
        and(eq(taskCompletions.taskId, taskId), eq(taskCompletions.status, "pending"))
      );
    });
  }

  async updateTaskCompletionPoints(completionId: string, points: number): Promise<void> {
    await db
      .update(taskCompletions)
      .set({ pointsEarned: points })
      .where(eq(taskCompletions.id, completionId));
  }

  async getPendingCompletionsByFamily(familyName: string): Promise<any[]> {
    const completions = await db
      .select({
        id: taskCompletions.id,
        taskId: taskCompletions.taskId,
        taskTitle: tasks.title,
        taskPoints: tasks.points,
        dailyTarget: tasks.dailyTarget,
        dailyRoundId: taskCompletions.dailyRoundId,
        dailyExecutionCount: taskCompletions.dailyExecutionCount,
        isShoppingList: tasks.isShoppingList,
        isSharedTask: tasks.isSharedTask,
        sharedMemberIds: tasks.sharedMemberIds,
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
    
    const visibleCompletions: any[] = [];
    const handledCollectiveTasks = new Set<string>();
    for (const completion of completions) {
      if (!completion.isShoppingList && !completion.isSharedTask && !completion.dailyRoundId) {
        visibleCompletions.push({
          ...completion,
          proofAttachments: getPendingProofAttachments([completion]),
        });
        continue;
      }
      const collectiveKey = completion.dailyRoundId || completion.taskId;
      if (handledCollectiveTasks.has(collectiveKey)) continue;
      handledCollectiveTasks.add(collectiveKey);

      const grouped = completions.filter(
        item => item.taskId === completion.taskId
          && (!completion.dailyRoundId || item.dailyRoundId === completion.dailyRoundId),
      );
      if (
        completion.isSharedTask
        && completion.sharedMemberIds?.length
        && grouped.length < completion.sharedMemberIds.length
      ) {
        continue;
      }
      visibleCompletions.push({
        ...completion,
        memberName: grouped.map(item => item.memberName).join(", "),
        pointsEarned: completion.dailyRoundId
          ? grouped.reduce((sum, item) => sum + item.pointsEarned, 0)
          : completion.taskPoints,
        ...(completion.dailyRoundId ? {
          dailyTarget: grouped.reduce((sum, item) => sum + (item.dailyExecutionCount || 0), 0),
        } : {}),
        ...(completion.dailyRoundId ? { dailyPointShares: grouped.map(item => ({
          memberId: item.memberId, memberName: item.memberName,
          executions: item.dailyExecutionCount, points: item.pointsEarned,
        })) } : {}),
        proofAttachments: getPendingProofAttachments(grouped),
        ...(completion.isShoppingList
          ? { shoppingListRecipientCount: grouped.length }
          : { teamRecipientCount: grouped.length }),
      });
    }
    return visibleCompletions;
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
    
    // For daily/weekdays recurring tasks, only get completions from TODAY (in family timezone)
    if (task.recurrence === 'daily' || task.recurrence === 'weekdays') {
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

  private async _lockTasksForCompletionDecisions(
    tx: any,
    completionIds: string[],
  ): Promise<{ taskIdByCompletionId: Map<string, string>; taskById: Map<string, Task>; completionIds: string[]; roundByCompletionId: Map<string, string> }> {
    const uniqueCompletionIds = [...new Set(completionIds)];
    if (uniqueCompletionIds.length === 0) {
      return { taskIdByCompletionId: new Map(), taskById: new Map(), completionIds: [], roundByCompletionId: new Map() };
    }
    const completionRefs = await tx
      .select({ id: taskCompletions.id, taskId: taskCompletions.taskId, dailyRoundId: taskCompletions.dailyRoundId })
      .from(taskCompletions)
      .where(inArray(taskCompletions.id, uniqueCompletionIds));
    if (completionRefs.length !== uniqueCompletionIds.length) {
      throw new Error("Completion not found");
    }

    const taskIdByCompletionId = new Map<string, string>(
      completionRefs.map((completion: { id: string; taskId: string }) => [completion.id, completion.taskId]),
    );
    const taskById = await lockTaskRowsInOrder(taskIdByCompletionId.values(), async (taskId) => {
      const [task] = await tx.select().from(tasks).where(eq(tasks.id, taskId)).for("update");
      return task as Task | undefined;
    });
    const roundIds = [...new Set<string>(completionRefs.map((row: any) => row.dailyRoundId).filter(Boolean))];
    const roundByCompletionId = new Map<string, string>();
    if (roundIds.length) {
      // Expand under the task lock, so deciding any recipient decides the
      // entire persisted round atomically, including batch API callers.
      const roundRefs = await tx.select({
        id: taskCompletions.id, taskId: taskCompletions.taskId, dailyRoundId: taskCompletions.dailyRoundId,
      }).from(taskCompletions).where(inArray(taskCompletions.dailyRoundId, roundIds)).for("update");
      for (const row of roundRefs) {
        if (!taskById.has(row.taskId)) throw new Error("Completion round crosses tasks");
        taskIdByCompletionId.set(row.id, row.taskId);
        roundByCompletionId.set(row.id, row.dailyRoundId);
      }
    }
    return { taskIdByCompletionId, taskById, completionIds: [...taskIdByCompletionId.keys()].sort(), roundByCompletionId };
  }

  private async _approveCompletionInternal(
    tx: any,
    completionId: string,
    approvedBy: string | null,
    options: { skipApprovalUpdate?: boolean; prelockedTask?: Task; pointsEarnedOverride?: number; skipCompletionCount?: boolean } = {},
  ): Promise<void> {
    const [completionRef] = await tx.select({ taskId: taskCompletions.taskId })
      .from(taskCompletions)
      .where(eq(taskCompletions.id, completionId));
    if (!completionRef) throw new Error("Completion not found");

    // Lock order is always task first, then completion. Batch callers acquire
    // every distinct task in sorted order before locking any completion row.
    const task = options.prelockedTask || (await tx.select().from(tasks)
      .where(eq(tasks.id, completionRef.taskId))
      .for("update"))[0];
    if (!task) throw new Error("Task not found");
    if (task.id !== completionRef.taskId) throw new Error("Completion task changed");

    const [completion] = await tx.select().from(taskCompletions)
      .where(eq(taskCompletions.id, completionId))
      .for("update");
    if (!completion) throw new Error("Completion not found");

    const decision = resolveCompletionDecision(
      completion.status,
      "approve",
      options.skipApprovalUpdate === true,
    );
    if (decision === "noop") return;
    if (options.skipApprovalUpdate && completion.status !== "approved") {
      throw new Error("Auto-approved completion must already be approved");
    }

    const pointsEarned = options.pointsEarnedOverride ?? completion.pointsEarned;

    // Pending is the only ordinary state that can be approved. Preapproved
    // rows are allowed solely for the create-time auto-award path above.
    if (!options.skipApprovalUpdate) {
      await tx.update(taskCompletions)
        .set({
          status: "approved",
          pointsEarned,
          approvedBy,
          approvedAt: new Date()
        })
        .where(eq(taskCompletions.id, completionId));
    }
    
    // 4. Handle task status updates based on completion
    const isRecurring = task.recurrence !== 'none' || task.recurrenceDays !== null;
    
    if (task.maxCompletions !== null && !options.skipCompletionCount) {
      // Multi-Completion mode: increment counter and check threshold
      // For recurring tasks: keep status as "active" even when maxCompletions reached
      // The nextAvailableDate (set in routes.ts) will make it unavailable until reset
      // For non-recurring tasks: set status to "completed" when maxCompletions reached
      await tx.update(tasks)
        .set({
          completionCount: sql<number>`completion_count + 1`,
          status: isRecurring || task.isShoppingList
            ? task.status // Recurring and collective shopping tasks finalize outside this single-row update.
            : sql`CASE WHEN completion_count + 1 >= ${task.maxCompletions} THEN 'completed'::task_status ELSE status END`,
          updatedAt: new Date()
        })
        .where(eq(tasks.id, task.id));
    } else {
      // Normal mode (no maxCompletions): Check for multi-assignment before setting completed
      // Recurring tasks remain "active" to allow future completions
      if (!isRecurring && !task.isShoppingList) {
        // Check for multi-assignment via EITHER:
        // 1. taskAssignments table (new style)
        // 2. sharedMemberIds array (legacy style with isSharedTask=true)
        const assignments = await tx
          .select({ memberId: taskAssignments.memberId })
          .from(taskAssignments)
          .where(eq(taskAssignments.taskId, task.id));
        let assignedMemberIds = assignments.map((a: { memberId: string }) => a.memberId);
        
        // If no taskAssignments, check for legacy sharedMemberIds
        if (assignedMemberIds.length === 0 && task.isSharedTask && task.sharedMemberIds && task.sharedMemberIds.length > 0) {
          assignedMemberIds = task.sharedMemberIds;
        }
        
        if (assignedMemberIds.length > 1) {
          // Multi-assignment task: Only mark completed when ALL assigned members have approved completions
          const allCompletions = await tx
            .select({ memberId: taskCompletions.memberId, status: taskCompletions.status })
            .from(taskCompletions)
            .where(
              and(
                eq(taskCompletions.taskId, task.id),
                eq(taskCompletions.status, 'approved')
              )
            );
          
          const approvedMemberIds = allCompletions.map((c: { memberId: string }) => c.memberId);
          const allMembersApproved = assignedMemberIds.every((id: string) => approvedMemberIds.includes(id));
          
          if (allMembersApproved) {
            await tx.update(tasks)
              .set({
                status: 'completed',
                updatedAt: new Date()
              })
              .where(eq(tasks.id, task.id));
          }
          // If not all members approved, task stays "active"
        } else {
          // A legacy shared flag with no selected members is still an
          // unassigned family-wide task. Only actual assignments/team members
          // defer completion until every assignee has approved.
          if (assignedMemberIds.length <= 1) {
            await tx.update(tasks)
              .set({
                status: 'completed',
                updatedAt: new Date()
              })
              .where(eq(tasks.id, task.id));
          }
          // Assigned tasks remain active until their own coordination path
          // decides that all required members have submitted.
        }
      }
    }
    
    // 5. Award points to member (existing logic from old approveTaskCompletion)
    await this.mutatePointBalance(tx, {
      memberId: completion.memberId,
      deltas: {
        totalEarned: pointsEarned,
        totalPoints: pointsEarned,
        weeklyPoints: pointsEarned,
        monthlyPoints: pointsEarned,
      },
      sourceType: "task_completion",
      sourceId: completionId,
      reason: "task_completion",
      actorMemberId: approvedBy,
      idempotencyKey: `task-award:${completionId}:${completion.memberId}`,
    });
    
    // Add points history
    await tx.insert(pointsHistory).values({
      memberId: completion.memberId,
      points: pointsEarned,
      reason: 'task_completion',
      taskId: completion.taskId
    });
  }

  private async _approveCompletionsInTransaction(
    tx: any,
    completionIds: string[],
    approvedBy: string | null,
    pointsEarnedOverride?: number,
  ): Promise<void> {
    const uniqueCompletionIds = [...new Set(completionIds)];
    const { taskIdByCompletionId, taskById, completionIds: expandedIds, roundByCompletionId } = await this._lockTasksForCompletionDecisions(tx, uniqueCompletionIds);
    const countedRounds = new Set<string>();
    for (const completionId of expandedIds) {
      const taskId = taskIdByCompletionId.get(completionId);
      const prelockedTask = taskId ? taskById.get(taskId) : undefined;
      const roundId = roundByCompletionId.get(completionId);
      await this._approveCompletionInternal(tx, completionId, approvedBy, {
        prelockedTask,
        pointsEarnedOverride: roundId ? undefined : pointsEarnedOverride,
        skipCompletionCount: !!roundId && countedRounds.has(roundId),
      });
      if (roundId) countedRounds.add(roundId);
    }

    // Shopping-list approval and task finalization must share the task lock.
    // Otherwise an uncheck could slip in after the awards but before the route
    // marks the task complete.
    for (const task of taskById.values()) {
      if (!task.isShoppingList || task.recurrence !== "none") continue;
      const [pending] = await tx.select({ id: taskCompletions.id })
        .from(taskCompletions)
        .where(and(
          eq(taskCompletions.taskId, task.id),
          eq(taskCompletions.status, "pending"),
        ))
        .limit(1);
      if (!pending) {
        await tx.update(tasks)
          .set({ status: "completed", updatedAt: new Date() })
          .where(eq(tasks.id, task.id));
        task.status = "completed";
      }
    }
  }

  async approveTaskCompletion(completionId: string, approvedBy: string): Promise<void> {
    await this.approveTaskCompletions([completionId], approvedBy);
  }

  async approveTaskCompletions(
    completionIds: string[],
    approvedBy: string,
    pointsEarnedOverride?: number,
  ): Promise<void> {
    await db.transaction(async (tx) => {
      await this._approveCompletionsInTransaction(tx, completionIds, approvedBy, pointsEarnedOverride);
    });
  }

  async autoApproveTaskCompletions(completionIds: string[], pointsEarnedOverride?: number): Promise<void> {
    await db.transaction(async (tx) => {
      await this._approveCompletionsInTransaction(tx, completionIds, null, pointsEarnedOverride);
    });
  }

  private async _rejectCompletionInternal(
    tx: any,
    completionId: string,
    approvedBy: string,
    rejectionReason: string,
    prelockedTask: Task,
  ): Promise<void> {
    const [completion] = await tx.select().from(taskCompletions)
      .where(eq(taskCompletions.id, completionId))
      .for("update");
    if (!completion) throw new Error("Completion not found");
    if (completion.taskId !== prelockedTask.id) throw new Error("Completion task changed");

    const decision = resolveCompletionDecision(completion.status, "reject");
    if (decision === "noop") return;

    await tx.update(taskCompletions).set({
      status: "rejected",
      approvedBy,
      approvedAt: new Date(),
      rejectionReason,
    }).where(eq(taskCompletions.id, completionId));

    if (completion.dailyRoundId || (prelockedTask.recurrence === "daily" && (prelockedTask.dailyTarget || 1) > 1)) {
      const [family] = await tx.select({ timezone: families.timezone })
        .from(families)
        .where(eq(families.familyName, prelockedTask.familyName));
      const localDate = formatInTimeZone(
        completion.completedAt || new Date(),
        family?.timezone || "Europe/Berlin",
        "yyyy-MM-dd",
      );
      const [assignment] = await tx.select({ memberId: taskAssignments.memberId })
        .from(taskAssignments)
        .where(eq(taskAssignments.taskId, prelockedTask.id))
        .limit(1);
      const hasLegacyTeamMembers = prelockedTask.isSharedTask
        && (prelockedTask.sharedMemberIds?.length || 0) > 0;
      const isFamilyWide = !!completion.dailyRoundId || (!assignment && !hasLegacyTeamMembers);
      // Rejecting the final submission rejects the entire multi-execution
      // attempt. Family-wide tasks may still have legacy per-member rows,
      // all of which belong to the same counter for this local date.
      await tx.update(dailyTaskProgress).set({
        executionCount: 0,
        updatedAt: new Date(),
      }).where(and(
        eq(dailyTaskProgress.taskId, prelockedTask.id),
        eq(dailyTaskProgress.localDate, localDate),
        isFamilyWide ? undefined : eq(dailyTaskProgress.memberId, completion.memberId),
      ));
    }
  }

  async rejectTaskCompletion(completionId: string, approvedBy: string, rejectionReason: string): Promise<void> {
    await this.rejectTaskCompletions([completionId], approvedBy, rejectionReason);
  }

  async rejectTaskCompletions(completionIds: string[], approvedBy: string, rejectionReason: string): Promise<void> {
    await db.transaction(async (tx) => {
      const uniqueCompletionIds = [...new Set(completionIds)];
      const { taskIdByCompletionId, taskById, completionIds: expandedIds } = await this._lockTasksForCompletionDecisions(tx, uniqueCompletionIds);
      for (const completionId of expandedIds) {
        const taskId = taskIdByCompletionId.get(completionId);
        const task = taskId ? taskById.get(taskId) : undefined;
        if (!task) throw new Error("Task not found");
        await this._rejectCompletionInternal(tx, completionId, approvedBy, rejectionReason, task);
      }
    });
  }

  // Reward operations
  async getRewardsByFamily(familyName: string): Promise<Reward[]> {
    return await db
      .select()
      .from(rewards)
      .where(and(
        eq(rewards.familyName, familyName),
        eq(rewards.isDeleted, false),
      ))
      .orderBy(desc(rewards.createdAt));
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
    await db
      .update(rewards)
      .set({
        isDeleted: true,
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(rewards.id, id));
  }
  
  // Reward redemption operations
  async createRewardRedemption(redemptionData: InsertRewardRedemption): Promise<RewardRedemption> {
    const [redemption] = await db
      .insert(rewardRedemptions)
      .values(redemptionData)
      .returning();
    return redemption;
  }

  async redeemRewardAtomically(
    memberId: string,
    reward: Reward,
    actorMemberId: string | null = null,
    operationId?: string | null,
  ): Promise<RewardRedemption> {
    return await db.transaction(async (tx) => {
      const redemptionId = operationId?.trim()
        ? `redemption:${operationId.trim()}`
        : randomUUID();
      const [member] = await tx
        .select()
        .from(familyMembers)
        .where(eq(familyMembers.id, memberId))
        .for("update")
        .limit(1);
      if (!member) throw new Error("Family member not found");
      const [existingRedemption] = await tx
        .select()
        .from(rewardRedemptions)
        .where(eq(rewardRedemptions.id, redemptionId))
        .limit(1);
      if (existingRedemption) {
        if (existingRedemption.memberId !== memberId || existingRedemption.rewardId !== reward.id) {
          throw new Error("Operation id is already used for another redemption");
        }
        return existingRedemption;
      }
      const [lockedReward] = await tx
        .select()
        .from(rewards)
        .where(eq(rewards.id, reward.id))
        .for("update")
        .limit(1);
      if (!lockedReward || !lockedReward.isActive || lockedReward.isDeleted) {
        throw new Error("Reward is not active");
      }
      if (member.totalPoints < lockedReward.pointThreshold) {
        throw new Error(`Not enough points. Need ${lockedReward.pointThreshold}, have ${member.totalPoints}`);
      }

      await this.mutatePointBalance(tx, {
        memberId,
        deltas: { totalPoints: -lockedReward.pointThreshold },
        sourceType: "reward_redemption",
        sourceId: redemptionId,
        reason: `Redeemed: ${lockedReward.title}`,
        actorMemberId,
        idempotencyKey: `reward-redemption:${redemptionId}:${memberId}`,
      });
      const [redemption] = await tx
        .insert(rewardRedemptions)
        .values({
          id: redemptionId,
          rewardId: lockedReward.id,
          memberId,
          pointsSpent: lockedReward.pointThreshold,
          originalPointsSpent: lockedReward.pointThreshold,
          sharingStatus: "not_shared",
          status: "approved",
        })
        .returning();
      await tx.insert(pointsHistory).values({
        memberId,
        points: -lockedReward.pointThreshold,
        reason: `Redeemed: ${lockedReward.title}`,
        taskId: null,
      });
      await tx
        .update(familyMembers)
        .set({ rewardsRedeemed: sql`${familyMembers.rewardsRedeemed} + 1`, updatedAt: new Date() })
        .where(eq(familyMembers.id, memberId));
      if (lockedReward.oneTimeOnly) {
        await tx
          .update(rewards)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(rewards.id, lockedReward.id));
      }
      return redemption;
    });
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
          iconEmoji: rewards.iconEmoji,
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
    await db.transaction(async (tx) => {
      const [redemption] = await tx
        .select()
        .from(rewardRedemptions)
        .where(eq(rewardRedemptions.id, redemptionId))
        .for("update")
        .limit(1);
      if (!redemption) throw new Error("Redemption not found");
      if (redemption.sharingStatus !== "not_shared") {
        throw new Error("Sharing is not available for this reward");
      }
      await tx
        .update(rewardRedemptions)
        .set({ sharingStatus: "sharing_active" })
        .where(eq(rewardRedemptions.id, redemptionId));
    });
  }

  async joinRewardSharing(redemptionId: string, memberId: string): Promise<RewardSharingParticipant> {
    return await db.transaction(async (tx) => {
      const [redemption] = await tx
        .select()
        .from(rewardRedemptions)
        .where(eq(rewardRedemptions.id, redemptionId))
        .for("update")
        .limit(1);
      if (!redemption) throw new Error("Redemption not found");
      if (redemption.sharingStatus !== "sharing_active") {
        throw new Error("Sharing is not active for this reward");
      }

      // Check if member already joined
      const existing = await tx
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
      const [participant] = await tx
        .insert(rewardSharingParticipants)
        .values({
          redemptionId,
          memberId,
          pointsContributed: 0, // Will be calculated on finalize
        })
        .returning();

      return participant;
    });
  }

  async finalizeRewardSharing(redemptionId: string): Promise<void> {
    await db.transaction(async (tx) => {
      // Get redemption
      const [redemption] = await tx
        .select()
        .from(rewardRedemptions)
        .where(eq(rewardRedemptions.id, redemptionId))
        .for("update")
        .limit(1);

      if (!redemption) {
        throw new Error("Redemption not found");
      }
      if (redemption.sharingStatus !== "sharing_active") {
        throw new Error("Sharing is not active for this reward");
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

      const lockedMembers = new Map<string, FamilyMember>();
      const memberIds = Array.from(new Set([
        redemption.memberId,
        ...participants.map(participant => participant.memberId),
      ])).sort();
      for (const memberId of memberIds) {
        const [lockedMember] = await tx
          .select()
          .from(familyMembers)
          .where(eq(familyMembers.id, memberId))
          .for("update")
          .limit(1);
        if (!lockedMember) {
          throw new Error(`Member ${memberId} not found`);
        }
        lockedMembers.set(memberId, lockedMember);
      }

      const shareIds = [redemption.memberId, ...participants.map(participant => participant.memberId)];
      const shares = allocateRewardShares(redemption.originalPointsSpent, shareIds);

      // The buyer already paid the full original cost. Only participant
      // debits require available-balance validation; the buyer receives the
      // difference back below.
      for (const memberId of participants.map(participant => participant.memberId)) {
        const member = lockedMembers.get(memberId)!;
        const share = shares.get(memberId)!;
        if (member.totalPoints < share) {
          throw new Error(`Member ${member.displayName} doesn't have enough points (needs ${share}, has ${member.totalPoints})`);
        }
      }

      const buyerShare = shares.get(redemption.memberId)!;
      const buyerRefund = redemption.originalPointsSpent - buyerShare;
      if (buyerRefund > 0) {
        await this.mutatePointBalance(tx, {
          memberId: redemption.memberId,
          deltas: { totalPoints: buyerRefund },
          sourceType: "reward_sharing_refund",
          sourceId: redemptionId,
          reason: `Refund from sharing reward (${shareIds.length} people)`,
          idempotencyKey: `reward-sharing-refund:${redemptionId}:${redemption.memberId}`,
        });
        await tx.insert(pointsHistory).values({
          memberId: redemption.memberId,
          points: buyerRefund,
          reason: `Refund from sharing reward (${shareIds.length} people)`,
        });
      }

      for (const participant of participants) {
        const share = shares.get(participant.memberId)!;
        await this.mutatePointBalance(tx, {
          memberId: participant.memberId,
          deltas: { totalPoints: -share },
          sourceType: "reward_sharing_debit",
          sourceId: redemptionId,
          reason: `Shared reward (${shareIds.length} people)`,
          idempotencyKey: `reward-sharing-debit:${redemptionId}:${participant.memberId}`,
        });
        await tx
          .update(rewardSharingParticipants)
          .set({ pointsContributed: share })
          .where(eq(rewardSharingParticipants.id, participant.id));
        await tx.insert(pointsHistory).values({
          memberId: participant.memberId,
          points: -share,
          reason: `Shared reward (${shareIds.length} people)`,
        });
      }

      // Update redemption status and final points
      await tx
        .update(rewardRedemptions)
        .set({
          sharingStatus: "sharing_finalized",
          pointsSpent: buyerShare,
        })
        .where(eq(rewardRedemptions.id, redemptionId));
    });
  }

  async cancelRewardSharing(redemptionId: string): Promise<void> {
    await db.transaction(async (tx) => {
      const [redemption] = await tx
        .select()
        .from(rewardRedemptions)
        .where(eq(rewardRedemptions.id, redemptionId))
        .for("update")
        .limit(1);

      if (!redemption) {
        throw new Error("Redemption not found");
      }

      if (redemption.sharingStatus !== "sharing_active") {
        throw new Error("Sharing is not active for this reward");
      }

      // No participant has paid before finalization. Remove these zero-value
      // invitations so restarting sharing begins with an empty participant set.
      await tx
        .delete(rewardSharingParticipants)
        .where(eq(rewardSharingParticipants.redemptionId, redemptionId));
      await tx
        .update(rewardRedemptions)
        .set({
          sharingStatus: "not_shared",
        })
        .where(eq(rewardRedemptions.id, redemptionId));
    });
  }

  async leaveRewardSharing(redemptionId: string, memberId: string): Promise<void> {
    await db.transaction(async (tx) => {
      const [redemption] = await tx
        .select()
        .from(rewardRedemptions)
        .where(eq(rewardRedemptions.id, redemptionId))
        .for("update")
        .limit(1);

      if (!redemption) {
        throw new Error("Redemption not found");
      }

      if (redemption.sharingStatus !== "sharing_active") {
        throw new Error("Sharing is not active for this reward");
      }

      if (redemption.memberId === memberId) {
        throw new Error("As the initiator, use cancel sharing instead");
      }

      const [participant] = await tx
        .select()
        .from(rewardSharingParticipants)
        .where(and(
          eq(rewardSharingParticipants.redemptionId, redemptionId),
          eq(rewardSharingParticipants.memberId, memberId)
        ))
        .limit(1);

      if (!participant) {
        throw new Error("You are not a participant in this shared reward");
      }

      // Points haven't been paid yet (that happens at finalize) — just remove the record
      await tx
        .delete(rewardSharingParticipants)
        .where(and(
          eq(rewardSharingParticipants.redemptionId, redemptionId),
          eq(rewardSharingParticipants.memberId, memberId)
        ));
    });
  }

  async cancelRewardRedemption(redemptionId: string): Promise<{ memberId: string; pointsRefunded: number; rewardId: string; rewardReactivated: boolean }> {
    return await db.transaction(async (tx) => {
      const [redemption] = await tx
        .select()
        .from(rewardRedemptions)
        .where(eq(rewardRedemptions.id, redemptionId))
        .for("update")
        .limit(1);

      if (!redemption) {
        throw new Error("Redemption not found");
      }

      const pointsToRefund = redemption.pointsSpent;
      const memberId = redemption.memberId;
      const rewardId = redemption.rewardId;
      const [reward] = await tx
        .select()
        .from(rewards)
        .where(eq(rewards.id, rewardId))
        .for("update")
        .limit(1);

      const refundsByMember = new Map<string, number>([[memberId, pointsToRefund]]);
      if (redemption.sharingStatus === "sharing_finalized") {
        const participants = await tx
          .select()
          .from(rewardSharingParticipants)
          .where(eq(rewardSharingParticipants.redemptionId, redemptionId));

        for (const participant of participants) {
          if (participant.pointsContributed && participant.pointsContributed > 0) {
            refundsByMember.set(
              participant.memberId,
              (refundsByMember.get(participant.memberId) ?? 0) + participant.pointsContributed,
            );
          }
        }
      }

      let pointsRefunded = 0;
      for (const [refundMemberId, requestedRefund] of Array.from(refundsByMember.entries()).sort(([a], [b]) => a.localeCompare(b))) {
        const refundMember = await this.mutatePointBalance(tx, {
          memberId: refundMemberId,
          deltas: { totalPoints: requestedRefund },
          sourceType: "reward_refund",
          sourceId: redemptionId,
          reason: "Refund from canceled reward",
          idempotencyKey: `reward-refund:${redemptionId}:${refundMemberId}`,
        });
        if (!refundMember) continue;
        await tx.insert(pointsHistory).values({
          memberId: refundMemberId,
          points: requestedRefund,
          reason: "Refund from canceled reward",
        });
        if (refundMemberId === memberId) {
          pointsRefunded = requestedRefund;
        }
      }

      if (redemption.sharingStatus === "sharing_active" || redemption.sharingStatus === "sharing_finalized") {
        await tx
          .delete(rewardSharingParticipants)
          .where(eq(rewardSharingParticipants.redemptionId, redemptionId));
      }

      if (reward?.oneTimeOnly) {
        await tx
          .update(rewards)
          .set({ isActive: true, updatedAt: new Date() })
          .where(eq(rewards.id, rewardId));
      }

      await tx
        .delete(rewardRedemptions)
        .where(eq(rewardRedemptions.id, redemptionId));

      return { memberId, pointsRefunded, rewardId, rewardReactivated: !!reward?.oneTimeOnly };
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

  async getPointTransactionsByMember(memberId: string, limit = 200): Promise<any[]> {
    return await db
      .select()
      .from(pointTransactions)
      .where(eq(pointTransactions.memberId, memberId))
      .orderBy(desc(pointTransactions.createdAt))
      .limit(Math.max(1, Math.min(limit, 1000)));
  }

  async getPointTransactionsByFamily(familyName: string, limit = 500): Promise<any[]> {
    return await db
      .select()
      .from(pointTransactions)
      .where(eq(pointTransactions.familyName, familyName))
      .orderBy(desc(pointTransactions.createdAt))
      .limit(Math.max(1, Math.min(limit, 2000)));
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
    options: { skinId: string | null; useCustomAvatar?: boolean; useThemeBackground?: boolean }
  ): Promise<void> {
    const updateData: any = { 
      activeSkinId: options.skinId,
      updatedAt: new Date()
    };
    
    if (options.useCustomAvatar !== undefined) {
      updateData.useCustomAvatar = options.useCustomAvatar;
    }
    
    if (options.useThemeBackground !== undefined) {
      updateData.useThemeBackground = options.useThemeBackground;
    }
    
    await db
      .update(familyMembers)
      .set(updateData)
      .where(eq(familyMembers.id, memberId));
  }

  async updateFamilyMemberThemeBackground(memberId: string, useThemeBackground: boolean): Promise<void> {
    await db
      .update(familyMembers)
      .set({ useThemeBackground, updatedAt: new Date() })
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

  async resetFamilyToFactory(familyName: string): Promise<{
    profilePhotoPaths: string[];
    googleRefreshTokenEncrypted: string | null;
  }> {
    // Wrap entire operation in a transaction to ensure atomicity
    return await db.transaction(async (tx) => {
      // Get all family members first (we need their IDs)
      const members = await tx
        .select()
        .from(familyMembers)
        .where(eq(familyMembers.familyName, familyName));
      const memberIds = members.map(m => m.id);
      const profilePhotoPaths = getProfilePhotoObjectPaths(members);

      if (memberIds.length === 0) {
        return { profilePhotoPaths: [], googleRefreshTokenEncrypted: null }; // No members, nothing to reset
      }

      // Get all family tasks (we'll need task IDs for assignments)
      const familyTasks = await tx
        .select()
        .from(tasks)
        .where(eq(tasks.familyName, familyName));
      const taskIds = familyTasks.map(t => t.id);

      // Drop the Google connection (including encrypted OAuth credentials).
      // Its mappings and imported-event links cascade; removing those links
      // first also keeps the subsequent task deletion FK-safe.
      const [googleConnection] = await tx.select({
        refreshTokenEncrypted: googleCalendarConnections.refreshTokenEncrypted,
      }).from(googleCalendarConnections).where(eq(googleCalendarConnections.familyName, familyName));
      await tx.delete(googleCalendarConnections)
        .where(eq(googleCalendarConnections.familyName, familyName));

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

      // Keep legacy points_history as a historical audit trail. The new
      // point_transactions journal is authoritative, but deleting the legacy
      // rows would make pre-rollout activity impossible to inspect.

      // 8. Delete all chat messages for this family
      await tx.delete(chatMessages)
        .where(eq(chatMessages.familyName, familyName));

      // 8b. Delete all pinboard notes for this family
      await tx.delete(pinboardNotes)
        .where(eq(pinboardNotes.familyName, familyName));

      // 8c. Delete all notifications for all members
      for (const memberId of memberIds) {
        await tx.delete(notifications)
          .where(eq(notifications.targetMemberId, memberId));
      }

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

      // 13. Delete all previous star placements.
      for (const memberId of memberIds) {
        await tx.delete(starPlacements)
          .where(eq(starPlacements.memberId, memberId));
      }

      // 14. Reset all family member stats to zero (including PIN codes, starsFound, Legacy skins, and profile photos)
      // Re-enrol every profile in the personal start choice, with no fixed gift.
      const DEFAULT_AVATARS = ["default:fox", "default:bear", "default:rabbit", "default:cat", "default:penguin", "default:lion"];
      
      for (const memberId of memberIds) {
        // Pick a random default avatar for each member
        const randomAvatar = DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)];

        const currentMember = await tx
          .select()
          .from(familyMembers)
          .where(eq(familyMembers.id, memberId))
          .for("update")
          .limit(1);
        if (currentMember[0]) {
          await this.mutatePointBalance(tx, {
            memberId,
            deltas: {
              totalEarned: -currentMember[0].totalEarned,
              totalPoints: -currentMember[0].totalPoints,
              weeklyPoints: -currentMember[0].weeklyPoints,
              monthlyPoints: -currentMember[0].monthlyPoints,
            },
            sourceType: "factory_reset",
            sourceId: familyName,
            reason: "Factory reset",
          });
        }
        
        // Factory reset is the one intentional direct write after the
        // preceding journaled mutation has captured the exact reset delta.
        await tx.update(familyMembers)
          .set({
            totalEarned: 0,
            totalPoints: 0,
            weeklyPoints: 0,
            monthlyPoints: 0,
            rewardsRedeemed: 0,
            unlockedSkins: [],
            discoveredSkinIds: [],
            startSkinOptions: createStartSkinOptions(),
            freeStarterSkinId: null,
            firstTaskCreatedAt: null,
            startCompletedAt: null,
            earnedLegacySkinIds: [], // Reset HeroKids Legacy avatars earned through stars
            activeSkinId: null, // No skin selected - use avatarUrl instead
            useThemeBackground: true,
            avatarUrl: randomAvatar, // Set random default avatar icon (resolved by frontend)
            useCustomAvatar: false, // Show skins when one is selected
            avatarHistory: [], // Remove all references to previously uploaded profile photos
            pinCode: null,
            starsFound: 0,
            updatedAt: new Date(),
          })
          .where(eq(familyMembers.id, memberId));

        // Positions are allocated atomically with the free choice, so its
        // selected card can never consume one of the 48 attainable stars.
      }
      const accountIds = members.map(member => member.userId).filter((id): id is string => !!id);
      if (accountIds.length) {
        await tx.update(users).set({ onboardingCompletedAt: null })
          .where(inArray(users.id, accountIds));
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

      return {
        profilePhotoPaths,
        googleRefreshTokenEncrypted: googleConnection?.refreshTokenEncrypted ?? null,
      };
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

      await this.mutatePointBalance(tx, {
        memberId,
        deltas: {
          totalEarned: bonusPoints,
          totalPoints: bonusPoints,
          weeklyPoints: bonusPoints,
          monthlyPoints: bonusPoints,
        },
        sourceType: "achievement_bonus",
        sourceId: achievementDefinitionId,
        reason: "Achievement bonus",
      });

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

  async backfillOneTimeAchievementAtomically(
    achievementDefinitionId: string,
    memberId: string,
    bonusPoints: number,
  ): Promise<{ award: AchievementAward; created: boolean }> {
    return await db.transaction(async (tx) => {
      const [member] = await tx
        .select()
        .from(familyMembers)
        .where(eq(familyMembers.id, memberId))
        .for("update")
        .limit(1);
      if (!member) throw new Error("Member not found");

      const [existing] = await tx
        .select()
        .from(achievementAwards)
        .where(and(
          eq(achievementAwards.achievementDefinitionId, achievementDefinitionId),
          eq(achievementAwards.memberId, memberId),
        ))
        .limit(1);
      if (existing) return { award: existing, created: false };

      await this.mutatePointBalance(tx, {
        memberId,
        deltas: {
          totalEarned: bonusPoints,
          totalPoints: bonusPoints,
          weeklyPoints: bonusPoints,
          monthlyPoints: bonusPoints,
        },
        sourceType: "achievement_bonus",
        sourceId: achievementDefinitionId,
        reason: "One-time achievement backfill",
        idempotencyKey: `achievement-backfill:${achievementDefinitionId}:${memberId}`,
      });
      const [history] = await tx
        .insert(pointsHistory)
        .values({
          memberId,
          points: bonusPoints,
          reason: "Achievement bonus",
          taskId: null,
        })
        .returning();
      const [award] = await tx
        .insert(achievementAwards)
        .values({
          achievementDefinitionId,
          memberId,
          pointsHistoryId: history.id,
          bonusPoints,
          rewardType: "points",
        })
        .returning();
      return { award, created: true };
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
  async getChatMessages(familyName: string, viewerMemberId: string, limit: number = 50): Promise<any[]> {
    const [viewer] = await db
      .select({ id: familyMembers.id, role: familyMembers.role })
      .from(familyMembers)
      .where(and(eq(familyMembers.id, viewerMemberId), eq(familyMembers.familyName, familyName)));
    if (!viewer) return [];

    const visibility = viewer.role === "parent"
      ? eq(chatMessages.familyName, familyName)
      : and(
          eq(chatMessages.familyName, familyName),
          sql`(${chatMessages.isTargeted} = false OR ${chatMessages.memberId} = ${viewerMemberId} OR ${chatMessages.targetMemberId} = ${viewerMemberId})`,
        );
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
        targetMemberId: chatMessages.targetMemberId,
        isTargeted: chatMessages.isTargeted,
        targetMemberName: sql<string | null>`(
          SELECT display_name FROM family_members target_member
          WHERE target_member.id = ${chatMessages.targetMemberId}
        )`,
      })
      .from(chatMessages)
      .innerJoin(familyMembers, eq(chatMessages.memberId, familyMembers.id))
      .where(visibility)
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);

    // Return in reverse order (oldest first)
    return messages.reverse();
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const [newMessage] = await db.insert(chatMessages).values(message).returning();
    return newMessage;
  }

  async updateLastReadChatAt(memberId: string, conversationKey: string): Promise<void> {
    await db
      .insert(chatConversationReads)
      .values({ memberId, conversationKey, lastReadAt: new Date() })
      .onConflictDoUpdate({
        target: [chatConversationReads.memberId, chatConversationReads.conversationKey],
        set: { lastReadAt: new Date() },
      });
  }

  async getUnreadMessageCounts(memberId: string, familyName: string): Promise<{ count: number; conversations: Record<string, number> }> {
    const [member] = await db
      .select({
        lastReadChatAt: familyMembers.lastReadChatAt,
      })
      .from(familyMembers)
      .where(eq(familyMembers.id, memberId));

    if (!member) return { count: 0, conversations: {} };

    const legacyReadAt = member.lastReadChatAt || new Date(0);
    const conversationReads = await db
      .select({
        conversationKey: chatConversationReads.conversationKey,
        lastReadAt: chatConversationReads.lastReadAt,
      })
      .from(chatConversationReads)
      .where(eq(chatConversationReads.memberId, memberId));
    const readAtByConversation = new Map(
      conversationReads.map(read => [read.conversationKey, read.lastReadAt]),
    );

    const incomingMessages = await db
      .select({
        createdAt: chatMessages.createdAt,
        memberId: chatMessages.memberId,
        isTargeted: chatMessages.isTargeted,
      })
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.familyName, familyName),
          sql`${chatMessages.memberId} != ${memberId}`,
          sql`(${chatMessages.isTargeted} = false OR ${chatMessages.targetMemberId} = ${memberId})`,
        )
      );

    const conversations = calculateConversationUnreadCounts(
      incomingMessages,
      legacyReadAt,
      readAtByConversation,
    );

    return {
      count: Object.values(conversations).reduce((sum, count) => sum + count, 0),
      conversations,
    };
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

  async createTvPairing(data: { id: string; secretHash: string; code: string; expiresAt: Date }): Promise<TvPairing> {
    await db.delete(tvPairings).where(and(
      lt(tvPairings.expiresAt, new Date()),
      sql`(${tvPairings.tvSessionId} IS NULL OR NOT EXISTS (
        SELECT 1 FROM tv_sessions
        WHERE tv_sessions.id = ${tvPairings.tvSessionId}
          AND tv_sessions.revoked_at IS NULL
          AND tv_sessions.expires_at > now()
      ))`,
    ));
    const [pairing] = await db.insert(tvPairings).values(data).returning();
    return pairing;
  }

  async getTvPairing(id: string): Promise<TvPairing | undefined> {
    const [pairing] = await db.select().from(tvPairings).where(eq(tvPairings.id, id));
    return pairing;
  }

  async approveTvPairing(code: string, familyName: string): Promise<TvPairing | undefined> {
    const [pairing] = await db.update(tvPairings)
      .set({ status: "approved", familyName })
      .where(and(
        eq(tvPairings.code, code),
        eq(tvPairings.status, "pending"),
        gt(tvPairings.expiresAt, new Date()),
      ))
      .returning();
    return pairing;
  }

  async claimTvPairingToken(
    id: string,
    secretHash: string,
    tokenHash: string,
    sessionExpiresAt: Date,
  ): Promise<"issued" | "retry" | false> {
    return db.transaction(async (tx) => {
      const [pairing] = await tx.select().from(tvPairings)
        .where(and(eq(tvPairings.id, id), eq(tvPairings.secretHash, secretHash)))
        .for("update")
        .limit(1);
      if (!pairing || pairing.status !== "approved" || !pairing.familyName) return false;
      if (pairing.tokenIssuedAt || pairing.tvSessionId) {
        if (!pairing.tvSessionId) return false;
        const [session] = await tx.select({ id: tvSessions.id })
          .from(tvSessions)
          .where(and(
            eq(tvSessions.id, pairing.tvSessionId),
            eq(tvSessions.familyName, pairing.familyName),
            eq(tvSessions.tokenHash, tokenHash),
            isNull(tvSessions.revokedAt),
            gt(tvSessions.expiresAt, new Date()),
          ))
          .limit(1);
        return session ? "retry" : false;
      }
      if (pairing.expiresAt <= new Date()) return false;
      const [session] = await tx.insert(tvSessions).values({
        familyName: pairing.familyName,
        tokenHash,
        expiresAt: sessionExpiresAt,
      }).returning({ id: tvSessions.id });
      const [claimed] = await tx.update(tvPairings)
        .set({ tokenIssuedAt: new Date(), tvSessionId: session.id })
        .where(and(
          eq(tvPairings.id, id),
          isNull(tvPairings.tokenIssuedAt),
          isNull(tvPairings.tvSessionId),
        ))
        .returning({ id: tvPairings.id });
      if (!claimed) throw new Error("TV pairing claim failed while holding its row lock");
      return "issued";
    });
  }

  async getTvSessionByTokenHash(tokenHash: string): Promise<TvSession | undefined> {
    const [tvSession] = await db.update(tvSessions)
      .set({ lastSeenAt: new Date() })
      .where(and(
        eq(tvSessions.tokenHash, tokenHash),
        isNull(tvSessions.revokedAt),
        gt(tvSessions.expiresAt, new Date()),
      ))
      .returning();
    return tvSession;
  }

  async getActiveTvSessionsForFamily(familyName: string): Promise<Array<Pick<TvSession, "id" | "createdAt" | "lastSeenAt">>> {
    return db.select({
      id: tvSessions.id,
      createdAt: tvSessions.createdAt,
      lastSeenAt: tvSessions.lastSeenAt,
    })
      .from(tvSessions)
      .where(and(
        eq(tvSessions.familyName, familyName),
        isNull(tvSessions.revokedAt),
        gt(tvSessions.expiresAt, new Date()),
      ))
      .orderBy(desc(tvSessions.createdAt));
  }

  async revokeTvSessionForFamily(sessionId: string, familyName: string): Promise<boolean> {
    const [revoked] = await db.update(tvSessions)
      .set({ revokedAt: new Date(), selectedMemberId: null })
      .where(and(
        eq(tvSessions.id, sessionId),
        eq(tvSessions.familyName, familyName),
        isNull(tvSessions.revokedAt),
        gt(tvSessions.expiresAt, new Date()),
      ))
      .returning({ id: tvSessions.id });
    return Boolean(revoked);
  }

  async selectTvSessionMember(
    sessionId: string,
    expectedMemberId: string | null,
    memberId: string | null,
    verifiedTarget?: { role: "parent" | "child"; pinCode: string | null },
  ): Promise<boolean> {
    const expectedSelection = expectedMemberId === null
      ? isNull(tvSessions.selectedMemberId)
      : eq(tvSessions.selectedMemberId, expectedMemberId);
    const targetIsValid = memberId === null
      ? sql`true`
      : verifiedTarget ? sql`EXISTS (
          SELECT 1 FROM family_members AS tv_target
          WHERE tv_target.id = ${memberId}
            AND tv_target.family_name = ${tvSessions.familyName}
            AND tv_target.is_paused = false
            AND tv_target.role = ${verifiedTarget.role}
            AND (tv_target.role = 'child' OR tv_target.pin_code IS NOT DISTINCT FROM ${verifiedTarget.pinCode})
        )` : sql`false`;
    const [updated] = await db.update(tvSessions)
      .set({ selectedMemberId: memberId, lastSeenAt: new Date() })
      .where(and(
        eq(tvSessions.id, sessionId),
        expectedSelection,
        isNull(tvSessions.revokedAt),
        gt(tvSessions.expiresAt, new Date()),
        targetIsValid,
      ))
      .returning({ id: tvSessions.id });
    return Boolean(updated);
  }

  async revokeTvSession(sessionId: string): Promise<void> {
    await db.update(tvSessions)
      .set({ revokedAt: new Date(), selectedMemberId: null })
      .where(and(eq(tvSessions.id, sessionId), sql`${tvSessions.revokedAt} IS NULL`));
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
    const member = await this.getFamilyMember(memberId);
    if (!member || isStartPending(member)) return;
    // Personal starters can contain a legitimately found star. Only the old
    // automatically unlocked fixed starter remains excluded for legacy profiles.
    const freeStarterId = member.startSkinOptions ? null : getFreeStarterId(member);
    // Get all standard (non-legacy) skins from database, excluding the starter skin
    const allSkins = await db.select({ id: skins.id }).from(skins);
    const allSkinIds = new Set(allSkins.map(s => s.id));
    const standardSkinIds = allSkins
      .map(s => s.id)
      .filter(id => !this.LEGACY_SKIN_IDS.includes(id) && id !== freeStarterId);
    
    if (standardSkinIds.length < TOTAL_HIDDEN_STARS) {
      console.warn(`Only ${standardSkinIds.length} standard skins available for star placement (need ${TOTAL_HIDDEN_STARS})`);
    }

    // Check if member already has star placements
    const existing = await this.getStarPlacementsByMember(memberId);
    
    // CRITICAL: Remove any invalid placements (Legacy skins, starter skin, or non-existent skins)
    // These skins can never be "discovered" so stars on them are permanently unreachable
    const invalidPlacements = existing.filter(p => 
      this.LEGACY_SKIN_IDS.includes(p.skinId) || 
      p.skinId === freeStarterId ||
      !allSkinIds.has(p.skinId)
    );
    
    if (invalidPlacements.length > 0) {
      console.log(`Removing ${invalidPlacements.length} invalid star placements for member ${memberId} (Legacy/starter/orphaned skins)`);
      for (const placement of invalidPlacements) {
        await db.delete(starPlacements).where(eq(starPlacements.id, placement.id));
      }
    }
    
    // Re-fetch after cleanup
    const validExisting = await this.getStarPlacementsByMember(memberId);
    
    // If member has correct number of valid stars, skip initialization
    if (validExisting.length >= TOTAL_HIDDEN_STARS) {
      return; // Already fully initialized
    }
    
    // Add more stars to reach TOTAL_HIDDEN_STARS
    const existingSkinIds = validExisting.map(p => p.skinId);
    const availableSkinIds = standardSkinIds.filter(id => !existingSkinIds.includes(id));
    const starsToAdd = TOTAL_HIDDEN_STARS - validExisting.length;
    
    if (starsToAdd > 0 && availableSkinIds.length > 0) {
      console.log(`Initializing/upgrading member ${memberId} stars: ${validExisting.length} -> ${TOTAL_HIDDEN_STARS} (adding ${starsToAdd})`);
      
      const shuffled = [...availableSkinIds].sort(() => Math.random() - 0.5);
      const newPositions = shuffled.slice(0, Math.min(starsToAdd, shuffled.length));
      
      for (const skinId of newPositions) {
        await db.insert(starPlacements).values({
          memberId,
          skinId,
          found: false,
        }).onConflictDoNothing();
      }
    }
  }

  async fixMemberStars(memberId: string): Promise<{ totalPlacements: number; added: number; message: string }> {
    // Get member and their current star placements
    const member = await this.getFamilyMember(memberId);
    if (!member) {
      return { totalPlacements: 0, added: 0, message: "Member not found" };
    }
    if (isStartPending(member)) {
      return { totalPlacements: 0, added: 0, message: "Choose your starter first" };
    }
    const freeStarterId = member.startSkinOptions ? null : getFreeStarterId(member);

    // Get all skins to validate placements
    const allSkins = await db.select({ id: skins.id }).from(skins);
    const allSkinIds = new Set(allSkins.map(s => s.id));
    const standardSkinIds = allSkins
      .map(s => s.id)
      .filter(id => !this.LEGACY_SKIN_IDS.includes(id) && id !== freeStarterId);

    const existing = await this.getStarPlacementsByMember(memberId);
    
    // STEP 1: Remove invalid placements (Legacy skins, starter skin, or non-existent skins)
    const invalidPlacements = existing.filter(p => 
      this.LEGACY_SKIN_IDS.includes(p.skinId) || 
      p.skinId === freeStarterId ||
      !allSkinIds.has(p.skinId)
    );
    
    let invalidRemoved = 0;
    if (invalidPlacements.length > 0) {
      console.log(`Removing ${invalidPlacements.length} invalid star placements for ${member.displayName} (Legacy/starter/orphaned skins)`);
      for (const placement of invalidPlacements) {
        await db.delete(starPlacements).where(eq(starPlacements.id, placement.id));
      }
      invalidRemoved = invalidPlacements.length;
    }
    
    // Re-fetch valid placements after cleanup
    const validExisting = await this.getStarPlacementsByMember(memberId);
    
    // Get member's discovered skins
    const discoveredSkinIds = member.discoveredSkinIds || [];
    
    // STEP 2: Mark any unfound stars on discovered skins as "found"
    let starsMarkedFound = 0;
    for (const placement of validExisting) {
      if (!placement.found && discoveredSkinIds.includes(placement.skinId)) {
        await db.update(starPlacements)
          .set({ found: true, foundAt: new Date() })
          .where(eq(starPlacements.id, placement.id));
        starsMarkedFound++;
      }
    }
    
    // STEP 3: Recalculate actual starsFound from placements
    const updatedPlacements = await this.getStarPlacementsByMember(memberId);
    const actualStarsFound = updatedPlacements.filter(p => p.found).length;
    
    // STEP 4: Update the member's starsFound counter if it's out of sync
    if (member.starsFound !== actualStarsFound) {
      await db.update(familyMembers)
        .set({ starsFound: actualStarsFound, updatedAt: new Date() })
        .where(eq(familyMembers.id, memberId));
      console.log(`Synced starsFound for ${member.displayName}: ${member.starsFound} -> ${actualStarsFound}`);
    }
    
    // STEP 5: Check if Legacy skins need to be awarded based on actual stars found
    const expectedLegacyCount = Math.floor(actualStarsFound / STARS_PER_LEGACY_AVATAR);
    const currentLegacyCount = (member.earnedLegacySkinIds || []).length;
    
    if (expectedLegacyCount > currentLegacyCount) {
      const newLegacySkins = this.LEGACY_SKIN_IDS.slice(0, expectedLegacyCount);
      await db.update(familyMembers)
        .set({ earnedLegacySkinIds: newLegacySkins, updatedAt: new Date() })
        .where(eq(familyMembers.id, memberId));
      console.log(`Awarded ${expectedLegacyCount - currentLegacyCount} Legacy skins to ${member.displayName}`);
    }
    
    // STEP 6: Add missing star placements to reach 48 (only on valid standard skins)
    let starsAdded = 0;
    const currentValidCount = updatedPlacements.length;
    
    if (currentValidCount < TOTAL_HIDDEN_STARS) {
      // Find skins that don't already have a star placement
      const existingSkinIds = updatedPlacements.map(p => p.skinId);
      const availableSkinIds = standardSkinIds.filter(id => !existingSkinIds.includes(id));
      
      // Calculate how many stars to add
      const starsToAdd = TOTAL_HIDDEN_STARS - currentValidCount;
      
      if (availableSkinIds.length > 0) {
        // Randomly select new positions from available skins
        const shuffled = [...availableSkinIds].sort(() => Math.random() - 0.5);
        const newPositions = shuffled.slice(0, Math.min(starsToAdd, shuffled.length));
        
        // Insert new star placements - mark as found if skin is already discovered
        for (const skinId of newPositions) {
          const isDiscovered = discoveredSkinIds.includes(skinId);
          await db.insert(starPlacements).values({
            memberId,
            skinId,
            found: isDiscovered,
            foundAt: isDiscovered ? new Date() : null,
          }).onConflictDoNothing();
          if (isDiscovered) starsMarkedFound++;
        }
        starsAdded = newPositions.length;
      }
    }

    // Build message
    const finalPlacements = await this.getStarPlacementsByMember(memberId);
    const newTotal = finalPlacements.length;
    const parts: string[] = [];
    if (invalidRemoved > 0) parts.push(`${invalidRemoved} invalid removed`);
    if (starsAdded > 0) parts.push(`${starsAdded} added`);
    if (starsMarkedFound > 0) parts.push(`${starsMarkedFound} synced`);
    
    const message = parts.length > 0 
      ? `Fixed ${member.displayName}: ${parts.join(', ')} (now ${newTotal}/48)`
      : `${member.displayName}: ${newTotal}/48 stars, all valid`;
    
    console.log(message);
    
    return { 
      totalPlacements: newTotal, 
      added: starsAdded, 
      message 
    };
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
    if (member && isStartPending(member)) {
      return { starsFound: 0, totalStars: TOTAL_HIDDEN_STARS, earnedLegacySkinIds: [] };
    }
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

  // Notification operations (member-based - each member has their own notifications)
  async getNotificationsForMember(memberId: string, limit: number = 50): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.targetMemberId, memberId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async getUnreadNotificationCountForMember(memberId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(
        eq(notifications.targetMemberId, memberId),
        eq(notifications.isRead, false)
      ));
    return result[0]?.count ?? 0;
  }

  async createNotification(notificationData: InsertNotification): Promise<Notification> {
    const [notification] = await db
      .insert(notifications)
      .values(notificationData)
      .returning();
    return notification;
  }

  // Create notification for each parent in family (optionally exclude a specific member)
  async createNotificationForParents(familyName: string, notificationData: Omit<InsertNotification, 'targetMemberId'>, excludeMemberId?: string): Promise<void> {
    const parents = await this.getFamilyMembersByFamily(familyName);
    // Filter to only parents, and exclude the specified member (so you don't notify yourself)
    const parentMembers = parents.filter(m => m.role === 'parent' && m.id !== excludeMemberId);
    
    for (const parent of parentMembers) {
      await db.insert(notifications).values({
        ...notificationData,
        targetMemberId: parent.id,
      });
    }
  }

  // Create notification for each sibling (other children) in family, excluding the specified member
  async createNotificationForSiblings(familyName: string, notificationData: Omit<InsertNotification, 'targetMemberId'>, excludeMemberId: string): Promise<void> {
    const members = await this.getFamilyMembersByFamily(familyName);
    // Filter to only children, and exclude the specified member (so you don't notify yourself)
    const siblings = members.filter(m => m.role === 'child' && m.id !== excludeMemberId);
    
    for (const sibling of siblings) {
      await db.insert(notifications).values({
        ...notificationData,
        targetMemberId: sibling.id,
      });
    }
  }

  // Create notification for all children in family
  async createNotificationForAllChildren(familyName: string, notificationData: Omit<InsertNotification, 'targetMemberId'>): Promise<void> {
    const members = await this.getFamilyMembersByFamily(familyName);
    const children = members.filter(m => m.role === 'child');
    
    for (const child of children) {
      await db.insert(notifications).values({
        ...notificationData,
        targetMemberId: child.id,
      });
    }
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, notificationId));
  }

  async markAllNotificationsAsReadForMember(memberId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.targetMemberId, memberId));
  }

  async deleteNotification(notificationId: string): Promise<void> {
    await db.delete(notifications).where(eq(notifications.id, notificationId));
  }

  async deleteAllNotificationsForMember(memberId: string): Promise<void> {
    await db.delete(notifications).where(eq(notifications.targetMemberId, memberId));
  }

  // Delete all notifications of a specific type for a specific task (used when task is approved/rejected)
  async deleteNotificationsByTypeAndTask(familyName: string, type: NotificationType, taskId: string): Promise<void> {
    await db.delete(notifications).where(and(
      eq(notifications.familyName, familyName),
      eq(notifications.type, type),
      eq(notifications.relatedTaskId, taskId)
    ));
  }
  
  // Delete notifications of a specific type targeted at a specific member
  async deleteNotificationsByTarget(familyName: string, type: NotificationType, targetMemberId: string): Promise<void> {
    await db.delete(notifications).where(and(
      eq(notifications.familyName, familyName),
      eq(notifications.type, type),
      eq(notifications.targetMemberId, targetMemberId)
    ));
  }

  async createEmailReadinessCheck(checkData: InsertEmailReadinessCheck): Promise<EmailReadinessCheck> {
    const [check] = await db
      .insert(emailReadinessChecks)
      .values(checkData)
      .returning();
    await db.execute(sql`
      DELETE FROM email_readiness_checks
      WHERE id IN (
        SELECT id FROM email_readiness_checks
        ORDER BY checked_at DESC
        OFFSET 100
      )
    `);
    return check;
  }

  async getRecentEmailReadinessChecks(limit = 10): Promise<EmailReadinessCheck[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 25);
    return await db
      .select()
      .from(emailReadinessChecks)
      .orderBy(desc(emailReadinessChecks.checkedAt))
      .limit(safeLimit);
  }

  async upsertDevicePushToken(memberId: string, token: string, platform = "ios"): Promise<void> {
    // A physical device can only be logged in as one family member at a time.
    // If this same token is still registered under other members (e.g. from a
    // prior profile switch on a shared/test device), drop those stale rows first
    // so the device doesn't receive duplicate push notifications for every
    // family-wide event.
    await db
      .delete(devicePushTokens)
      .where(and(eq(devicePushTokens.token, token), ne(devicePushTokens.memberId, memberId)));

    await db
      .insert(devicePushTokens)
      .values({ memberId, token, platform })
      .onConflictDoUpdate({
        target: [devicePushTokens.memberId, devicePushTokens.token],
        set: { updatedAt: new Date() },
      });
  }

  async removeDevicePushToken(token: string): Promise<void> {
    await db.delete(devicePushTokens).where(eq(devicePushTokens.token, token));
  }

  async getDevicePushTokensForMember(memberId: string): Promise<string[]> {
    const rows = await db
      .select({ token: devicePushTokens.token })
      .from(devicePushTokens)
      .where(eq(devicePushTokens.memberId, memberId));
    return rows.map((r) => r.token);
  }

  async getDevicePushTokensForMembers(memberIds: string[]): Promise<string[]> {
    if (!memberIds.length) return [];
    const rows = await db
      .select({ token: devicePushTokens.token })
      .from(devicePushTokens)
      .where(inArray(devicePushTokens.memberId, memberIds));
    // A single physical device should only be registered to one member, but
    // stale rows from before that constraint existed can still make the same
    // token appear for several recipients. Dedup defensively so one device
    // never receives the same push more than once.
    return Array.from(new Set(rows.map((r) => r.token)));
  }

  // One-time cleanup for tokens registered under more than one member before
  // upsertDevicePushToken started clearing stale cross-member rows. Keeps the
  // most recently updated row per token and drops the rest. Safe to call
  // repeatedly; it is a no-op once no duplicates remain.
  async dedupeDevicePushTokens(): Promise<number> {
    const result = await db.execute(sql`
      DELETE FROM ${devicePushTokens}
      WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (
            PARTITION BY token ORDER BY updated_at DESC, created_at DESC
          ) AS rn
          FROM ${devicePushTokens}
        ) ranked
        WHERE rn > 1
      )
    `);
    return (result as any).rowCount ?? 0;
  }

  async getAppConfig(key: string): Promise<string | null> {
    const [row] = await db.select().from(appConfig).where(eq(appConfig.key, key));
    return row?.value ?? null;
  }

  async setAppConfig(key: string, value: string): Promise<void> {
    await db
      .insert(appConfig)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({ target: appConfig.key, set: { value, updatedAt: new Date() } });
  }
}

export const storage = new DatabaseStorage();
