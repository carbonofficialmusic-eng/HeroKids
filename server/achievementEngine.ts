import { storage } from "./storage";
import { broadcastToFamily } from "./websocket";
import type { AchievementDefinition, FamilyMember } from "@shared/schema";

export interface AchievementEvent {
  type: "task_approved" | "task_rejected" | "midnight_reset" | "daily_check";
  familyName: string;
  memberId?: string;
  taskId?: string;
  pointsEarned?: number;
}

// Helper to create achievement notifications (for parents and the child who earned it)
async function createAchievementNotification(
  familyName: string,
  memberName: string,
  achievementTitle: string,
  bonusPoints: number,
  memberId: string
): Promise<void> {
  try {
    // Create notification for parents (family-wide, targetMemberId = null)
    await storage.createNotification({
      familyName,
      type: "achievement_earned",
      title: `${memberName} earned an achievement!`,
      message: `"${achievementTitle}" (+${bonusPoints} points)`,
      relatedMemberId: memberId,
    });
    
    // Create notification for the child who earned the achievement
    await storage.createNotification({
      familyName,
      type: "achievement_earned",
      title: `You earned an achievement!`,
      message: `"${achievementTitle}" (+${bonusPoints} points)`,
      relatedMemberId: memberId,
      targetMemberId: memberId,
    });
    
    broadcastToFamily(familyName, { type: "notification_update" });
  } catch (error) {
    console.error("Error creating achievement notification:", error);
  }
}

export class AchievementEngine {
  async processEvent(event: AchievementEvent): Promise<void> {
    const definitions = await storage.getAchievementDefinitionsByFamily(event.familyName);
    const activeDefinitions = definitions.filter(d => d.isActive);

    for (const definition of activeDefinitions) {
      try {
        await this.evaluateAchievement(definition, event);
      } catch (error) {
        console.error(`Error evaluating achievement ${definition.slug}:`, error);
      }
    }
  }

  private async evaluateAchievement(definition: AchievementDefinition, event: AchievementEvent): Promise<void> {
    switch (definition.type) {
      case "first_weekly_finisher":
        await this.evaluateFirstWeeklyFinisher(definition, event);
        break;
      case "weekly_leaderboard":
        await this.evaluateWeeklyLeaderboard(definition, event);
        break;
      case "perfect_week":
        await this.evaluatePerfectWeek(definition, event);
        break;
      case "lifetime_milestone":
        await this.evaluateLifetimeMilestone(definition, event);
        break;
      case "task_streak":
        await this.evaluateTaskStreak(definition, event);
        break;
    }
  }

  private async evaluateFirstWeeklyFinisher(definition: AchievementDefinition, event: AchievementEvent): Promise<void> {
    if (event.type !== "task_approved" || !event.memberId) return;

    const member = await storage.getFamilyMember(event.memberId);
    if (!member) return;

    const achievementMember = await storage.getOrCreateAchievementMember(event.familyName, event.memberId);

    if (achievementMember.firstWeeklyFinisher) {
      return;
    }

    achievementMember.weeklyCompletionCount += 1;

    const familyTasks = await storage.getTasksByFamily(event.familyName);
    const assignedTasks = await storage.getTaskAssignmentsByMember(event.memberId);
    const totalAssignedTasks = assignedTasks.filter(taskId => {
      const task = familyTasks.find(t => t.id === taskId);
      return task && task.status === "active";
    }).length;

    const allWeeklyTasksCompleted = achievementMember.weeklyCompletionCount >= totalAssignedTasks && totalAssignedTasks > 0;

    if (allWeeklyTasksCompleted) {
      const otherMembers = await storage.getFamilyMembersByFamily(event.familyName);
      let anyoneClaimed = false;

      for (const otherMember of otherMembers) {
        if (otherMember.id === event.memberId) continue;
        const otherAchievementMember = await storage.getOrCreateAchievementMember(event.familyName, otherMember.id);
        if (otherAchievementMember.firstWeeklyFinisher) {
          anyoneClaimed = true;
          break;
        }
      }

      if (!anyoneClaimed) {
        await storage.updateAchievementMember(achievementMember.id, {
          firstWeeklyFinisher: true,
          weeklyCompletionCount: achievementMember.weeklyCompletionCount,
        });

        await storage.awardAchievement(definition.id, event.memberId, definition.bonusPoints);
        console.log(`🏆 ${member.displayName} earned "${definition.title}" (+${definition.bonusPoints} points)`);
        
        // Broadcast achievement to family with celebration
        broadcastToFamily(event.familyName, {
          type: "achievement_earned",
          memberId: event.memberId,
          memberName: member.displayName,
          achievementTitle: definition.title,
          bonusPoints: definition.bonusPoints,
        });
        
        // Create notification for parents
        await createAchievementNotification(
          event.familyName,
          member.displayName,
          definition.title,
          definition.bonusPoints,
          event.memberId
        );
      }
    } else {
      await storage.updateAchievementMember(achievementMember.id, {
        weeklyCompletionCount: achievementMember.weeklyCompletionCount,
      });
    }
  }

