import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import {
  pgTable,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
  jsonb,
  pgEnum,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const roleEnum = pgEnum("role", ["parent", "child"]);
export const taskStatusEnum = pgEnum("task_status", ["active", "completed", "archived"]);
export const recurrenceEnum = pgEnum("recurrence", ["none", "daily", "weekdays", "weekly", "monthly", "yearly", "immediate"]);
export const subscriptionTierEnum = pgEnum("subscription_tier", ["free", "family", "family_plus", "family_hero"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", ["active", "trialing", "past_due", "canceled", "incomplete"]);
export const sharingStatusEnum = pgEnum("sharing_status", ["not_shared", "sharing_active", "sharing_finalized"]);
export const achievementTypeEnum = pgEnum("achievement_type", ["first_weekly_finisher", "weekly_leaderboard", "perfect_week", "lifetime_milestone", "task_streak"]);
export const contributionPeriodEnum = pgEnum("contribution_period", ["weekly", "monthly"]);

// Session storage table - Required for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table - Required for Replit Auth, extended for HeroKids
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Families - Family groups with subscription tiers
export const families = pgTable("families", {
  familyName: varchar("family_name").primaryKey(),
  joinCode: varchar("join_code", { length: 6 }).notNull().unique(), // Family-level join code
  subscriptionTier: subscriptionTierEnum("subscription_tier").notNull().default("free"),
  subscriptionStatus: subscriptionStatusEnum("subscription_status").default("active"), // Stripe subscription status
  billingCustomerId: varchar("billing_customer_id"), // Stripe customer ID
  billingSubscriptionId: varchar("billing_subscription_id"), // Stripe subscription ID
  tierExpiresAt: timestamp("tier_expires_at"), // When subscription expires (for grace periods)
  showLeaderboard: boolean("show_leaderboard").notNull().default(true), // Parents can hide leaderboard from children
  singleDeviceMode: boolean("single_device_mode").notNull().default(false), // Enable PIN protection for member switching
  language: varchar("language", { length: 2 }).notNull().default("en"), // Family language (de, en, fr, es, ja, zh, ko, sv)
  timezone: varchar("timezone", { length: 50 }).notNull().default("Europe/Berlin"), // IANA timezone (e.g., "America/New_York", "Asia/Tokyo")
  weeklyPrize: text("weekly_prize"), // Prize for weekly leaderboard winner
  monthlyPrize: text("monthly_prize"), // Prize for monthly leaderboard winner
  yearlyPrize: text("yearly_prize"), // Prize for yearly leaderboard winner
  skinCardCost: integer("skin_card_cost").notNull().default(60), // Points needed to discover one skin card (40-80, step 5)
  lastDailyReset: timestamp("last_daily_reset"), // When daily tasks were last reset (null = never)
  lastWeeklyReset: timestamp("last_weekly_reset"), // When weekly points were last reset (null = never)
  lastMonthlyReset: timestamp("last_monthly_reset"), // When monthly points were last reset (null = never)
  lastDailyPeriod: varchar("last_daily_period", { length: 10 }), // Family-local date string "YYYY-MM-DD"
  lastWeeklyPeriod: varchar("last_weekly_period", { length: 10 }), // Family-local ISO week "RRRR-Www"
  lastMonthlyPeriod: varchar("last_monthly_period", { length: 7 }), // Family-local month "YYYY-MM"
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const familiesRelations = relations(families, ({ many }) => ({
  members: many(familyMembers),
}));

export const insertFamilySchema = createInsertSchema(families).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertFamily = z.infer<typeof insertFamilySchema>;
export type Family = typeof families.$inferSelect;

// Family members - Individual family members with avatars and roles
export const familyMembers = pgTable("family_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  familyName: varchar("family_name").notNull().references(() => families.familyName, { onDelete: "cascade" }),
  displayName: varchar("display_name").notNull(),
  role: roleEnum("role").notNull().default("child"),
  avatarUrl: varchar("avatar_url"),
  color: varchar("color").notNull().default("#8B5CF6"), // User's theme color
  pinCode: varchar("pin_code", { length: 60 }), // bcrypt-hashed 4-digit PIN for single-device mode (optional)
  totalEarned: integer("total_earned").notNull().default(0), // Lifetime achievement points (never decreases)
  totalPoints: integer("total_points").notNull().default(0), // Available balance for redeeming rewards
  weeklyPoints: integer("weekly_points").notNull().default(0),
  monthlyPoints: integer("monthly_points").notNull().default(0),
  rewardsRedeemed: integer("rewards_redeemed").notNull().default(0), // Counter for unlocking skins
  unlockedSkins: text("unlocked_skins").array().notNull().default(sql`ARRAY[]::text[]`), // Array of unlocked skin IDs (deprecated, use discoveredSkinIds)
  discoveredSkinIds: text("discovered_skin_ids").array().notNull().default(sql`ARRAY[]::text[]`), // Skins the member has chosen/discovered (Tekken-style system)
  starsFound: integer("stars_found").notNull().default(0), // Number of hidden stars found (48 total, every 4 = 1 HeroKids Legacy avatar)
  earnedLegacySkinIds: text("earned_legacy_skin_ids").array().notNull().default(sql`ARRAY[]::text[]`), // HeroKids Legacy avatars earned through star collection
  activeSkinId: varchar("active_skin_id"), // Currently selected skin
  useCustomAvatar: boolean("use_custom_avatar").notNull().default(false), // Use custom avatar instead of skin avatar (background stays from skin)
  useThemeBackground: boolean("use_theme_background").notNull().default(true), // Show themed background from active skin (can be disabled to keep avatar only)
  avatarHistory: jsonb("avatar_history").$type<string[]>().default(sql`'[]'::jsonb`), // Last 3 uploaded avatar URLs for quick selection
  lastReadChatAt: timestamp("last_read_chat_at"), // When member last viewed chat messages
  excludeFromLeaderboard: boolean("exclude_from_leaderboard").notNull().default(false), // Exclude member from leaderboard competition
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const familyMembersRelations = relations(familyMembers, ({ one, many }) => ({
  user: one(users, {
    fields: [familyMembers.userId],
    references: [users.id],
  }),
  family: one(families, {
    fields: [familyMembers.familyName],
    references: [families.familyName],
  }),
  tasksCreated: many(tasks),
  taskAssignments: many(taskAssignments),
  taskCompletions: many(taskCompletions),
  pointsHistory: many(pointsHistory),
}));

export const insertFamilyMemberSchema = createInsertSchema(familyMembers).omit({
  id: true,
  userId: true, // Populated from authenticated session
  createdAt: true,
  updatedAt: true,
});

export type InsertFamilyMember = z.infer<typeof insertFamilyMemberSchema>;
export type FamilyMember = typeof familyMembers.$inferSelect;

// Tasks - Chore/task definitions
export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyName: varchar("family_name").notNull(),
  createdBy: varchar("created_by").notNull().references(() => familyMembers.id),
  title: varchar("title").notNull(),
  description: text("description"),
  points: integer("points").notNull().default(10),
  recurrence: recurrenceEnum("recurrence").notNull().default("none"),
  recurrenceDays: integer("recurrence_days"), // Custom recurrence interval in days (e.g., 3 for every 3 days)
  nextAvailableDate: timestamp("next_available_date"), // When task becomes available again after completion
  status: taskStatusEnum("status").notNull().default("active"),
  requiresProof: boolean("requires_proof").notNull().default(false),
  requiresApproval: boolean("requires_approval").notNull().default(true),
  maxCompletions: integer("max_completions"), // Multi-completion mode: null = assignment-based, number = slot-based (e.g., 3 children can complete)
  completionCount: integer("completion_count").notNull().default(0), // Performance cache: approved completions count
  iconEmoji: varchar("icon_emoji").default("⭐"),
  isSharedTask: boolean("is_shared_task").notNull().default(false), // Shared task: all members must complete together, points split equally
  sharedMemberIds: text("shared_member_ids").array(), // Array of member IDs who must complete this shared task together
  dueDate: varchar("due_date"), // Optional due date for one-time tasks (YYYY-MM-DD format)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  creator: one(familyMembers, {
    fields: [tasks.createdBy],
    references: [familyMembers.id],
  }),
  assignments: many(taskAssignments),
  completions: many(taskCompletions),
}));

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

// Task assignments - Who is assigned to which task
export const taskAssignments = pgTable("task_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  memberId: varchar("member_id").notNull().references(() => familyMembers.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const taskAssignmentsRelations = relations(taskAssignments, ({ one }) => ({
  task: one(tasks, {
    fields: [taskAssignments.taskId],
    references: [tasks.id],
  }),
  member: one(familyMembers, {
    fields: [taskAssignments.memberId],
    references: [familyMembers.id],
  }),
}));

