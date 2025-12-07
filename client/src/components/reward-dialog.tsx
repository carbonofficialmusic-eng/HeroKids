import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertRewardSchema, type Reward } from "@shared/schema";
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
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type RewardFormData = z.infer<typeof insertRewardSchema>;

interface RewardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: RewardFormData) => void;
  isSubmitting?: boolean;
  familyName: string;
  reward?: Reward | null;
}

export function RewardDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
  familyName,
  reward = null,
}: RewardDialogProps) {
  const { t } = useTranslation();
  const isEditing = !!reward;

  const form = useForm<RewardFormData>({
    resolver: zodResolver(insertRewardSchema),
    defaultValues: {
      familyName,
      title: "",
      description: "",
      pointThreshold: 100,
      isActive: true,
    },
  });

  // Reset form when reward changes
  useEffect(() => {
    if (reward) {
      form.reset({
        familyName: reward.familyName,
        title: reward.title,
        description: reward.description || "",
        pointThreshold: reward.pointThreshold,
        isActive: reward.isActive,
      });
    } else {
      form.reset({
        familyName,
        title: "",
        description: "",
        pointThreshold: 100,
        isActive: true,
      });
    }
  }, [reward, familyName, form]);

  const handleSubmit = (data: RewardFormData) => {
    onSubmit(data);
    if (!isEditing) {
      form.reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" data-testid={isEditing ? "dialog-edit-reward" : "dialog-create-reward"}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-accent">{isEditing ? t('rewards.editReward') : t('rewards.createReward')}</DialogTitle>
          <DialogDescription>
            {isEditing ? t('rewards.updateDetails') : t('rewards.setupNewReward')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('rewards.rewardTitle')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('rewards.rewardTitlePlaceholder')}
                      {...field}
                      data-testid="input-reward-title"
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
                  <FormLabel>{t('rewards.descriptionOptional')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('rewards.descriptionPlaceholder')}
                      {...field}
                      value={field.value || ""}
                      data-testid="input-reward-description"
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
                  <FormLabel>{t('rewards.pointsRequired')}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={10}
                      step={10}
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                      data-testid="input-reward-points"
                    />
                  </FormControl>
                  <FormDescription>
                    {t('rewards.pointsRequiredDesc')}
                  </FormDescription>
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
                data-testid="button-cancel-reward"
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={isSubmitting}
                data-testid="button-submit-reward"
              >
                {isSubmitting ? (isEditing ? t('rewards.saving') : t('rewards.creating')) : (isEditing ? t('rewards.saveChanges') : t('rewards.createRewardButton'))}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
