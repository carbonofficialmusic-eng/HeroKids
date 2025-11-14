import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AvatarSelector } from "./avatar-selector";
import { avatarAssets, colorOptions } from "@/lib/avatarAssets";
import { Users, UserPlus } from "lucide-react";

const createFamilySchema = z.object({
  familyName: z.string().min(1, "Family name is required"),
  displayName: z.string().min(1, "Display name is required"),
  role: z.enum(["parent", "child"]),
  ageGroup: z.enum(["6-11", "11-17", "adult"]),
});

const joinFamilySchema = z.object({
  joinCode: z.string().length(6, "Join code must be 6 characters"),
  displayName: z.string().min(1, "Display name is required"),
  ageGroup: z.enum(["6-11", "11-17", "adult"]),
});

type CreateFamilyForm = z.infer<typeof createFamilySchema>;
type JoinFamilyForm = z.infer<typeof joinFamilySchema>;
type FamilyMemberForm = CreateFamilyForm;

interface FamilySetupProps {
  onComplete: (data: FamilyMemberForm & { avatarUrl: string; color: string }) => void;
  onJoin: (data: JoinFamilyForm & { avatarUrl: string; color: string }) => void;
  isSubmitting?: boolean;
}

export function FamilySetup({ onComplete, onJoin, isSubmitting = false }: FamilySetupProps) {
  const { t } = useTranslation();
  const [selectedAvatar, setSelectedAvatar] = useState(avatarAssets[0].url);
  const [selectedColor, setSelectedColor] = useState(colorOptions[0].value);
  const [uploadedAvatarFile, setUploadedAvatarFile] = useState<File | null>(null);
  const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState<string | null>(null);

  const createForm = useForm<CreateFamilyForm>({
    resolver: zodResolver(createFamilySchema),
    defaultValues: {
      familyName: "",
      displayName: "",
      role: "parent",
      ageGroup: "adult",
    },
  });

  const joinForm = useForm<JoinFamilyForm>({
    resolver: zodResolver(joinFamilySchema),
    defaultValues: {
      joinCode: "",
      displayName: "",
      ageGroup: "6-11",
    },
  });

  const handleCustomUpload = (file: File) => {
    setUploadedAvatarFile(file);
  };

  const handleClearCustomUpload = () => {
    setUploadedAvatarFile(null);
    setUploadedAvatarUrl(null);
  };

  const uploadAvatar = async () => {
    let finalAvatarUrl = selectedAvatar;
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
      }
    }
    return finalAvatarUrl;
  };

  const onCreateSubmit = async (data: CreateFamilyForm) => {
    const finalAvatarUrl = await uploadAvatar();
    onComplete({
      ...data,
      avatarUrl: finalAvatarUrl,
      color: selectedColor,
    });
  };

  const onJoinSubmit = async (data: JoinFamilyForm) => {
    const finalAvatarUrl = await uploadAvatar();
    onJoin({
      ...data,
      avatarUrl: finalAvatarUrl,
      color: selectedColor,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-2xl p-8">
        <div className="text-center mb-8">
          <div className="h-16 w-16 rounded-full gradient-celebration mx-auto mb-4 flex items-center justify-center">
            <Users className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-black font-accent mb-2" data-testid="text-setup-title">
            {t('familySetup.welcomeToHeroKids')}
          </h1>
          <p className="text-muted-foreground" data-testid="text-setup-subtitle">
            {t('familySetup.setupProfile')}
          </p>
        </div>

        <Tabs defaultValue="create" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="create" data-testid="tab-create-family">
              <Users className="h-4 w-4 mr-2" />
              {t('familySetup.createFamily')}
            </TabsTrigger>
            <TabsTrigger value="join" data-testid="tab-join-family">
              <UserPlus className="h-4 w-4 mr-2" />
              {t('familySetup.joinFamily')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create">
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-6">
                <FormField
                  control={createForm.control}
                  name="familyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('familySetup.familyName')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('familySetup.familyNamePlaceholder')}
                          {...field}
                          data-testid="input-family-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('familySetup.yourName')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('familySetup.yourNamePlaceholder')}
                          {...field}
                          data-testid="input-display-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('familySetup.yourRole')}</FormLabel>
                      <Select onValueChange={(value) => {
                        field.onChange(value);
                        if (value === "parent") {
                          createForm.setValue("ageGroup", "adult");
                        } else {
                          createForm.setValue("ageGroup", "6-11");
                        }
                      }} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-role">
                            <SelectValue placeholder={t('familySetup.selectYourRole')} />
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

                {createForm.watch("role") === "child" && (
                  <FormField
                    control={createForm.control}
                    name="ageGroup"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Age Group</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-age-group">
                              <SelectValue placeholder="Select age group" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="6-11" data-testid="option-age-6-11">6-11 years (Children)</SelectItem>
                            <SelectItem value="11-17" data-testid="option-age-11-17">11-17 years (Youth)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={isSubmitting}
                  data-testid="button-complete-setup"
                >
                  {isSubmitting ? t('familySetup.creatingFamily') : t('familySetup.createFamilyButton')}
                </Button>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="join">
            <Form {...joinForm}>
              <form onSubmit={joinForm.handleSubmit(onJoinSubmit)} className="space-y-6">
                <FormField
                  control={joinForm.control}
                  name="joinCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('familySetup.joinCode')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('familySetup.joinCodePlaceholder')}
                          maxLength={6}
                          {...field}
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                          data-testid="input-join-code"
                          className="text-center text-2xl font-mono tracking-wider"
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-sm text-muted-foreground mt-2">
                        {t('familySetup.askParentForCode')}
                      </p>
                    </FormItem>
                  )}
                />

                <FormField
                  control={joinForm.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('familySetup.yourName')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('familySetup.yourNamePlaceholder')}
                          {...field}
                          data-testid="input-join-display-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={joinForm.control}
                  name="ageGroup"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Age Group</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-join-age-group">
                            <SelectValue placeholder="Select age group" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="6-11" data-testid="option-join-age-6-11">6-11 years (Children)</SelectItem>
                          <SelectItem value="11-17" data-testid="option-join-age-11-17">11-17 years (Youth)</SelectItem>
                          <SelectItem value="adult" data-testid="option-join-age-adult">Parent/Adult</SelectItem>
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

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={isSubmitting}
                  data-testid="button-join-family"
                >
                  {isSubmitting ? t('familySetup.joining') : t('familySetup.joinFamilyButton')}
                </Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
