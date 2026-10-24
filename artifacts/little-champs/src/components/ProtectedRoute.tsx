import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { AppLoadingScreen } from "@/components/app-loading-screen";

interface FamilyMember {
  id: number;
  role: "parent" | "child";
}

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "parent" | "child";
  redirectTo?: string;
}

export function ProtectedRoute({ 
  children, 
  requiredRole = "parent",
  redirectTo = "/" 
}: ProtectedRouteProps) {
  const [, setLocation] = useLocation();
  
  const { data: member, isLoading } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/current"],
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!isLoading && member && requiredRole === "parent" && member.role !== "parent") {
      setLocation(redirectTo);
    }
  }, [member, isLoading, requiredRole, redirectTo, setLocation]);

  if (isLoading) {
    return <AppLoadingScreen />;
  }

  if (!member || (requiredRole === "parent" && member.role !== "parent")) {
    return null;
  }

  return <>{children}</>;
}
