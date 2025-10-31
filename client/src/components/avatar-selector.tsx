import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { avatarAssets, colorOptions } from "@/lib/avatarAssets";
import { Check, Upload, X } from "lucide-react";
import { useState, useRef } from "react";

interface AvatarSelectorProps {
  selectedAvatar: string;
  selectedColor: string;
  onAvatarSelect: (url: string) => void;
  onColorSelect: (color: string) => void;
  onCustomUpload?: (file: File) => void;
  onClearCustomUpload?: () => void;
  uploadedAvatarUrl?: string | null;
}

export function AvatarSelector({
  selectedAvatar,
  selectedColor,
  onAvatarSelect,
  onColorSelect,
  onCustomUpload,
  onClearCustomUpload,
  uploadedAvatarUrl,
}: AvatarSelectorProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(uploadedAvatarUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Notify parent
      if (onCustomUpload) {
        onCustomUpload(file);
      }
    }
  };

  const clearCustomPhoto = () => {
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    // Notify parent to clear the uploaded file
    if (onClearCustomUpload) {
      onClearCustomUpload();
    }
    // Select first pre-made avatar
    onAvatarSelect(avatarAssets[0].url);
  };

  return (
    <div className="space-y-6">
      {/* Avatar Selection */}
      <div>
        <label className="text-sm font-medium mb-3 block" data-testid="label-avatar-selection">
          Choose Your Avatar
        </label>
        
        {/* Custom Upload Option */}
        <div className="mb-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            data-testid="input-avatar-upload"
          />
          {previewUrl ? (
            <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
              <img
                src={previewUrl}
                alt="Custom avatar"
                className="h-16 w-16 rounded-full object-cover"
              />
              <div className="flex-1">
                <p className="text-sm font-medium">Custom Photo</p>
                <p className="text-xs text-muted-foreground">Your uploaded picture</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={clearCustomPhoto}
                data-testid="button-clear-custom-avatar"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="w-full h-20 border-dashed"
              onClick={() => fileInputRef.current?.click()}
              data-testid="button-upload-avatar"
            >
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm">Upload Your Own Photo</span>
              </div>
            </Button>
          )}
        </div>

        {/* Pre-made Avatars */}
        {!previewUrl && (
          <div className="grid grid-cols-3 gap-3">
            {avatarAssets.map((avatar) => (
              <Button
                key={avatar.id}
                type="button"
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
        )}
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
              type="button"
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
          <AvatarImage src={previewUrl || selectedAvatar} />
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
