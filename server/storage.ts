import {
  users,
  families,
  familyMembers,
  tasks,
  taskAssignments,
  taskCompletions,
  rewards,
  rewardRedemptions,
  pointsHistory,
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
  type InsertPointsHistory,
  type TaskCompletion,
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
  updateFamilyTier(familyName: string, tier: "free" | "family" | "family_plus" | "hero_pro"): Promise<void>;

  // Family member operations
  getFamilyMember(id: string): Promise<FamilyMember | undefined>;
  getFamilyMemberById(id: string): Promise<FamilyMember | undefined>;
  getFamilyMemberByUserId(userId: string): Promise<FamilyMember | undefined>;
  getFamilyMembersByFamily(familyName: string): Promise<FamilyMember[]>;
  getFamilyMemberCount(familyName: string): Promise<number>;
  createFamilyMember(member: InsertFamilyMember): Promise<FamilyMember>;
  updateFamilyMember(id: string, updates: Partial<InsertFamilyMember>): Promise<FamilyMember>;
  updateFamilyMemberPoints(
    id: string,
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

  // Task assignment operations
  createTaskAssignment(assignment: InsertTaskAssignment): Promise<void>;
  getTaskAssignmentsByMember(memberId: string): Promise<string[]>;
  getTaskAssignmentsByTask(taskId: string): Promise<string[]>;

  // Task completion operations
  createTaskCompletion(completion: InsertTaskCompletion): Promise<TaskCompletion>;
  getTaskCompletionsByMember(memberId: string): Promise<TaskCompletion[]>;

  // Reward operations
  getRewardsByFamily(familyName: string): Promise<Reward[]>;
  createReward(reward: InsertReward): Promise<Reward>;
  
  // Reward redemption operations
  createRewardRedemption(redemption: InsertRewardRedemption): Promise<RewardRedemption>;
  getRewardRedemptionsByFamily(familyName: string): Promise<any[]>;
  getRewardRedemptionsByMember(memberId: string): Promise<RewardRedemption[]>;
  updateRewardRedemptionStatus(id: string, status: string): Promise<void>;

  // Points history operations
  addPointsHistory(history: InsertPointsHistory): Promise<void>;
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
          ...userData,
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
    tier: "free" | "family" | "family_plus" | "hero_pro"
  ): Promise<void> {
    await db
      .update(families)
      .set({ subscriptionTier: tier, updatedAt: new Date() })
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

  async updateFamilyMemberPoints(
    id: string,
    totalPoints: number,
    weeklyPoints: number,
    monthlyPoints: number
  ): Promise<void> {
    await db
      .update(familyMembers)
      .set({ totalPoints, weeklyPoints, monthlyPoints, updatedAt: new Date() })
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
    return await db
      .select()
      .from(tasks)
      .where(eq(tasks.familyName, familyName))
      .orderBy(desc(tasks.createdAt));
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

  // Points history operations
  async addPointsHistory(historyData: InsertPointsHistory): Promise<void> {
    await db.insert(pointsHistory).values(historyData);
  }
}

export const storage = new DatabaseStorage();
