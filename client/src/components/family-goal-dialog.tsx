import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertFamilyGoalSchema } from "@shared/schema";
import { z } from "zod";
import { useEffect } from "react";
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
import { Slider } from "@/components/ui/slider";

const goalFormSchema = insertFamilyGoalSchema.extend({});

type GoalFormData = z.infer<typeof goalFormSchema>;

interface FamilyGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: GoalFormData) => void;
  isSubmitting?: boolean;
  familyName: string;
  editingGoal?: any;
}

const goalIcons = ["🎯", "🏊", "🦁", "🎢", "🎪", "🏖️", "⛷️", "🎭", "🎨", "🏰"];

export function FamilyGoalDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
  familyName,
  editingGoal,
}: FamilyGoalDialogProps) {
  const form = useForm<GoalFormData>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: {
      familyName,
      title: "",
      description: "",
      targetPoints: 1000,
      contributionAmount: 50,
      contributionPeriod: "weekly",
      iconEmoji: "🎯",
      isActive: true,
    },
  });

  useEffect(() => {
    if (open) {
      if (editingGoal) {
        form.reset({
          familyName: editingGoal.familyName,
          title: editingGoal.title,
          description: editingGoal.description || "",
          targetPoints: editingGoal.targetPoints,
          contributionAmount: editingGoal.contributionAmount,
          contributionPeriod: editingGoal.contributionPeriod,
          iconEmoji: editingGoal.iconEmoji || "🎯",
          isActive: editingGoal.isActive,
        });
      } else {
        form.reset({
          familyName,
          title: "",
          description: "",
          targetPoints: 1000,
          contributionAmount: 50,
          contributionPeriod: "weekly",
          iconEmoji: "🎯",
          isActive: true,
        });
      }
    }
  }, [open, editingGoal, familyName]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto [&>button.absolute]:hidden" data-testid="dialog-create-family-goal" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-accent">
            {editingGoal ? "Familienziel bearbeiten" : "Neues Familienziel erstellen"}
          </DialogTitle>
          <DialogDescription>
            {editingGoal 
              ? "Bearbeite die Details des Familienziels." 
              : "Erstelle ein gemeinsames Ziel für die ganze Familie."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="iconEmoji"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Icon wählen</FormLabel>
                  <div className="grid grid-cols-5 gap-2">
                    {goalIcons.map((icon) => (
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
                  <FormLabel>Zieltitel</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="z.B. Tierpark-Besuch, Schwimmbad, Freizeitpark"
                      {...field}
                      data-testid="input-goal-title"
                    />
                  </FormControl>
                  <FormDescription>
                    Gib deinem Familienziel einen motivierenden Titel.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beschreibung (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Weitere Details zum Ziel..."
                      {...field}
                      value={field.value || ""}
                      maxLength={200}
                      data-testid="input-goal-description"
                    />
                  </FormControl>
                  <FormDescription className="text-xs text-right">
                    {(field.value || "").length} / 200 Zeichen
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="targetPoints"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gesamtziel: {field.value} Punkte</FormLabel>
                  <FormControl>
                    <Slider
                      min={100}
                      max={5000}
                      step={50}
                      value={[field.value || 1000]}
                      onValueChange={(vals) => field.onChange(vals[0])}
                      data-testid="slider-target-points"
                    />
                  </FormControl>
                  <FormDescription>
                    Die Gesamtpunktzahl, die von allen Familienmitgliedern zusammen erreicht werden muss.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contributionAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beitrag pro Person: {field.value} Punkte</FormLabel>
                  <FormControl>
                    <Slider
                      min={10}
                      max={500}
                      step={10}
                      value={[field.value || 50]}
                      onValueChange={(vals) => field.onChange(vals[0])}
                      data-testid="slider-contribution-amount"
                    />
                  </FormControl>
                  <FormDescription>
                    Jedes Familienmitglied zahlt diesen Betrag pro Zeitraum ein.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contributionPeriod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beitragsrhythmus</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-contribution-period">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="weekly">Wöchentlich</SelectItem>
                      <SelectItem value="monthly">Monatlich</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Wie oft sollen Familienmitglieder einzahlen?
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-goal"
              >
                Abbrechen
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={isSubmitting}
                data-testid="button-submit-goal"
              >
                {isSubmitting ? "Wird erstellt..." : editingGoal ? "Speichern" : "Erstellen"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
