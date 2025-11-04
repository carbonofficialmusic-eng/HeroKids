import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { useAuth } from "@/hooks/useAuth";
import { getBackgroundUrl } from "@/lib/skins";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Pricing from "@/pages/pricing";
import Analytics from "@/pages/analytics";
import RewardsBoard from "@/pages/rewards-board";
import Settings from "@/pages/settings";
import SkinsGallery from "@/pages/skins-gallery";

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
            <Route path="/pricing" component={Pricing} />
            <Route path="/analytics" component={Analytics} />
            <Route path="/rewards-board" component={RewardsBoard} />
            <Route path="/skins" component={SkinsGallery} />
            <Route path="/settings" component={Settings} />
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
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
