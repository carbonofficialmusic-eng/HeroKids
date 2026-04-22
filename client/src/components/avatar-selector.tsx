import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { avatarAssets, colorOptions } from "@/lib/avatarAssets";
import { Check, Upload, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Capacitor } from "@capacitor/core";

interface AvatarSelectorProps {
  selectedAvatar: string;
  selectedColor: string;
  onAvatarSelect: (url: string) => void;
  onColorSelect: (color: string) => void;
  onCustomUpload?: (file: File) => void;
  onClearCustomUpload?: () => void;
  uploadedAvatarUrl?: string | null;
}

async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type || "image/jpeg" });
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
  const { t } = useTranslation();
  const [previewUrl, setPreviewUrl] = useState<string | null>(uploadedAvatarUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastProcessedFileRef = useRef<string | null>(null);

  const platform = Capacitor.getPlatform();
  const isNativeMobile = platform === "ios" || platform === "android";

  // Sync previewUrl when a history avatar is selected externally
  useEffect(() => {
    setPreviewUrl(uploadedAvatarUrl || null);
  }, [uploadedAvatarUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Create a unique identifier for this file to prevent duplicate processing
      const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
      
      // Skip if we just processed this exact file (prevents mobile camera duplicate events)
      if (lastProcessedFileRef.current === fileKey) {
        return;
      }
      lastProcessedFileRef.current = fileKey;
      
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

  const handleNativePhotoCapture = async () => {
    try {
      const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
      const photo = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt,
      });
      if (photo.dataUrl) {
        setPreviewUrl(photo.dataUrl);
        lastProcessedFileRef.current = null;
        if (onCustomUpload) {
          const file = await dataUrlToFile(photo.dataUrl, "avatar-photo.jpg");
          onCustomUpload(file);
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.message?.toLowerCase().includes("cancel")) {
        return;
      }
      console.error("Camera error:", error);
    }
  };

  const handleUploadClick = () => {
    if (isNativeMobile) {
      handleNativePhotoCapture();
    } else {
      fileInputRef.current?.click();
    }
  };

  const clearCustomPhoto = () => {
    setPreviewUrl(null);
    lastProcessedFileRef.current = null;
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
          {t("avatarSelector.chooseYourAvatar")}
        </label>
        
        {/* Custom Upload Option */}
        <div className="mb-4">
          {!isNativeMobile && (
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              data-testid="input-avatar-upload"
            />
          )}
          {previewUrl ? (
            <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
              <img
                src={previewUrl}
                alt="Custom avatar"
                className="h-16 w-16 rounded-full object-cover"
              />
              <div className="flex-1">
                <p className="text-sm font-medium">{t("avatarSelector.customPhoto")}</p>
                <p className="text-xs text-muted-foreground">{t("avatarSelector.yourUploadedPicture")}</p>
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
              onClick={handleUploadClick}
              data-testid="button-upload-avatar"
            >
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm">{t("avatarSelector.uploadYourPhoto")}</span>
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
          {t("avatarSelector.chooseYourColor")}
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
          <p className="text-sm font-medium text-muted-foreground">{t("avatarSelector.preview")}</p>
          <p className="font-semibold">{t("avatarSelector.avatarWithColorRing")}</p>
        </div>
      </div>
    </div>
  );
}
