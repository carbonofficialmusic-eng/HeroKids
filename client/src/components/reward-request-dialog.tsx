import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Lightbulb, Pencil } from "lucide-react";

const rewardRequestFormSchema = z.object({
  title: z.string().min(1, "Please enter a reward title"),
  description: z.string().optional(),
  pointThreshold: z.number().min(1, "Points must be at least 1"),
});

type RewardRequestFormData = z.infer<typeof rewardRequestFormSchema>;

interface RewardRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: RewardRequestFormData) => void;
  isSubmitting?: boolean;
  familyName: string;
  request?: { id: string; title: string; description: string | null; pointThreshold: number } | null;
}

export function RewardRequestDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
  familyName,
  request = null,
}: RewardRequestDialogProps) {
  const isEditing = !!request;
  
  const form = useForm<RewardRequestFormData>({
    resolver: zodResolver(rewardRequestFormSchema),
    defaultValues: {
      title: "",
      description: "",
      pointThreshold: 50,
    },
  });

  useEffect(() => {
    if (request) {
      form.reset({
        title: request.title,
        description: request.description || "",
        pointThreshold: request.pointThreshold,
      });
    } else {
      form.reset({
        title: "",
        description: "",
        pointThreshold: 50,
      });
    }
  }, [request, form]);

  const handleSubmit = (data: RewardRequestFormData) => {
    onSubmit(data);
    form.reset({
      title: "",
      description: "",
      pointThreshold: 50,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" data-testid={isEditing ? "dialog-edit-request" : "dialog-request-reward"}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <Pencil className="h-6 w-6 text-primary" />
            ) : (
              <Lightbulb className="h-6 w-6 text-primary" />
            )}
            <DialogTitle className="text-2xl font-accent">
              {isEditing ? "Edit Reward Request" : "Request a Reward"}
            </DialogTitle>
          </div>
          <DialogDescription>
            {isEditing 
              ? "Adjust the reward details before approving."
              : "Tell your parents what reward you'd like to earn! They'll review your request."
            }
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
                data-testid={isEditing ? "button-save-request" : "button-submit-request"}
              >
                {isSubmitting ? (isEditing ? "Saving..." : "Sending...") : (isEditing ? "Save Changes" : "Send Request")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
