import { useEffect, useRef, useCallback } from "react";
import { queryClient } from "@/lib/queryClient";
import confetti from "canvas-confetti";

export function useWebSocket(familyName: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!familyName) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected");
        // Join family room
        ws.send(JSON.stringify({ type: "join_family", familyName }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case "task_created":
            case "task_updated":
            case "task_completed":
            case "task_completion_pending":
            case "task_completion_approved":
            case "task_completion_rejected":
            case "task_deleted":
              // Invalidate tasks and family members to refetch
              queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
              queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
              break;

            case "reward_created":
            case "reward_updated":
            case "reward_deleted":
              queryClient.invalidateQueries({ queryKey: ["/api/rewards"] });
              break;

            case "reward_request_created":
            case "reward_request_updated":
              queryClient.invalidateQueries({ queryKey: ["/api/reward-requests"] });
              break;

            case "reward_redeemed":
            case "redemption_updated":
              // Invalidate family members (points changed) and reward redemptions
              queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
              queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
              queryClient.invalidateQueries({ queryKey: ["/api/reward-redemptions"] });
              break;

            case "member_joined":
            case "member_updated":
            case "member_deleted":
              queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
              queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
              queryClient.invalidateQueries({ queryKey: ["/api/family-members/real"] });
              break;

            case "settings_updated":
              // Invalidate family settings and current family data
              queryClient.invalidateQueries({ queryKey: ["/api/families/settings"] });
              queryClient.invalidateQueries({ queryKey: ["/api/families/current"] });
              break;

            case "skin_changed":
              // Invalidate family members and current member to update backgrounds
              queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
              queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
              queryClient.invalidateQueries({ queryKey: ["/api/skins"] });
              break;

            case "skin_discovered":
              // Invalidate skins and family members (points changed if bonus awarded)
              queryClient.invalidateQueries({ queryKey: ["/api/skins"] });
              queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
              queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
              break;

            case "chat_message":
              // Invalidate chat messages to show new message
              queryClient.invalidateQueries({ queryKey: ["/api/chat"] });
              break;

            case "achievement_earned":
              // Invalidate queries to refresh data
              queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
              queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
              queryClient.invalidateQueries({ queryKey: ["/api/achievements/awards"] });
              
              // Trigger confetti celebration
              {
                const duration = 3000;
                const animationEnd = Date.now() + duration;
                const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };
                const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

                const interval: any = setInterval(() => {
                  const timeLeft = animationEnd - Date.now();

                  if (timeLeft <= 0) {
                    return clearInterval(interval);
                  }

                  const particleCount = 50 * (timeLeft / duration);
                  
                  confetti({
                    ...defaults,
                    particleCount,
                    origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
                  });
                  confetti({
                    ...defaults,
                    particleCount,
                    origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
                  });
                }, 250);
                
                console.log(`🎉 ${data.memberName} earned "${data.achievementTitle}" (+${data.bonusPoints} points)!`);
              }
              break;

            case "achievement_created":
            case "achievement_updated":
            case "achievement_deleted":
              queryClient.invalidateQueries({ queryKey: ["/api/achievements"] });
              break;

            default:
              console.log("Unknown WebSocket message type:", data.type);
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected, reconnecting in 3s...");
        wsRef.current = null;
        
        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };
    } catch (error) {
      console.error("Error creating WebSocket connection:", error);
    }
  }, [familyName]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return wsRef;
}
