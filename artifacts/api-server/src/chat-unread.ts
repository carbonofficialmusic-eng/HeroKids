export type IncomingChatMessage = {
  createdAt: Date | null;
  memberId: string;
  isTargeted: boolean;
};

export function calculateConversationUnreadCounts(
  messages: IncomingChatMessage[],
  legacyReadAt: Date,
  readAtByConversation: Map<string, Date>,
): Record<string, number> {
  const conversations: Record<string, number> = {};

  for (const message of messages) {
    const conversationKey = message.isTargeted ? message.memberId : "all";
    const threadReadAt = readAtByConversation.get(conversationKey) || legacyReadAt;
    if (message.createdAt && message.createdAt > threadReadAt) {
      conversations[conversationKey] = (conversations[conversationKey] || 0) + 1;
    }
  }

  return conversations;
}