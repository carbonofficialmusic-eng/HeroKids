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
import { Sparkles, RotateCcw, CalendarIcon, X, Lock } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, parse, type Locale } from "date-fns";
import { de, enUS, fr, es, ja, zhCN, ko, sv } from "date-fns/locale";

const dateFnsLocales: Record<string, Locale> = {
  de, en: enUS, fr, es, ja, zh: zhCN, ko, sv,
};

const taskFormSchema = insertTaskSchema.extend({
  recurrenceDays: z.number().int().min(1).max(365).optional(),
  maxCompletions: z.number().int().min(2).max(20).optional(),
  isSharedTask: z.boolean().optional(),
  sharedMemberIds: z.array(z.string()).optional(),
  dueDate: z.string().optional().nullable(),
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
  subscriptionTier?: string;
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
  subscriptionTier = "free",
}: TaskDialogProps) {
  const canAssignMembers = subscriptionTier !== "free";
  const { t, i18n } = useTranslation();
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
      id: "homework",
      title: t('taskTemplates.homework.title'),
      description: t('taskTemplates.homework.description'),
      points: 40,
      iconEmoji: "📚",
      requiresProof: false,
    },
    {
      id: "brush-teeth",
      title: t('taskTemplates.brushTeeth.title'),
      description: t('taskTemplates.brushTeeth.description'),
      points: 10,
      iconEmoji: "🦷",
      requiresProof: false,
    },
    {
      id: "help-out",
      title: t('taskTemplates.helpOut.title'),
      description: t('taskTemplates.helpOut.description'),
      points: 20,
      iconEmoji: "🌟",
      requiresProof: false,
    },
  ];
  
  // Track which recurrence mode is selected
  const [recurrenceMode, setRecurrenceMode] = useState<"standard" | "custom" | "immediate">("standard");
  
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
      iconEmoji: "🧹",
      maxCompletions: undefined,
      isSharedTask: false,
      sharedMemberIds: [],
      dueDate: undefined,
    },
  });

  // Reset form when dialog opens or editingTask changes
  useEffect(() => {
    if (open) {
      if (editingTask) {
        // Determine mode based on which field has a value
        if (editingTask.recurrence === "immediate") {
          setRecurrenceMode("immediate");
        } else if (editingTask.recurrenceDays) {
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
          iconEmoji: editingTask.iconEmoji || "🧹",
          maxCompletions: undefined,
          isSharedTask: editingTask.isSharedTask || false,
          sharedMemberIds: editingTask.sharedMemberIds || [],
          dueDate: editingTask.dueDate || undefined,
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
          iconEmoji: "🧹",
          maxCompletions: undefined,
          isSharedTask: false,
          sharedMemberIds: [],
          dueDate: undefined,
        });
        // Clear assigned members state
        setSelectedSharedMembers([]);
      }
    }
  }, [open, editingTask, familyName, createdBy, totalMemberCount]);

  const handleSubmit = (data: TaskFormData) => {
    const submitData = { ...data };
    if (recurrenceMode === "immediate") {
      submitData.recurrence = "immediate";
      submitData.recurrenceDays = undefined;
      submitData.requiresApproval = true;
      submitData.dueDate = undefined;
    } else if (recurrenceMode === "standard") {
      submitData.recurrenceDays = undefined;
      if (submitData.recurrence !== "none") {
        submitData.dueDate = undefined;
      }
    } else {
      submitData.recurrence = "none";
      submitData.dueDate = undefined;
    }
    
    if (selectedSharedMembers.length > 0) {
      submitData.isSharedTask = true;
      submitData.sharedMemberIds = selectedSharedMembers;
    } else {
      submitData.isSharedTask = false;
      submitData.sharedMemberIds = [];
    }
    
    submitData.maxCompletions = undefined;
    
    onSubmit(submitData);
  };
  
  const handleRecurrenceModeChange = (mode: "standard" | "custom" | "immediate") => {
    setRecurrenceMode(mode);
    if (mode === "immediate") {
      form.setValue("recurrence", "immediate");
      form.setValue("recurrenceDays", undefined);
      form.setValue("requiresApproval", true);
      form.setValue("dueDate", undefined);
    } else if (mode === "standard") {
      form.setValue("recurrenceDays", undefined);
      form.setValue("recurrence", "none");
    } else {
      form.setValue("recurrence", "none");
      form.setValue("recurrenceDays", undefined);
      form.setValue("dueDate", undefined);
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-create-task" onOpenAutoFocus={(e) => e.preventDefault()}>
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
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {Object.entries(emojiCategories).map(([categoryKey, category]) => (
                      <div key={categoryKey} className="space-y-1.5">
                        <p className="text-xs text-muted-foreground font-medium text-center min-h-[2rem] flex items-center justify-center">
                          {t(category.label)}
                        </p>
                        <div className="flex justify-center gap-1.5">
                          {category.emojis.map((icon) => (
                            <Button
                              key={icon}
                              type="button"
                              variant={field.value === icon ? "default" : "outline"}
                              size="icon"
                              className="h-9 w-9 text-lg"
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
                      min={5}
                      max={400}
                      step={5}
                      value={[field.value || 5]}
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
                    <div className="flex items-center gap-2">
                      <FormLabel>{t('tasks.assignedToLabel')}</FormLabel>
                      {!canAssignMembers && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Lock className="w-3 h-3" />
                          Family
                        </Badge>
                      )}
                    </div>
                    <FormDescription>
                      {t('tasks.assignedToDescAll')}
                    </FormDescription>
                    
                    {!canAssignMembers ? (
                      <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground flex items-center gap-2">
                        <Lock className="w-4 h-4 shrink-0" />
                        <span>{t('tasks.assignmentLockedDesc', 'Upgrade to Family to assign tasks to specific members.')}</span>
                      </div>
                    ) : hasMembers ? (
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
                  className="flex flex-wrap gap-x-4 gap-y-2 mt-2"
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
                    <RadioGroupItem value="immediate" id="immediate-mode" data-testid="radio-immediate" />
                    <label
                      htmlFor="immediate-mode"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {t('tasks.immediate')}
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
                  {recurrenceMode === "standard" && t('tasks.standardRecurrenceDesc')}
                  {recurrenceMode === "immediate" && t('tasks.immediateRecurrenceDesc')}
                  {recurrenceMode === "custom" && t('tasks.customDaysDesc')}
                </p>
              </div>

              {recurrenceMode === "standard" && (
                <FormField
                  control={form.control}
                  name="recurrence"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('tasks.repeatSchedule')}</FormLabel>
                      <div className="space-y-3">
                        {/* Main recurrence options as tiles */}
                        <div className="flex flex-wrap gap-2">
                          {[
                            { value: "none", label: t('tasks.oneTime') },
                            { value: "daily", label: t('tasks.recurrenceDailyBtn') },
                            { value: "weekly", label: t('tasks.weekly') },
                            { value: "monthly", label: t('tasks.monthly') },
                            { value: "yearly", label: t('tasks.yearly') },
                          ].map((option) => {
                            const isActive = option.value === "daily"
                              ? (field.value === "daily" || field.value === "weekdays")
                              : field.value === option.value;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                  if (option.value === "daily") {
                                    if (field.value !== "daily" && field.value !== "weekdays") {
                                      field.onChange("daily");
                                    }
                                  } else {
                                    field.onChange(option.value);
                                  }
                                }}
                                className={`px-2 py-2 text-xs font-medium rounded-md border transition-colors ${
                                  isActive
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-background hover-elevate border-input"
                                }`}
                                data-testid={`btn-recurrence-${option.value}`}
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                        {/* Sub-options when Täglich is selected */}
                        {(field.value === "daily" || field.value === "weekdays") && (
                          <div className="flex gap-2 pl-1">
                            <button
                              type="button"
                              onClick={() => field.onChange("daily")}
                              className={`px-2 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                                field.value === "daily"
                                  ? "bg-primary/20 text-primary border-primary/50"
                                  : "bg-background hover-elevate border-input"
                              }`}
                              data-testid="btn-recurrence-sub-daily"
                            >
                              {t('tasks.dailySubAllDays')}
                            </button>
                            <button
                              type="button"
                              onClick={() => field.onChange("weekdays")}
                              className={`px-2 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                                field.value === "weekdays"
                                  ? "bg-primary/20 text-primary border-primary/50"
                                  : "bg-background hover-elevate border-input"
                              }`}
                              data-testid="btn-recurrence-sub-weekdays"
                            >
                              {t('tasks.dailySubWeekdays')}
                            </button>
                          </div>
                        )}
                        {/* Dynamic description based on selection */}
                        <p className="text-sm text-muted-foreground">
                          {field.value === "none" && t('tasks.recurrenceDescNone')}
                          {field.value === "daily" && t('tasks.recurrenceDescDaily')}
                          {field.value === "weekdays" && t('tasks.recurrenceDescWeekdays')}
                          {field.value === "weekly" && t('tasks.recurrenceDescWeekly')}
                          {field.value === "monthly" && t('tasks.recurrenceDescMonthly')}
                          {field.value === "yearly" && t('tasks.recurrenceDescYearly')}
                        </p>
                      </div>
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

            {recurrenceMode === "standard" && form.watch("recurrence") === "none" && (
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => {
                  const langKey = i18n.language.split(/[-_]/)[0];
                  const currentLocale = dateFnsLocales[langKey] || enUS;
                  const rawValue = field.value;
                  let selectedDate: Date | undefined;
                  if (rawValue && typeof rawValue === "string" && rawValue.trim() !== "") {
                    try {
                      const dateStr = rawValue.substring(0, 10);
                      selectedDate = parse(dateStr, "yyyy-MM-dd", new Date());
                      if (isNaN(selectedDate.getTime())) selectedDate = undefined;
                    } catch {
                      selectedDate = undefined;
                    }
                  }

                  return (
                    <FormItem>
                      <FormLabel>{t('tasks.dueDateDesc')}</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={`w-full justify-start text-left font-normal ${
                                !selectedDate ? "text-muted-foreground" : ""
                              }`}
                              data-testid="button-due-date"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {selectedDate
                                ? format(selectedDate, "EEEE, d. MMMM yyyy", { locale: currentLocale })
                                : t('tasks.noDueDate')}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={(date) => {
                              if (date) {
                                field.onChange(format(date, "yyyy-MM-dd"));
                              } else {
                                field.onChange(undefined);
                              }
                            }}
                            defaultMonth={selectedDate || new Date()}
                            locale={currentLocale}
                            initialFocus
                            data-testid="calendar-due-date"
                          />
                        </PopoverContent>
                      </Popover>
                      {selectedDate && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="mt-1"
                          onClick={() => field.onChange(undefined)}
                          data-testid="button-clear-due-date"
                        >
                          <X className="mr-1 h-3 w-3" />
                          {t('tasks.clearDueDate')}
                        </Button>
                      )}
                      <FormMessage />
                    </FormItem>
                  );
                }}
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
              render={({ field }) => {
                const recurrence = form.watch("recurrence");
                const isImmediate = recurrence === "immediate";
                
                // Force approval on for immediate recurrence tasks
                if (isImmediate && !field.value) {
                  field.onChange(true);
                }
                
                return (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">{t('tasks.parentApproval')}</FormLabel>
                      <FormDescription>
                        {isImmediate 
                          ? t('tasks.immediateDesc')
                          : t('tasks.parentApprovalDesc')}
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={isImmediate ? true : field.value}
                        onCheckedChange={field.onChange}
                        disabled={isImmediate}
                        data-testid="switch-requires-approval"
                      />
                    </FormControl>
                  </FormItem>
                );
              }}
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
