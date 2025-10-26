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
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const roleEnum = pgEnum("role", ["parent", "child"]);
export const taskStatusEnum = pgEnum("task_status", ["active", "completed", "archived"]);
export const recurrenceEnum = pgEnum("recurrence", ["none", "daily", "weekly", "monthly"]);
export const subscriptionTierEnum = pgEnum("subscription_tier", ["free", "family", "family_plus", "hero_pro"]);

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

// User storage table - Required for Replit Auth, extended for HomeHero
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
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
  subscriptionTier: subscriptionTierEnum("subscription_tier").notNull().default("free"),
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
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  familyName: varchar("family_name").notNull().references(() => families.familyName, { onDelete: "cascade" }),
  displayName: varchar("display_name").notNull(),
  role: roleEnum("role").notNull().default("child"),
  avatarUrl: varchar("avatar_url"),
  color: varchar("color").notNull().default("#8B5CF6"), // User's theme color
  totalPoints: integer("total_points").notNull().default(0),
  weeklyPoints: integer("weekly_points").notNull().default(0),
  monthlyPoints: integer("monthly_points").notNull().default(0),
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
  dueDate: timestamp("due_date"),
  recurrence: recurrenceEnum("recurrence").notNull().default("none"),
  status: taskStatusEnum("status").notNull().default("active"),
  requiresProof: boolean("requires_proof").notNull().default(false),
  iconEmoji: varchar("icon_emoji").default("⭐"),
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
export const taskCompletions = pgTable("task_completions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  memberId: varchar("member_id").notNull().references(() => familyMembers.id, { onDelete: "cascade" }),
  proofPhotoUrl: varchar("proof_photo_url"),
  pointsEarned: integer("points_earned").notNull(),
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
}));

export const insertTaskCompletionSchema = createInsertSchema(taskCompletions).omit({
  id: true,
  completedAt: true,
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
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, approved, completed
  redeemedAt: timestamp("redeemed_at").defaultNow(),
});

export const rewardRedemptionsRelations = relations(rewardRedemptions, ({ one }) => ({
  reward: one(rewards, {
    fields: [rewardRedemptions.rewardId],
    references: [rewards.id],
  }),
  member: one(familyMembers, {
    fields: [rewardRedemptions.memberId],
    references: [familyMembers.id],
  }),
}));

export const insertRewardRedemptionSchema = createInsertSchema(rewardRedemptions).omit({
  id: true,
  redeemedAt: true,
});

export type InsertRewardRedemption = z.infer<typeof insertRewardRedemptionSchema>;
export type RewardRedemption = typeof rewardRedemptions.$inferSelect;
