import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTaskSchema, type Task } from "@shared/schema";
import { z } from "zod";
import { useEffect, useState } from "react";
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
}

const taskIcons = ["⭐", "🧹", "🍽️", "🗑️", "🧺", "🛁", "🌱", "📚", "🐕", "🚗"];

// Predefined task templates for common chores
const taskTemplates = [
  {
    id: "clean-room",
    title: "Clean Your Room",
    description: "Pick up toys, make bed, organize desk",
    points: 30,
    iconEmoji: "🧹",
    requiresProof: true,
  },
  {
    id: "dishes",
    title: "Do the Dishes",
    description: "Wash and dry all dishes, clean the sink",
    points: 25,
    iconEmoji: "🍽️",
    requiresProof: false,
  },
  {
    id: "homework",
    title: "Complete Homework",
    description: "Finish all assigned homework for today",
    points: 40,
    iconEmoji: "📚",
    requiresProof: false,
  },
  {
    id: "trash",
    title: "Take Out Trash",
    description: "Take trash bins to the curb",
    points: 15,
    iconEmoji: "🗑️",
    requiresProof: false,
  },
  {
    id: "laundry",
    title: "Fold Laundry",
    description: "Fold clean clothes and put them away",
    points: 35,
    iconEmoji: "🧺",
    requiresProof: false,
  },
  {
    id: "school-work",
    title: "Write a Good Mark in School",
    description: "Get a good grade on schoolwork or test",
    points: 20,
    iconEmoji: "✏️",
    requiresProof: false,
  },
  {
    id: "vacuum",
    title: "Vacuum Living Room",
    description: "Vacuum the living room and hallway",
    points: 30,
    iconEmoji: "🧹",
    requiresProof: true,
  },
  {
    id: "garden",
    title: "Water Plants",
    description: "Water all indoor and outdoor plants",
    points: 20,
    iconEmoji: "🌱",
    requiresProof: false,
  },
];

export function TaskDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
  familyName,
  createdBy,
  editingTask,
}: TaskDialogProps) {
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
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-create-task">
        <DialogHeader>
          <DialogTitle className="text-2xl font-accent">
            {editingTask ? "Edit Task" : "Create New Task"}
          </DialogTitle>
          <DialogDescription>
            {editingTask ? "Update the details for this task." : "Set up a new task for your family to complete."}
          </DialogDescription>
        </DialogHeader>

        {/* Quick Templates Section - Only show when creating */}
        {!editingTask && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Quick Templates</h3>
            <Badge variant="secondary">Popular</Badge>
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
                      <span>{template.points} pts</span>
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
            <span className="bg-background px-2 text-muted-foreground">Or customize</span>
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
                  <FormLabel>Task Icon</FormLabel>
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
                  <FormLabel>Task Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Clean your room"
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
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add more details about the task..."
                      {...field}
                      value={field.value || ""}
                      maxLength={100}
                      data-testid="input-task-description"
                    />
                  </FormControl>
                  <FormDescription className="text-xs text-right">
                    {(field.value || "").length}/100 characters
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
                  <FormLabel>Points: {field.value}</FormLabel>
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
                    How many points is this task worth?
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
                  <FormLabel>Due Date (Optional)</FormLabel>
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
                <FormLabel>Recurrence Type</FormLabel>
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
                      Standard Recurrence
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="custom" id="custom" data-testid="radio-custom" />
                    <label
                      htmlFor="custom"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      Custom Days
                    </label>
                  </div>
                </RadioGroup>
                <p className="text-sm text-muted-foreground mt-2">
                  {recurrenceMode === "standard" 
                    ? "Choose from preset intervals (one-time, daily, weekly, monthly, yearly)"
                    : "Set a custom number of days for the task to repeat"}
                </p>
              </div>

              {recurrenceMode === "standard" && (
                <FormField
                  control={form.control}
                  name="recurrence"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Repeat Schedule</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-task-recurrence">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">One-time</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
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
                      <FormLabel>Repeat Every (Days)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          max="365"
                          placeholder="e.g., 3 for every 3 days"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          data-testid="input-recurrence-days"
                        />
                      </FormControl>
                      <FormDescription>
                        Task will reappear after this many days following completion (1-365)
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
                    <FormLabel className="text-base">Photo Proof</FormLabel>
                    <FormDescription>
                      Require a photo to verify task completion
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
                    <FormLabel className="text-base">Parent Approval</FormLabel>
                    <FormDescription>
                      Turn off for simple daily tasks (brush teeth, make bed) so points are awarded immediately. Recurring tasks will show as "done" and reopen on schedule.
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
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={isSubmitting}
                data-testid="button-submit-task"
              >
                {isSubmitting ? (editingTask ? "Updating..." : "Creating...") : editingTask ? "Update Task" : "Create Task"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
