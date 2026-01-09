import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTaskSchema, type Task, type FamilyMember } from "@shared/schema";
import { z } from "zod";
import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sparkles, RotateCcw } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const taskFormSchema = insertTaskSchema.extend({
  recurrenceDays: z.number().int().min(1).max(365).optional(),
  maxCompletions: z.number().int().min(2).max(20).optional(),
  isSharedTask: z.boolean().optional(),
  sharedMemberIds: z.array(z.string()).optional(),
});

type TaskFormData = z.infer<typeof taskFormSchema>;

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: TaskFormData) => void;
  isSubmitting?: boolean;
  familyName: string;
  createdBy: string;
  editingTask?: Task | null;
  familyMembers?: FamilyMember[];
}

// Emoji categories for task icons (4 categories, 3 emojis each)
const emojiCategories = {
  household: {
    label: "tasks.emojiCategory.household",
    emojis: ["🧹", "🍽️", "🧺"]
  },
  school: {
    label: "tasks.emojiCategory.school",
    emojis: ["📚", "✏️", "🎒"]
  },
  selfCare: {
    label: "tasks.emojiCategory.selfCare",
    emojis: ["🦷", "🛏️", "👕"]
  },
  other: {
    label: "tasks.emojiCategory.other",
    emojis: ["⭐", "🎯", "🏆"]
  }
};

