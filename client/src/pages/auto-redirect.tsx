import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

interface FamilyMember {
  id: string;
  isParent: boolean;
  isRealParent: boolean;
}

export default function AutoRedirect() {
  const [, setLocation] = useLocation();
  
  const { data: member, isLoading } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/current"],
  });

  useEffect(() => {
    if (!isLoading && member) {
      // Redirect based on role
      if (member.isParent || member.isRealParent) {
        setLocation("/dashboard");
      } else {
        setLocation("/kid-dashboard");
      }
    }
  }, [member, isLoading, setLocation]);

  // Show loading state while determining role
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-muted-foreground">Laden...</p>
      </div>
    </div>
  );
}
