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
  const [selectedAvatar, setSelectedAvatar] = useState(avatarAssets[0].url);
  const [selectedColor, setSelectedColor] = useState(colorOptions[0].value);

  const form = useForm<AddMemberForm>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: {
      displayName: "",
      role: "child",
    },
  });

  const handleSubmit = (data: AddMemberForm) => {
    onSubmit({
      ...data,
      avatarUrl: selectedAvatar,
      color: selectedColor,
      familyName,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-add-member">
        <DialogHeader>
          <DialogTitle>Add Family Member</DialogTitle>
          <DialogDescription>
            Add a new member to your family. They'll be able to complete tasks and earn rewards!
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Member Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Alex, Emma, Sam"
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
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-member-role">
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="child" data-testid="option-role-child">Child</SelectItem>
                      <SelectItem value="parent" data-testid="option-role-parent">Parent</SelectItem>
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                data-testid="button-cancel-member"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                data-testid="button-submit-member"
              >
                {isSubmitting ? "Adding..." : "Add Member"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
