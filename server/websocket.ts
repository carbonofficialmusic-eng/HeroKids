import { WebSocket } from "ws";

// WebSocket connection management
export type FamilyWebSocketClient = {
  ws: WebSocket;
  memberId: string;
  role: "parent" | "child";
};

export const wsClients = new Map<string, Set<FamilyWebSocketClient>>();

export function broadcastToFamily(familyName: string, message: any) {
  const clients = wsClients.get(familyName);
  if (clients) {
    const messageStr = JSON.stringify(message);
    clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(messageStr);
      }
    });
  }
}

export function broadcastToFamilyMembers(
  familyName: string,
  message: any,
  predicate: (client: FamilyWebSocketClient) => boolean,
) {
  const clients = wsClients.get(familyName);
  if (!clients) return;
  const messageStr = JSON.stringify(message);
  clients.forEach((client) => {
    if (predicate(client) && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(messageStr);
    }
  });
}