export const insertTaskAssignmentSchema = createInsertSchema(taskAssignments).omit({
  id: true,
  createdAt: true,
});

export type InsertTaskAssignment = z.infer<typeof insertTaskAssignmentSchema>;
export type TaskAssignment = typeof taskAssignments.$inferSelect;

// Task completions - Track when tasks are completed
export const completionStatusEnum = pgEnum("completion_status", ["pending", "approved", "rejected"]);

export const taskCompletions = pgTable("task_completions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  memberId: varchar("member_id").notNull().references(() => familyMembers.id, { onDelete: "cascade" }),
  proofPhotoUrl: varchar("proof_photo_url"),
  pointsEarned: integer("points_earned").notNull(),
  status: completionStatusEnum("status").notNull().default("pending"),
  approvedBy: varchar("approved_by").references(() => familyMembers.id),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  completedAt: timestamp("completed_at").defaultNow(),
});

export const taskCompletionsRelations = relations(taskCompletions, ({ one }) => ({
  task: one(tasks, {
    fields: [taskCompletions.taskId],
    references: [tasks.id],
  }),
  member: one(familyMembers, {
    fields: [taskCompletions.memberId],
    references: [familyMembers.id],
  }),
  approver: one(familyMembers, {
    fields: [taskCompletions.approvedBy],
    references: [familyMembers.id],
  }),
}));

