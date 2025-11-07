import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Lock, MessageCircle, ArrowLeft } from "lucide-react";
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
  const { user } = useAuth();
  const { toast } = useToast();
  const [messageText, setMessageText] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading, error } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat"],
    enabled: !!user,
    refetchInterval: 5000, // Refetch every 5 seconds as fallback
  });

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
        title: "Failed to send message",
        description: error.message || "Please try again",
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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

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

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Family Chat</h1>
          <Link href="/dashboard">
            <Button variant="outline" data-testid="button-back-to-dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
        <div className="flex items-center justify-center min-h-[60vh]" data-testid="loading-chat">
          <div className="animate-pulse">Loading chat...</div>
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
        <div className="container mx-auto p-6" data-testid="chat-upgrade-prompt">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold">Family Chat</h1>
            <Link href="/dashboard">
              <Button variant="outline" data-testid="button-back-to-dashboard">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <Lock className="w-8 h-8 text-muted-foreground" />
                <CardTitle>Family Chat</CardTitle>
              </div>
              <CardDescription>Connect with your whole family in real-time</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">Upgrade to unlock Family Chat</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Upgrade to <strong>Family+ tier ($9/month)</strong> or higher
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 mt-3">
                  <li>• Real-time family messaging</li>
                  <li>• Share updates and celebrate wins</li>
                  <li>• Stay connected with your kids</li>
                  <li>• Plus all Family tier benefits</li>
                </ul>
              </div>
              <Button className="w-full" data-testid="button-upgrade">
                <MessageCircle className="w-4 h-4 mr-2" />
                Upgrade to Family+
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Other errors
    toast({
      title: "Error loading chat",
      description: errorMessage,
      variant: "destructive",
    });
    return null;
  }

  return (
    <div className="container mx-auto p-4 h-screen flex flex-col" data-testid="page-chat">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold mb-2" data-testid="heading-chat">
            Family Chat
          </h1>
          <p className="text-muted-foreground">
            Chat with your family in real-time
          </p>
        </div>
        <Link href="/dashboard">
          <Button variant="outline" data-testid="button-back-to-dashboard">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              Messages
            </CardTitle>
            <span className="text-sm text-muted-foreground">
              {messages.length} message{messages.length !== 1 ? "s" : ""}
            </span>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
          {/* Messages area */}
          <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
            <div className="space-y-4" data-testid="chat-messages">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No messages yet. Start the conversation!</p>
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

          {/* Input area */}
          <form
            onSubmit={handleSendMessage}
            className="border-t p-4 flex gap-2"
            data-testid="form-send-message"
          >
            <EmoticonPicker onSelectEmoticon={handleSelectEmoticon} />
            <Input
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type a message..."
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
        </CardContent>
      </Card>
    </div>
  );
}
