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
import { Camera, Upload, X } from "lucide-react";
import type { Task } from "@shared/schema";
import { useTranslation } from "react-i18next";

interface TaskCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  onComplete: (taskId: string, proofPhotoUrl?: string) => void;
  isSubmitting?: boolean;
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setUploadedPhoto(null);
      setUploadedPhotoUrl(null);
      setPreviewUrl(null);
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [open]);

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
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!task) return;

    // If task requires proof and no photo uploaded yet, upload it first
    if (task.requiresProof && uploadedPhoto && !uploadedPhotoUrl) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('photo', uploadedPhoto);

        const response = await fetch(`/api/tasks/${task.id}/upload-proof`, {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const { photoUrl } = await response.json();
          setUploadedPhotoUrl(photoUrl);
          // Now complete the task with the photo URL
          onComplete(task.id, photoUrl);
          setIsUploading(false);
        } else {
          const error = await response.json();
          alert(error.message || 'Failed to upload photo');
          setIsUploading(false);
          return;
        }
      } catch (error) {
        console.error('Error uploading photo:', error);
        alert('Failed to upload photo. Please try again.');
        setIsUploading(false);
        return;
      }
    } else {
      // No photo needed or already uploaded
      onComplete(task.id, uploadedPhotoUrl || undefined);
    }

    // Don't reset state here - let the mutation's onSuccess handler close the dialog
  };

  const canSubmit = !task?.requiresProof || (task.requiresProof && uploadedPhoto);

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-complete-task">
        <DialogHeader>
          <DialogTitle>{t('tasks.completeTask')}</DialogTitle>
          <DialogDescription>
            {t('tasks.confirmCompletion')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Task Info */}
          <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
            <div className="text-4xl">{task.iconEmoji}</div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{task.title}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge className="gradient-achievement text-white border-0">
                  +{task.points} {t('dashboard.pointsLabel')}
                </Badge>
                {task.requiresProof && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Camera className="h-3 w-3" />
                    <span>{t('tasks.photoRequired')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Photo Upload Section */}
          {task.requiresProof && (
            <div className="space-y-3">
              <div className="text-sm font-medium">{t('tasks.uploadPhotoProof')}</div>
              
              {!previewUrl ? (
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                    data-testid="input-photo-upload"
                  />
                  <Camera className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-3">
                    {t('tasks.takePhoto')}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="button-choose-photo"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {t('tasks.choosePhoto')}
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <img
                    src={previewUrl}
                    alt={t('tasks.choosePhoto')}
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
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting || isUploading}
            data-testid="button-submit-complete"
          >
            {isSubmitting || isUploading ? t('tasks.submitting') : t('tasks.completeAndEarn')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
