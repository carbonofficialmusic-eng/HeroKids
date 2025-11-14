import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import Dashboard from "@/pages/dashboard";
import ChildDashboard from "@/pages/child-dashboard";
import type { FamilyMember } from "@shared/schema";

export default function DashboardGateway() {
  const { user } = useAuth();

  const { data: member, isLoading } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/current"],
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-lg text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!member) {
    return <Dashboard />;
  }

  if (member.ageGroup === "6-11") {
    return <ChildDashboard />;
  }

  if (member.ageGroup === "11-17") {
    return <ChildDashboard />;
  }

  return <Dashboard />;
}
