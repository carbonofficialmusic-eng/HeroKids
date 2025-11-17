import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { getBackgroundUrl } from "@/lib/skins";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import KidDashboard from "@/pages/kid-dashboard";
import KidDashboardOld from "@/pages/kid-dashboard-old";
import Pricing from "@/pages/pricing";
import Analytics from "@/pages/analytics";
import Chat from "@/pages/chat";
import Approvals from "@/pages/approvals";
import RewardsBoard from "@/pages/rewards-board";
import Settings from "@/pages/settings";
import SkinsGallery from "@/pages/skins-gallery";
import Achievements from "@/pages/achievements";
import FamilyGoals from "@/pages/family-goals";

interface FamilyMember {
  id: number;
  activeSkinId: string | null;
}

function BackgroundWrapper({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  
  const { data: member } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/current"],
    enabled: isAuthenticated,
  });

  const backgroundUrl = getBackgroundUrl(member?.activeSkinId);
  
  const [currentBg, setCurrentBg] = useState<string | undefined>(backgroundUrl);
  const [previousBg, setPreviousBg] = useState<string | undefined>(undefined);
  const [showNew, setShowNew] = useState(true);

  useEffect(() => {
    if (backgroundUrl !== currentBg) {
      setPreviousBg(currentBg);
      setCurrentBg(backgroundUrl);
      setShowNew(false);
      
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setShowNew(true);
        });
      });
      
      const cleanupTimer = setTimeout(() => {
        setPreviousBg(undefined);
      }, 800);
      
      return () => clearTimeout(cleanupTimer);
    }
  }, [backgroundUrl, currentBg]);

  return (
    <div className="min-h-screen relative">
      {previousBg && (
        <div 
          className="fixed inset-0 bg-cover bg-center theme-background-layer"
          style={{
            backgroundImage: `url(${previousBg})`,
            zIndex: 0,
            opacity: showNew ? 0 : 1,
          }}
        />
      )}
      
      {currentBg && (
        <div 
          className="fixed inset-0 bg-cover bg-center theme-background-layer"
          style={{
            backgroundImage: `url(${currentBg})`,
            zIndex: 0,
            opacity: showNew ? 1 : 0,
          }}
        />
      )}
      
      <div className="relative" style={{ zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <BackgroundWrapper>
      <Switch>
        {isLoading || !isAuthenticated ? (
          <Route path="/" component={Landing} />
        ) : (
          <>
            <Route path="/" component={Dashboard} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/kid-dashboard" component={KidDashboard} />
            <Route path="/kid-dashboard-old" component={KidDashboardOld} />
            <Route path="/tasks" component={Dashboard} />
            <Route path="/rewards" component={Dashboard} />
            <Route path="/leaderboard" component={Dashboard} />
            <Route path="/skins" component={SkinsGallery} />
            <Route path="/pricing" component={Pricing} />
            <Route path="/analytics" component={Analytics} />
            <Route path="/chat" component={Chat} />
            <Route path="/approvals" component={Approvals} />
            <Route path="/rewards-board" component={RewardsBoard} />
            <Route path="/skins-gallery" component={SkinsGallery} />
            <Route path="/settings">
              <ProtectedRoute requiredRole="parent" redirectTo="/dashboard">
                <Settings />
              </ProtectedRoute>
            </Route>
            <Route path="/achievements">
              <ProtectedRoute requiredRole="parent" redirectTo="/dashboard">
                <Achievements />
              </ProtectedRoute>
            </Route>
            <Route path="/family-goals" component={FamilyGoals} />
          </>
        )}
        <Route component={NotFound} />
      </Switch>
    </BackgroundWrapper>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <LanguageProvider>
            <Toaster />
            <Router />
          </LanguageProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
