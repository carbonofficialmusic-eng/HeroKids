import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AvatarSelector } from "./avatar-selector";
import { avatarAssets, colorOptions } from "@/lib/avatarAssets";
import { useTranslation } from "react-i18next";

const addMemberSchema = z.object({
  displayName: z.string().min(1, "Display name is required"),
  role: z.enum(["parent", "child"]),
});

type AddMemberForm = z.infer<typeof addMemberSchema>;

interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: AddMemberForm & { avatarUrl: string; color: string; familyName: string }) => void;
  isSubmitting?: boolean;
  familyName: string;
}

export function AddMemberDialog({ 
  open, 
  onOpenChange, 
  onSubmit, 
  isSubmitting = false,
  familyName 
}: AddMemberDialogProps) {
  const { t } = useTranslation();
  const [selectedAvatar, setSelectedAvatar] = useState(avatarAssets[0].url);
  const [selectedColor, setSelectedColor] = useState(colorOptions[0].value);
  const [uploadedAvatarFile, setUploadedAvatarFile] = useState<File | null>(null);
  const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState<string | null>(null);

  const form = useForm<AddMemberForm>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: {
      displayName: "",
      role: "child",
    },
  });

  const handleCustomUpload = (file: File) => {
    setUploadedAvatarFile(file);
  };

  const handleClearCustomUpload = () => {
    setUploadedAvatarFile(null);
    setUploadedAvatarUrl(null);
  };

  const handleSubmit = async (data: AddMemberForm) => {
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

    onSubmit({
      ...data,
      avatarUrl: finalAvatarUrl,
      color: selectedColor,
      familyName,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto" data-testid="dialog-add-member">
        <DialogHeader>
          <DialogTitle>{t("addMember.title")}</DialogTitle>
          <DialogDescription>
            {t("addMember.description")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("addMember.memberName")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("addMember.memberNamePlaceholder")}
                      {...field}
                      data-testid="input-member-name"
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
                  <FormLabel>{t("addMember.role")}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-member-role">
                        <SelectValue placeholder={t("addMember.selectRole")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="child" data-testid="option-role-child">{t("addMember.roleChild")}</SelectItem>
                      <SelectItem value="parent" data-testid="option-role-parent">{t("addMember.roleParent")}</SelectItem>
                    </SelectContent>
                  </Select>
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
                data-testid="button-cancel-member"
              >
                {t("addMember.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                data-testid="button-submit-member"
              >
                {isSubmitting ? t("addMember.adding") : t("addMember.addMember")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
