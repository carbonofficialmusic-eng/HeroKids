import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { AvatarSelector } from "./avatar-selector";
import { avatarAssets, colorOptions } from "@/lib/avatarAssets";
import type { FamilyMember } from "@shared/schema";

const editMemberSchema = z.object({
  displayName: z.string().min(1, "Display name is required"),
});

type EditMemberForm = z.infer<typeof editMemberSchema>;

interface EditMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (memberId: string, data: EditMemberForm & { avatarUrl: string; color: string }) => void;
  isSubmitting?: boolean;
  member: FamilyMember | null;
}

export function EditMemberDialog({ 
  open, 
  onOpenChange, 
  onSubmit, 
  isSubmitting = false,
  member
}: EditMemberDialogProps) {
  const [selectedAvatar, setSelectedAvatar] = useState(member?.avatarUrl || avatarAssets[0].url);
  const [selectedColor, setSelectedColor] = useState(member?.color || colorOptions[0].value);
  const [uploadedAvatarFile, setUploadedAvatarFile] = useState<File | null>(null);
  const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState<string | null>(null);

  const form = useForm<EditMemberForm>({
    resolver: zodResolver(editMemberSchema),
    defaultValues: {
      displayName: member?.displayName || "",
    },
  });

  // Update form when member changes
  useEffect(() => {
    if (member) {
      form.reset({
        displayName: member.displayName,
      });
      setSelectedAvatar(member.avatarUrl || avatarAssets[0].url);
      setSelectedColor(member.color || colorOptions[0].value);
      setUploadedAvatarFile(null);
      setUploadedAvatarUrl(null);
    }
  }, [member, form]);

  const handleCustomUpload = (file: File) => {
    setUploadedAvatarFile(file);
  };

  const handleClearCustomUpload = () => {
    setUploadedAvatarFile(null);
    setUploadedAvatarUrl(null);
  };

  const handleSubmit = async (data: EditMemberForm) => {
    if (!member) return;

    let finalAvatarUrl = selectedAvatar;

    // If user uploaded a custom avatar, upload it first
    if (uploadedAvatarFile) {
      try {
        const formData = new FormData();
        formData.append('avatar', uploadedAvatarFile);

        const response = await fetch('/api/upload-avatar', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const { avatarUrl } = await response.json();
          finalAvatarUrl = avatarUrl;
          setUploadedAvatarUrl(avatarUrl);
        }
      } catch (error) {
        console.error('Error uploading avatar:', error);
        // Continue with default avatar on error
      }
    }

    onSubmit(member.id, {
      ...data,
      avatarUrl: finalAvatarUrl,
      color: selectedColor,
    });
  };

  if (!member) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-edit-member">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>
            Update your profile picture, color, or display name.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Alex, Emma, Sam"
                      {...field}
                      data-testid="input-edit-member-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <AvatarSelector
              selectedAvatar={selectedAvatar}
              selectedColor={selectedColor}
              onAvatarSelect={setSelectedAvatar}
              onColorSelect={setSelectedColor}
              onCustomUpload={handleCustomUpload}
              onClearCustomUpload={handleClearCustomUpload}
              uploadedAvatarUrl={uploadedAvatarUrl}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                data-testid="button-cancel-edit"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                data-testid="button-submit-edit"
              >
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
