import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
});

const joinFamilySchema = z.object({
  joinCode: z.string().length(6, "Join code must be 6 characters"),
  displayName: z.string().min(1, "Display name is required"),
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
    },
  });

  const joinForm = useForm<JoinFamilyForm>({
    resolver: zodResolver(joinFamilySchema),
    defaultValues: {
      joinCode: "",
      displayName: "",
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
            Welcome to HomeHero!
          </h1>
          <p className="text-muted-foreground" data-testid="text-setup-subtitle">
            Let's set up your family profile to get started
          </p>
        </div>

        <Tabs defaultValue="create" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="create" data-testid="tab-create-family">
              <Users className="h-4 w-4 mr-2" />
              Create Family
            </TabsTrigger>
            <TabsTrigger value="join" data-testid="tab-join-family">
              <UserPlus className="h-4 w-4 mr-2" />
              Join Family
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
                      <FormLabel>Family Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., The Smiths"
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
                      <FormLabel>Your Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Mom, Dad, Alex"
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
                      <FormLabel>Your Role</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-role">
                            <SelectValue placeholder="Select your role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="parent" data-testid="option-role-parent">Parent</SelectItem>
                          <SelectItem value="child" data-testid="option-role-child">Child</SelectItem>
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
                  data-testid="button-complete-setup"
                >
                  {isSubmitting ? "Creating Family..." : "Create Family"}
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
                      <FormLabel>Join Code</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter 6-character code"
                          maxLength={6}
                          {...field}
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                          data-testid="input-join-code"
                          className="text-center text-2xl font-mono tracking-wider"
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-sm text-muted-foreground mt-2">
                        Ask a parent in your family for the join code
                      </p>
                    </FormItem>
                  )}
                />

                <FormField
                  control={joinForm.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Your Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Liv, Alex, Sam"
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
                  {isSubmitting ? "Joining..." : "Join Family"}
                </Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
