import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertRewardRequestSchema } from "@shared/schema";
import { z } from "zod";
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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Lightbulb } from "lucide-react";

type RewardRequestFormData = z.infer<typeof insertRewardRequestSchema>;

interface RewardRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: RewardRequestFormData) => void;
  isSubmitting?: boolean;
  familyName: string;
}

export function RewardRequestDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
  familyName,
}: RewardRequestDialogProps) {
  const form = useForm<RewardRequestFormData>({
    resolver: zodResolver(insertRewardRequestSchema),
    defaultValues: {
      familyName,
      title: "",
      description: "",
      pointThreshold: 50,
      status: "pending",
    },
  });

  const handleSubmit = (data: RewardRequestFormData) => {
    onSubmit(data);
    form.reset({
      familyName,
      title: "",
      description: "",
      pointThreshold: 50,
      status: "pending",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="dialog-request-reward">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Lightbulb className="h-6 w-6 text-primary" />
            <DialogTitle className="text-2xl font-accent">Request a Reward</DialogTitle>
          </div>
          <DialogDescription>
            Tell your parents what reward you'd like to earn! They'll review your request.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What reward do you want?</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Ice cream trip, New toy"
                      {...field}
                      data-testid="input-request-title"
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
                  <FormLabel>Tell us more (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add more details about what you'd like..."
                      {...field}
                      value={field.value || ""}
                      data-testid="input-request-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="pointThreshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>How many points should it cost?</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      placeholder="50"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      data-testid="input-request-points"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-request"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                data-testid="button-submit-request"
              >
                {isSubmitting ? "Sending..." : "Send Request"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
