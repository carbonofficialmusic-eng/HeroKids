import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Camera, CheckCircle, Zap, Star, Users, Lock, Calendar, CalendarDays, Moon, Info, ShoppingCart, Square, CheckSquare, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Task, FamilyMember, ShoppingListItem } from "@shared/schema";
import { getAvatarUrl } from "@/lib/skins";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { format, isToday, isTomorrow, isPast, differenceInDays, parse, type Locale } from "date-fns";
import { de, enUS, fr, es, ja, ko, sv, zhCN } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getDevHeaders } from "@/lib/queryClient";


interface TaskCardProps {
  task: Task & {
    remainingSlots?: number | null;
    memberHasCompleted?: boolean;
    completions?: Array<{
      id: string;
      memberId: string;
      memberDisplayName: string;
      memberAvatarUrl: string | null;
      memberActiveSkinId: string | null;
      memberUseCustomAvatar: boolean;
      memberColor: string;
      status: "pending" | "approved" | "rejected";
      completedAt: Date | null;
    }>;
    sharedMemberCompletions?: Array<{
      memberId: string;
      displayName: string;
      avatarUrl: string | null;
      activeSkinId: string | null;
      useCustomAvatar: boolean;
      color: string;
      hasCompleted: boolean;
    }>;
    assignedMemberCompletions?: Array<{
      memberId: string;
      displayName: string;
      avatarUrl: string | null;
      activeSkinId: string | null;
      useCustomAvatar: boolean;
      color: string;
      hasCompleted: boolean; // true only when approved
      hasSubmitted: boolean; // true when pending or approved (for UI graying)
      status: "pending" | "approved" | "rejected" | null;
    }>;
  };
  assignedTo?: FamilyMember;
  onComplete?: (taskId: string) => void;
  isCompleting?: boolean;
  showAssignee?: boolean;
  onClick?: (task: Task) => void;
  currentMemberId?: string;
  compact?: boolean;
}