export const insertTaskCompletionSchema = createInsertSchema(taskCompletions).omit({
  id: true,
  completedAt: true,
  approvedAt: true,
});

export type InsertTaskCompletion = z.infer<typeof insertTaskCompletionSchema>;
export type TaskCompletion = typeof taskCompletions.$inferSelect;

// Rewards - Prizes that can be earned
export const rewards = pgTable("rewards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyName: varchar("family_name").notNull(),
  title: varchar("title").notNull(),
  description: text("description"),
  pointThreshold: integer("point_threshold").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  oneTimeOnly: boolean("one_time_only").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertRewardSchema = createInsertSchema(rewards).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertReward = z.infer<typeof insertRewardSchema>;
export type Reward = typeof rewards.$inferSelect;

// Reward requests - Children can request new rewards for parent approval
export const rewardRequests = pgTable("reward_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyName: varchar("family_name").notNull(),
  requestedBy: varchar("requested_by").notNull().references(() => familyMembers.id, { onDelete: "cascade" }),
  title: varchar("title").notNull(),
  description: text("description"),
  pointThreshold: integer("point_threshold").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, approved, declined
  reviewedBy: varchar("reviewed_by").references(() => familyMembers.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const rewardRequestsRelations = relations(rewardRequests, ({ one }) => ({
  requester: one(familyMembers, {
    fields: [rewardRequests.requestedBy],
    references: [familyMembers.id],
  }),
  reviewer: one(familyMembers, {
    fields: [rewardRequests.reviewedBy],
    references: [familyMembers.id],
  }),
}));

export const insertRewardRequestSchema = createInsertSchema(rewardRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  reviewedBy: true,
  reviewedAt: true,
});

export type InsertRewardRequest = z.infer<typeof insertRewardRequestSchema>;
export type RewardRequest = typeof rewardRequests.$inferSelect;

// Points history - Detailed tracking of point changes
export const pointsHistory = pgTable("points_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memberId: varchar("member_id").notNull().references(() => familyMembers.id, { onDelete: "cascade" }),
  points: integer("points").notNull(),
  reason: varchar("reason").notNull(),
  taskId: varchar("task_id").references(() => tasks.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const pointsHistoryRelations = relations(pointsHistory, ({ one }) => ({
  member: one(familyMembers, {
    fields: [pointsHistory.memberId],
    references: [familyMembers.id],
  }),
  task: one(tasks, {
    fields: [pointsHistory.taskId],
    references: [tasks.id],
  }),
}));

export const insertPointsHistorySchema = createInsertSchema(pointsHistory).omit({
  id: true,
  createdAt: true,
});

export type InsertPointsHistory = z.infer<typeof insertPointsHistorySchema>;
export type PointsHistory = typeof pointsHistory.$inferSelect;

// Reward redemptions - Track when rewards are claimed
export const rewardRedemptions = pgTable("reward_redemptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  rewardId: varchar("reward_id").notNull().references(() => rewards.id, { onDelete: "cascade" }),
  memberId: varchar("member_id").notNull().references(() => familyMembers.id, { onDelete: "cascade" }),
  pointsSpent: integer("points_spent").notNull(),
  originalPointsSpent: integer("original_points_spent").notNull(), // Original points before sharing
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, approved, completed
  sharingStatus: sharingStatusEnum("sharing_status").notNull().default("not_shared"),
  redeemedAt: timestamp("redeemed_at").defaultNow(),
});

export const rewardRedemptionsRelations = relations(rewardRedemptions, ({ one, many }) => ({
  reward: one(rewards, {
    fields: [rewardRedemptions.rewardId],
    references: [rewards.id],
  }),
  member: one(familyMembers, {
    fields: [rewardRedemptions.memberId],
    references: [familyMembers.id],
  }),
  sharingParticipants: many(rewardSharingParticipants),
}));

export const insertRewardRedemptionSchema = createInsertSchema(rewardRedemptions).omit({
  id: true,
  redeemedAt: true,
});

export type InsertRewardRedemption = z.infer<typeof insertRewardRedemptionSchema>;
export type RewardRedemption = typeof rewardRedemptions.$inferSelect;

// Reward sharing participants - Track who is sharing a reward
export const rewardSharingParticipants = pgTable("reward_sharing_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  redemptionId: varchar("redemption_id").notNull().references(() => rewardRedemptions.id, { onDelete: "cascade" }),
  memberId: varchar("member_id").notNull().references(() => familyMembers.id, { onDelete: "cascade" }),
  pointsContributed: integer("points_contributed").notNull(),
  joinedAt: timestamp("joined_at").defaultNow(),
}, (table) => ({
  uniqueRedemptionMember: unique("unique_redemption_member").on(table.redemptionId, table.memberId),
}));

export const rewardSharingParticipantsRelations = relations(rewardSharingParticipants, ({ one }) => ({
  redemption: one(rewardRedemptions, {
    fields: [rewardSharingParticipants.redemptionId],
    references: [rewardRedemptions.id],
  }),
  member: one(familyMembers, {
    fields: [rewardSharingParticipants.memberId],
    references: [familyMembers.id],
  }),
}));

export const insertRewardSharingParticipantSchema = createInsertSchema(rewardSharingParticipants).omit({
  id: true,
  joinedAt: true,
});

export type InsertRewardSharingParticipant = z.infer<typeof insertRewardSharingParticipantSchema>;
export type RewardSharingParticipant = typeof rewardSharingParticipants.$inferSelect;

// Chat Messages - Family chat messages (Family+ and Enterprise tier)
export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyName: varchar("family_name").notNull().references(() => families.familyName, { onDelete: "cascade" }),
  memberId: varchar("member_id").notNull().references(() => familyMembers.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  family: one(families, {
    fields: [chatMessages.familyName],
    references: [families.familyName],
  }),
  member: one(familyMembers, {
    fields: [chatMessages.memberId],
    references: [familyMembers.id],
  }),
}));

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

