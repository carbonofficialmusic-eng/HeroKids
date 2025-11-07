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
import { useQuery } from "@tanstack/react-query";
import { SKIN_IMAGES } from "@/lib/skins";

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

interface MessageRendererProps {
  message: string;
}

const EMOTICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  ":smile:": Smile,
  ":heart:": Heart,
  ":thumbsup:": ThumbsUp,
  ":thumbsdown:": ThumbsDown,
  ":star:": Star,
  ":flame:": Flame,
  ":zap:": Zap,
  ":trophy:": Trophy,
  ":target:": Target,
  ":check:": CheckCircle2,
  ":cross:": XCircle,
  ":alert:": AlertCircle,
  ":question:": HelpCircle,
  ":sparkles:": Sparkles,
  ":sun:": Sun,
  ":moon:": Moon,
  ":cloud:": Cloud,
  ":rocket:": Rocket,
  ":gift:": Gift,
  ":party:": PartyPopper,
};

export function MessageRenderer({ message }: MessageRendererProps) {
  // Fetch all skins to render skin emoticons
  const { data: skinsData } = useQuery<SkinsResponse>({
    queryKey: ["/api/skins"],
  });

  const skins = skinsData?.skins || [];

  const renderMessage = () => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    // Regular expression to match emoticons: :code: or :skin:id:
    const emoticonRegex = /:(skin:[\w-]+|[\w]+):/g;
    let match;

    while ((match = emoticonRegex.exec(message)) !== null) {
      // Add text before the emoticon
      if (match.index > lastIndex) {
        parts.push(message.substring(lastIndex, match.index));
      }

      const fullMatch = match[0]; // e.g., ":smile:" or ":skin:default-fox:"
      const code = match[1]; // e.g., "smile" or "skin:default-fox"

      if (code.startsWith("skin:")) {
        // Skin emoticon
        const skinId = code.substring(5); // Remove "skin:" prefix
        const skin = skins.find((s) => s.id === skinId);
        const skinImage = SKIN_IMAGES[skinId];
        
        if (skin && skinImage) {
          parts.push(
            <img
              key={`emoticon-${match.index}`}
              src={skinImage}
              alt={skin.name}
              className="inline-block h-6 w-6 rounded object-cover mx-0.5 align-middle"
              title={skin.name}
            />
          );
        } else {
          // Skin not found, just show the code
          parts.push(fullMatch);
        }
      } else {
        // Standard icon emoticon
        const IconComponent = EMOTICON_MAP[fullMatch];
        
        if (IconComponent) {
          parts.push(
            <IconComponent
              key={`emoticon-${match.index}`}
              className="inline-block h-5 w-5 mx-0.5 align-middle"
            />
          );
        } else {
          // Unknown emoticon, just show the code
          parts.push(fullMatch);
        }
      }

      lastIndex = match.index + fullMatch.length;
    }

    // Add remaining text after the last emoticon
    if (lastIndex < message.length) {
      parts.push(message.substring(lastIndex));
    }

    return parts;
  };

  return <>{renderMessage()}</>;
}
