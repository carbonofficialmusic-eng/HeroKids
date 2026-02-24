import { storage } from "./storage";
import { achievementEngine } from "./achievementEngine";
import type { Family } from "@shared/schema";
import { formatInTimeZone } from "date-fns-tz";

export function startPointsResetScheduler() {
  const startTime = new Date();
  console.log(`Points reset scheduler started at ${startTime.toISOString()}`);
  console.log(`Server timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
  console.log(`Scheduler will check each family's timezone for midnight resets (every 5 minutes)`);
  
  // Check every 5 minutes for point resets (more accurate timing near midnight)
  setInterval(async () => {
    await checkAndResetPoints();
  }, 5 * 60 * 1000); // Check every 5 minutes
}

async function checkAndResetPoints() {
  try {
    const families = await storage.getFamilies();
    
    for (const family of families) {
      await checkAndResetFamily(family);
    }
  } catch (error) {
    console.error("Error checking and resetting points:", error);
  }
}

// Get period identifier strings in family's timezone
function getCurrentPeriods(now: Date, timezone: string): {
  day: string;       // "2024-12-01"
  week: string;      // "2024-W49"
  month: string;     // "2024-12"
  hour: number;      // 0-23
  dayOfWeek: number; // 1=Monday, 7=Sunday
  dayOfMonth: number; // 1-31
} {
  return {
    day: formatInTimeZone(now, timezone, 'yyyy-MM-dd'),
    week: formatInTimeZone(now, timezone, "RRRR-'W'II"),
    month: formatInTimeZone(now, timezone, 'yyyy-MM'),
    hour: parseInt(formatInTimeZone(now, timezone, 'H'), 10),
    dayOfWeek: parseInt(formatInTimeZone(now, timezone, 'i'), 10), // 1=Monday, 7=Sunday (ISO)
    dayOfMonth: parseInt(formatInTimeZone(now, timezone, 'd'), 10),
  };
}

// Get period from a timestamp in family's timezone (for migration from old timestamps)
function getPeriodFromTimestamp(timestamp: Date | null, timezone: string): {
  day: string | null;
  week: string | null;
  month: string | null;
} {
  if (!timestamp) return { day: null, week: null, month: null };
  return {
    day: formatInTimeZone(timestamp, timezone, 'yyyy-MM-dd'),
    week: formatInTimeZone(timestamp, timezone, "RRRR-'W'II"),
    month: formatInTimeZone(timestamp, timezone, 'yyyy-MM'),
  };
}

async function checkAndResetFamily(family: Family) {
  const familyTimezone = family.timezone || "Europe/Berlin";
  const now = new Date();
  
  // Get current period identifiers in family's timezone
  const current = getCurrentPeriods(now, familyTimezone);
  
  // Format for logging
  const familyTimeString = formatInTimeZone(now, familyTimezone, "EEEE, yyyy-MM-dd HH:mm");
  
  // Get stored period strings
  let lastDailyPeriod = family.lastDailyPeriod;
  let lastWeeklyPeriod = family.lastWeeklyPeriod;
  let lastMonthlyPeriod = family.lastMonthlyPeriod;
  
  // If ANY period strings are null, initialize them and skip resets for this tick
  // This prevents immediate resets after migration/deployment
  const needsPeriodInit = !lastDailyPeriod || !lastWeeklyPeriod || !lastMonthlyPeriod;
  if (needsPeriodInit) {
    const fromTimestamps = {
      daily: getPeriodFromTimestamp(family.lastDailyReset, familyTimezone),
      weekly: getPeriodFromTimestamp(family.lastWeeklyReset, familyTimezone),
      monthly: getPeriodFromTimestamp(family.lastMonthlyReset, familyTimezone),
    };
    
    // Initialize from timestamps if available, otherwise set to current period
    const initDailyPeriod = lastDailyPeriod || fromTimestamps.daily.day || current.day;
    const initWeeklyPeriod = lastWeeklyPeriod || fromTimestamps.weekly.week || current.week;
    const initMonthlyPeriod = lastMonthlyPeriod || fromTimestamps.monthly.month || current.month;
    
    // Persist the initialized periods
    console.log(`📝 Initializing period strings for family "${family.familyName}": daily=${initDailyPeriod}, weekly=${initWeeklyPeriod}, monthly=${initMonthlyPeriod}`);
    await storage.updateFamily(family.familyName, {
      lastDailyPeriod: initDailyPeriod,
      lastWeeklyPeriod: initWeeklyPeriod,
      lastMonthlyPeriod: initMonthlyPeriod,
    });
    
    // Skip reset checks for this tick - we just initialized, don't reset immediately
    return;
  }
  
  // Check for weekly reset - ONLY on Monday (dayOfWeek=1) and if different week
  const isMonday = current.dayOfWeek === 1;
  const needsWeeklyReset = isMonday && lastWeeklyPeriod !== current.week;
  
  if (needsWeeklyReset) {
    console.log(`⏰ Running weekly reset for family "${family.familyName}" at ${familyTimeString} (${familyTimezone}) [Week ${current.week} vs stored ${lastWeeklyPeriod}]`);
    await resetWeeklyPointsForFamily(family.familyName);
    await storage.updateFamily(family.familyName, { 
      lastWeeklyReset: now,
      lastWeeklyPeriod: current.week 
    });
    // Update local variable for consistency in subsequent checks
    lastWeeklyPeriod = current.week;
  }
  
  // Check for monthly reset - ONLY on day 1 and if different month
  const isFirstOfMonth = current.dayOfMonth === 1;
  const needsMonthlyReset = isFirstOfMonth && lastMonthlyPeriod !== current.month;
  
  if (needsMonthlyReset) {
    console.log(`⏰ Running monthly reset for family "${family.familyName}" at ${familyTimeString} (${familyTimezone}) [Month ${current.month} vs stored ${lastMonthlyPeriod}]`);
    await resetMonthlyPointsForFamily(family.familyName);
    await storage.updateFamily(family.familyName, { 
      lastMonthlyReset: now,
      lastMonthlyPeriod: current.month 
    });
    // Update local variable for consistency
    lastMonthlyPeriod = current.month;
  }
  
  // Check for daily reset - run if we're in a different day
  const needsDailyReset = lastDailyPeriod !== current.day;
  
  if (needsDailyReset) {
    const isNearMidnight = current.hour === 0; // Between 00:00 and 00:59
    const isSafeForLateReset = current.hour >= 2; // After 02:00 (safe time after early morning completions)
    
    // Run reset if:
    // 1. Ideally: Between 00:00-01:00 (near midnight)
    // 2. Fallback: After 02:00 if reset wasn't executed yet (e.g., due to server downtime)
    if (isNearMidnight || isSafeForLateReset) {
      console.log(`⏰ Running daily reset for family "${family.familyName}" at ${familyTimeString} (${familyTimezone}) [Day ${current.day} vs stored ${lastDailyPeriod}]`);
      await resetDailyTasksForFamily(family.familyName);
      await expireOverdueTasks(family.familyName, familyTimezone);
      await runDailyAchievementCheckForFamily(family.familyName);
      await storage.updateFamily(family.familyName, { 
        lastDailyReset: now,
        lastDailyPeriod: current.day 
      });
      // Update local variable for consistency
      lastDailyPeriod = current.day;
    } else {
      console.log(`⏭️  Waiting for safe reset time for family "${family.familyName}" (current hour: ${current.hour}, will reset at 02:00 or later)`);
    }
  }
}

async function expireOverdueTasks(familyName: string, familyTimezone: string) {
  try {
    const todayStr = formatInTimeZone(new Date(), familyTimezone, "yyyy-MM-dd");
    const allTasks = await storage.getTasksByFamily(familyName);
    
    const expiredTasks = allTasks.filter(task => {
      if (!task.dueDate || task.recurrence !== "none" || task.status !== "active") return false;
      const dueDateStr = String(task.dueDate).substring(0, 10);
      const dueMs = new Date(dueDateStr + "T00:00:00").getTime();
      const todayMs = new Date(todayStr + "T00:00:00").getTime();
      const daysPastDue = Math.floor((todayMs - dueMs) / (1000 * 60 * 60 * 24));
      return daysPastDue > 3;
    });
    
    if (expiredTasks.length === 0) return;
    
    const family = await storage.getFamily(familyName);
    const lang = family?.language || "en";
    
    const { translateNotification } = await import("./routes");
    
    for (const task of expiredTasks) {
      await storage.updateTaskStatus(task.id, "completed");
      
      await storage.createNotificationForParents(familyName, {
        familyName,
        type: "task_expired",
        title: translateNotification(lang, "task_expired.title"),
        message: translateNotification(lang, "task_expired.message", { task: task.title }),
        relatedTaskId: task.id,
      });
      
      console.log(`⏰ Expired task "${task.title}" for family "${familyName}" (due: ${String(task.dueDate).substring(0, 10)})`);
    }
    
    console.log(`✅ ${expiredTasks.length} overdue task(s) expired for family "${familyName}"`);
  } catch (error) {
    console.error(`Error expiring overdue tasks for family "${familyName}":`, error);
  }
}

async function resetDailyTasksForFamily(familyName: string) {
  try {
    await storage.resetDailyTasksForFamily(familyName);
    console.log(`✅ Daily tasks reset for family "${familyName}"`);
  } catch (error) {
    console.error(`Error resetting daily tasks for family "${familyName}":`, error);
  }
}

async function runDailyAchievementCheckForFamily(familyName: string) {
  try {
    await achievementEngine.processEvent({
      type: "daily_check",
      familyName,
    });
    console.log(`✅ Daily achievement check completed for family "${familyName}"`);
  } catch (error) {
    console.error(`Error running daily achievement check for family "${familyName}":`, error);
  }
}

async function resetWeeklyPointsForFamily(familyName: string) {
  try {
    await storage.resetWeeklyPointsForFamily(familyName);
    console.log(`✅ Weekly points reset for family "${familyName}"`);
    
    // First: Calculate and award achievements (Perfect Week, Weekly Leader) 
    // using the current week's data
    await achievementEngine.processEvent({
      type: "midnight_reset",
      familyName,
    });
    
    // Then: Reset the weekly achievement counters for the new week
    await storage.resetWeeklyAchievements(familyName);
    console.log(`✅ Weekly achievement counters reset for family "${familyName}"`);
  } catch (error) {
    console.error(`Error resetting weekly points for family "${familyName}":`, error);
  }
}

async function resetMonthlyPointsForFamily(familyName: string) {
  try {
    await storage.resetMonthlyPointsForFamily(familyName);
    console.log(`✅ Monthly points reset for family "${familyName}"`);
  } catch (error) {
    console.error(`Error resetting monthly points for family "${familyName}":`, error);
  }
}
