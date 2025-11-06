import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Calendar, Camera, CheckCircle, Zap } from "lucide-react";
import type { Task, FamilyMember } from "@shared/schema";
import { format } from "date-fns";
import { getAvatarUrl } from "@/lib/skins";

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
  return (
    <Card
      className={`p-6 transition-all ${onClick ? 'hover-elevate active-elevate-2 cursor-pointer' : ''}`}
      data-testid={`card-task-${task.id}`}
      onClick={() => onClick?.(task)}
    >
      <div className="flex items-start gap-4">
        <div className="text-5xl" data-testid={`text-task-icon-${task.id}`}>
          {task.iconEmoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3
              className="text-xl font-semibold truncate"
              data-testid={`text-task-title-${task.id}`}
            >
              {task.title}
            </h3>
            <Badge
              className="shrink-0 gradient-achievement text-white border-0"
              data-testid={`badge-points-${task.id}`}
            >
              {task.points} pts
            </Badge>
          </div>
          
          {task.description && (
            <p
              className="text-sm text-muted-foreground mb-3 line-clamp-2"
              data-testid={`text-task-description-${task.id}`}
            >
              {task.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-4">
            {task.dueDate && (
              <div className="flex items-center gap-1" data-testid={`text-task-due-${task.id}`}>
                <Calendar className="h-4 w-4" />
                <span>{format(new Date(task.dueDate), "MMM d")}</span>
              </div>
            )}
            
            {task.requiresProof && (
              <div className="flex items-center gap-1" data-testid={`icon-requires-proof-${task.id}`}>
                <Camera className="h-4 w-4" />
                <span>Photo required</span>
              </div>
            )}
            
            {!task.requiresApproval && (
              <div className="flex items-center gap-1 text-primary" data-testid={`icon-auto-approved-${task.id}`}>
                <Zap className="h-4 w-4" />
                <span>Auto-approved</span>
              </div>
            )}

            {showAssignee && assignedTo && (
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
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

          {onComplete && (
            <Button
              className="w-full"
              onClick={(e) => {
                e.stopPropagation();
                onComplete(task.id);
              }}
              disabled={isCompleting}
              data-testid={`button-complete-task-${task.id}`}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {isCompleting ? "Completing..." : "Mark Complete"}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
