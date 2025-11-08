import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Calendar, Camera, CheckCircle, Zap, Star } from "lucide-react";
import type { Task, FamilyMember } from "@shared/schema";
import { format } from "date-fns";
import { getAvatarUrl } from "@/lib/skins";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

interface TaskCardProps {
  task: Task;
  assignedTo?: FamilyMember;
  onComplete?: (taskId: string) => void;
  isCompleting?: boolean;
  showAssignee?: boolean;
  onClick?: (task: Task) => void;
}

export function TaskCard({
  task,
  assignedTo,
  onComplete,
  isCompleting = false,
  showAssignee = true,
  onClick,
}: TaskCardProps) {
  const { t } = useTranslation();
  // Check if task is currently unavailable (future nextAvailableDate)
  const isUnavailable = !!(task.nextAvailableDate && new Date(task.nextAvailableDate) > new Date());
  
  return (
    <motion.div
      className="min-h-[140px]"
      initial={false}
      animate={{
        opacity: isUnavailable ? 0.6 : 1,
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
                filter: isUnavailable ? "grayscale(100%)" : "grayscale(0%)",
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
              {isUnavailable && (
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                >
                  <CheckCircle className="h-5 w-5 text-green-500 shrink-0" data-testid={`icon-done-${task.id}`} />
                </motion.div>
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

            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {task.dueDate && (
                <div className="flex items-center gap-1" data-testid={`text-task-due-${task.id}`}>
                  <Calendar className="h-3 w-3" />
                  <span>{format(new Date(task.dueDate), "MMM d")}</span>
                </div>
              )}
              
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
                    <AvatarImage src={getAvatarUrl(assignedTo.activeSkinId, assignedTo.avatarUrl)} />
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
            <Button
              size="icon"
              variant={isUnavailable ? "outline" : "default"}
              className="flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                if (!isUnavailable) {
                  onComplete(task.id);
                }
              }}
              disabled={isCompleting || isUnavailable}
              data-testid={`button-complete-task-${task.id}`}
            >
              <CheckCircle className="h-5 w-5" />
            </Button>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
