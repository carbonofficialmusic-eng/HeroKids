import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Lock, MessageCircle, ArrowLeft, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Link } from "wouter";
import { EmoticonPicker } from "@/components/emoticon-picker";
import { MessageRenderer } from "@/components/message-renderer";

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

export default function Chat() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [messageText, setMessageText] = useState("");
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Use member query directly - works for both Replit Auth and Device Sessions
  const { data: member, isLoading: memberLoading } = useQuery<any>({
    queryKey: ["/api/family-members/current"],
    staleTime: 5 * 60 * 1000,
  });

  // Real (non-acting-as) member — to detect if we're acting as someone else
  const { data: realMember } = useQuery<any>({
    queryKey: ["/api/family-members/real"],
    staleTime: 5 * 60 * 1000,
  });

  // True when a parent has switched into a child's profile
  const isActingAs = !!(member && realMember && member.id !== realMember.id);

  const { data: messages = [], isLoading, error } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat"],
    enabled: !!member, // Enable when member is loaded (works for Device Sessions)
    refetchInterval: 5000, // Refetch every 5 seconds as fallback
    staleTime: 5 * 60 * 1000,
  });

  const isChild = member?.role === "child";
  const dashboardUrl = isChild ? "/kid-dashboard" : "/dashboard";

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      return await apiRequest("POST", "/api/chat", { message });
    },
    onSuccess: () => {
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ["/api/chat"] });
      // Scroll to bottom after sending
      setTimeout(scrollToBottom, 100);
    },
    onError: (error: any) => {
      toast({
        title: t('chat.failedToSend'),
        description: error.message || t('errors.tryAgain'),
        variant: "destructive",
      });
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/chat/mark-read", {});
    },
    onSuccess: () => {
      // Invalidate unread count query
      queryClient.invalidateQueries({ queryKey: ["/api/chat/unread-count"] });
    },
  });

  const scrollToBottom = () => {
    // Scroll the ScrollArea viewport directly to avoid affecting window scroll
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
        return;
      }
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Push the chat above the on-screen keyboard using the visualViewport API.
  // Works in iOS WKWebView where the keyboard overlays fixed-position layouts.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const onViewportChange = () => {
      // Keyboard height = layout viewport bottom minus visual viewport bottom
      const offset = Math.max(0, window.innerHeight - vv.offsetTop - vv.height);
      setKeyboardOffset(offset);
      if (offset > 50) {
        // Keyboard just opened — make sure the latest message is visible
        setTimeout(scrollToBottom, 80);
      }
    };

    vv.addEventListener("resize", onViewportChange);
    vv.addEventListener("scroll", onViewportChange);
    return () => {
      vv.removeEventListener("resize", onViewportChange);
      vv.removeEventListener("scroll", onViewportChange);
    };
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Mark messages as read when user views chat
  useEffect(() => {
    if (messages.length > 0 && !isLoading) {
      markAsReadMutation.mutate();
    }
  }, [messages.length, isLoading]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || sendMessageMutation.isPending) return;
    sendMessageMutation.mutate(messageText.trim());
  };

  const handleSelectEmoticon = (emoticon: string) => {
    setMessageText((prev) => prev + emoticon + " ");
  };

  const safeTopStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    bottom: keyboardOffset > 0 ? `${keyboardOffset}px` : 0,
    paddingTop: 'max(1rem, env(safe-area-inset-top))',
  };
  const backBtn = (
    <Link href={dashboardUrl}>
      <Button
        variant="outline"
        size="sm"
        className="bg-background/30 backdrop-blur-sm border-border/40 hover:bg-background/60"
        data-testid="button-back-to-dashboard"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        {t('settings.backToDashboard')}
      </Button>
    </Link>
  );

  if (isLoading || memberLoading) {
    return (
      <div className="p-4 flex flex-col" style={safeTopStyle}>
        <div className="flex items-center gap-3 mb-4 shrink-0">
          {backBtn}
          <h1 className="text-2xl font-bold">{t('chat.title')}</h1>
        </div>
        <div className="flex items-center justify-center flex-1" data-testid="loading-chat">
          <div className="animate-pulse">{t('chat.loadingChat')}</div>
        </div>
      </div>
    );
  }

  // Handle tier restriction error
  if (error) {
    const errorMessage = (error as any)?.message || "An error occurred";
    const isTierError = errorMessage.includes("Family+") || errorMessage.includes("tier");
    
    if (isTierError) {
      return (
        <div className="p-4 overflow-y-auto" style={safeTopStyle} data-testid="chat-upgrade-prompt">
          <div className="flex items-center gap-3 mb-4 shrink-0">
            {backBtn}
            <h1 className="text-2xl font-bold">{t('chat.title')}</h1>
          </div>
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <Lock className="w-8 h-8 text-muted-foreground" />
                <CardTitle>{t('chat.title')}</CardTitle>
              </div>
              <CardDescription>{t('chat.connectRealtime')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">{t('chat.upgradeToUnlock')}</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  {t('chat.upgradeToFamilyPlus')}
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 mt-3">
                  <li>• {t('chat.realTimeMessaging')}</li>
                  <li>• {t('chat.shareUpdates')}</li>
                  <li>• {t('chat.stayConnected')}</li>
                  <li>• {t('chat.plusAllBenefits')}</li>
                </ul>
              </div>
              <Link href="/pricing">
                <Button className="w-full" data-testid="button-upgrade">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  {t('chat.upgradeToFamilyPlusButton')}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Other errors
    toast({
      title: t('chat.errorLoadingChat'),
      description: errorMessage,
      variant: "destructive",
    });
    return null;
  }

  return (
    <div
      className="flex flex-col"
      style={{ ...safeTopStyle, paddingBottom: keyboardOffset > 0 ? 0 : 'env(safe-area-inset-bottom)' }}
      data-testid="page-chat"
    >
      <div className="w-full lg:max-w-3xl flex flex-col flex-1 min-h-0 mx-auto px-4 pb-4">
        <div className="flex items-center gap-3 mb-4 shrink-0">
          {backBtn}
          <h1 className="text-2xl font-bold" data-testid="heading-chat">
            {t('chat.title')}
          </h1>
        </div>

        <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <CardHeader className="border-b shrink-0 py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                {t('chat.messages')}
              </CardTitle>
              <span className="text-sm text-muted-foreground">
                {t(messages.length === 1 ? 'chat.messageCount' : 'chat.messageCount_other', { count: messages.length })}
              </span>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-0 min-h-0 overflow-hidden">
            {/* Messages area — scrolls independently */}
            <ScrollArea className="flex-1 min-h-0 p-4" ref={scrollAreaRef}>
              <div className="space-y-4" data-testid="chat-messages">
                {messages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">
                    <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>{t('chat.noMessagesStart')}</p>
                  </div>
                ) : (
                  messages.map((msg, index) => (
                    <div
                      key={msg.id}
                      className="flex gap-3 items-start"
                      data-testid={`chat-message-${index}`}
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                        style={{ backgroundColor: msg.memberColor }}
                      >
                        {msg.memberName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="font-semibold text-sm" data-testid={`text-message-author-${index}`}>
                            {msg.memberName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(msg.createdAt), "h:mm a")}
                          </span>
                        </div>
                        <div className="text-sm break-words" data-testid={`text-message-content-${index}`}>
                          <MessageRenderer message={msg.message} />
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input area — always pinned at bottom */}
            {isActingAs ? (
              <div className="border-t p-4 flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 shrink-0" data-testid="chat-readonly-notice">
                <EyeOff className="w-4 h-4 flex-shrink-0" />
                <span>{t('chat.readOnlyActingAs', 'Nur lesen — du bist als {{name}} angemeldet. Melde dich mit deinem eigenen Account an, um zu schreiben.', { name: member?.displayName })}</span>
              </div>
            ) : (
              <form
                onSubmit={handleSendMessage}
                className="border-t p-4 flex gap-2 shrink-0"
                data-testid="form-send-message"
              >
                <EmoticonPicker onSelectEmoticon={handleSelectEmoticon} />
                <Input
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder={t('chat.typeMessage')}
                  maxLength={1000}
                  disabled={sendMessageMutation.isPending}
                  className="flex-1"
                  data-testid="input-message"
                />
                <Button
                  type="submit"
                  disabled={!messageText.trim() || sendMessageMutation.isPending}
                  data-testid="button-send-message"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
