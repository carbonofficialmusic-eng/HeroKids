import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect } from "react";

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
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!member || (requiredRole === "parent" && member.role !== "parent")) {
    return null;
  }

  return <>{children}</>;
}
