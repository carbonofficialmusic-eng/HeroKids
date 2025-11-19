import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AvatarSelector } from "./avatar-selector";
import { avatarAssets, colorOptions } from "@/lib/avatarAssets";
import { getAvatarUrl } from "@/lib/skins";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import type { FamilyMember } from "@shared/schema";

const editMemberSchema = z.object({
  displayName: z.string().min(1, "Display name is required"),
  role: z.enum(["parent", "child"]),
});

type EditMemberForm = z.infer<typeof editMemberSchema>;

interface EditMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (memberId: string, data: EditMemberForm & { avatarUrl: string; color: string }) => void;
  isSubmitting?: boolean;
  member: FamilyMember | null;
  currentUserRole?: "parent" | "child";
}

export function EditMemberDialog({ 
  open, 
  onOpenChange, 
  onSubmit, 
  isSubmitting = false,
  member,
  currentUserRole
}: EditMemberDialogProps) {
  const { t } = useTranslation();
  const [selectedAvatar, setSelectedAvatar] = useState(member?.avatarUrl || avatarAssets[0].url);
  const [selectedColor, setSelectedColor] = useState(member?.color || colorOptions[0].value);
  const [uploadedAvatarFile, setUploadedAvatarFile] = useState<File | null>(null);
  const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState<string | null>(null);

  const form = useForm<EditMemberForm>({
    resolver: zodResolver(editMemberSchema),
    defaultValues: {
      displayName: member?.displayName || "",
      role: member?.role || "child",
    },
  });

  // Update form when member changes
  useEffect(() => {
    if (member) {
      form.reset({
        displayName: member.displayName,
        role: member.role,
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

    // If user uploaded a custom avatar, upload it first using 3-step Object Storage flow
    if (uploadedAvatarFile) {
      try {
        // Step 1: Get presigned upload URL
        const urlResponse = await fetch('/api/upload-avatar-url', {
          method: 'POST',
        });

        if (!urlResponse.ok) {
          throw new Error('Failed to get upload URL');
        }

        const { uploadURL } = await urlResponse.json();

        // Step 2: Upload file directly to Object Storage using presigned URL
        const uploadResponse = await fetch(uploadURL, {
          method: 'PUT',
          body: uploadedAvatarFile,
          headers: {
            'Content-Type': uploadedAvatarFile.type,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload avatar to storage');
        }

        // Step 3: Set ACL policy and get final object path
        const aclResponse = await fetch('/api/avatar', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ avatarUrl: uploadURL }),
        });

        if (!aclResponse.ok) {
          throw new Error('Failed to finalize avatar upload');
        }

        const { avatarUrl } = await aclResponse.json();
        finalAvatarUrl = avatarUrl;
        setUploadedAvatarUrl(avatarUrl);
      } catch (error) {
        console.error('Error uploading avatar:', error);
        // Continue with default avatar on error
      }
    }

    onSubmit(member.id, {
      ...data,
      avatarUrl: finalAvatarUrl,
      color: selectedColor,
      useCustomAvatar: uploadedAvatarFile ? true : undefined, // Enable custom avatar if uploaded
    });
  };

  if (!member) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto" data-testid="dialog-edit-member">
        <DialogHeader>
          <DialogTitle>{t('memberDialogs.editProfile')}</DialogTitle>
          <DialogDescription>
            {t('memberDialogs.editProfileDesc')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('memberDialogs.displayName')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('memberDialogs.displayNamePlaceholder')}
                      {...field}
                      data-testid="input-edit-member-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('memberDialogs.role')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-edit-role">
                        <SelectValue placeholder={t('memberDialogs.selectRole')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="parent" data-testid="option-role-parent">{t('settings.parent')}</SelectItem>
                      <SelectItem value="child" data-testid="option-role-child">{t('settings.child')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {member.activeSkinId && (
              <div className="space-y-2" data-testid="active-skin-preview">
                <FormLabel>{t('memberDialogs.currentDisplayAvatar')}</FormLabel>
                <div className="flex items-center gap-3 p-3 rounded-md bg-muted">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={getAvatarUrl(member.activeSkinId, member.avatarUrl, member.useCustomAvatar)} alt={member.displayName} />
                    <AvatarFallback>{member.displayName[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <p className="text-sm text-muted-foreground">
                    {t('memberDialogs.activeSkinOverride')}
                  </p>
                </div>
              </div>
            )}

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
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                data-testid="button-submit-edit"
              >
                {isSubmitting ? t('rewards.saving') : t('rewards.saveChanges')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
