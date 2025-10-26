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
import { AvatarSelector } from "./avatar-selector";
import { avatarAssets, colorOptions } from "@/lib/avatarAssets";
import { Users } from "lucide-react";

const familyMemberSchema = z.object({
  familyName: z.string().min(1, "Family name is required"),
  displayName: z.string().min(1, "Display name is required"),
  role: z.enum(["parent", "child"]),
});

type FamilyMemberForm = z.infer<typeof familyMemberSchema>;

interface FamilySetupProps {
  onComplete: (data: FamilyMemberForm & { avatarUrl: string; color: string }) => void;
  isSubmitting?: boolean;
}

export function FamilySetup({ onComplete, isSubmitting = false }: FamilySetupProps) {
  const [selectedAvatar, setSelectedAvatar] = useState(avatarAssets[0].url);
  const [selectedColor, setSelectedColor] = useState(colorOptions[0].value);

  const form = useForm<FamilyMemberForm>({
    resolver: zodResolver(familyMemberSchema),
    defaultValues: {
      familyName: "",
      displayName: "",
      role: "parent",
    },
  });

  const onSubmit = (data: FamilyMemberForm) => {
    onComplete({
      ...data,
      avatarUrl: selectedAvatar,
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

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
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
              control={form.control}
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
              control={form.control}
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
            />

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isSubmitting}
              data-testid="button-complete-setup"
            >
              {isSubmitting ? "Setting up..." : "Complete Setup"}
            </Button>
          </form>
        </Form>
      </Card>
    </div>
  );
}
