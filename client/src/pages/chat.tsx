import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Lock, MessageCircle, ArrowLeft, EyeOff, Users, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Link } from "wouter";
import { MessageRenderer } from "@/components/message-renderer";
import { EmoticonPicker } from "@/components/emoticon-picker";

interface ChatMessage {
  id: string;
  message: string;
  createdAt: Date;
  memberId: string;
  memberName: string;
  memberColor?: string;
  targetMemberId: string | null;
  targetMemberName: string | null;
  isTargeted: boolean;
}
interface FamilyMember {
  id: string;
  displayName: string;
  role: string;
  color?: string;
  avatarUrl?: string | null;
}
interface ChatUnreadCounts {
  count: number;
  conversations: Record<string, number>;
}

export default function Chat() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [messageText, setMessageText] = useState("");
  const [conversation, setConversation] = useState("all");
  const [vvHeight, setVvHeight] = useState(() => window.visualViewport?.height ?? window.innerHeight);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { data: member, isLoading: memberLoading } = useQuery<any>({
    queryKey: ["/api/family-members/current"], staleTime: 5 * 60 * 1000,
  });
  const { data: realMember } = useQuery<any>({
    queryKey: ["/api/family-members/real"], staleTime: 5 * 60 * 1000,
  });
  const { data: familyMembers = [] } = useQuery<FamilyMember[]>({
    queryKey: ["/api/family-members"], enabled: !!member, staleTime: 5 * 60 * 1000,
  });
  const { data: messages = [], isLoading, error } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat"], enabled: !!member, refetchInterval: 5000, staleTime: 5 * 60 * 1000,
  });
  const { data: unreadCounts } = useQuery<ChatUnreadCounts>({
    queryKey: ["/api/chat/unread-count"],
    enabled: !!member,
    refetchInterval: 5000,
  });
  const isActingAs = !!(member && realMember && member.id !== realMember.id);
  const isParent = member?.role === "parent";
  const dashboardUrl = member?.role === "child" ? "/kid-dashboard" : "/dashboard";
  const selectedMember = familyMembers.find((candidate) => candidate.id === conversation);

  useEffect(() => {
    if (conversation !== "all" && conversation !== "oversight" && (!selectedMember || selectedMember.id === member?.id)) {
      setConversation("all");
    }
  }, [conversation, selectedMember, member?.id]);

  const visibleMessages = useMemo(() => {
    if (conversation === "all") return messages.filter((message) => !message.isTargeted);
    if (conversation === "oversight") {
      if (!isParent) return [];
      const children = new Set(familyMembers.filter((candidate) => candidate.role === "child").map((candidate) => candidate.id));
      return messages.filter((message) => message.isTargeted && children.has(message.memberId) && !!message.targetMemberId && children.has(message.targetMemberId));
    }
    return messages.filter((message) => message.isTargeted && !!selectedMember &&
      ((message.memberId === member?.id && message.targetMemberId === selectedMember.id) ||
       (message.memberId === selectedMember.id && message.targetMemberId === member?.id)));
  }, [conversation, familyMembers, isParent, member?.id, messages, selectedMember]);

  const sendMessageMutation = useMutation({
    mutationFn: async ({ message, target }: { message: string; target: string | null }) =>
      apiRequest("POST", "/api/chat", { message, targetMemberId: target }),
    onSuccess: () => {
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ["/api/chat"] });
      setTimeout(scrollToBottom, 100);
    },
    onError: (sendError: any) => toast({
      title: t("chat.failedToSend"),
      description: sendError.message === "acting_as_member"
        ? t("chat.readOnlyActingAs", { name: member?.displayName ?? "" })
        : (sendError.message || t("errors.tryAgain")),
      variant: "destructive",
    }),
  });
  const markAsReadMutation = useMutation({
    mutationFn: (conversationKey: string) => apiRequest("POST", "/api/chat/mark-read", { conversationKey }),
    onSuccess: (_response, conversationKey) => {
      queryClient.setQueryData<ChatUnreadCounts>(["/api/chat/unread-count"], (current) => {
        if (!current) return current;
        const conversations = { ...current.conversations };
        const removed = conversations[conversationKey] || 0;
        delete conversations[conversationKey];
        return { count: Math.max(0, current.count - removed), conversations };
      });
    },
  });
  function scrollToBottom() {
    const viewport = scrollAreaRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLElement | null;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
    else messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    let previous = viewport.height;
    const onViewportChange = () => {
      setVvHeight(viewport.height);
      if (viewport.height < previous - 50) setTimeout(scrollToBottom, 120);
      previous = viewport.height;
    };
    viewport.addEventListener("resize", onViewportChange);
    viewport.addEventListener("scroll", onViewportChange);
    return () => { viewport.removeEventListener("resize", onViewportChange); viewport.removeEventListener("scroll", onViewportChange); };
  }, []);
  useEffect(() => { scrollToBottom(); }, [visibleMessages.length]);
  useEffect(() => {
    if (!isLoading && conversation !== "oversight") {
      markAsReadMutation.mutate(conversation);
    }
  }, [conversation, visibleMessages.length, isLoading]);

  const handleSendMessage = (event: React.FormEvent) => {
    event.preventDefault();
    if (!messageText.trim() || sendMessageMutation.isPending || conversation === "oversight") return;
    sendMessageMutation.mutate({ message: messageText.trim(), target: conversation === "all" ? null : conversation });
  };
  const isKeyboardOpen = vvHeight < window.innerHeight - 80;
  const safeTopStyle: React.CSSProperties = {
    position: "fixed", top: 0, left: 0, right: 0, height: `${vvHeight}px`,
    paddingTop: isKeyboardOpen ? "0.25rem" : "max(1rem, env(safe-area-inset-top))",
    paddingBottom: isKeyboardOpen ? 0 : "env(safe-area-inset-bottom)",
    paddingLeft: "max(1rem, env(safe-area-inset-left))", paddingRight: "max(1rem, env(safe-area-inset-right))",
  };
  const backBtn = <Link href={dashboardUrl}><Button variant="outline" size="sm" className="bg-background/30 backdrop-blur-sm border-border/40" data-testid="button-back-to-dashboard"><ArrowLeft className="w-4 h-4 mr-2" />{t("settings.backToDashboard")}</Button></Link>;

  if (isLoading || memberLoading) return <div className="p-4 flex flex-col items-center" style={safeTopStyle}><div className="w-full lg:max-w-3xl flex items-center gap-3 mb-4">{backBtn}<h1 className="text-2xl font-bold">{t("chat.title")}</h1></div><div className="flex-1 flex items-center" data-testid="loading-chat"><div className="animate-pulse">{t("chat.loadingChat")}</div></div></div>;
  if (error) {
    const errorMessage = (error as any)?.message || t("errors.tryAgain");
    const isTierError = errorMessage.includes("Family+") || errorMessage.includes("tier");
    return <div className="p-4 overflow-y-auto" style={safeTopStyle}><div className="flex items-center gap-3 mb-4">{backBtn}<h1 className="text-2xl font-bold">{t("chat.title")}</h1></div><Card className="max-w-2xl mx-auto"><CardHeader><CardTitle><Lock className="w-6 h-6 inline mr-2" />{isTierError ? t("chat.upgradeToUnlock") : t("chat.errorLoadingChat")}</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-muted-foreground">{isTierError ? t("chat.upgradeToFamilyPlus") : errorMessage}</p>{isTierError && <Link href="/pricing"><Button className="w-full" data-testid="button-upgrade"><MessageCircle className="w-4 h-4 mr-2" />{t("chat.upgradeToFamilyPlusButton")}</Button></Link>}</CardContent></Card></div>;
  }

  const conversationTitle = conversation === "all" ? t("chat.allMembers") : conversation === "oversight" ? t("chat.childConversations") : t("chat.withMember", { name: selectedMember?.displayName });
  return (
    <div className={`lc-chat-page ${isKeyboardOpen ? "is-keyboard-open" : ""} flex flex-col items-center`} style={safeTopStyle} data-testid="page-chat">
      <div className={`w-full lg:max-w-4xl flex flex-col flex-1 min-h-0 px-4 ${isKeyboardOpen ? "pb-0" : "pb-4"}`}>
        <div className={`flex items-center gap-3 shrink-0 ${isKeyboardOpen ? "mb-1" : "mb-4"}`}>{backBtn}<h1 className="text-2xl font-bold" data-testid="heading-chat">{t("chat.title")}</h1></div>
        <Card className="lc-chat-card flex-1 flex flex-col min-h-0 overflow-hidden">
          {!isKeyboardOpen && <CardHeader className="border-b shrink-0 py-3"><div className="flex items-center justify-between"><CardTitle className="flex items-center gap-2"><MessageCircle className="w-5 h-5" />{conversationTitle}</CardTitle><span className="text-sm text-muted-foreground">{t(visibleMessages.length === 1 ? "chat.messageCount" : "chat.messageCount_other", { count: visibleMessages.length })}</span></div></CardHeader>}
          <CardContent className="flex-1 flex flex-col p-0 min-h-0 overflow-hidden">
            <nav className="border-b px-3 py-2 flex gap-2 overflow-x-auto shrink-0" aria-label={t("chat.conversations")} data-testid="select-chat-recipient">
               <Button variant={conversation === "all" ? "default" : "ghost"} size="sm" className="relative overflow-visible" onClick={() => setConversation("all")} data-testid="button-chat-all"><Users className="w-4 h-4 mr-1.5" />{t("chat.allMembers")}{!!unreadCounts?.conversations.all && <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center shadow" data-testid="badge-chat-unread-all">{unreadCounts.conversations.all > 99 ? "99+" : unreadCounts.conversations.all}</span>}</Button>
               {familyMembers.filter((candidate) => candidate.id !== member?.id).map((candidate) => <Button key={candidate.id} variant={conversation === candidate.id ? "default" : "ghost"} size="sm" className="relative overflow-visible" onClick={() => setConversation(candidate.id)} data-testid={`button-chat-member-${candidate.id}`}><span className="w-2.5 h-2.5 rounded-full mr-1.5 ring-2 ring-offset-1 ring-offset-background" style={{ backgroundColor: candidate.color || "hsl(var(--primary))", outlineColor: candidate.color || "hsl(var(--primary))" }} />{candidate.displayName}{!!unreadCounts?.conversations[candidate.id] && <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center shadow" data-testid={`badge-chat-unread-${candidate.id}`}>{unreadCounts.conversations[candidate.id] > 99 ? "99+" : unreadCounts.conversations[candidate.id]}</span>}</Button>)}
              {isParent && <Button variant={conversation === "oversight" ? "default" : "ghost"} size="sm" onClick={() => setConversation("oversight")} data-testid="button-chat-oversight"><ShieldCheck className="w-4 h-4 mr-1.5" />{t("chat.childConversations")}</Button>}
            </nav>
            {conversation === "oversight" && <div className="px-4 py-2 text-xs text-muted-foreground bg-muted/30 border-b flex items-center gap-2"><EyeOff className="w-3.5 h-3.5" />{t("chat.oversightReadOnly")}</div>}
            <ScrollArea className="flex-1 min-h-0 p-4" ref={scrollAreaRef}><div className="space-y-4" data-testid="chat-messages">
              {visibleMessages.length === 0 ? <div className="lc-empty-state text-center py-12"><MessageCircle className="lc-empty-state-icon w-12 h-12 mx-auto mb-3 opacity-50" /><p className="lc-empty-state-description">{t("chat.noMessagesStart")}</p></div> :
                visibleMessages.map((msg, index) => <div key={msg.id} className="flex gap-3 items-start" data-testid={`chat-message-${index}`}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ring-2 ring-offset-2 ring-offset-background" style={{ backgroundColor: msg.memberColor || "hsl(var(--primary))", outlineColor: msg.memberColor || "hsl(var(--primary))" }}>{msg.memberName.charAt(0).toUpperCase()}</div>
                  <div className="flex-1 min-w-0"><div className="flex items-baseline gap-2 mb-1 flex-wrap"><span className="font-semibold text-sm" data-testid={`text-message-author-${index}`}>{msg.memberName}</span>{conversation === "oversight" && <span className="text-xs text-primary">{t("chat.toMember", { name: msg.targetMemberName || t("chat.selectedMember") })}</span>}<span className="text-xs text-muted-foreground">{format(new Date(msg.createdAt), "h:mm a")}</span></div><div className="text-sm break-words" data-testid={`text-message-content-${index}`}><MessageRenderer message={msg.message} /></div></div>
                </div>)}
              <div ref={messagesEndRef} />
            </div></ScrollArea>
             {!isActingAs && conversation !== "oversight" && <><div className="border-t px-4 pt-3"><p className="text-xs text-muted-foreground mb-2">{t("chat.parentVisibilityNotice")}</p><p className="text-xs font-medium text-primary">{conversation === "all" ? t("chat.broadcastHint") : t("chat.directHint", { name: selectedMember?.displayName })}</p></div><form onSubmit={handleSendMessage} className={`lc-chat-composer flex gap-2 shrink-0 ${isKeyboardOpen ? "py-2 px-3" : "p-4"}`} data-testid="form-send-message"><EmoticonPicker onSelectEmoticon={(emoticon) => setMessageText((previous) => previous + emoticon + " ")} /><Input value={messageText} onChange={(event) => setMessageText(event.target.value)} placeholder={t("chat.typeMessage")} maxLength={1000} disabled={sendMessageMutation.isPending} className="flex-1" data-testid="input-message" /><Button type="submit" disabled={!messageText.trim() || sendMessageMutation.isPending} data-testid="button-send-message"><Send className="w-4 h-4" /></Button></form></>}
            {conversation === "oversight" && <div className="border-t p-4 flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 shrink-0"><EyeOff className="w-4 h-4 flex-shrink-0" />{t("chat.oversightReadOnly")}</div>}
            {isActingAs && <div className="border-t p-4 flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 shrink-0" data-testid="chat-readonly-notice"><EyeOff className="w-4 h-4 flex-shrink-0" /><span>{t("chat.readOnlyActingAs", { name: member?.displayName })}</span></div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}