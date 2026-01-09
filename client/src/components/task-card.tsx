import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Camera, CheckCircle, Zap, Star, Users, Lock } from "lucide-react";
import type { Task, FamilyMember } from "@shared/schema";
import { getAvatarUrl } from "@/lib/skins";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";


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
  };
  assignedTo?: FamilyMember;
  onComplete?: (taskId: string) => void;
  isCompleting?: boolean;
  showAssignee?: boolean;
  onClick?: (task: Task) => void;
  currentMemberId?: string;
}

export function TaskCard({
  task,
  assignedTo,
  onComplete,
  isCompleting = false,
  showAssignee = true,
  onClick,
  currentMemberId,
}: TaskCardProps) {
  const { t } = useTranslation();
  // Check if task is currently unavailable (future nextAvailableDate)
  const isUnavailable = !!(task.nextAvailableDate && new Date(task.nextAvailableDate) > new Date());
  
  // Check if this member has already completed this multi-completion task
  const isCompletedByMember = task.memberHasCompleted || false;
  
  // Check if this is a shared task and current member is NOT assigned
  const isSharedTaskNotAssigned = task.isSharedTask && 
    task.sharedMemberIds && 
    task.sharedMemberIds.length > 0 && 
    currentMemberId && 
    !task.sharedMemberIds.includes(currentMemberId);
  
  // Get assigned member names for tooltip
  const assignedMemberNames = task.sharedMemberCompletions?.map(m => m.displayName).join(' & ') || '';
  
  // Task should appear grayed out if it's unavailable OR completed by this member
  const isGrayedOut = isUnavailable || isCompletedByMember;
  
  return (
    <motion.div
      className="min-h-[140px] min-w-0 w-full"
      initial={false}
      animate={{
        opacity: isGrayedOut ? 0.6 : 1,
        scale: 1,
      }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      whileTap={onClick ? { scale: 0.98 } : undefined}
    >
      <Card
        className={`p-4 transition-all min-h-[140px] h-full flex flex-col ${onClick ? 'hover-elevate active-elevate-2 cursor-pointer' : ''}`}
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
              {isGrayedOut && (
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                >
                  <CheckCircle className="h-5 w-5 text-green-500 shrink-0" data-testid={`icon-done-${task.id}`} />
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
            
            {task.description && (
              <p
                className="text-sm text-muted-foreground mb-2 line-clamp-2"
                data-testid={`text-task-description-${task.id}`}
              >
                {task.description}
              </p>
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

            {/* Shared Task Progress */}
            {task.isSharedTask && task.sharedMemberCompletions && task.sharedMemberCompletions.length > 0 && (
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

          {/* Compact complete button on right */}
          {onComplete && (
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