  private async evaluateWeeklyLeaderboard(definition: AchievementDefinition, event: AchievementEvent): Promise<void> {
    if (event.type !== "midnight_reset") return;

    const members = await storage.getFamilyMembersByFamily(event.familyName);
    if (members.length === 0) return;

    const sortedMembers = [...members]
      .filter(m => !m.excludeFromLeaderboard)
      .sort((a, b) => b.weeklyPoints - a.weeklyPoints);

    const config = definition.config as { rank: number | "gold" | "silver" | "bronze" };
    // Support both numeric rank (1, 2, 3) and string rank ("gold", "silver", "bronze")
    const rankMap: Record<string, number> = { gold: 0, silver: 1, bronze: 2 };
    const rankIndex = typeof config.rank === "number" 
      ? config.rank - 1  // Convert 1-based to 0-based index
      : (rankMap[config.rank] ?? 0);

    if (sortedMembers.length > rankIndex) {
      const winner = sortedMembers[rankIndex];
      if (winner.weeklyPoints > 0) {
        await storage.awardAchievement(definition.id, winner.id, definition.bonusPoints);
        console.log(`🥇 ${winner.displayName} earned "${definition.title}" for ${config.rank} rank (+${definition.bonusPoints} points)`);
        
        broadcastToFamily(event.familyName, {
          type: "achievement_earned",
          memberId: winner.id,
          memberName: winner.displayName,
          achievementTitle: definition.title,
          bonusPoints: definition.bonusPoints,
        });
        
        // Create notification for parents
        await createAchievementNotification(
          event.familyName,
          winner.displayName,
          definition.title,
          definition.bonusPoints,
          winner.id
        );
      }
    }
  }

  private async evaluatePerfectWeek(definition: AchievementDefinition, event: AchievementEvent): Promise<void> {
    if (event.type === "task_rejected" && event.memberId) {
      const achievementMember = await storage.getOrCreateAchievementMember(event.familyName, event.memberId);
      await storage.updateAchievementMember(achievementMember.id, {
        weeklyRejectionCount: achievementMember.weeklyRejectionCount + 1,
      });
    } else if (event.type === "midnight_reset") {
      const members = await storage.getFamilyMembersByFamily(event.familyName);

      for (const member of members) {
        const achievementMember = await storage.getOrCreateAchievementMember(event.familyName, member.id);
        
        const hasTasks = achievementMember.weeklyCompletionCount > 0;
        const noRejections = achievementMember.weeklyRejectionCount === 0;

        if (hasTasks && noRejections) {
          await storage.awardAchievement(definition.id, member.id, definition.bonusPoints);
          console.log(`⭐ ${member.displayName} earned "${definition.title}" - Perfect week! (+${definition.bonusPoints} points)`);
          
          broadcastToFamily(event.familyName, {
            type: "achievement_earned",
            memberId: member.id,
            memberName: member.displayName,
            achievementTitle: definition.title,
            bonusPoints: definition.bonusPoints,
          });
          
          // Create notification for parents
          await createAchievementNotification(
            event.familyName,
            member.displayName,
            definition.title,
            definition.bonusPoints,
            member.id
          );
        }
      }
    }
  }

