import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { 
  Bell, 
  CheckCircle, 
  Clock, 
  Gift, 
  Trophy, 
  Star,
  UserPlus,
  Check,
  CheckCheck,
  Trash2,
  Share2
} from "lucide-react";
import type { Notification } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale/de";
import { enUS } from "date-fns/locale/en-US";
import { fr } from "date-fns/locale/fr";
import { es } from "date-fns/locale/es";
import { ja } from "date-fns/locale/ja";
import { zhCN } from "date-fns/locale/zh-CN";
import { ko } from "date-fns/locale/ko";
import { sv } from "date-fns/locale/sv";

interface NotificationBellProps {
  familyLanguage?: string;
  wsConnection?: WebSocket | null;
  memberRole?: "parent" | "child";
}

const localeMap: Record<string, typeof de> = {
  de, en: enUS, fr, es, ja, zh: zhCN, ko, sv
};

const notificationIcons: Record<string, typeof Bell> = {
  task_completed: CheckCircle,
  task_pending: Clock,
  task_approved: CheckCircle,
  task_rejected: Clock,
  reward_redeemed: Gift,
  reward_sharing: Share2,
  reward_request: Gift,
  achievement_earned: Trophy,
  points_milestone: Star,
  member_joined: UserPlus,
};

export function NotificationBell({ familyLanguage = "en", wsConnection, memberRole = "parent" }: NotificationBellProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const locale = localeMap[familyLanguage] || localeMap.en;

  const getNavigationRoute = (notification: Notification): string | null => {
    // Children should always go to kid-dashboard pages
    const childDashboard = "/kid-dashboard";
    const parentDashboard = "/dashboard";
    
    switch (notification.type) {
      case "task_pending":
      case "task_completed":
        // Only parents should go to /approvals - children go to kid-dashboard
        return memberRole === "parent" ? "/approvals" : childDashboard;
      case "reward_redeemed":
      case "reward_sharing":
        // Parents go to rewards-board, children go to kid-dashboard (rewards section)
        return memberRole === "parent" ? "/rewards-board" : childDashboard;
      case "task_approved":
      case "task_rejected":
        // Children see their task status on kid-dashboard
        return memberRole === "parent" ? parentDashboard : childDashboard;
      case "achievement_earned":
        // Parents have achievements page, children see it on kid-dashboard
        return memberRole === "parent" ? "/achievements" : childDashboard;
      case "reward_request":
        // Parents go to approvals for reward requests, children go to kid-dashboard
        return memberRole === "parent" ? "/approvals" : childDashboard;
      case "points_milestone":
      case "member_joined":
      default:
        return memberRole === "parent" ? parentDashboard : childDashboard;
    }
  };

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 60000,
    staleTime: 30 * 1000,
  });

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 30000,
    staleTime: 15 * 1000,
  });

  const unreadCount = unreadData?.count ?? 0;

  useEffect(() => {
    if (!wsConnection) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "notification_update") {
          queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
          queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
        }
      } catch (e) {
      }
    };

    wsConnection.addEventListener("message", handleMessage);
    return () => wsConnection.removeEventListener("message", handleMessage);
  }, [wsConnection]);

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return await apiRequest("PATCH", `/api/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("PATCH", "/api/notifications/read-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      toast({
        title: t("notifications.allMarkedRead", "All notifications marked as read"),
      });
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", "/api/notifications");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      toast({
        title: t("notifications.allDeleted", "All notifications deleted"),
      });
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    console.log("Notification clicked:", notification.type, notification.title);
    
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }
    
    const route = getNavigationRoute(notification);
    console.log("Navigating to:", route);
    
    if (route) {
      setOpen(false);
      setTimeout(() => {
        setLocation(route);
      }, 100);
    }
  };

  const getIcon = (type: string) => {
    const Icon = notificationIcons[type] || Bell;
    return <Icon className="h-4 w-4 flex-shrink-0" />;
  };

  const formatTime = (date: Date | null) => {
    if (!date) return "";
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale });
  };

  return (
    <>
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative flex-shrink-0 bg-background/60 backdrop-blur-sm border border-border/50 overflow-visible"
          data-testid="button-notification-bell"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span 
              className="absolute -top-1.5 -right-1.5 h-5 min-w-[20px] px-1 flex items-center justify-center text-xs font-medium bg-destructive text-destructive-foreground rounded-full pointer-events-none"
              data-testid="badge-unread-count"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>{t("notifications.title", "Notifications")}</span>
          {notifications.length > 0 && (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  markAllAsReadMutation.mutate();
                }}
                disabled={markAllAsReadMutation.isPending || unreadCount === 0}
                title={t("notifications.markAllRead", "Mark all as read")}
                data-testid="button-mark-all-read"
              >
                <CheckCheck className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteDialogOpen(true);
                }}
                disabled={deleteAllMutation.isPending}
                title={t("notifications.deleteAll", "Delete all")}
                data-testid="button-delete-all"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {isLoading ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            {t("common.loading", "Loading...")}
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            {t("notifications.empty", "No notifications yet")}
          </div>
        ) : (
          <div className="max-h-[300px] overflow-y-auto">
            {notifications.slice(0, 20).map((notification) => (
              <div
                key={notification.id}
                className={`flex gap-3 p-3 cursor-pointer rounded-sm transition-colors hover:bg-accent ${!notification.isRead ? "bg-accent/30" : ""}`}
                onClick={() => handleNotificationClick(notification)}
                data-testid={`notification-item-${notification.id}`}
              >
                <div className={`mt-0.5 ${!notification.isRead ? "text-primary" : "text-muted-foreground"}`}>
                  {getIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${!notification.isRead ? "font-medium" : ""}`}>
                    {notification.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {notification.message}
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    {formatTime(notification.createdAt)}
                  </p>
                </div>
                {!notification.isRead && (
                  <div className="flex-shrink-0">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>

    <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("notifications.deleteAllTitle", "Delete all notifications?")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("notifications.deleteAllDescription", "This will permanently delete all your notifications. This action cannot be undone.")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-cancel-delete">
            {t("common.cancel", "Cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              deleteAllMutation.mutate();
              setDeleteDialogOpen(false);
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-testid="button-confirm-delete"
          >
            {t("common.delete", "Delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
