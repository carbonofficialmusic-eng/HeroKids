import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import Landing from "./landing";

interface FamilyMember {
  id: string;
  role: "parent" | "child";
}

export default function AutoRedirect() {
  const [, setLocation] = useLocation();
  
  const { data: member, isLoading, isError } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/current"],
    retry: false,
  });

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
    return <Landing />;
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
