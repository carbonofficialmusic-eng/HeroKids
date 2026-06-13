import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";
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

// On iOS, tapping an input inside a fixed dialog does NOT automatically
// scroll the view to keep the input above the keyboard. We call
// scrollIntoView after the keyboard animation (~300 ms) finishes.
function scrollInputIntoView(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  const el = e.currentTarget;
  setTimeout(() => {
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, 320);
}

export function RewardRequestDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
  familyName,
  request = null,
}: RewardRequestDialogProps) {
  const { t } = useTranslation();
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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" data-testid={isEditing ? "dialog-edit-request" : "dialog-request-reward"} onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <Pencil className="h-6 w-6 text-primary" />
            ) : (
              <Lightbulb className="h-6 w-6 text-primary" />
            )}
            <DialogTitle className="text-2xl font-accent">
              {isEditing ? t('rewards.editRewardRequest') : t('rewards.requestReward')}
            </DialogTitle>
          </div>
          <DialogDescription>
            {isEditing 
              ? t('rewards.adjustRewardDetails')
              : t('rewards.tellParentsWhatYouWant')
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
                  <FormLabel>{t('rewards.whatRewardDoYouWant')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('rewards.rewardRequestPlaceholder')}
                      {...field}
                      onFocus={scrollInputIntoView}
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
                  <FormLabel>{t('rewards.tellUsMore')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('rewards.tellUsMorePlaceholder')}
                      {...field}
                      value={field.value || ""}
                      onFocus={scrollInputIntoView}
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
                  <FormLabel>{t('rewards.howManyPoints')}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      placeholder="50"
                      {...field}
                      value={field.value === 0 ? "" : field.value}
                      onChange={(e) => {
                        const val = e.target.value;
                        field.onChange(val === "" ? 0 : parseInt(val) || 0);
                      }}
                      onFocus={scrollInputIntoView}
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
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                data-testid={isEditing ? "button-save-request" : "button-submit-request"}
              >
                {isSubmitting ? (isEditing ? t('rewards.saving') : t('rewards.sending')) : (isEditing ? t('rewards.saveChanges') : t('rewards.sendRequest'))}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
