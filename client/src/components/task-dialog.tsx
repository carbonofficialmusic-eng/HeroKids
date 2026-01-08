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
  dueDate: z.string().optional(),
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

const taskIcons = ["⭐", "🧹", "🍽️", "🗑️", "🧺", "🛁", "🌱", "📚", "🐕", "🚗"];

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
  
  // Predefined task templates for common chores
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
    {
      id: "laundry",
      title: t('taskTemplates.laundry.title'),
      description: t('taskTemplates.laundry.description'),
      points: 35,
      iconEmoji: "🧺",
      requiresProof: false,
    },
    {
      id: "school-work",
      title: t('taskTemplates.schoolWork.title'),
      description: t('taskTemplates.schoolWork.description'),
      points: 20,
      iconEmoji: "✏️",
      requiresProof: false,
    },
    {
      id: "vacuum",
      title: t('taskTemplates.vacuum.title'),
      description: t('taskTemplates.vacuum.description'),
      points: 30,
      iconEmoji: "🧹",
      requiresProof: true,
    },
    {
      id: "dentist",
      title: t('taskTemplates.dentist.title'),
      description: t('taskTemplates.dentist.description'),
      points: 200,
      iconEmoji: "🦷",
      requiresProof: false,
      recurrence: "yearly" as const,
    },
  ];
  
  // Track which recurrence mode is selected
  const [recurrenceMode, setRecurrenceMode] = useState<"standard" | "custom">("standard");
  
  // Local state for maxCompletions input (allows empty string during editing)
  const [maxCompletionsInput, setMaxCompletionsInput] = useState<string>("");
  
  // State for shared task member selection
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
      dueDate: "",
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
        
        // Clamp maxCompletions to current family size to handle edge case where family shrunk
        let clampedMaxCompletions = editingTask.maxCompletions || undefined;
        if (clampedMaxCompletions !== undefined) {
          // If family shrunk below 2 members, disable multi-completion feature
          if (totalMemberCount < 2) {
            clampedMaxCompletions = undefined;
          } else {
            // Otherwise, clamp to valid range [2, totalMemberCount]
            clampedMaxCompletions = Math.max(2, Math.min(clampedMaxCompletions, totalMemberCount));
          }
        }
        
        form.reset({
          familyName: editingTask.familyName,
          createdBy: editingTask.createdBy,
          title: editingTask.title,
          description: editingTask.description || "",
          points: editingTask.points,
          dueDate: editingTask.dueDate 
            ? (editingTask.dueDate instanceof Date 
                ? editingTask.dueDate.toISOString().split('T')[0] 
                : editingTask.dueDate)
            : "",
          recurrence: editingTask.recurrence,
          recurrenceDays: editingTask.recurrenceDays || undefined,
          status: editingTask.status,
          requiresProof: editingTask.requiresProof,
          requiresApproval: editingTask.requiresApproval ?? true,
          iconEmoji: editingTask.iconEmoji || "⭐",
          maxCompletions: clampedMaxCompletions,
          isSharedTask: editingTask.isSharedTask || false,
          sharedMemberIds: editingTask.sharedMemberIds || [],
        });
        // Sync local input state with field value
        setMaxCompletionsInput(clampedMaxCompletions !== undefined ? String(clampedMaxCompletions) : "");
        // Sync shared members state
        setSelectedSharedMembers(editingTask.sharedMemberIds || []);
      } else {
        setRecurrenceMode("standard");
        form.reset({
          familyName,
          createdBy,
          title: "",
          description: "",
          points: 10,
          dueDate: "",
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
        // Clear local input state for new task
        setMaxCompletionsInput("");
        // Clear shared members state
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
    
    // Handle shared task - sync selectedSharedMembers to form data
    if (submitData.isSharedTask) {
      submitData.sharedMemberIds = selectedSharedMembers;
      // Clear maxCompletions when using shared task (they are mutually exclusive)
      submitData.maxCompletions = undefined;
    } else {
      submitData.sharedMemberIds = [];
    }
    
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
    
    // Apply recurrence if template has it
    if ('recurrence' in template && template.recurrence) {
      form.setValue("recurrence", template.recurrence);
      setRecurrenceMode("standard");
    }
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
            <FormField
              control={form.control}
              name="maxCompletions"
              render={({ field }) => {
                const isDisabled = totalMemberCount < 2;
                
                return (
                  <FormItem className="space-y-3">
                    <FormLabel className={isDisabled ? "text-muted-foreground" : ""}>
                      {t('tasks.multiCompletionLabel')}
                    </FormLabel>
                    <FormDescription>
                      {isDisabled ? (
                        `⚠️ ${t('tasks.multiCompletionDescDisabled')}`
                      ) : (
                        t('tasks.multiCompletionDesc', { max: totalMemberCount })
                      )}
                    </FormDescription>
                    <div className="flex items-center gap-4">
                      <Switch
                        checked={typeof field.value === 'number'}
                        disabled={isDisabled}
                        onCheckedChange={(checked) => {
                          // Prevent enabling if less than 2 family members
                          if (checked && totalMemberCount < 2) {
                            toast({
                              title: t('tasks.multiCompletionNotAvailable'),
                              description: t('tasks.multiCompletionNotAvailableDesc'),
                              variant: "destructive",
                            });
                            return;
                          }
                          
                          // When enabling: set to totalMemberCount (or 2 minimum)
                          // When disabling: clear the value to undefined
                          if (checked) {
                            if (totalMemberCount < 2) {
                              field.onChange(undefined);
                              setMaxCompletionsInput("");
                              toast({
                                title: t('tasks.multiCompletionDisabled'),
                                description: t('tasks.multiCompletionDisabledDesc'),
                                variant: "destructive",
                              });
                            } else {
                              // Set to totalMemberCount as default
                              field.onChange(totalMemberCount);
                              setMaxCompletionsInput(String(totalMemberCount));
                            }
                          } else {
                            field.onChange(undefined);
                            setMaxCompletionsInput("");
                          }
                        }}
                        data-testid="toggle-multi-completion"
                      />
                      {typeof field.value === 'number' && !isDisabled && (
                        <div className="flex items-center gap-2">
                          <FormLabel className="text-sm">{t('tasks.multiCompletionTimes')}</FormLabel>
                          <Input
                            type="number"
                            min={2}
                            max={totalMemberCount}
                            value={maxCompletionsInput}
                            onChange={(e) => {
                              const val = e.target.value;
                              // Update local state (allows empty string)
                              setMaxCompletionsInput(val);
                              
                              // Update field value for form validation
                              if (val === '') {
                                // Don't update field.value during typing, only on blur
                                return;
                              }
                              const numVal = parseInt(val);
                              if (!isNaN(numVal)) {
                                // Update field value without clamping
                                field.onChange(numVal);
                              }
                            }}
                            onBlur={() => {
                              // Clamp to valid range when user finishes editing
                              if (maxCompletionsInput === '') {
                                // If empty, reset to minimum
                                field.onChange(2);
                                setMaxCompletionsInput("2");
                                return;
                              }
                              const numVal = parseInt(maxCompletionsInput);
                              if (!isNaN(numVal)) {
                                const clamped = Math.max(2, Math.min(numVal, totalMemberCount));
                                field.onChange(clamped);
                                setMaxCompletionsInput(String(clamped));
                              } else {
                                // Invalid input, reset to minimum
                                field.onChange(2);
                                setMaxCompletionsInput("2");
                              }
                            }}
                            onFocus={(e) => e.target.select()} // Auto-select on focus for easy editing
                            className="w-20"
                            data-testid="input-max-completions"
                          />
                        </div>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            {/* Shared Task Section */}
            <FormField
              control={form.control}
              name="isSharedTask"
              render={({ field }) => {
                const isDisabled = allMembers.length < 2;
                const isSharedEnabled = field.value === true;
                const maxCompletionsValue = form.watch("maxCompletions");
                const hasMaxCompletions = typeof maxCompletionsValue === 'number';
                
                return (
                  <FormItem className="space-y-3">
                    <FormLabel className={isDisabled || hasMaxCompletions ? "text-muted-foreground" : ""}>
                      {t('tasks.sharedTaskLabel')}
                    </FormLabel>
                    <FormDescription>
                      {isDisabled ? (
                        `⚠️ ${t('tasks.sharedTaskDescDisabled')}`
                      ) : hasMaxCompletions ? (
                        `⚠️ ${t('tasks.sharedTaskDescMutuallyExclusive')}`
                      ) : (
                        t('tasks.sharedTaskDesc')
                      )}
                    </FormDescription>
                    <div className="flex items-center gap-4">
                      <Switch
                        checked={isSharedEnabled}
                        disabled={isDisabled || hasMaxCompletions}
                        onCheckedChange={(checked) => {
                          field.onChange(checked);
                          if (!checked) {
                            setSelectedSharedMembers([]);
                          }
                        }}
                        data-testid="toggle-shared-task"
                      />
                    </div>
                    
                    {/* Member Selection */}
                    {isSharedEnabled && !isDisabled && (
                      <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                        <FormLabel className="text-sm">{t('tasks.selectMembers')}</FormLabel>
                        <div className="flex flex-wrap gap-2">
                          {allMembers.map((member) => {
                            const isSelected = selectedSharedMembers.includes(member.id);
                            return (
                              <Badge
                                key={member.id}
                                variant={isSelected ? "default" : "outline"}
                                className="cursor-pointer transition-all"
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedSharedMembers(prev => prev.filter(id => id !== member.id));
                                  } else {
                                    setSelectedSharedMembers(prev => [...prev, member.id]);
                                  }
                                }}
                                data-testid={`badge-member-${member.id}`}
                              >
                                {member.displayName}
                              </Badge>
                            );
                          })}
                        </div>
                        {selectedSharedMembers.length >= 2 && (
                          <p className="text-xs text-muted-foreground mt-2">
                            {t('tasks.pointsSplit', { 
                              points: Math.floor((form.watch("points") || 10) / selectedSharedMembers.length),
                              count: selectedSharedMembers.length
                            })}
                          </p>
                        )}
                        {selectedSharedMembers.length < 2 && (
                          <p className="text-xs text-destructive mt-2">
                            {t('tasks.selectAtLeastTwo')}
                          </p>
                        )}
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

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
              
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">{t('tasks.quickTemplates')}</h3>
                  <Badge variant="secondary">{t('tasks.popular')}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {taskTemplates.map((template) => (
                    <Card
                      key={template.id}
                      className="p-3 cursor-pointer hover-elevate active-elevate-2 transition-all"
                      onClick={() => applyTemplate(template)}
                      data-testid={`template-${template.id}`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-2xl">{template.iconEmoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{template.title}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <span>{template.points} {t('tasks.pts')}</span>
                          </div>
                        </div>
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
                  <FormLabel>{t('tasks.taskIcon')}</FormLabel>
                  <div className="grid grid-cols-5 gap-2">
                    {taskIcons.map((icon) => (
                      <Button
                        key={icon}
                        type="button"
                        variant={field.value === icon ? "default" : "outline"}
                        className="h-12 text-2xl"
                        onClick={() => field.onChange(icon)}
                        data-testid={`button-icon-${icon}`}
                      >
                        {icon}
                      </Button>
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

            {/* Due Date - Only shown for one-time tasks */}
            {form.watch("recurrence") === "none" && recurrenceMode === "standard" && (
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('tasks.dueDateOptional')}</FormLabel>
                    <FormDescription>
                      {t('tasks.dueDateDesc')}
                    </FormDescription>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        data-testid="input-task-due-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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
