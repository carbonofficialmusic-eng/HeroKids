import { useState, useEffect } from "react";
import { scrollFieldIntoView } from "@/lib/keyboard-scroll";
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
import { Switch } from "@/components/ui/switch";
import { AvatarSelector } from "./avatar-selector";
import { avatarAssets, colorOptions } from "@/lib/avatarAssets";
import { getAvatarUrl, SKIN_IMAGES } from "@/lib/skins";
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
  onSubmit: (memberId: string, data: EditMemberForm & { avatarUrl: string; color: string; useCustomAvatar?: boolean }) => void;
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
  const [useCustomAvatarToggle, setUseCustomAvatarToggle] = useState(member?.useCustomAvatar || false);
  const [isLocalSubmitting, setIsLocalSubmitting] = useState(false);

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
      setUseCustomAvatarToggle(member.useCustomAvatar || false);
    }
  }, [member, form]);

  const handleCustomUpload = (file: File) => {
    setUploadedAvatarFile(file);
    // When uploading a new photo, automatically enable custom avatar
    setUseCustomAvatarToggle(true);
  };

  const handleClearCustomUpload = () => {
    setUploadedAvatarFile(null);
    setUploadedAvatarUrl(null);
  };

  const handleAvatarSelect = (avatarUrl: string) => {
    setSelectedAvatar(avatarUrl);
    // Clear custom avatar state when selecting a skin/default avatar
    setUploadedAvatarFile(null);
    setUploadedAvatarUrl(null);
  };

  const handleSubmit = async (data: EditMemberForm) => {
    if (!member || isLocalSubmitting) return;
    setIsLocalSubmitting(true);

    try {
      let finalAvatarUrl = selectedAvatar;

      // If user selected an avatar from history, use that URL directly
      if (uploadedAvatarUrl) {
        finalAvatarUrl = uploadedAvatarUrl;
      }
      // If user uploaded a new custom avatar file, upload it first using 3-step Object Storage flow
      else if (uploadedAvatarFile && uploadedAvatarFile.size > 0) {
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
        } catch (error) {
          console.error('Error uploading avatar:', error);
          // Continue with default avatar on error
        }
      }

      // Determine useCustomAvatar flag:
      // - If new avatar uploaded or history selected → true
      // - If toggle was changed by user → use toggle value
      // - If reverted to skin/default avatar → false
      let useCustomAvatarFlag: boolean;
      if (uploadedAvatarUrl || (uploadedAvatarFile && uploadedAvatarFile.size > 0)) {
        // New upload or history selection → always use custom avatar
        useCustomAvatarFlag = true;
      } else if (member.activeSkinId) {
        // If skin is active, respect the toggle value
        useCustomAvatarFlag = useCustomAvatarToggle;
      } else if (finalAvatarUrl !== member.avatarUrl) {
        // Avatar changed to something else (likely skin asset)
        useCustomAvatarFlag = false;
      } else {
        // No avatar change, preserve existing flag
        useCustomAvatarFlag = member.useCustomAvatar;
      }

      onSubmit(member.id, {
        ...data,
        avatarUrl: finalAvatarUrl,
        color: selectedColor,
        useCustomAvatar: useCustomAvatarFlag,
      });
    } finally {
      setIsLocalSubmitting(false);
    }
  };

  if (!member) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto" data-testid="dialog-edit-member" onOpenAutoFocus={(e) => e.preventDefault()}>
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
                      onFocus={(e) => scrollFieldIntoView(e.currentTarget)}
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
              <div className="space-y-3" data-testid="active-skin-preview">
                <FormLabel>{t('memberDialogs.currentDisplayAvatar')}</FormLabel>
                <div className="flex items-center gap-4 p-3 rounded-md bg-muted">
                  <div className="flex gap-2">
                    <Avatar className="h-14 w-14 border-2 border-primary">
                      <AvatarImage src={getAvatarUrl(member.activeSkinId, member.avatarUrl, useCustomAvatarToggle, member.updatedAt)} alt={member.displayName} />
                      <AvatarFallback>{member.displayName[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {t('memberDialogs.activeSkinOverride')}
                    </p>
                    {member.avatarUrl && (
                      <div className="flex items-center gap-2">
                        <Switch
                          id="use-custom-avatar"
                          checked={useCustomAvatarToggle}
                          onCheckedChange={setUseCustomAvatarToggle}
                          data-testid="switch-use-custom-avatar"
                        />
                        <label htmlFor="use-custom-avatar" className="text-sm cursor-pointer">
                          {t('memberDialogs.useOwnPhoto')}
                        </label>
                      </div>
                    )}
                  </div>
                </div>
                {member.avatarUrl && (
                  <div className="flex gap-3 p-2 rounded-md bg-muted/50">
                    <div 
                      className={`cursor-pointer transition-all ${!useCustomAvatarToggle ? 'ring-2 ring-primary ring-offset-2' : 'opacity-60'}`}
                      onClick={() => setUseCustomAvatarToggle(false)}
                    >
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={SKIN_IMAGES[member.activeSkinId]} alt="Skin Avatar" />
                        <AvatarFallback>S</AvatarFallback>
                      </Avatar>
                      <p className="text-xs text-center mt-1 text-muted-foreground">Skin</p>
                    </div>
                    <div 
                      className={`cursor-pointer transition-all ${useCustomAvatarToggle ? 'ring-2 ring-primary ring-offset-2' : 'opacity-60'}`}
                      onClick={() => setUseCustomAvatarToggle(true)}
                    >
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={member.avatarUrl} alt="Eigenes Foto" />
                        <AvatarFallback>{member.displayName[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <p className="text-xs text-center mt-1 text-muted-foreground">{t('memberDialogs.ownPhoto')}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {(member as any).avatarHistory && (member as any).avatarHistory.length > 0 && (
              <div className="space-y-2" data-testid="recent-avatars-section">
                <FormLabel>{t('memberDialogs.recentAvatars')}</FormLabel>
                <div className="flex gap-2">
                  {((member as any).avatarHistory as string[]).map((avatarUrl: string, index: number) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        setUploadedAvatarUrl(avatarUrl);
                        setUploadedAvatarFile(null);
                        setSelectedAvatar(avatarUrl);
                      }}
                      className="relative group"
                      data-testid={`button-recent-avatar-${index}`}
                    >
                      <Avatar className={`h-14 w-14 border-2 transition-all ${
                        uploadedAvatarUrl === avatarUrl 
                          ? 'border-primary ring-2 ring-primary ring-offset-2' 
                          : 'border-border hover-elevate'
                      }`}>
                        <AvatarImage src={avatarUrl} alt={`Recent avatar ${index + 1}`} />
                        <AvatarFallback>{member.displayName[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('memberDialogs.recentAvatarsHint')}
                </p>
              </div>
            )}

            <AvatarSelector
              selectedAvatar={selectedAvatar}
              selectedColor={selectedColor}
              onAvatarSelect={handleAvatarSelect}
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
                disabled={isSubmitting || isLocalSubmitting}
                data-testid="button-cancel-edit"
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || isLocalSubmitting}
                data-testid="button-submit-edit"
              >
                {(isSubmitting || isLocalSubmitting) ? t('rewards.saving') : t('rewards.saveChanges')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