export function TaskDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
  familyName,
  createdBy,
  editingTask,
  familyMembers = [],
}: TaskDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showResetDialog, setShowResetDialog] = useState(false);
  
  // Calculate total number of family members (parents + children)
  const totalMemberCount = useMemo(() => {
    return familyMembers.length;
  }, [familyMembers]);
  
  // Predefined task templates (4 popular templates in 2x2 grid)
  const taskTemplates = [
    {
      id: "clean-room",
      title: t('taskTemplates.cleanRoom.title'),
      description: t('taskTemplates.cleanRoom.description'),
      points: 30,
      iconEmoji: "🧹",
      requiresProof: true,
    },
    {
      id: "dishes",
      title: t('taskTemplates.dishes.title'),
      description: t('taskTemplates.dishes.description'),
      points: 25,
      iconEmoji: "🍽️",
      requiresProof: false,
    },
    {
      id: "homework",
      title: t('taskTemplates.homework.title'),
      description: t('taskTemplates.homework.description'),
      points: 40,
      iconEmoji: "📚",
      requiresProof: false,
    },
    {
      id: "trash",
      title: t('taskTemplates.trash.title'),
      description: t('taskTemplates.trash.description'),
      points: 15,
      iconEmoji: "🗑️",
      requiresProof: false,
    },
  ];
  
  // Track which recurrence mode is selected
  const [recurrenceMode, setRecurrenceMode] = useState<"standard" | "custom">("standard");
  
  // State for assigned member selection
  const [selectedSharedMembers, setSelectedSharedMembers] = useState<string[]>([]);
  
  // All family members can be assigned to shared tasks (parents and children)
  const allMembers = useMemo(() => {
    return familyMembers;
  }, [familyMembers]);
  
  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      familyName,
      createdBy,
      title: "",
      description: "",
      points: 10,
      recurrence: "none",
      recurrenceDays: undefined,
      status: "active",
      requiresProof: false,
      requiresApproval: true,
      iconEmoji: "⭐",
      maxCompletions: undefined,
      isSharedTask: false,
      sharedMemberIds: [],
    },
  });

  // Reset form when dialog opens or editingTask changes
  useEffect(() => {
    if (open) {
      if (editingTask) {
        // Determine mode based on which field has a value
        if (editingTask.recurrenceDays) {
          setRecurrenceMode("custom");
        } else {
          setRecurrenceMode("standard");
        }
        
        form.reset({
          familyName: editingTask.familyName,
          createdBy: editingTask.createdBy,
          title: editingTask.title,
          description: editingTask.description || "",
          points: editingTask.points,
          recurrence: editingTask.recurrence,
          recurrenceDays: editingTask.recurrenceDays || undefined,
          status: editingTask.status,
          requiresProof: editingTask.requiresProof,
          requiresApproval: editingTask.requiresApproval ?? true,
          iconEmoji: editingTask.iconEmoji || "⭐",
          maxCompletions: undefined,
          isSharedTask: editingTask.isSharedTask || false,
          sharedMemberIds: editingTask.sharedMemberIds || [],
        });
        // Sync assigned members state
        setSelectedSharedMembers(editingTask.sharedMemberIds || []);
      } else {
        setRecurrenceMode("standard");
        form.reset({
          familyName,
          createdBy,
          title: "",
          description: "",
          points: 10,
          recurrence: "none",
          recurrenceDays: undefined,
          status: "active",
          requiresProof: false,
          requiresApproval: true,
          iconEmoji: "⭐",
          maxCompletions: undefined,
          isSharedTask: false,
          sharedMemberIds: [],
        });
        // Clear assigned members state
        setSelectedSharedMembers([]);
      }
    }
  }, [open, editingTask, familyName, createdBy, totalMemberCount]);

  const handleSubmit = (data: TaskFormData) => {
    // Create a copy and clear the field that's not being used based on mode
    const submitData = { ...data };
    if (recurrenceMode === "standard") {
      submitData.recurrenceDays = undefined;
    } else {
      submitData.recurrence = "none";
    }
    
    // Handle task assignment
    // - No members selected: all children can complete (isSharedTask = false)
    // - 1 member selected: exclusive task for that child (isSharedTask = true, but single member)
    // - 2+ members selected: shared task with split points (isSharedTask = true)
    if (selectedSharedMembers.length > 0) {
      submitData.isSharedTask = true;
      submitData.sharedMemberIds = selectedSharedMembers;
    } else {
      submitData.isSharedTask = false;
      submitData.sharedMemberIds = [];
    }
    
    // Clear maxCompletions as it's no longer used
    submitData.maxCompletions = undefined;
    
    onSubmit(submitData);
  };
  
  const handleRecurrenceModeChange = (mode: "standard" | "custom") => {
    setRecurrenceMode(mode);
    // Clear the opposite field when switching modes
    if (mode === "standard") {
      form.setValue("recurrenceDays", undefined);
      form.setValue("recurrence", "none");
    } else {
      form.setValue("recurrence", "none");
      form.setValue("recurrenceDays", undefined);
    }
  };

  const applyTemplate = (template: typeof taskTemplates[0]) => {
    form.setValue("title", template.title);
    form.setValue("description", template.description);
    form.setValue("points", template.points);
    form.setValue("iconEmoji", template.iconEmoji);
    form.setValue("requiresProof", template.requiresProof);
  };

  // Manual task reset mutation
  const resetTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return await apiRequest("POST", `/api/tasks/${taskId}/reset`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: t('tasks.resetSuccess'),
        description: t('tasks.resetSuccessDesc'),
      });
      setShowResetDialog(false);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: t('tasks.resetError'),
        description: error.message || t('tasks.resetErrorDesc'),
        variant: "destructive",
      });
    },
  });

  const handleResetClick = () => {
    if (editingTask) {
      resetTaskMutation.mutate(editingTask.id);
    }
  };

  // Check if task is recurring (for showing reset button)
  const isRecurringTask = editingTask && (
    editingTask.recurrence !== "none" || 
    (editingTask.recurrenceDays && editingTask.recurrenceDays > 0)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-create-task">
        <DialogHeader>
          <DialogTitle className="text-2xl font-accent">
            {editingTask ? t('tasks.editTask') : t('tasks.createTask')}
          </DialogTitle>
          <DialogDescription>
            {editingTask ? t('tasks.updateDetails') : t('tasks.setupNewTask')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">

            {/* Quick Templates Section - Only show when creating */}
            {!editingTask && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">{t('tasks.orChooseTemplate')}</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">{t('tasks.quickTemplates')}</h3>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {taskTemplates.map((template) => (
                    <Card
                      key={template.id}
                      className="p-2 cursor-pointer hover-elevate active-elevate-2 transition-all"
                      onClick={() => applyTemplate(template)}
                      data-testid={`template-${template.id}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-lg">{template.iconEmoji}</span>
                        <span className="font-medium text-xs truncate">{template.title}</span>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">{t('tasks.orCustomize')}</span>
                </div>
              </div>
            </>
            )}

            <FormField
              control={form.control}
              name="iconEmoji"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('tasks.category')}</FormLabel>
                  <div className="grid grid-cols-4 gap-3">
                    {Object.entries(emojiCategories).map(([categoryKey, category]) => (
                      <div key={categoryKey} className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium text-center">
                          {t(category.label)}
                        </p>
                        <div className="flex justify-center gap-1">
                          {category.emojis.map((icon) => (
                            <Button
                              key={icon}
                              type="button"
                              variant={field.value === icon ? "default" : "outline"}
                              size="icon"
                              className="h-8 w-8 text-base"
                              onClick={() => field.onChange(icon)}
                              data-testid={`button-icon-${icon}`}
                            >
                              {icon}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('tasks.taskTitle')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('tasks.taskTitlePlaceholder')}
                      {...field}
                      data-testid="input-task-title"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('tasks.descriptionOptional')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('tasks.descriptionPlaceholder')}
                      {...field}
                      value={field.value || ""}
                      maxLength={100}
                      data-testid="input-task-description"
                    />
                  </FormControl>
                  <FormDescription className="text-xs text-right">
                    {t('tasks.charactersCount', { count: (field.value || "").length })}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="points"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('tasks.pointsValue', { value: field.value })}</FormLabel>
                  <FormControl>
                    <Slider
                      min={10}
                      max={500}
                      step={5}
                      value={[field.value || 10]}
                      onValueChange={(vals) => field.onChange(vals[0])}
                      data-testid="slider-task-points"
                    />
                  </FormControl>
                  <FormDescription>
                    {t('tasks.pointsQuestion')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Task Assignment Section */}
            <FormField
              control={form.control}
              name="isSharedTask"
              render={({ field }) => {
                const hasMembers = allMembers.length > 0;
                
                return (
                  <FormItem className="space-y-3">
                    <FormLabel>{t('tasks.assignedToLabel')}</FormLabel>
                    <FormDescription>
                      {t('tasks.assignedToDescAll')}
                    </FormDescription>
                    
                    {hasMembers ? (
                      <div className="flex flex-wrap gap-2">
                        {allMembers.map((member) => {
                          const isSelected = selectedSharedMembers.includes(member.id);
                          return (
                            <Badge
                              key={member.id}
                              variant={isSelected ? "default" : "outline"}
                              className="cursor-pointer transition-all py-1.5 px-3"
                              onClick={() => {
                                let newSelection: string[];
                                if (isSelected) {
                                  newSelection = selectedSharedMembers.filter(id => id !== member.id);
                                } else {
                                  newSelection = [...selectedSharedMembers, member.id];
                                }
                                setSelectedSharedMembers(newSelection);
                                field.onChange(newSelection.length > 0);
                              }}
                              data-testid={`badge-assign-${member.id}`}
                            >
                              {member.displayName}
                            </Badge>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {t('tasks.noMembersToAssign')}
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <div className="space-y-4">
              <div>
                <FormLabel>{t('tasks.recurrenceType')}</FormLabel>
                <RadioGroup
                  value={recurrenceMode}
                  onValueChange={handleRecurrenceModeChange}
                  className="grid grid-cols-2 gap-4 mt-2"
                  data-testid="radio-recurrence-mode"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="standard" id="standard" data-testid="radio-standard" />
                    <label
                      htmlFor="standard"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {t('tasks.standardRecurrence')}
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="custom" id="custom" data-testid="radio-custom" />
                    <label
                      htmlFor="custom"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {t('tasks.customDaysRecurrence')}
                    </label>
                  </div>
                </RadioGroup>
                <p className="text-sm text-muted-foreground mt-2">
                  {recurrenceMode === "standard" 
                    ? t('tasks.standardRecurrenceDesc')
                    : t('tasks.customDaysDesc')}
                </p>
              </div>

              {recurrenceMode === "standard" && (
                <FormField
                  control={form.control}
                  name="recurrence"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('tasks.repeatSchedule')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-task-recurrence">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">{t('tasks.oneTime')}</SelectItem>
                          <SelectItem value="daily">{t('tasks.daily')}</SelectItem>
                          <SelectItem value="weekly">{t('tasks.weekly')}</SelectItem>
                          <SelectItem value="monthly">{t('tasks.monthly')}</SelectItem>
                          <SelectItem value="yearly">{t('tasks.yearly')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {recurrenceMode === "custom" && (
                <FormField
                  control={form.control}
                  name="recurrenceDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('tasks.repeatEveryDays')}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          max="365"
                          placeholder={t('tasks.repeatEveryPlaceholder')}
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          data-testid="input-recurrence-days"
                        />
                      </FormControl>
                      <FormDescription>
                        {t('tasks.repeatEveryDesc')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <FormField
              control={form.control}
              name="requiresProof"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">{t('tasks.photoProof')}</FormLabel>
                    <FormDescription>
                      {t('tasks.photoProofDesc')}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-requires-proof"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="requiresApproval"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">{t('tasks.parentApproval')}</FormLabel>
                    <FormDescription>
                      {t('tasks.parentApprovalDesc')}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-requires-approval"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-task"
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={isSubmitting}
                data-testid="button-submit-task"
              >
                {isSubmitting ? (editingTask ? t('tasks.updating') : t('tasks.creating')) : editingTask ? t('tasks.updateTaskButton') : t('tasks.createTaskButton')}
              </Button>
            </div>

            {isRecurringTask && (
              <div className="pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowResetDialog(true)}
                  data-testid="button-reset-task"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {t('tasks.resetTask')}
                </Button>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  {t('tasks.resetTaskDesc')}
                </p>
              </div>
            )}
          </form>
        </Form>
      </DialogContent>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent data-testid="dialog-reset-confirmation">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('tasks.resetTaskConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('tasks.resetTaskConfirmDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-reset">
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetClick}
              disabled={resetTaskMutation.isPending}
              data-testid="button-confirm-reset"
            >
              {resetTaskMutation.isPending ? t('tasks.resetting') : t('tasks.resetConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
