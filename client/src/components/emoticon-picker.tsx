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

interface EmoticonPickerProps {
  onSelectEmoticon: (emoticon: string) => void;
}

interface Skin {
  id: string;
  name: string;
  imageUrl: string;
  isUnlocked: boolean;
  isActive: boolean;
  canUnlock: boolean;
}

interface SkinsResponse {
  skins: Skin[];
  rewardsRedeemed: number;
}

const STANDARD_EMOTICONS = [
  { icon: Smile, code: ":smile:", label: "Smile" },
  { icon: Heart, code: ":heart:", label: "Heart" },
  { icon: ThumbsUp, code: ":thumbsup:", label: "Thumbs Up" },
  { icon: ThumbsDown, code: ":thumbsdown:", label: "Thumbs Down" },
  { icon: Star, code: ":star:", label: "Star" },
  { icon: Flame, code: ":flame:", label: "Fire" },
  { icon: Zap, code: ":zap:", label: "Lightning" },
  { icon: Trophy, code: ":trophy:", label: "Trophy" },
  { icon: Target, code: ":target:", label: "Target" },
  { icon: CheckCircle2, code: ":check:", label: "Check" },
  { icon: XCircle, code: ":cross:", label: "Cross" },
  { icon: AlertCircle, code: ":alert:", label: "Alert" },
  { icon: HelpCircle, code: ":question:", label: "Question" },
  { icon: Sparkles, code: ":sparkles:", label: "Sparkles" },
  { icon: Sun, code: ":sun:", label: "Sun" },
  { icon: Moon, code: ":moon:", label: "Moon" },
  { icon: Cloud, code: ":cloud:", label: "Cloud" },
  { icon: Rocket, code: ":rocket:", label: "Rocket" },
  { icon: Gift, code: ":gift:", label: "Gift" },
  { icon: PartyPopper, code: ":party:", label: "Party" },
];

export function EmoticonPicker({ onSelectEmoticon }: EmoticonPickerProps) {
  const [open, setOpen] = useState(false);

  // Fetch all skins and filter for unlocked ones
  const { data: skinsData } = useQuery<SkinsResponse>({
    queryKey: ["/api/skins"],
  });

  const unlockedSkins = skinsData?.skins.filter(skin => skin.isUnlocked) || [];

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
          aria-label="Add emoticon"
        >
          <Smile className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <Tabs defaultValue="standard" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="standard" data-testid="tab-standard-emoticons">
              Icons
            </TabsTrigger>
            <TabsTrigger value="skins" data-testid="tab-skin-emoticons">
              Skins ({unlockedSkins.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="standard" className="m-0">
            <ScrollArea className="h-64 p-2">
              <div className="grid grid-cols-5 gap-2">
                {STANDARD_EMOTICONS.map(({ icon: Icon, code, label }) => (
                  <Button
                    key={code}
                    variant="ghost"
                    size="icon"
                    onClick={() => handleSelectEmoticon(code)}
                    className="h-12 w-12"
                    title={label}
                    data-testid={`emoticon-${code}`}
                  >
                    <Icon className="h-5 w-5" />
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="skins" className="m-0">
            <ScrollArea className="h-64 p-2">
              {unlockedSkins.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <p className="mb-2">No unlocked skins yet</p>
                  <p className="text-xs">
                    Complete tasks and redeem rewards to unlock character skins
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {unlockedSkins.map((skin) => (
                    <Button
                      key={skin.id}
                      variant="ghost"
                      onClick={() => handleSelectEmoticon(`:skin:${skin.id}:`)}
                      className="h-16 w-16 p-1 flex flex-col items-center gap-1"
                      title={skin.name}
                      data-testid={`emoticon-skin-${skin.id}`}
                    >
                      <img
                        src={SKIN_IMAGES[skin.id]}
                        alt={skin.name}
                        className="h-10 w-10 rounded-lg object-cover"
                      />
                      <span className="text-xs truncate w-full">{skin.name}</span>
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
