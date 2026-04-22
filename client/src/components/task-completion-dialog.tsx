import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, Upload, X, Images } from "lucide-react";
import type { Task } from "@shared/schema";
import { useTranslation } from "react-i18next";
import { Capacitor } from "@capacitor/core";
import { isPhotoPickerCancelError } from "@/lib/cameraUtils";

interface TaskCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  onComplete: (taskId: string, proofPhotoUrl?: string) => void;
  isSubmitting?: boolean;
}

async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type || "image/jpeg" });
}

async function nativeUriToDataUrl(uri: string): Promise<string> {
  const webPath = Capacitor.convertFileSrc(uri);
  const response = await fetch(webPath);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function TaskCompletionDialog({
  open,
  onOpenChange,
  task,
  onComplete,
  isSubmitting = false,
}: TaskCompletionDialogProps) {
  const { t } = useTranslation();
  const [uploadedPhoto, setUploadedPhoto] = useState<File | null>(null);
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const platform = Capacitor.getPlatform();
  const isNativeMobile = platform === "ios" || platform === "android";

  useEffect(() => {
    if (!open) {
      setUploadedPhoto(null);
      setUploadedPhotoUrl(null);
      setPreviewUrl(null);
      setIsUploading(false);
      setCameraError(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [open]);

  const handleNativeTakePhoto = async () => {
    setCameraError(null);
    try {
      const { Camera } = await import("@capacitor/camera");

      let perms = await Camera.checkPermissions();
      if (perms.camera === "prompt" || perms.camera === "prompt-with-rationale") {
        perms = await Camera.requestPermissions({ permissions: ["camera"] });
      }
      if (perms.camera === "denied") {
        setCameraError(t("tasks.cameraPermissionDenied", "Kamera-Zugriff verweigert. Bitte in den Einstellungen aktivieren."));
        return;
      }

      const result = await Camera.takePhoto({ quality: 85 });
      if (result.uri) {
        const dataUrl = await nativeUriToDataUrl(result.uri);
        setPreviewUrl(dataUrl);
        const file = await dataUrlToFile(dataUrl, "proof-photo.jpg");
        setUploadedPhoto(file);
      }
    } catch (error: unknown) {
      if (isPhotoPickerCancelError(error)) return;
      const msg = error instanceof Error ? error.message : String(error);
      console.error("Camera takePhoto error:", msg);
      if (/denied|permission|not allowed/i.test(msg)) {
        setCameraError(t("tasks.cameraPermissionDenied", "Kamera-Zugriff verweigert. Bitte in den Einstellungen aktivieren."));
      } else {
        setCameraError(t("tasks.cameraError", "Kamera konnte nicht geöffnet werden. Bitte erneut versuchen."));
      }
    }
  };

  const handleNativeGalleryPick = async () => {
    setCameraError(null);
    try {
      const { Camera } = await import("@capacitor/camera");

      let perms = await Camera.checkPermissions();
      if (perms.photos === "prompt" || perms.photos === "prompt-with-rationale") {
        perms = await Camera.requestPermissions({ permissions: ["photos"] });
      }
      if (perms.photos === "denied") {
        setCameraError(t("tasks.cameraPermissionDenied", "Kamera-Zugriff verweigert. Bitte in den Einstellungen aktivieren."));
        return;
      }

      const results = await Camera.chooseFromGallery({ allowMultipleSelection: false });
      const uri = results.results[0]?.uri;
      if (uri) {
        const dataUrl = await nativeUriToDataUrl(uri);
        setPreviewUrl(dataUrl);
        const file = await dataUrlToFile(dataUrl, "proof-photo.jpg");
        setUploadedPhoto(file);
      }
    } catch (error: unknown) {
      if (isPhotoPickerCancelError(error)) return;
      const msg = error instanceof Error ? error.message : String(error);
      console.error("Gallery pick error:", msg);
      if (/denied|permission|not allowed/i.test(msg)) {
        setCameraError(t("tasks.cameraPermissionDenied", "Kamera-Zugriff verweigert. Bitte in den Einstellungen aktivieren."));
      } else {
        setCameraError(t("tasks.cameraError", "Kamera konnte nicht geöffnet werden. Bitte erneut versuchen."));
      }
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setUploadedPhoto(null);
    setPreviewUrl(null);
    setUploadedPhotoUrl(null);
    setCameraError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!task) return;

    if (task.requiresProof && uploadedPhoto && !uploadedPhotoUrl) {
      setIsUploading(true);
      try {
        const urlResponse = await fetch("/api/tasks/upload-proof-url", {
          method: "POST",
        });

        if (!urlResponse.ok) {
          const error = await urlResponse.json();
          alert(error.message || "Failed to get upload URL");
          setIsUploading(false);
          return;
        }

        const { uploadURL } = await urlResponse.json();

        const uploadResponse = await fetch(uploadURL, {
          method: "PUT",
          body: uploadedPhoto,
          headers: {
            "Content-Type": uploadedPhoto.type || "image/jpeg",
          },
        });

        if (!uploadResponse.ok) {
          alert("Failed to upload photo to storage");
          setIsUploading(false);
          return;
        }

        const aclResponse = await fetch(`/api/tasks/${task.id}/proof-photo`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ photoUrl: uploadURL }),
        });

        if (!aclResponse.ok) {
          const error = await aclResponse.json();
          alert(error.message || "Failed to finalize upload");
          setIsUploading(false);
          return;
        }

        const { photoUrl } = await aclResponse.json();
        setUploadedPhotoUrl(photoUrl);
        onComplete(task.id, photoUrl);
        setIsUploading(false);
      } catch (error) {
        console.error("Error uploading photo:", error);
        alert("Failed to upload photo. Please try again.");
        setIsUploading(false);
        return;
      }
    } else {
      onComplete(task.id, uploadedPhotoUrl || undefined);
    }
  };

  const canSubmit = !task?.requiresProof || (task.requiresProof && uploadedPhoto);

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-complete-task">
        <DialogHeader>
          <DialogTitle>{t("tasks.completeTask")}</DialogTitle>
          <DialogDescription>
            {t("tasks.confirmCompletion")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
            <div className="text-4xl">{task.iconEmoji}</div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{task.title}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge className="gradient-achievement text-white border-0">
                  +{task.points} {t("dashboard.pointsLabel")}
                </Badge>
                {task.requiresProof && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Camera className="h-3 w-3" />
                    <span>{t("tasks.photoRequired")}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {task.requiresProof && (
            <div className="space-y-3">
              <div className="text-sm font-medium">{t("tasks.uploadPhotoProof")}</div>

              {!previewUrl ? (
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  {!isNativeMobile && (
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoSelect}
                      className="hidden"
                      data-testid="input-photo-upload"
                    />
                  )}
                  <Camera className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-3">
                    {t("tasks.takePhoto")}
                  </p>
                  {cameraError && (
                    <p className="text-sm text-destructive mb-3" data-testid="text-camera-error">
                      {cameraError}
                    </p>
                  )}
                  {isNativeMobile ? (
                    <div className="flex gap-2 justify-center flex-wrap">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleNativeTakePhoto}
                        data-testid="button-take-photo"
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        {t("tasks.takePhotoBtn", "Foto aufnehmen")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleNativeGalleryPick}
                        data-testid="button-choose-photo"
                      >
                        <Images className="h-4 w-4 mr-2" />
                        {t("tasks.choosePhoto")}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="button-choose-photo"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {t("tasks.choosePhoto")}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <img
                    src={previewUrl}
                    alt={t("tasks.choosePhoto")}
                    className="w-full h-48 object-cover rounded-lg"
                    data-testid="img-photo-preview"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={handleRemovePhoto}
                    data-testid="button-remove-photo"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting || isUploading}
            data-testid="button-cancel-complete"
          >
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting || isUploading}
            data-testid="button-submit-complete"
          >
            {isSubmitting || isUploading ? t("tasks.submitting") : t("tasks.completeAndEarn")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