// Skins - Unlockable character skins for avatars
export const skins = pgTable("skins", {
  id: varchar("id").primaryKey(),
  name: varchar("name").notNull(),
  description: text("description"),
  imageUrl: varchar("image_url").notNull(),
  pointsRequired: integer("points_required").notNull(), // Total points earned required to unlock
  bonusPoints: integer("bonus_points").notNull().default(0), // Bonus points awarded when discovering this skin
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSkinSchema = createInsertSchema(skins).omit({
  createdAt: true,
});

export type InsertSkin = z.infer<typeof insertSkinSchema>;
export type Skin = typeof skins.$inferSelect;

// Achievement Definitions - Templates for achievements (configured per family)
export const achievementDefinitions = pgTable("achievement_definitions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyName: varchar("family_name").notNull().references(() => families.familyName, { onDelete: "cascade" }),
  type: achievementTypeEnum("type").notNull(),
  slug: varchar("slug").notNull(), // Unique identifier within family (e.g., "first-weekly-finisher")
  title: varchar("title").notNull(), // Display name (e.g., "Weekly Champion")
  description: text("description").notNull(), // Description shown to members
  config: jsonb("config").notNull().default(sql`'{}'::jsonb`), // Type-specific config (e.g., { threshold: 100, rank: "gold" })
  bonusPoints: integer("bonus_points").notNull(), // Points awarded when achievement is earned (if rewardType is "points")
  rewardType: varchar("reward_type").notNull().default("points"), // "points" or "custom"
  customReward: text("custom_reward"), // Custom reward text (e.g., "Extra pocket money", "Movie night")
  isActive: boolean("is_active").notNull().default(true), // Parents can enable/disable
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique().on(table.familyName, table.slug), // Unique slug per family
]);

export const achievementDefinitionsRelations = relations(achievementDefinitions, ({ one, many }) => ({
  family: one(families, {
    fields: [achievementDefinitions.familyName],
    references: [families.familyName],
  }),
  awards: many(achievementAwards),
}));

export const insertAchievementDefinitionSchema = createInsertSchema(achievementDefinitions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAchievementDefinition = z.infer<typeof insertAchievementDefinitionSchema>;
export type AchievementDefinition = typeof achievementDefinitions.$inferSelect;

// Achievement Members - Progress tracking for each member
export const achievementMembers = pgTable("achievement_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyName: varchar("family_name").notNull().references(() => families.familyName, { onDelete: "cascade" }),
  memberId: varchar("member_id").notNull().references(() => familyMembers.id, { onDelete: "cascade" }),
  weeklyCompletionCount: integer("weekly_completion_count").notNull().default(0), // Tasks completed this week
  weeklyRejectionCount: integer("weekly_rejection_count").notNull().default(0), // Tasks rejected this week
  consecutiveDaysStreak: integer("consecutive_days_streak").notNull().default(0), // Current streak of days with tasks
  lastStreakDate: timestamp("last_streak_date"), // Last date when streak was updated
  lastWeeklyReset: timestamp("last_weekly_reset").defaultNow(), // When weekly counters were last reset
  firstWeeklyFinisher: boolean("first_weekly_finisher").notNull().default(false), // Has claimed first-weekly-finisher this week
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique().on(table.familyName, table.memberId), // One progress record per member per family
]);

export const achievementMembersRelations = relations(achievementMembers, ({ one }) => ({
  family: one(families, {
    fields: [achievementMembers.familyName],
    references: [families.familyName],
  }),
  member: one(familyMembers, {
    fields: [achievementMembers.memberId],
    references: [familyMembers.id],
  }),
}));

export const insertAchievementMemberSchema = createInsertSchema(achievementMembers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAchievementMember = z.infer<typeof insertAchievementMemberSchema>;
export type AchievementMember = typeof achievementMembers.$inferSelect;

// Achievement Awards - History of earned achievements
export const achievementAwards = pgTable("achievement_awards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  achievementDefinitionId: varchar("achievement_definition_id").notNull().references(() => achievementDefinitions.id, { onDelete: "cascade" }),
  memberId: varchar("member_id").notNull().references(() => familyMembers.id, { onDelete: "cascade" }),
  pointsHistoryId: varchar("points_history_id").references(() => pointsHistory.id, { onDelete: "set null" }), // Link to points history entry
  bonusPoints: integer("bonus_points").notNull(), // Points awarded (snapshot at award time)
  rewardType: varchar("reward_type").notNull().default("points"), // "points" or "custom" (snapshot at award time)
  customReward: text("custom_reward"), // Custom reward text (snapshot at award time)
  awardedAt: timestamp("awarded_at").defaultNow(),
});

export const achievementAwardsRelations = relations(achievementAwards, ({ one }) => ({
  achievementDefinition: one(achievementDefinitions, {
    fields: [achievementAwards.achievementDefinitionId],
    references: [achievementDefinitions.id],
  }),
  member: one(familyMembers, {
    fields: [achievementAwards.memberId],
    references: [familyMembers.id],
  }),
  pointsHistory: one(pointsHistory, {
    fields: [achievementAwards.pointsHistoryId],
    references: [pointsHistory.id],
  }),
}));

export const insertAchievementAwardSchema = createInsertSchema(achievementAwards).omit({
  id: true,
  awardedAt: true,
});

export type InsertAchievementAward = z.infer<typeof insertAchievementAwardSchema>;
export type AchievementAward = typeof achievementAwards.$inferSelect;

// Family Goals - Shared family objectives that require equal contributions from all members
export const familyGoals = pgTable("family_goals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyName: varchar("family_name").notNull().references(() => families.familyName, { onDelete: "cascade" }),
  title: varchar("title", { length: 100 }).notNull(), // e.g., "Tierpark-Besuch"
  description: text("description"), // Optional details about the goal
  targetPoints: integer("target_points").notNull(), // Total points needed to complete the goal
  contributionAmount: integer("contribution_amount").notNull(), // Points each member must contribute per period
  contributionPeriod: contributionPeriodEnum("contribution_period").notNull(), // weekly or monthly
  currentPoints: integer("current_points").notNull().default(0), // Current total contributed
  isActive: boolean("is_active").notNull().default(true),
  iconEmoji: varchar("icon_emoji", { length: 10 }).notNull().default("🎯"), // Visual icon for the goal
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"), // When the goal was achieved
});

