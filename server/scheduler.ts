import { storage } from "./storage";
import { achievementEngine } from "./achievementEngine";

// Track last reset dates to prevent duplicate resets
// Initialize to epoch (far in the past) so first check always triggers
let lastWeeklyReset = new Date(0);
let lastMonthlyReset = new Date(0);
let lastDailyCheck = new Date(0);

export function startPointsResetScheduler() {
  // Log initial timezone info
  const startTime = new Date();
  console.log(`Points reset scheduler started at ${startTime.toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })} (German Time)`);
  console.log(`Server timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
  
  // Check every hour for point resets
  setInterval(async () => {
    const now = new Date();
    const germanTime = now.toLocaleString('de-DE', { timeZone: 'Europe/Berlin', hour12: false });
    
    // Weekly reset - every Monday at 00:00
    const isMonday = now.getDay() === 1;
    const isSameWeek = 
      lastWeeklyReset.getFullYear() === now.getFullYear() &&
      getWeekNumber(lastWeeklyReset) === getWeekNumber(now);
    
    if (isMonday && !isSameWeek) {
      console.log(`⏰ Running weekly points reset at ${germanTime} (German Time)`);
      await resetWeeklyPoints();
      lastWeeklyReset = now;
    }
    
    // Monthly reset - 1st of each month at 00:00
    const isFirstOfMonth = now.getDate() === 1;
    const isSameMonth =
      lastMonthlyReset.getMonth() === now.getMonth() &&
      lastMonthlyReset.getFullYear() === now.getFullYear();
    
    if (isFirstOfMonth && !isSameMonth) {
      console.log(`⏰ Running monthly points reset at ${germanTime} (German Time)`);
      await resetMonthlyPoints();
      lastMonthlyReset = now;
    }
    
    // Daily check for streak tracking and recurring task resets
    const isSameDay =
      lastDailyCheck.getDate() === now.getDate() &&
      lastDailyCheck.getMonth() === now.getMonth() &&
      lastDailyCheck.getFullYear() === now.getFullYear();
    
    if (!isSameDay) {
      console.log(`⏰ Running daily reset at ${germanTime} (German Time)`);
      console.log(`   Date: ${now.getDate()}.${now.getMonth() + 1}.${now.getFullYear()}`);
      await runDailyAchievementCheck();
      lastDailyCheck = now;
    }
  }, 60 * 60 * 1000); // Check every hour
}

async function runDailyAchievementCheck() {
  try {
    const families = await storage.getFamilies();
    for (const family of families) {
      await achievementEngine.processEvent({
        type: "daily_check",
        familyName: family.familyName,
      });
    }
    console.log("✅ Daily achievement check completed");
  } catch (error) {
    console.error("Error running daily achievement check:", error);
  }
}

async function resetWeeklyPoints() {
  try {
    await storage.resetAllWeeklyPoints();
    console.log("✅ Weekly points have been reset for all family members");
    
    // Trigger achievement evaluations for all families
    const families = await storage.getFamilies();
    for (const family of families) {
      await achievementEngine.processEvent({
        type: "midnight_reset",
        familyName: family.familyName,
      });
    }
  } catch (error) {
    console.error("Error resetting weekly points:", error);
  }
}

async function resetMonthlyPoints() {
  try {
    await storage.resetAllMonthlyPoints();
    console.log("✅ Monthly points have been reset for all family members");
  } catch (error) {
    console.error("Error resetting monthly points:", error);
  }
}

// Helper function to get week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
