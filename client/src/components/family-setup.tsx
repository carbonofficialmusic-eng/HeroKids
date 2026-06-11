import { useEffect, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AvatarSelector } from "./avatar-selector";
import { avatarAssets, colorOptions } from "@/lib/avatarAssets";
import { CheckCircle, Users, UserPlus, Smartphone, LogOut } from "lucide-react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const createFamilySchema = z.object({
  familyName: z.string().min(1, "Family name is required"),
  displayName: z.string().min(1, "Display name is required"),
});

const joinFamilySchema = z.object({
  joinCode: z.string().length(6, "Join code must be 6 characters"),
  displayName: z.string().min(1, "Display name is required"),
});

type CreateFamilyForm = z.infer<typeof createFamilySchema>;
type JoinFamilyForm = z.infer<typeof joinFamilySchema>;
type FamilyMemberForm = CreateFamilyForm & { role: "parent" };

interface FamilySetupProps {
  onComplete: (data: FamilyMemberForm & { avatarUrl: string; color: string }) => void;
  onJoin: (data: JoinFamilyForm & { avatarUrl: string; color: string }) => void;
  isSubmitting?: boolean;
  initialDisplayName?: string;
  initialFamilyName?: string;
}

export function FamilySetup({
  onComplete,
  onJoin,
  isSubmitting = false,
  initialDisplayName = "",
  initialFamilyName = "",
}: FamilySetupProps) {
  const { t } = useTranslation();
  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      window.location.href = "/";
    },
  });
  const [selectedAvatar, setSelectedAvatar] = useState(avatarAssets[0].url);
  const [selectedColor, setSelectedColor] = useState(colorOptions[0].value);
  const [uploadedAvatarFile, setUploadedAvatarFile] = useState<File | null>(null);
  const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState<string | null>(null);
  const [showRegistrationIntro, setShowRegistrationIntro] = useState(false);

  const createForm = useForm<CreateFamilyForm>({
    resolver: zodResolver(createFamilySchema),
    defaultValues: {
      familyName: initialFamilyName,
      displayName: initialDisplayName,
    },
  });

  const joinForm = useForm<JoinFamilyForm>({
    resolver: zodResolver(joinFamilySchema),
    defaultValues: {
      joinCode: "",
      displayName: initialDisplayName,
    },
  });

  useEffect(() => {
    if (sessionStorage.getItem("herokids_registration_complete") === "true") {
      setShowRegistrationIntro(true);
      sessionStorage.removeItem("herokids_registration_complete");
    }
  }, []);

  useEffect(() => {
    if (initialFamilyName && !createForm.getValues("familyName")) {
      createForm.setValue("familyName", initialFamilyName);
    }
    if (initialDisplayName) {
      if (!createForm.getValues("displayName")) {
        createForm.setValue("displayName", initialDisplayName);
      }
      if (!joinForm.getValues("displayName")) {
        joinForm.setValue("displayName", initialDisplayName);
      }
    }
  }, [createForm, initialDisplayName, initialFamilyName, joinForm]);

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
        // Step 1: Get presigned upload URL
        const urlResponse = await fetch('/api/upload-avatar-url', {
          method: 'POST',
        });

        if (!urlResponse.ok) {
          console.error('Failed to get avatar upload URL');
          return finalAvatarUrl;
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
          console.error('Failed to upload avatar to storage');
          return finalAvatarUrl;
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
          console.error('Failed to finalize avatar upload');
          return finalAvatarUrl;
        }

        const { avatarUrl } = await aclResponse.json();
        finalAvatarUrl = avatarUrl;
        setUploadedAvatarUrl(avatarUrl);
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
      role: "parent",
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
        <div className="flex justify-end mb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            data-testid="button-logout-setup"
            className="text-muted-foreground gap-2"
          >
            <LogOut className="h-4 w-4" />
            {logoutMutation.isPending ? "..." : "Abmelden"}
          </Button>
        </div>
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

        {showRegistrationIntro && (
          <Alert className="mb-6" data-testid="status-registration-next-step">
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>Konto erstellt. Jetzt noch Familie einrichten.</AlertTitle>
            <AlertDescription>
              Wir haben deinen Namen schon eingetragen. Lege jetzt deine Familie an oder tritt einer bestehenden Familie mit Einladungscode bei.
            </AlertDescription>
          </Alert>
        )}

        <div className="mb-6 grid gap-3 rounded-md bg-muted/60 p-4 text-sm text-muted-foreground" data-testid="panel-setup-steps">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground">Schritt 1</span>
            <span>Konto erstellen</span>
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground">Schritt 2</span>
            <span>Familie und dein Profil einrichten</span>
          </div>
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

                <div className="rounded-md bg-muted/50 p-4" data-testid="status-parent-profile">
                  <p className="text-sm font-semibold">{t('familySetup.yourRole')}: {t('settings.parent')}</p>
                  <p className="text-sm text-muted-foreground">{t('familySetup.parentProfileHint')}</p>
                </div>

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

        <div className="mt-6 pt-6 border-t text-center">
          <p className="text-sm text-muted-foreground mb-3">
            {t('familySetup.alreadyHaveAccount')}
          </p>
          <Link href="/link-device">
            <Button variant="outline" className="gap-2" data-testid="button-link-device">
              <Smartphone className="h-4 w-4" />
              {t('familySetup.linkExistingDevice')}
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
