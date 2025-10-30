import { useState, useRef } from "react";
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
  const [uploadedPhoto, setUploadedPhoto] = useState<File | null>(null);
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setIsUploading(false);
    } else {
      // No photo needed or already uploaded
      onComplete(task.id, uploadedPhotoUrl || undefined);
    }

    // Reset state
    handleRemovePhoto();
  };

  const canSubmit = !task?.requiresProof || (task.requiresProof && uploadedPhoto);

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-complete-task">
        <DialogHeader>
          <DialogTitle>Complete Task</DialogTitle>
          <DialogDescription>
            Confirm task completion to earn your points!
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
                  +{task.points} points
                </Badge>
                {task.requiresProof && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Camera className="h-3 w-3" />
                    <span>Photo required</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Photo Upload Section */}
          {task.requiresProof && (
            <div className="space-y-3">
              <div className="text-sm font-medium">Upload Photo Proof</div>
              
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
                    Take a photo showing you completed this task
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="button-choose-photo"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Choose Photo
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <img
                    src={previewUrl}
                    alt="Proof preview"
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
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting || isUploading}
            data-testid="button-submit-complete"
          >
            {isSubmitting || isUploading ? "Submitting..." : "Complete & Earn Points!"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
