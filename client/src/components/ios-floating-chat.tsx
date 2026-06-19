import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Send, MessageCircle, EyeOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { isNativePlatform } from "@/lib/platform";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { hasFeature } from "@shared/tier-config";
import type { SubscriptionTier } from "@shared/tier-config";
import { EmoticonPicker } from "@/components/emoticon-picker";
import { MessageRenderer } from "@/components/message-renderer";
import { useToast } from "@/hooks/use-toast";

interface ChatMessage {
  id: string;
  message: string;
  createdAt: Date;
  memberId: string;
  memberName: string;
  memberColor: string;
  memberAvatarUrl: string | null;
  memberActiveSkinId: string | null;
}

interface IosFloatingChatProps {
  subscriptionTier: string | undefined;
  trialEndsAt?: string | null;
  memberId?: string | null;
}

export function IosFloatingChat({ subscriptionTier, trialEndsAt, memberId }: IosFloatingChatProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [messageText, setMessageText] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isOnTrial = !!(trialEndsAt && new Date(trialEndsAt) > new Date());
  const hasChatFeature = hasFeature(subscriptionTier as SubscriptionTier || "free", "familyChat") || isOnTrial;

  const { data: member } = useQuery<any>({
    queryKey: ["/api/family-members/current"],
    staleTime: 5 * 60 * 1000,
  });

  const { data: realMember } = useQuery<any>({
    queryKey: ["/api/family-members/real"],
    staleTime: 5 * 60 * 1000,
  });

  const isActingAs = !!(member && realMember && member.id !== realMember.id);

  const { data: messages = [] } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat"],
    enabled: isOpen && hasChatFeature,
    refetchInterval: isOpen ? 5000 : false,
    staleTime: 5 * 60 * 1000,
  });

  const { data: unreadChatData } = useQuery<{ count: number }>({
    queryKey: ["/api/chat/unread-count"],
    enabled: hasChatFeature,
    refetchInterval: 15000,
    staleTime: 30 * 1000,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/chat/mark-read", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/unread-count"] });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      return await apiRequest("POST", "/api/chat", { message });
    },
    onSuccess: () => {
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ["/api/chat"] });
      setTimeout(scrollToBottom, 100);
    },
    onError: (error: any) => {
      toast({
        title: t("chat.failedToSend"),
        description: error.message || t("errors.tryAgain"),
        variant: "destructive",
      });
    },
  });

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]");
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
        return;
      }
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(scrollToBottom, 150);
      markAsReadMutation.mutate();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && messages.length > 0) {
      scrollToBottom();
    }
  }, [messages.length, isOpen]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || sendMessageMutation.isPending) return;
    sendMessageMutation.mutate(messageText.trim());
  };

  const handleSelectEmoticon = (emoticon: string) => {
    setMessageText((prev) => prev + emoticon + " ");
  };

  const unreadCount = unreadChatData?.count ?? 0;

  if (!isNativePlatform() || !hasChatFeature) return null;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="chat-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[998] bg-black/20 backdrop-blur-[1px]"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="chat-panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed top-0 right-0 bottom-0 z-[999] flex flex-col bg-background shadow-2xl"
            style={{
              width: "min(85vw, 360px)",
              paddingTop: "max(1rem, env(safe-area-inset-top))",
              paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))",
              paddingRight: "max(0.75rem, env(safe-area-inset-right))",
              paddingLeft: "0.75rem",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3 shrink-0">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-primary" />
                <span className="font-bold text-base" style={{ fontFamily: "Fredoka, sans-serif" }}>
                  {t("chat.title")}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                data-testid="button-close-ios-chat"
                aria-label={t("common.close", "Schließen")}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <ScrollArea className="flex-1 min-h-0 pr-1" ref={scrollAreaRef}>
              <div className="space-y-3 pb-2" data-testid="ios-chat-messages">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-2">
                    <MessageCircle className="w-10 h-10 opacity-30" />
                    <p className="text-sm">{t("chat.noMessagesStart")}</p>
                  </div>
                ) : (
                  messages.map((msg, index) => (
                    <div
                      key={msg.id}
                      className="flex gap-2 items-start"
                      data-testid={`ios-chat-message-${index}`}
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5"
                        style={{ backgroundColor: msg.memberColor }}
                      >
                        {msg.memberName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-1.5 mb-0.5">
                          <span className="font-semibold text-xs">
                            {msg.memberName}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(msg.createdAt), "HH:mm")}
                          </span>
                        </div>
                        <div className="text-sm break-words leading-snug">
                          <MessageRenderer message={msg.message} />
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="shrink-0 border-t pt-2 mt-1">
              {isActingAs ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                  <EyeOff className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>
                    {t("chat.readOnlyActingAs", { name: member?.displayName ?? "" })}
                  </span>
                </div>
              ) : (
                <form onSubmit={handleSend} className="flex gap-1.5 items-center" data-testid="form-ios-send-message">
                  <EmoticonPicker onSelectEmoticon={handleSelectEmoticon} />
                  <Input
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder={t("chat.typeMessage")}
                    maxLength={1000}
                    disabled={sendMessageMutation.isPending}
                    className="flex-1 h-9 text-sm"
                    data-testid="input-ios-message"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!messageText.trim() || sendMessageMutation.isPending}
                    data-testid="button-ios-send-message"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="fixed z-[997]"
        style={{
          right: 0,
          top: "50%",
          transform: "translateY(-50%)",
          paddingRight: 0,
        }}
        animate={{ x: isOpen ? "-min(85vw, 360px)" : 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
      >
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          data-testid="button-ios-chat-tab"
          aria-label={isOpen ? t("chat.closeChat", "Chat schließen") : t("chat.openChat", "Chat öffnen")}
          className="relative flex items-center justify-center rounded-l-full bg-primary text-primary-foreground shadow-lg active:brightness-90"
          style={{
            width: 36,
            height: 64,
            borderTopRightRadius: 0,
            borderBottomRightRadius: 0,
          }}
        >
          {isOpen ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <ChevronLeft className="w-5 h-5" />
          )}

          {!isOpen && unreadCount > 0 && (
            <span
              className="absolute -top-1.5 -left-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none"
              data-testid="badge-ios-chat-unread"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </motion.div>
    </>
  );
}
