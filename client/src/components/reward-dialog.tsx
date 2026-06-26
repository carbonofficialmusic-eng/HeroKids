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
import { RewardIconDisplay } from "@/lib/reward-icon";

function scrollFieldIntoView(el: HTMLElement) {
  const doScroll = () => {
    const scrollable = el.closest("[data-radix-scroll-area-viewport], .overflow-y-auto") as HTMLElement | null;
    if (!scrollable) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const elRect = el.getBoundingClientRect();
    const parentRect = scrollable.getBoundingClientRect();
    // Use visualViewport height to account for iOS keyboard overlay
    const visibleHeight = (window.visualViewport?.height ?? window.innerHeight);
    const visibleContainerBottom = Math.min(parentRect.bottom, visibleHeight);
    const visibleContainerHeight = Math.max(visibleContainerBottom - parentRect.top, 120);
    const relativeTop = elRect.top - parentRect.top + scrollable.scrollTop;
    // Position field at ~35% from top of visible area
    const targetScroll = relativeTop - visibleContainerHeight * 0.35;
    scrollable.scrollTo({ top: Math.max(0, targetScroll), behavior: "smooth" });
  };
  // Fire at 350ms (fast keyboards) and again at 700ms (slow iOS keyboards)
  setTimeout(doScroll, 350);
  setTimeout(doScroll, 700);
}

const REWARD_IMAGE_ICONS = [
  { value: "/reward-icons/ice-cream.png",     label: "Eis" },
  { value: "/reward-icons/cinema.png",         label: "Kino" },
  { value: "/reward-icons/board-game.png",     label: "Brettspiel" },
  { value: "/reward-icons/amusement-park.png", label: "Freizeitpark" },
  { value: "/reward-icons/pizza.png",          label: "Pizza" },
  { value: "/reward-icons/bicycle.png",        label: "Fahrrad" },
  { value: "/reward-icons/football.png",       label: "Fußball" },
  { value: "/reward-icons/books.png",          label: "Bücher" },
  { value: "/reward-icons/baking.png",         label: "Backen" },
  { value: "/reward-icons/trophy.png",         label: "Pokal" },
  { value: "/reward-icons/gaming.png",         label: "Gaming" },
  { value: "/reward-icons/gift.png",           label: "Geschenk" },
  { value: "/reward-icons/dice.png",           label: "Würfel" },
  { value: "/reward-icons/guitar.png",         label: "Gitarre" },
  { value: "/reward-icons/circus.png",         label: "Zirkus" },
  { value: "/reward-icons/bowling-pin.png",    label: "Kegel" },
  { value: "/reward-icons/clock.png",          label: "Uhr" },
  { value: "/reward-icons/carnival-mask.png",  label: "Maske" },
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
      iconEmoji: "/reward-icons/gift.png",
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
        iconEmoji: reward.iconEmoji || "/reward-icons/gift.png",
      });
    } else {
      form.reset({
        familyName,
        title: "",
        description: "",
        pointThreshold: 100,
        isActive: true,
        oneTimeOnly: false,
        iconEmoji: "/reward-icons/gift.png",
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
                  <FormLabel className="block text-center">{t('rewards.icon')}</FormLabel>

                  {/* Preview */}
                  <div className="flex justify-center mb-3">
                    <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center p-2">
                      <RewardIconDisplay
                        icon={field.value}
                        imgClassName="w-full h-full object-contain drop-shadow-sm"
                        textClassName="text-5xl leading-none"
                      />
                    </div>
                  </div>

                  <FormControl>
                    <div className="space-y-3" data-testid="reward-icon-grid">

                      {/* 3D Image Icons */}
                      <div className="grid grid-cols-6 gap-2">
                        {REWARD_IMAGE_ICONS.map((icon) => (
                          <button
                            key={icon.value}
                            type="button"
                            onClick={() => field.onChange(icon.value)}
                            title={icon.label}
                            data-testid={`button-icon-img-${icon.label}`}
                            className={`h-12 w-full rounded-xl p-1.5 flex items-center justify-center transition-all ${
                              field.value === icon.value
                                ? "bg-primary/20 ring-2 ring-primary scale-110"
                                : "bg-muted hover-elevate"
                            }`}
                          >
                            <img
                              src={icon.value}
                              alt={icon.label}
                              className="w-full h-full object-contain drop-shadow-sm"
                            />
                          </button>
                        ))}
                      </div>


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
