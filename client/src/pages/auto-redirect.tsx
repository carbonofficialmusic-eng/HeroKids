import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { FamilySetup } from "@/components/family-setup";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";

interface FamilyMember {
  id: string;
  role: "parent" | "child";
}

export default function AutoRedirect() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useTranslation();
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email?.split("@")[0] || "";
  const familyNameBase = user?.lastName || user?.firstName || "";
  
  const { data: member, isLoading, isError } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/current"],
    retry: false,
  });

  const createFamilyMutation = useMutation({
    mutationFn: async (data: { familyName: string; displayName: string; role: string; avatarUrl: string; color: string }) => {
      const res = await apiRequest("POST", "/api/family-members", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/families/current"] });
      setLocation("/dashboard");
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create family",
      });
    },
  });

  const joinFamilyMutation = useMutation({
    mutationFn: async (data: { joinCode: string; displayName: string; avatarUrl: string; color: string }): Promise<FamilyMember> => {
      const res = await apiRequest("POST", "/api/join-family", data);
      return res.json();
    },
    onSuccess: (data: FamilyMember) => {
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/families/current"] });
      if (data.role === "parent") {
        setLocation("/dashboard");
      } else {
        setLocation("/kid-dashboard");
      }
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to join family",
      });
    },
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const verified = urlParams.get("verified");

    if (verified === "success") {
      toast({ title: "E-Mail bestätigt", description: "Dein HeroKids-Konto ist jetzt bestätigt." });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      window.history.replaceState({}, "", "/");
    } else if (verified === "invalid") {
      toast({ title: "Bestätigung fehlgeschlagen", description: "Der Link ist ungültig oder abgelaufen.", variant: "destructive" });
      window.history.replaceState({}, "", "/");
    }
  }, [toast]);

  useEffect(() => {
    if (!isLoading && member) {
      if (member.role === "parent") {
        setLocation("/dashboard");
      } else {
        setLocation("/kid-dashboard");
      }
    }
  }, [member, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Laden...</p>
        </div>
      </div>
    );
  }

  if (isError || !member) {
    return (
      <FamilySetup
        onComplete={(data) => createFamilyMutation.mutate(data)}
        onJoin={(data) => joinFamilyMutation.mutate(data)}
        isSubmitting={createFamilyMutation.isPending || joinFamilyMutation.isPending}
        initialDisplayName={displayName}
        initialFamilyName={familyNameBase ? t("familySetup.familyNameSuggestion", { name: familyNameBase }) : ""}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-muted-foreground">Laden...</p>
      </div>
    </div>
  );
}
