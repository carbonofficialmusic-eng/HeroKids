import { useEffect, useRef, useCallback } from "react";
import { queryClient } from "@/lib/queryClient";

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
              // Invalidate tasks and family members to refetch
              queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
              queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
              break;

            case "reward_created":
            case "reward_updated":
            case "reward_deleted":
              queryClient.invalidateQueries({ queryKey: ["/api/rewards"] });
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
              queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
              queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
              queryClient.invalidateQueries({ queryKey: ["/api/family-members/real"] });
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
