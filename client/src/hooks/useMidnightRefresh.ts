import { useEffect, useRef } from "react";
import { queryClient } from "@/lib/queryClient";

/**
 * Custom hook that automatically refreshes tasks at midnight
 * to unlock recurring tasks that have become available.
 */
export function useMidnightRefresh() {
  const timerIdRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    /**
     * Calculate milliseconds until next midnight (local time)
     */
    function getMillisecondsUntilMidnight(): number {
      const now = new Date();
      const nextMidnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1, // Next day
        0, 0, 0, 0 // Midnight: 00:00:00.000
      );
      return nextMidnight.getTime() - now.getTime();
    }

    /**
     * Refresh tasks by invalidating the query cache
     */
    function refreshTasks() {
      console.log("🕛 Midnight reached - refreshing tasks...");
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    }

    /**
     * Set up the next midnight timer
     */
    function setupMidnightTimer() {
      // Clear any existing timer before setting a new one
      if (timerIdRef.current) {
        clearTimeout(timerIdRef.current);
      }

      const msUntilMidnight = getMillisecondsUntilMidnight();
      console.log(`⏰ Next task refresh scheduled in ${Math.round(msUntilMidnight / 1000 / 60)} minutes (at midnight)`);

      timerIdRef.current = setTimeout(() => {
        refreshTasks();
        // After refreshing, schedule the next midnight
        setupMidnightTimer();
      }, msUntilMidnight);
    }

    // Initial setup
    setupMidnightTimer();

    // Cleanup on unmount - clear the current timer
    return () => {
      if (timerIdRef.current) {
        clearTimeout(timerIdRef.current);
        timerIdRef.current = null;
      }
    };
  }, []);
}
