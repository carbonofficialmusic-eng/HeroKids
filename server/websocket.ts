import { WebSocket } from "ws";

// WebSocket connection management
export const wsClients = new Map<string, Set<WebSocket>>();

export function broadcastToFamily(familyName: string, message: any) {
  const clients = wsClients.get(familyName);
  if (clients) {
    const messageStr = JSON.stringify(message);
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }
}
