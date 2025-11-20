import { storage } from "./storage";
import { achievementEngine } from "./achievementEngine";

// Track last reset dates PER FAMILY to prevent duplicate resets
// Map: familyName -> { weekly, monthly, daily }
const lastResetByFamily: Map<string, {
  weekly: Date;
  monthly: Date;
  daily: Date;
}> = new Map();

export function startPointsResetScheduler() {
  const startTime = new Date();
  console.log(`Points reset scheduler started at ${startTime.toISOString()}`);
  console.log(`Server timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
  console.log(`Scheduler will check each family's timezone for midnight resets`);
  
  // Check every hour for point resets
  setInterval(async () => {
    await checkAndResetPoints();
  }, 60 * 60 * 1000); // Check every hour
}

async function checkAndResetPoints() {
  try {
    const families = await storage.getFamilies();
    
    for (const family of families) {
      const familyTimezone = family.timezone || "Europe/Berlin"; // Default to Berlin if not set
      
      // Initialize tracking for this family if not exists
      if (!lastResetByFamily.has(family.familyName)) {
        lastResetByFamily.set(family.familyName, {
          weekly: new Date(0),
          monthly: new Date(0),
          daily: new Date(0),
        });
      }
      
      const familyResets = lastResetByFamily.get(family.familyName)!;
      
      // Get current time in family's timezone
      const now = new Date();
      const familyTimeString = now.toLocaleString('en-US', { 
        timeZone: familyTimezone,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'long'
      });
      
      // Parse the family's local date/time
      const familyDate = new Date(now.toLocaleString('en-US', { timeZone: familyTimezone }));
      
      // Check for weekly reset (Monday in family's timezone)
      const isMonday = familyDate.getDay() === 1;
      const weekNumber = getWeekNumber(familyDate);
      const lastWeeklyWeekNumber = getWeekNumber(familyResets.weekly);
      const isSameWeek = 
        familyResets.weekly.getFullYear() === familyDate.getFullYear() &&
        lastWeeklyWeekNumber === weekNumber;
      
      if (isMonday && !isSameWeek) {
        console.log(`⏰ Running weekly reset for family "${family.familyName}" at ${familyTimeString} (${familyTimezone})`);
        await resetWeeklyPointsForFamily(family.familyName);
        familyResets.weekly = familyDate; // Store family's local date, not server time
      }
      
      // Check for monthly reset (1st of month in family's timezone)
      const isFirstOfMonth = familyDate.getDate() === 1;
      const isSameMonth =
        familyResets.monthly.getMonth() === familyDate.getMonth() &&
        familyResets.monthly.getFullYear() === familyDate.getFullYear();
      
      if (isFirstOfMonth && !isSameMonth) {
        console.log(`⏰ Running monthly reset for family "${family.familyName}" at ${familyTimeString} (${familyTimezone})`);
        await resetMonthlyPointsForFamily(family.familyName);
        familyResets.monthly = familyDate; // Store family's local date, not server time
      }
      
      // Check for daily reset (new day in family's timezone)
      const isSameDay =
        familyResets.daily.getDate() === familyDate.getDate() &&
        familyResets.daily.getMonth() === familyDate.getMonth() &&
        familyResets.daily.getFullYear() === familyDate.getFullYear();
      
      if (!isSameDay) {
        console.log(`⏰ Running daily reset for family "${family.familyName}" at ${familyTimeString} (${familyTimezone})`);
        await resetDailyTasksForFamily(family.familyName);
        await runDailyAchievementCheckForFamily(family.familyName);
        familyResets.daily = familyDate; // Store family's local date, not server time
      }
    }
  } catch (error) {
    console.error("Error checking and resetting points:", error);
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
    
    await achievementEngine.processEvent({
      type: "midnight_reset",
      familyName,
    });
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

// Helper function to get week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