export const familyGoalsRelations = relations(familyGoals, ({ one, many }) => ({
  family: one(families, {
    fields: [familyGoals.familyName],
    references: [families.familyName],
  }),
  contributions: many(goalContributions),
}));

export const insertFamilyGoalSchema = createInsertSchema(familyGoals).omit({
  id: true,
  currentPoints: true,
  createdAt: true,
  completedAt: true,
});

export type InsertFamilyGoal = z.infer<typeof insertFamilyGoalSchema>;
export type FamilyGoal = typeof familyGoals.$inferSelect;

// Goal Contributions - Tracks individual member contributions to family goals
export const goalContributions = pgTable("goal_contributions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  goalId: varchar("goal_id").notNull().references(() => familyGoals.id, { onDelete: "cascade" }),
  memberId: varchar("member_id").notNull().references(() => familyMembers.id, { onDelete: "cascade" }),
  points: integer("points").notNull(), // Amount contributed
  period: varchar("period", { length: 20 }).notNull(), // e.g., "2025-W47" (weekly) or "2025-11" (monthly)
  contributedAt: timestamp("contributed_at").defaultNow(),
});

export const goalContributionsRelations = relations(goalContributions, ({ one }) => ({
  goal: one(familyGoals, {
    fields: [goalContributions.goalId],
    references: [familyGoals.id],
  }),
  member: one(familyMembers, {
    fields: [goalContributions.memberId],
    references: [familyMembers.id],
  }),
}));

