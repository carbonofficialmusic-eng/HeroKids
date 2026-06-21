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
import { Switch } from "@/components/ui/switch";

function scrollFieldIntoView(el: HTMLElement) {
  setTimeout(() => {
    const scrollable = el.closest("[data-radix-scroll-area-viewport], .overflow-y-auto") as HTMLElement | null;
    if (scrollable) {
      const elRect = el.getBoundingClientRect();
      const parentRect = scrollable.getBoundingClientRect();
      const relativeTop = elRect.top - parentRect.top + scrollable.scrollTop;
      const targetScroll = relativeTop - parentRect.height / 2 + elRect.height / 2;
      scrollable.scrollTo({ top: targetScroll, behavior: "smooth" });
    } else {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, 400);
}

const REWARD_ICONS = [
  "🍦", "🎬", "🤖", "🎲", "🎢", "🚲", "🍕", "🏊",
  "🎮", "🎵", "⚽", "📚", "🎡", "🧸", "🎯", "🏆",
  "🎸", "🎨", "🧁", "🌮", "🚀", "🦁", "🎭", "🎳",
  "🛹", "🎁", "🎀", "🎈", "🧩", "🎪",
];

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
      oneTimeOnly: false,
      iconEmoji: "🎁",
    },
  });

  useEffect(() => {
    if (reward) {
      form.reset({
        familyName: reward.familyName,
        title: reward.title,
        description: reward.description || "",
        pointThreshold: reward.pointThreshold,
        isActive: reward.isActive,
        oneTimeOnly: reward.oneTimeOnly ?? false,
        iconEmoji: reward.iconEmoji || "🎁",
      });
    } else {
      form.reset({
        familyName,
        title: "",
        description: "",
        pointThreshold: 100,
        isActive: true,
        oneTimeOnly: false,
        iconEmoji: "🎁",
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

            {/* Icon Picker */}
            <FormField
              control={form.control}
              name="iconEmoji"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('rewards.icon') || 'Symbol'}</FormLabel>
                  <div className="flex items-center gap-4 mb-2">
                    <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-5xl leading-none">{field.value || "🎁"}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{t('rewards.iconPickerHint') || 'Wähle ein Symbol für diese Belohnung'}</p>
                  </div>
                  <FormControl>
                    <div className="grid grid-cols-6 gap-2" data-testid="reward-icon-grid">
                      {REWARD_ICONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => field.onChange(emoji)}
                          data-testid={`button-icon-${emoji}`}
                          className={`h-11 w-full rounded-xl text-2xl flex items-center justify-center transition-all ${
                            field.value === emoji
                              ? "bg-primary/20 ring-2 ring-primary scale-110"
                              : "bg-muted hover-elevate"
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                      onFocus={(e) => scrollFieldIntoView(e.currentTarget)}
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
                      onFocus={(e) => scrollFieldIntoView(e.currentTarget)}
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
                      onFocus={(e) => scrollFieldIntoView(e.currentTarget)}
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

            <FormField
              control={form.control}
              name="oneTimeOnly"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">{t('rewards.oneTimeOnly')}</FormLabel>
                    <FormDescription>
                      {t('rewards.oneTimeOnlyDesc')}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-one-time-only"
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
