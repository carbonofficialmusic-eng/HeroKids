import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SKIN_IMAGES } from "@/lib/skins";
import {
  Smile,
  Heart,
  ThumbsUp,
  ThumbsDown,
  Star,
  Flame,
  Zap,
  Trophy,
  Target,
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Sun,
  Moon,
  Cloud,
  Rocket,
  Gift,
  PartyPopper,
} from "lucide-react";
import { useTranslation } from "react-i18next";

interface EmoticonPickerProps {
  onSelectEmoticon: (emoticon: string) => void;
}

interface Skin {
  id: string;
  name: string;
  imageUrl: string;
  isDiscovered: boolean;
  isActive: boolean;
  canDiscover: boolean;
  tier: number;
}

interface SkinsResponse {
  skins: Skin[];
  rewardsRedeemed: number;
}

const STANDARD_EMOTICONS = [
  { icon: Smile, code: ":smile:", labelKey: "smile" },
  { icon: Heart, code: ":heart:", labelKey: "heart" },
  { icon: ThumbsUp, code: ":thumbsup:", labelKey: "thumbsUp" },
  { icon: ThumbsDown, code: ":thumbsdown:", labelKey: "thumbsDown" },
  { icon: Star, code: ":star:", labelKey: "star" },
  { icon: Flame, code: ":flame:", labelKey: "fire" },
  { icon: Zap, code: ":zap:", labelKey: "lightning" },
  { icon: Trophy, code: ":trophy:", labelKey: "trophy" },
  { icon: Target, code: ":target:", labelKey: "target" },
  { icon: CheckCircle2, code: ":check:", labelKey: "check" },
  { icon: XCircle, code: ":cross:", labelKey: "cross" },
  { icon: AlertCircle, code: ":alert:", labelKey: "alert" },
  { icon: HelpCircle, code: ":question:", labelKey: "question" },
  { icon: Sparkles, code: ":sparkles:", labelKey: "sparkles" },
  { icon: Sun, code: ":sun:", labelKey: "sun" },
  { icon: Moon, code: ":moon:", labelKey: "moon" },
  { icon: Cloud, code: ":cloud:", labelKey: "cloud" },
  { icon: Rocket, code: ":rocket:", labelKey: "rocket" },
  { icon: Gift, code: ":gift:", labelKey: "gift" },
  { icon: PartyPopper, code: ":party:", labelKey: "party" },
];

export function EmoticonPicker({ onSelectEmoticon }: EmoticonPickerProps) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  // Fetch all skins and filter for discovered ones
  const { data: skinsData } = useQuery<SkinsResponse>({
    queryKey: ["/api/skins"],
    staleTime: 5 * 60 * 1000,
  });

  const discoveredSkins = skinsData?.skins.filter(skin => skin.isDiscovered) || [];

  const handleSelectEmoticon = (emoticon: string) => {
    onSelectEmoticon(emoticon);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-testid="button-emoticon-picker"
          aria-label={t("emoticonPicker.addEmoticon")}
        >
          <Smile className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <Tabs defaultValue="standard" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="standard" data-testid="tab-standard-emoticons">
              {t("emoticonPicker.icons")}
            </TabsTrigger>
            <TabsTrigger value="skins" data-testid="tab-skin-emoticons">
              {t("emoticonPicker.skins", { count: discoveredSkins.length })}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="standard" className="m-0">
            <ScrollArea className="h-[min(256px,38vh)] p-2">
              <div className="grid grid-cols-5 gap-2">
                {STANDARD_EMOTICONS.map(({ icon: Icon, code, labelKey }) => (
                  <Button
                    key={code}
                    variant="ghost"
                    size="icon"
                    onClick={() => handleSelectEmoticon(code)}
                    className="h-12 w-12"
                    title={t(`emoticonPicker.${labelKey}`)}
                    data-testid={`emoticon-${code}`}
                  >
                    <Icon className="h-5 w-5" />
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="skins" className="m-0">
            <ScrollArea className="h-[min(256px,38vh)] p-2">
              {discoveredSkins.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <p className="mb-2">{t("emoticonPicker.noUnlockedSkins")}</p>
                  <p className="text-xs">
                    {t("emoticonPicker.noUnlockedSkinsDesc")}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {discoveredSkins.map((skin) => (
                    <Button
                      key={skin.id}
                      variant="ghost"
                      onClick={() => handleSelectEmoticon(`:skin:${skin.id}:`)}
                      className="h-16 w-16 p-1 flex items-center justify-center"
                      title={skin.name}
                      data-testid={`emoticon-skin-${skin.id}`}
                    >
                      <img
                        src={SKIN_IMAGES[skin.id]}
                        alt={skin.name}
                        className="h-12 w-12 rounded-lg object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    </Button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
