import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { avatarAssets, colorOptions } from "@/lib/avatarAssets";
import { Check } from "lucide-react";

interface AvatarSelectorProps {
  selectedAvatar: string;
  selectedColor: string;
  onAvatarSelect: (url: string) => void;
  onColorSelect: (color: string) => void;
}

export function AvatarSelector({
  selectedAvatar,
  selectedColor,
  onAvatarSelect,
  onColorSelect,
}: AvatarSelectorProps) {
  return (
    <div className="space-y-6">
      {/* Avatar Selection */}
      <div>
        <label className="text-sm font-medium mb-3 block" data-testid="label-avatar-selection">
          Choose Your Avatar
        </label>
        <div className="grid grid-cols-3 gap-3">
          {avatarAssets.map((avatar) => (
            <Button
              key={avatar.id}
              variant="outline"
              className={`h-24 p-2 relative ${
                selectedAvatar === avatar.url ? "ring-4 ring-primary" : ""
              }`}
              onClick={() => onAvatarSelect(avatar.url)}
              data-testid={`button-avatar-${avatar.id}`}
            >
              <img
                src={avatar.url}
                alt={avatar.name}
                className="w-full h-full object-contain"
              />
              {selectedAvatar === avatar.url && (
                <div className="absolute top-1 right-1 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                  <Check className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Color Selection */}
      <div>
        <label className="text-sm font-medium mb-3 block" data-testid="label-color-selection">
          Choose Your Color
        </label>
        <div className="grid grid-cols-4 gap-3">
          {colorOptions.map((color) => (
            <Button
              key={color.id}
              variant="outline"
              className={`h-12 p-0 relative ${
                selectedColor === color.value ? "ring-4 ring-primary" : ""
              }`}
              onClick={() => onColorSelect(color.value)}
              data-testid={`button-color-${color.id}`}
            >
              <div
                className="w-full h-full rounded-md"
                style={{ backgroundColor: color.value }}
              />
              {selectedColor === color.value && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Check className="h-6 w-6 text-white drop-shadow-lg" />
                </div>
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
        <Avatar
          className="h-16 w-16"
          style={{ borderWidth: "4px", borderColor: selectedColor }}
        >
          <AvatarImage src={selectedAvatar} />
          <AvatarFallback style={{ backgroundColor: selectedColor }} className="text-white text-2xl">
            ?
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Preview</p>
          <p className="font-semibold">Your avatar with color ring</p>
        </div>
      </div>
    </div>
  );
}
