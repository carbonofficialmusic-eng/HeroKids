import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTaskSchema, type Task, type FamilyMember } from "@shared/schema";
import { z } from "zod";
import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sparkles } from "lucide-react";

const taskFormSchema = insertTaskSchema.extend({
  dueDate: z.string().optional(),
  recurrenceDays: z.number().int().min(1).max(365).optional(),
  maxCompletions: z.number().int().min(2).max(20).optional(),
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
  
  // Calculate number of children in the family
  const childCount = useMemo(() => {
    return familyMembers.filter(m => m.role === 'child').length;
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
          maxCompletions: editingTask.maxCompletions || undefined,
        });
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
        });
      }
    }
  }, [open, editingTask, familyName, createdBy]);

  const handleSubmit = (data: TaskFormData) => {
    // Create a copy and clear the field that's not being used based on mode
    const submitData = { ...data };
    if (recurrenceMode === "standard") {
      submitData.recurrenceDays = undefined;
    } else {
      submitData.recurrence = "none";
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

        {/* Quick Templates Section - Only show when creating */}
        {!editingTask && (
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
        )}

        {!editingTask && (
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">{t('tasks.orCustomize')}</span>
          </div>
        </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
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

            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('tasks.dueDateOptional')}</FormLabel>
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

            <FormField
              control={form.control}
              name="maxCompletions"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Multiple Children Can Complete</FormLabel>
                  <FormDescription>
                    Allow multiple children to complete this task. Adjustable range: 2 to {Math.max(childCount, 2)} (based on your family size).
                  </FormDescription>
                  <div className="flex items-center gap-4">
                    <Switch
                      checked={field.value !== undefined && field.value !== null}
                      onCheckedChange={(checked) => {
                        // When enabling: use number of children in family (minimum 2)
                        // When editing existing task: preserve current value
                        if (checked) {
                          // Only set default if it's a new task (not editing)
                          if (!editingTask) {
                            field.onChange(Math.max(childCount, 2));
                          } else {
                            // When editing, keep existing value or use childCount
                            field.onChange(field.value || Math.max(childCount, 2));
                          }
                        } else {
                          field.onChange(undefined);
                        }
                      }}
                      data-testid="toggle-multi-completion"
                    />
                    {field.value !== undefined && field.value !== null && (
                      <div className="flex items-center gap-2">
                        <FormLabel className="text-sm">Times:</FormLabel>
                        <Input
                          type="number"
                          min={2}
                          max={Math.max(childCount, 2)}
                          value={field.value || 2}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val)) {
                              field.onChange(Math.max(2, Math.min(val, Math.max(childCount, 2))));
                            }
                          }}
                          className="w-20"
                          data-testid="input-max-completions"
                        />
                      </div>
                    )}
                  </div>
                  <FormMessage />
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
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