export const insertGoalContributionSchema = createInsertSchema(goalContributions).omit({
  id: true,
  contributedAt: true,
});

export type InsertGoalContribution = z.infer<typeof insertGoalContributionSchema>;
export type GoalContribution = typeof goalContributions.$inferSelect;

// Device Link Codes - One-time codes for linking child accounts to new devices
export const deviceLinkCodes = pgTable("device_link_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memberId: varchar("member_id").notNull().references(() => familyMembers.id, { onDelete: "cascade" }),
  createdByParentId: varchar("created_by_parent_id").notNull().references(() => familyMembers.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 6 }).notNull(), // 6-digit alphanumeric code
  expiresAt: timestamp("expires_at").notNull(), // Code expires after 15 minutes
  consumedAt: timestamp("consumed_at"), // When code was used (null if unused)
  createdAt: timestamp("created_at").defaultNow(),
});

export const deviceLinkCodesRelations = relations(deviceLinkCodes, ({ one }) => ({
  member: one(familyMembers, {
    fields: [deviceLinkCodes.memberId],
    references: [familyMembers.id],
  }),
  createdByParent: one(familyMembers, {
    fields: [deviceLinkCodes.createdByParentId],
    references: [familyMembers.id],
  }),
}));

export const insertDeviceLinkCodeSchema = createInsertSchema(deviceLinkCodes).omit({
  id: true,
  consumedAt: true,
  createdAt: true,
});