  private async evaluateLifetimeMilestone(definition: AchievementDefinition, event: AchievementEvent): Promise<void> {
    if (event.type !== "task_approved" || !event.memberId) return;

    const member = await storage.getFamilyMember(event.memberId);
    if (!member) return;

    const config = definition.config as { threshold: number };
    const threshold = config.threshold || 100;

    const previousTotal = member.totalEarned - (event.pointsEarned || 0);
    const crossedThreshold = previousTotal < threshold && member.totalEarned >= threshold;

    if (crossedThreshold) {
      const existingAwards = await storage.getAchievementAwardsByMember(event.memberId);
      const alreadyAwarded = existingAwards.some(award => award.achievementDefinitionId === definition.id);

      if (!alreadyAwarded) {
        await storage.awardAchievement(definition.id, event.memberId, definition.bonusPoints);
        console.log(`🎯 ${member.displayName} earned "${definition.title}" - ${threshold} lifetime points! (+${definition.bonusPoints} points)`);
        
        broadcastToFamily(event.familyName, {
          type: "achievement_earned",
          memberId: event.memberId,
          memberName: member.displayName,
          achievementTitle: definition.title,
          bonusPoints: definition.bonusPoints,
        });
        
        // Create notification for parents
        await createAchievementNotification(
          event.familyName,
          member.displayName,
          definition.title,
          definition.bonusPoints,
          event.memberId
        );
      }
    }
  }

  private async evaluateTaskStreak(definition: AchievementDefinition, event: AchievementEvent): Promise<void> {
    if (event.type === "daily_check") {
      const members = await storage.getFamilyMembersByFamily(event.familyName);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      for (const member of members) {
        const achievementMember = await storage.getOrCreateAchievementMember(event.familyName, member.id);
        
        const completionsToday = await storage.getTaskCompletionsByMember(member.id);
        const todayCompletions = completionsToday.filter(completion => {
          if (!completion.completedAt) return false;
          const completedDate = new Date(completion.completedAt);
          completedDate.setHours(0, 0, 0, 0);
          return completedDate.getTime() === today.getTime() && completion.status === "approved";
        });

        if (todayCompletions.length > 0) {
          let newStreak = 1;

          if (achievementMember.lastStreakDate) {
            const lastStreakDate = new Date(achievementMember.lastStreakDate);
            lastStreakDate.setHours(0, 0, 0, 0);

            if (lastStreakDate.getTime() === yesterday.getTime()) {
              newStreak = achievementMember.consecutiveDaysStreak + 1;
            }
          }

          await storage.updateAchievementMember(achievementMember.id, {
            consecutiveDaysStreak: newStreak,
            lastStreakDate: today,
          });

          const config = definition.config as { days?: number; threshold?: number };
          const threshold = config.days ?? config.threshold ?? 7;

          if (newStreak === threshold) {
            await storage.awardAchievement(definition.id, member.id, definition.bonusPoints);
            console.log(`🔥 ${member.displayName} earned "${definition.title}" - ${threshold} day streak! (+${definition.bonusPoints} points)`);
            
            broadcastToFamily(event.familyName, {
              type: "achievement_earned",
              memberId: member.id,
              memberName: member.displayName,
              achievementTitle: definition.title,
              bonusPoints: definition.bonusPoints,
            });
            
            // Create notification for parents
            await createAchievementNotification(
              event.familyName,
              member.displayName,
              definition.title,
              definition.bonusPoints,
              member.id
            );
          }
        } else {
          if (achievementMember.lastStreakDate) {
            const lastStreakDate = new Date(achievementMember.lastStreakDate);
            lastStreakDate.setHours(0, 0, 0, 0);

            if (lastStreakDate.getTime() < yesterday.getTime()) {
              await storage.updateAchievementMember(achievementMember.id, {
                consecutiveDaysStreak: 0,
                lastStreakDate: null,
              });
            }
          }
        }
      }
    }
  }
}

export const achievementEngine = new AchievementEngine();