function ShoppingListSection({ taskId, onClick, expanded: controlledExpanded, onToggle }: { taskId: string | number; onClick?: (e: React.MouseEvent) => void; expanded?: boolean; onToggle?: () => void; }) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [internalExpanded, setInternalExpanded] = useState(false);
  const expanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  const toggle = onToggle ?? (() => setInternalExpanded((v: boolean) => !v));

  const { data: items = [] } = useQuery<any[]>({
    queryKey: ["/api/tasks", taskId, "shopping-items"],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}/shopping-items`, { headers: getDevHeaders() });
      if (!res.ok) throw new Error("Failed to fetch shopping items");
      return res.json();
    },
    staleTime: 15000,
  });

  const toggleMutation = useMutation({
    mutationFn: async (itemId: number) => {
      const res = await apiRequest("PATCH", `/api/shopping-items/${itemId}/toggle`);
      return res.json();
    },
    onMutate: async (itemId: number) => {
      await queryClient.cancelQueries({ queryKey: ["/api/tasks", taskId, "shopping-items"] });
      const previous = queryClient.getQueryData<any[]>(["/api/tasks", taskId, "shopping-items"]);
      queryClient.setQueryData(["/api/tasks", taskId, "shopping-items"], (old: any[] = []) =>
        old.map((item) =>
          item.id === itemId
            ? { ...item, completedAt: item.completedAt ? null : new Date().toISOString() }
            : item
        )
      );
      return { previous };
    },
    onError: (_err: any, _itemId: any, context: any) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/tasks", taskId, "shopping-items"], context.previous);
      }
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/tasks", taskId, "shopping-items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
    },
  });

  if (items.length === 0) return null;

  const doneCount = items.filter((it: any) => it.completedAt !== null).length;

  return (
    <div
      className="mt-3"
      onClick={(e) => { e.stopPropagation(); onClick?.(e); }}
      data-testid={`shopping-list-${taskId}`}
    >
      {/* Collapsible header — always visible */}
      <button
        type="button"
        className="flex items-center gap-1.5 w-full text-left mb-2 group"
        onClick={(e) => { e.stopPropagation(); toggle(); }}
        data-testid={`shopping-list-toggle-${taskId}`}
      >
        <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground flex-1">
          {doneCount}/{items.length} {t("tasks.shoppingItemsDone", { defaultValue: "Artikel erledigt" })}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="space-y-1.5">
          {items.map((item: any) => {
            const isDone = item.completedAt !== null;
            return (
              <div
                key={item.id}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer transition-colors ${isDone ? "bg-green-500/10" : "bg-muted/30 hover-elevate"}`}
                onClick={(e) => { e.stopPropagation(); if (!toggleMutation.isPending) toggleMutation.mutate(item.id); }}
                data-testid={`shopping-item-${item.id}`}
              >
                {isDone
                  ? <CheckSquare className="h-4 w-4 text-green-500 flex-shrink-0" />
                  : <Square className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                }
                <span className={`text-sm flex-1 min-w-0 ${isDone ? "line-through text-muted-foreground" : ""}`}>
                  {item.text}
                </span>
                {isDone && item.completedByMemberName && (
                  <span
                    className="text-xs font-medium px-1.5 py-0.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: item.completedByMemberColor ? `${item.completedByMemberColor}30` : undefined,
                      color: item.completedByMemberColor ?? undefined,
                    }}
                  >
                    {item.completedByMemberName}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function TaskCard({
  task,
  assignedTo,
  onComplete,
  isCompleting = false,
  showAssignee = true,
  onClick,
  currentMemberId,
  compact = false,
}: TaskCardProps) {
  const { t, i18n } = useTranslation();
  const [shoppingListExpanded, setShoppingListExpanded] = useState(false);
  
  // Get locale for date formatting
  const getDateLocale = () => {
    const localeMap: Record<string, Locale> = {
      de, en: enUS, fr, es, ja, ko, sv, zh: zhCN
    };
    return localeMap[i18n.language] || enUS;
  };
  
  // Check if task is currently unavailable (future nextAvailableDate)
  const isUnavailable = !!(task.nextAvailableDate && new Date(task.nextAvailableDate) > new Date());
  
  // Check if this is a weekdays-only task that's unavailable on weekends (Sat=6, Sun=0)
  const todayDow = new Date().getDay();
  const isWeekendUnavailable = task.recurrence === 'weekdays' && (todayDow === 0 || todayDow === 6) && !isUnavailable;
  
  // Format next available date for display
  const getNextAvailableText = () => {
    if (!task.nextAvailableDate || !isUnavailable) return null;
    const nextDate = new Date(task.nextAvailableDate);
    const today = new Date();
    if (isToday(nextDate)) return t('tasks.availableToday');
    if (isTomorrow(nextDate)) return t('tasks.availableTomorrow');
    const daysUntil = differenceInDays(nextDate, today);
    // Show weekday name for within 7 days, full date for longer periods
    if (daysUntil <= 7) {
      return t('tasks.availableOn', { date: format(nextDate, 'EEEE', { locale: getDateLocale() }) });
    }
    // For longer periods, show full date (e.g., "10. März" or "March 10")
    return t('tasks.availableOnDate', { date: format(nextDate, 'd. MMMM', { locale: getDateLocale() }) });
  };
  
  // Check if this member has already completed this multi-completion task
  const isCompletedByMember = task.memberHasCompleted || false;
  
  // Check if this is a shared task and current member is NOT assigned
  const isSharedTaskNotAssigned = task.isSharedTask && 
    task.sharedMemberIds && 
    task.sharedMemberIds.length > 0 && 
    currentMemberId && 
    !task.sharedMemberIds.includes(currentMemberId);
  
  // Get assigned member names for tooltip (prefer assignedMemberCompletions over legacy sharedMemberCompletions)
  const assignedMemberNames = task.assignedMemberCompletions?.map(m => m.displayName).join(' & ') || 
    task.sharedMemberCompletions?.map(m => m.displayName).join(' & ') || '';
  
  // Due date availability logic for one-time tasks
  const dueDateInfo = (() => {
    if (!task.dueDate || task.recurrence !== "none") return { notYet: false, expired: false, isLate: false, daysPast: 0 };
    const dateStr = String(task.dueDate).substring(0, 10);
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    if (dateStr > todayStr) return { notYet: true, expired: false, isLate: false, daysPast: 0 };
    
    const dueMs = new Date(dateStr + "T00:00:00").getTime();
    const todayMs = new Date(todayStr + "T00:00:00").getTime();
    const daysPast = Math.floor((todayMs - dueMs) / (1000 * 60 * 60 * 24));
    
    return {
      notYet: false,
      expired: daysPast > 3,
      isLate: daysPast >= 1 && daysPast <= 3,
      daysPast,
    };
  })();
  
  // Task should appear grayed out if it's unavailable OR completed by this member OR due date not yet reached OR expired OR weekend-only unavailable OR awaiting approval
  const isGrayedOut = isUnavailable || isCompletedByMember || dueDateInfo.notYet || dueDateInfo.expired || isWeekendUnavailable || task.status === "pending_approval" || task.status === "completed";

  // True when requiresApproval and at least one submission is still pending approval.
  // Used to show a yellow (amber) checkmark instead of green on the parent dashboard.
  const hasPendingApproval = (() => {
    if (!task.requiresApproval) return false;
    // Multi-member assigned tasks: check per-member status
    if (task.assignedMemberCompletions && task.assignedMemberCompletions.length > 0) {
      return task.assignedMemberCompletions.some(m => m.status === "pending");
    }
    // Multi-completion tasks: check completions array
    if (task.completions && task.completions.length > 0) {
      return task.completions.some(c => c.status === "pending");
    }
    // Single / unassigned task: pending_approval status
    return task.status === "pending_approval";
  })();

  // ── Compact (grid) rendering ──────────────────────────────────────────────
  if (compact) {
    // Date label shown directly on the compact card
    const compactDateText = (() => {
      // Unavailable (completed, waiting for reset) — highest priority
      if (isUnavailable && getNextAvailableText()) return { text: getNextAvailableText()!, color: "text-muted-foreground" };
      // Weekend unavailable (weekdays-only task shown on Sat/Sun)
      if (isWeekendUnavailable) return { text: t('tasks.weekendUnavailable'), color: "text-muted-foreground" };
      // One-time task with due date
      if (task.dueDate && task.recurrence === "none") {
        const dateStr = typeof task.dueDate === "string" ? task.dueDate.substring(0, 10) : String(task.dueDate).substring(0, 10);
        const dueDate = parse(dateStr, "yyyy-MM-dd", new Date());
        if (isNaN(dueDate.getTime())) return null;
        const locale = getDateLocale();
        if (dueDateInfo.expired) return { text: t('tasks.dueDateExpired'), color: "text-destructive" };
        if (dueDateInfo.isLate) return { text: t('tasks.dueDateLate', { days: dueDateInfo.daysPast }), color: "text-amber-600 dark:text-amber-400" };
        if (isToday(dueDate)) return { text: t('kidDashboard.dueTodayHurry'), color: "text-amber-600 dark:text-amber-400" };
        if (isTomorrow(dueDate)) return { text: t('kidDashboard.dueTomorrowHurry'), color: "text-muted-foreground" };
        if (dueDateInfo.notYet) return { text: t('tasks.dueDateNotYet', { date: format(dueDate, "d. MMM", { locale }) }), color: "text-muted-foreground" };
        return { text: format(dueDate, "d. MMM", { locale }), color: "text-muted-foreground" };
      }
      // Currently available recurring task — show the recurrence cadence so parents know when it repeats
      const r = task.recurrence;
      if (r === "daily") return { text: t('tasks.recurrenceDaily', { defaultValue: 'Daily' }), color: "text-muted-foreground" };
      if (r === "weekdays") return { text: t('tasks.recurrenceWeekdays', { defaultValue: 'Mon–Fri' }), color: "text-muted-foreground" };
      if (r === "weekly") return { text: t('tasks.recurrenceWeekly', { defaultValue: 'Weekly' }), color: "text-muted-foreground" };
      if (r === "monthly") return { text: t('tasks.recurrenceMonthly', { defaultValue: 'Monthly' }), color: "text-muted-foreground" };
      if (r === "yearly") return { text: t('tasks.recurrenceYearly', { defaultValue: 'Yearly' }), color: "text-muted-foreground" };
      if (task.recurrenceDays) return { text: t('tasks.recurrenceEveryN', { count: task.recurrenceDays, defaultValue: `Every ${task.recurrenceDays}d` }), color: "text-muted-foreground" };
      return null;
    })();

    // Recurrence label for the popover
    const recurrenceLabel = (() => {
      const r = task.recurrence;
      if (r === "none") return t('tasks.recurrenceNone', { defaultValue: 'One-time' });
      if (r === "daily") return t('tasks.recurrenceDaily', { defaultValue: 'Daily' });
      if (r === "weekdays") return t('tasks.recurrenceWeekdays', { defaultValue: 'Mon–Fri' });
      if (r === "weekly") return t('tasks.recurrenceWeekly', { defaultValue: 'Weekly' });
      if (r === "monthly") return t('tasks.recurrenceMonthly', { defaultValue: 'Monthly' });
      if (r === "yearly") return t('tasks.recurrenceYearly', { defaultValue: 'Yearly' });
      if (r === "immediate") return t('tasks.immediate', { defaultValue: 'Immediate Repeat' });
      return r;
    })();

    // Assignee display name(s) for the popover
    const assigneeLabel = assignedTo?.displayName
      || assignedMemberNames
      || null;

    return (
      <motion.div
        className="min-w-0 w-full"
        initial={false}
        animate={{ scale: 1 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        whileTap={onClick ? { scale: 0.98 } : undefined}
      >
        <Card
          className={`p-2 transition-all h-full flex flex-col backdrop-blur-md ${
            isGrayedOut ? 'bg-card/20' : 'bg-card/80'
          } hover-elevate active-elevate-2 cursor-pointer`}
          data-testid={`card-task-${task.id}`}
          onClick={() => (task as any).isShoppingList ? setShoppingListExpanded(v => !v) : onClick?.(task)}
        >
          <div className="flex items-start gap-1.5 flex-1">
            {/* Compact emoji */}
            <motion.div
              className="text-xl flex-shrink-0 leading-none mt-0.5"
              data-testid={`text-task-icon-${task.id}`}
              animate={{ filter: isGrayedOut ? "grayscale(100%)" : "grayscale(0%)" }}
              transition={{ duration: 0.3 }}
            >
              {task.iconEmoji}
            </motion.div>

            {/* Title + date — only primary info directly visible */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <p
                  className="text-xs font-semibold truncate flex-1 leading-snug"
                  data-testid={`text-task-title-${task.id}`}
                >
                  {task.title}
                </p>
                {task.requiresProof && !isGrayedOut && (
                  <Camera className="h-3 w-3 text-sky-400 shrink-0" data-testid={`icon-camera-${task.id}`} />
                )}
                {isGrayedOut && (
                  isWeekendUnavailable
                    ? <Moon className="h-3 w-3 text-muted-foreground shrink-0" />
                    : <CheckCircle className={`h-3 w-3 shrink-0 ${hasPendingApproval ? "text-amber-400" : "text-green-500"}`} />
                )}
              </div>
              {compactDateText && (
                <p className={`text-xs truncate leading-tight mt-0.5 ${compactDateText.color}`}>
                  {compactDateText.text}
                </p>
              )}
            </div>

            {/* Info popover — secondary details (points, assignee, recurrence) */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="flex-shrink-0 h-6 w-6 text-muted-foreground"
                  onClick={(e) => e.stopPropagation()}
                  data-testid={`button-info-task-${task.id}`}
                >
                  <Info className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-44 p-2 text-xs space-y-1.5" side="top" align="end">
                {/* Points */}
                <div className="flex items-center gap-1.5">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 shrink-0" />
                  <span data-testid={`badge-points-${task.id}`}>{task.points} {t('tasks.points', { defaultValue: 'pts' })}</span>
                </div>
                {/* Recurrence */}
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="h-3 w-3 shrink-0" />
                  <span>{recurrenceLabel}</span>
                </div>
                {/* Assignee */}
                {assigneeLabel && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="h-3 w-3 shrink-0" />
                    <span className="truncate">{assigneeLabel}</span>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            {/* Complete button — hidden for shopping list tasks (they complete via item-checking) */}
            {onComplete && !(task as any).isShoppingList && (
              isSharedTaskNotAssigned ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="outline"
                      className="flex-shrink-0 h-7 w-7 opacity-50 cursor-not-allowed"
                      onClick={(e) => e.stopPropagation()}
                      disabled
                      data-testid={`button-complete-task-${task.id}`}
                    >
                      <Lock className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t('tasks.sharedTaskNotAssigned', { members: assignedMemberNames })}</p>
                  </TooltipContent>
                </Tooltip>
              ) : (dueDateInfo.notYet || dueDateInfo.expired) ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="outline"
                      className="flex-shrink-0 h-7 w-7 opacity-50 cursor-not-allowed"
                      onClick={(e) => e.stopPropagation()}
                      disabled
                      data-testid={`button-complete-task-${task.id}`}
                    >
                      <Lock className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{dueDateInfo.notYet ? t('tasks.dueDateNotYetTooltip') : t('tasks.dueDateExpiredTooltip')}</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Button
                  size="icon"
                  variant={isGrayedOut ? "outline" : "default"}
                  className="flex-shrink-0 h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isGrayedOut) onComplete(task.id);
                  }}
                  disabled={isCompleting || isGrayedOut}
                  data-testid={`button-complete-task-${task.id}`}
                >
                  <CheckCircle className="h-3 w-3" />
                </Button>
              )
            )}
          </div>
          {/* Shopping list expandable section in compact mode */}
          {(task as any).isShoppingList && (
            <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
              <ShoppingListSection
                taskId={task.id}
                expanded={shoppingListExpanded}
                onToggle={() => setShoppingListExpanded(v => !v)}
              />
            </div>
          )}
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="min-h-[140px] min-w-0 w-full"
      initial={false}
      animate={{
        scale: 1,
      }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      whileTap={onClick ? { scale: 0.98 } : undefined}
    >
      <Card
        className={`p-4 transition-all min-h-[140px] h-full flex flex-col backdrop-blur-md ${
          isGrayedOut ? 'bg-card/20' : 'bg-card/80'
        } ${onClick ? 'hover-elevate active-elevate-2 cursor-pointer' : ''}`}
        data-testid={`card-task-${task.id}`}
        onClick={() => onClick?.(task)}
      >
        <div className="flex items-start gap-3 flex-1">
          {/* Icon with points in star */}
          <div className="relative flex-shrink-0">
            <motion.div
              className="text-4xl"
              data-testid={`text-task-icon-${task.id}`}
              animate={{
                filter: isGrayedOut ? "grayscale(100%)" : "grayscale(0%)",
              }}
              transition={{ duration: 0.3 }}
            >
              {task.iconEmoji}
            </motion.div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 flex items-center justify-center">
              <Star className="absolute w-full h-full fill-yellow-400 text-yellow-400" />
              <span 
                className="relative z-10 text-xs font-bold text-black leading-none"
                data-testid={`badge-points-${task.id}`}
              >
                {task.points}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3
                className="text-lg font-semibold truncate flex-1"
                data-testid={`text-task-title-${task.id}`}
              >
                {task.title}
              </h3>
              {task.requiresProof && !isGrayedOut && (
                <Camera className="h-4 w-4 text-sky-400 shrink-0" data-testid={`icon-camera-${task.id}`} />
              )}
              {isGrayedOut && (
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="flex items-center gap-1"
                >
                  {isWeekendUnavailable
                    ? <Moon className="h-5 w-5 text-muted-foreground shrink-0" data-testid={`icon-weekend-${task.id}`} />
                    : <CheckCircle className={`h-5 w-5 shrink-0 ${hasPendingApproval ? "text-amber-400" : "text-green-500"}`} data-testid={`icon-done-${task.id}`} />
                  }
                </motion.div>
              )}
              {/* Multi-Completion Counter Badge */}
              {task.maxCompletions !== null && task.maxCompletions !== undefined && (
                <Badge 
                  variant="secondary" 
                  className="shrink-0 text-xs"
                  data-testid={`badge-multi-completion-${task.id}`}
                >
                  {(task.completions?.filter(c => c.status === "approved").length) || 0}/{task.maxCompletions}
                </Badge>
              )}
            </div>
            
            {/* Show next available date for recurring tasks - separate line so title stays visible */}
            {isUnavailable && getNextAvailableText() && (
              <div className="mb-1">
                <Badge variant="outline" className="text-xs gap-1" data-testid={`badge-next-available-${task.id}`}>
                  <Calendar className="h-3 w-3" />
                  {getNextAvailableText()}
                </Badge>
              </div>
            )}
            {isWeekendUnavailable && (
              <div className="mb-1">
                <Badge variant="outline" className="text-xs gap-1 text-muted-foreground" data-testid={`badge-weekend-${task.id}`}>
                  <Moon className="h-3 w-3" />
                  {t('tasks.weekendUnavailable')}
                </Badge>
              </div>
            )}

            {/* Due date display for one-time tasks */}
            {task.dueDate && task.recurrence === "none" && (() => {
              const dateStr = typeof task.dueDate === "string" ? task.dueDate.substring(0, 10) : String(task.dueDate).substring(0, 10);
              const dueDate = parse(dateStr, "yyyy-MM-dd", new Date());
              if (isNaN(dueDate.getTime())) return null;
              const locale = getDateLocale();
              const dueDateIsToday = isToday(dueDate);
              const dueDateIsTomorrow = isTomorrow(dueDate);
              
              let colorClass = "text-muted-foreground";
              let badgeText = format(dueDate, "EEEE, d. MMM", { locale });
              
              if (dueDateInfo.expired) {
                colorClass = "text-destructive";
                badgeText = t('tasks.dueDateExpired');
              } else if (dueDateInfo.isLate) {
                colorClass = "text-amber-600 dark:text-amber-400";
                badgeText = t('tasks.dueDateLate', { days: dueDateInfo.daysPast });
              } else if (dueDateIsToday) {
                colorClass = "text-amber-600 dark:text-amber-400";
                badgeText = t('kidDashboard.dueTodayHurry');
              } else if (dueDateInfo.notYet) {
                colorClass = "text-muted-foreground";
                badgeText = t('tasks.dueDateNotYet', { date: format(dueDate, "EEEE, d. MMM", { locale }) });
              } else if (dueDateIsTomorrow) {
                badgeText = t('kidDashboard.dueTomorrowHurry');
              }

              return (
                <div className="mb-1">
                  <Badge variant="outline" className={`text-xs gap-1 ${colorClass}`} data-testid={`badge-due-date-${task.id}`}>
                    <CalendarDays className="h-3 w-3" />
                    {badgeText}
                  </Badge>
                </div>
              );
            })()}
            
            {task.description && (
              <p
                className="text-sm text-muted-foreground mb-2 line-clamp-2"
                data-testid={`text-task-description-${task.id}`}
              >
                {task.description}
              </p>
            )}

            {/* Shopping List Items */}
            {(task as any).isShoppingList && (
              <ShoppingListSection taskId={task.id} />
            )}

            {/* Multi-Completion Participants */}
            {task.maxCompletions !== null && task.completions && task.completions.length > 0 && (
              <div className="mb-2" data-testid={`participants-${task.id}`}>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">
                  {t('tasks.participants')}:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {task.completions.map((completion) => (
                    <Badge 
                      key={completion.id} 
                      variant="secondary" 
                      className="gap-1.5 text-xs"
                      data-testid={`participant-${completion.memberId}`}
                    >
                      <Avatar className="h-4 w-4">
                        <AvatarImage src={getAvatarUrl(completion.memberActiveSkinId, completion.memberAvatarUrl, completion.memberUseCustomAvatar)} />
                        <AvatarFallback 
                          className="text-xs text-white font-bold"
                          style={{ backgroundColor: completion.memberColor }}
                        >
                          {completion.memberDisplayName[0]}
                        </AvatarFallback>
                      </Avatar>
                      {completion.memberDisplayName}
                      {completion.status === "pending" && " ⏳"}
                      {completion.status === "approved" && " ✓"}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Multi-Assignment Task Progress (new style - uses taskAssignments) */}
            {task.assignedMemberCompletions && task.assignedMemberCompletions.length > 1 && (
              <div className="mb-2" data-testid={`assigned-progress-${task.id}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs font-medium text-muted-foreground">
                    {t('tasks.sharedProgress', {
                      completed: task.assignedMemberCompletions.filter(m => m.hasCompleted).length,
                      total: task.assignedMemberCompletions.length
                    })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {task.assignedMemberCompletions.map((member) => {
                    const hasSubmitted = member.hasSubmitted ?? (member.status !== null);
                    return (
                      <Badge 
                        key={member.memberId} 
                        variant={hasSubmitted ? "default" : "outline"}
                        className="gap-1.5 text-xs"
                        data-testid={`assigned-member-${member.memberId}`}
                      >
                        <Avatar className="h-4 w-4">
                          <AvatarImage src={getAvatarUrl(member.activeSkinId, member.avatarUrl, member.useCustomAvatar)} />
                          <AvatarFallback 
                            className="text-xs text-white font-bold"
                            style={{ backgroundColor: member.color }}
                          >
                            {member.displayName[0]}
                          </AvatarFallback>
                        </Avatar>
                        {member.displayName}
                        {member.status === "approved" ? " ✓" : member.status === "pending" ? " ⏳" : ""}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Legacy Shared Task Progress (uses sharedMemberIds field) */}
            {task.isSharedTask && task.sharedMemberCompletions && task.sharedMemberCompletions.length > 0 && !task.assignedMemberCompletions && (
              <div className="mb-2" data-testid={`shared-progress-${task.id}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs font-medium text-muted-foreground">
                    {t('tasks.sharedProgress', {
                      completed: task.sharedMemberCompletions.filter(m => m.hasCompleted).length,
                      total: task.sharedMemberCompletions.length
                    })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {task.sharedMemberCompletions.map((member) => (
                    <Badge 
                      key={member.memberId} 
                      variant={member.hasCompleted ? "default" : "outline"}
                      className="gap-1.5 text-xs"
                      data-testid={`shared-member-${member.memberId}`}
                    >
                      <Avatar className="h-4 w-4">
                        <AvatarImage src={getAvatarUrl(member.activeSkinId, member.avatarUrl, member.useCustomAvatar)} />
                        <AvatarFallback 
                          className="text-xs text-white font-bold"
                          style={{ backgroundColor: member.color }}
                        >
                          {member.displayName[0]}
                        </AvatarFallback>
                      </Avatar>
                      {member.displayName}
                      {member.hasCompleted ? " ✓" : ""}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {task.requiresProof && (
                <div className="flex items-center gap-1" data-testid={`icon-requires-proof-${task.id}`}>
                  <Camera className="h-3 w-3" />
                  <span>{t('tasks.photoRequired')}</span>
                </div>
              )}
              
              {!task.requiresApproval && (
                <div className="flex items-center gap-1 text-primary" data-testid={`icon-auto-approved-${task.id}`}>
                  <Zap className="h-3 w-3" />
                  <span>{t('tasks.autoApproved')}</span>
                </div>
              )}

              {showAssignee && assignedTo && (
                <div className="flex items-center gap-1.5">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={getAvatarUrl(assignedTo.activeSkinId, assignedTo.avatarUrl, assignedTo.useCustomAvatar)} />
                    <AvatarFallback
                      style={{ backgroundColor: assignedTo.color }}
                      className="text-white text-xs"
                    >
                      {assignedTo.displayName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs" data-testid={`text-assignee-${task.id}`}>
                    {assignedTo.displayName}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Compact complete button — hidden for shopping list tasks */}
          {onComplete && !(task as any).isShoppingList && (
            isSharedTaskNotAssigned ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="outline"
                    className="flex-shrink-0 opacity-50 cursor-not-allowed"
                    onClick={(e) => e.stopPropagation()}
                    disabled
                    data-testid={`button-complete-task-${task.id}`}
                  >
                    <Lock className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('tasks.sharedTaskNotAssigned', { members: assignedMemberNames })}</p>
                </TooltipContent>
              </Tooltip>
            ) : (dueDateInfo.notYet || dueDateInfo.expired) ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="outline"
                    className="flex-shrink-0 opacity-50 cursor-not-allowed"
                    onClick={(e) => e.stopPropagation()}
                    disabled
                    data-testid={`button-complete-task-${task.id}`}
                  >
                    <Lock className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{dueDateInfo.notYet 
                    ? t('tasks.dueDateNotYetTooltip') 
                    : t('tasks.dueDateExpiredTooltip')}</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <Button
                size="icon"
                variant={isGrayedOut ? "outline" : "default"}
                className="flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isGrayedOut) {
                    onComplete(task.id);
                  }
                }}
                disabled={isCompleting || isGrayedOut}
                data-testid={`button-complete-task-${task.id}`}
              >
                <CheckCircle className="h-5 w-5" />
              </Button>
            )
          )}
        </div>
      </Card>
    </motion.div>
  );
}