export type InsertDeviceLinkCode = z.infer<typeof insertDeviceLinkCodeSchema>;
export type DeviceLinkCode = typeof deviceLinkCodes.$inferSelect;

// Child Device Sessions - Active sessions for children on their own devices
export const childDeviceSessions = pgTable("child_device_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memberId: varchar("member_id").notNull().references(() => familyMembers.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(), // SHA-256 hash of session token
  deviceLabel: varchar("device_label", { length: 100 }), // Optional device name (e.g., "Marias iPhone")
  lastSeenAt: timestamp("last_seen_at").defaultNow(),
  revokedAt: timestamp("revoked_at"), // When session was revoked (null if active)
  createdAt: timestamp("created_at").defaultNow(),
});

export const childDeviceSessionsRelations = relations(childDeviceSessions, ({ one }) => ({
  member: one(familyMembers, {
    fields: [childDeviceSessions.memberId],
    references: [familyMembers.id],
  }),
}));

export const insertChildDeviceSessionSchema = createInsertSchema(childDeviceSessions).omit({
  id: true,
  lastSeenAt: true,
  revokedAt: true,
  createdAt: true,
});

export type InsertChildDeviceSession = z.infer<typeof insertChildDeviceSessionSchema>;
export type ChildDeviceSession = typeof childDeviceSessions.$inferSelect;

// Mobile Push Tokens - For push notifications on mobile devices
export const pushTokenPlatformEnum = pgEnum("push_token_platform", ["ios", "android", "expo"]);

export const mobilePushTokens = pgTable("mobile_push_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memberId: varchar("member_id").notNull().references(() => familyMembers.id, { onDelete: "cascade" }),
  token: text("token").notNull(), // Push token from Expo/APNs/FCM
  platform: pushTokenPlatformEnum("platform").notNull(),
  deviceId: varchar("device_id", { length: 100 }), // Unique device identifier
  isActive: boolean("is_active").notNull().default(true),
  lastUsedAt: timestamp("last_used_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueMemberToken: unique("unique_member_token").on(table.memberId, table.token),
}));

export const mobilePushTokensRelations = relations(mobilePushTokens, ({ one }) => ({
  member: one(familyMembers, {
    fields: [mobilePushTokens.memberId],
    references: [familyMembers.id],
  }),
}));

export const insertMobilePushTokenSchema = createInsertSchema(mobilePushTokens).omit({
  id: true,
  lastUsedAt: true,
  createdAt: true,
});

export type InsertMobilePushToken = z.infer<typeof insertMobilePushTokenSchema>;
export type MobilePushToken = typeof mobilePushTokens.$inferSelect;

// Mobile Refresh Tokens - For JWT refresh token rotation
export const mobileRefreshTokens = pgTable("mobile_refresh_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memberId: varchar("member_id").notNull().references(() => familyMembers.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(), // SHA-256 hash of refresh token
  deviceId: varchar("device_id", { length: 100 }), // Unique device identifier
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"), // When token was revoked (null if active)
  createdAt: timestamp("created_at").defaultNow(),
});

export const mobileRefreshTokensRelations = relations(mobileRefreshTokens, ({ one }) => ({
  member: one(familyMembers, {
    fields: [mobileRefreshTokens.memberId],
    references: [familyMembers.id],
  }),
}));

export const insertMobileRefreshTokenSchema = createInsertSchema(mobileRefreshTokens).omit({
  id: true,
  revokedAt: true,
  createdAt: true,
});

export type InsertMobileRefreshToken = z.infer<typeof insertMobileRefreshTokenSchema>;
export type MobileRefreshToken = typeof mobileRefreshTokens.$inferSelect;

// Star Placements - Hidden stars on skin cards for gamification (48 stars total, 4 stars = 1 HeroKids Legacy avatar)
export const starPlacements = pgTable("star_placements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memberId: varchar("member_id").notNull().references(() => familyMembers.id, { onDelete: "cascade" }),
  skinId: varchar("skin_id").notNull(), // The skin card where the star is hidden
  found: boolean("found").notNull().default(false), // Whether the member has discovered this star
  foundAt: timestamp("found_at"), // When the star was discovered
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique().on(table.memberId, table.skinId), // Each member can only have one star per skin position
]);

export const starPlacementsRelations = relations(starPlacements, ({ one }) => ({
  member: one(familyMembers, {
    fields: [starPlacements.memberId],
    references: [familyMembers.id],
  }),
}));

export const insertStarPlacementSchema = createInsertSchema(starPlacements).omit({
  id: true,
  foundAt: true,
  createdAt: true,
});

export type InsertStarPlacement = z.infer<typeof insertStarPlacementSchema>;
export type StarPlacement = typeof starPlacements.$inferSelect;

// Notification Types
export const notificationTypeEnum = pgEnum("notification_type", [
  "task_completed",      // Child completed a task
  "task_pending",        // Task waiting for approval
  "task_approved",       // Parent approved a task
  "task_rejected",       // Parent rejected a task
  "task_expired",        // Task not completed within grace period
  "reward_redeemed",     // Child redeemed a reward
  "reward_request",      // Child requests a new reward
  "reward_created",      // Parent created a new reward
  "reward_sharing",      // Child offers to share a reward
  "achievement_earned",  // Child earned an achievement
  "points_milestone",    // Child reached a points milestone
  "member_joined",       // New member joined the family
]);

// Notifications - For parents (family events) and children (personal events)
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyName: varchar("family_name").notNull().references(() => families.familyName, { onDelete: "cascade" }),
  type: notificationTypeEnum("type").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  targetMemberId: varchar("target_member_id").references(() => familyMembers.id, { onDelete: "cascade" }), // Who should see this notification (null = parents, specific ID = that child)
  relatedMemberId: varchar("related_member_id").references(() => familyMembers.id, { onDelete: "set null" }), // Member who triggered the notification
  relatedTaskId: varchar("related_task_id").references(() => tasks.id, { onDelete: "set null" }), // Related task (if applicable)
  relatedRewardId: varchar("related_reward_id").references(() => rewards.id, { onDelete: "set null" }), // Related reward (if applicable)
  createdAt: timestamp("created_at").defaultNow(),
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  family: one(families, {
    fields: [notifications.familyName],
    references: [families.familyName],
  }),
  targetMember: one(familyMembers, {
    fields: [notifications.targetMemberId],
    references: [familyMembers.id],
    relationName: "notificationTarget",
  }),
  relatedMember: one(familyMembers, {
    fields: [notifications.relatedMemberId],
    references: [familyMembers.id],
    relationName: "notificationRelated",
  }),
  relatedTask: one(tasks, {
    fields: [notifications.relatedTaskId],
    references: [tasks.id],
  }),
  relatedReward: one(rewards, {
    fields: [notifications.relatedRewardId],
    references: [rewards.id],
  }),
}));

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;
export type NotificationType = typeof notificationTypeEnum.enumValues[number];
