import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
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
import AutoRedirect from "@/pages/auto-redirect";
import Pricing from "@/pages/pricing";
import Analytics from "@/pages/analytics";
import Chat from "@/pages/chat";
import Approvals from "@/pages/approvals";
import RewardsBoard from "@/pages/rewards-board";
import Settings from "@/pages/settings";
import SkinsGallery from "@/pages/skins-gallery";
import Achievements from "@/pages/achievements";
import FamilyGoals from "@/pages/family-goals";
import MyRewards from "@/pages/my-rewards";
import MyAchievements from "@/pages/my-achievements";
import LinkDevice from "@/pages/link-device";
import Admin from "@/pages/admin";
import Privacy from "@/pages/privacy";

interface FamilyMember {
  id: number;
  activeSkinId: string | null;
  useThemeBackground: boolean;
}

function RedirectToLanding() {
  useEffect(() => {
    // Preserve query parameters when redirecting (for Stripe session_id)
    const currentSearch = window.location.search;
    window.location.href = "/" + currentSearch;
  }, []);
  return null;
}

function BackgroundWrapper({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  
  const { data: member } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/current"],
    enabled: isAuthenticated,
  });

  // Only show background if useThemeBackground is true AND there's an active skin
  const shouldShowBackground = member?.useThemeBackground !== false && !!member?.activeSkinId;
  const backgroundUrl = shouldShowBackground ? getBackgroundUrl(member?.activeSkinId) : undefined;
  
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
    <div className="min-h-full">
      {/* Background container - fixed positioning, below all content via negative z-index */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: -1 }}>
        {previousBg && (
          <img 
            src={previousBg}
            alt=""
            className="absolute inset-0 w-full h-full transition-opacity duration-700 ease-in-out"
            style={{
              objectFit: 'cover',
              objectPosition: 'center center',
              opacity: showNew ? 0 : 1,
            }}
          />
        )}
        
        {currentBg && (
          <img 
            src={currentBg}
            alt=""
            className="absolute inset-0 w-full h-full transition-opacity duration-700 ease-in-out"
            style={{
              objectFit: 'cover',
              objectPosition: 'center center',
              opacity: showNew ? 1 : 0,
            }}
          />
        )}
        
        {/* Fallback background when no skin is active */}
        {!currentBg && !previousBg && (
          <div className="absolute inset-0 bg-background" />
        )}
      </div>
      
      {/* No explicit z-index here — avoids creating a stacking context that can
          cause iOS WKWebView to miscalculate the horizontal position of
          fixed/sticky descendants (the fixed background is z-index:-1 so it
          sits below normal-flow content without needing a counter-index). */}
      <div>
        {children}
      </div>
    </div>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  // Use location-based key to force complete remount when navigating between dashboards
  const [location] = useLocation();
  const dashboardKey = `dashboard-${location}`;

  // Scroll #root (our scroll container) back to top on every navigation
  useEffect(() => {
    document.getElementById('root')?.scrollTo({ top: 0, behavior: 'instant' });
  }, [location]);

  // iOS WKWebView architectural fix:
  // WKWebView's UIScrollView.contentOffset can be silently displaced by any
  // system event (keyboard, photo-picker, app-switch). Crucially, WKWebView
  // sometimes LIES and reports window.scrollY = 0 even when the UIScrollView
  // is visually offset by 50-100 px. The old guard `if (scrollY !== 0)` meant
  // the fix never ran when WKWebView was lying. Fix: call scrollTo(0,0)
  // unconditionally every frame so UIScrollView is always snapped to the top.
  useEffect(() => {
    let rafId: number;
    const snapWindowScroll = () => {
      // Always call scrollTo — WKWebView may report scrollY=0 while the
      // UIScrollView is actually displaced. The save/restore below ensures
      // this never clobbers the user's real scroll position inside #root.
      const root = document.getElementById('root');
      const savedTop = root ? root.scrollTop : 0;
      window.scrollTo(0, 0);
      if (root && root.scrollTop !== savedTop) {
        root.scrollTop = savedTop;
      }
      rafId = requestAnimationFrame(snapWindowScroll);
    };
    rafId = requestAnimationFrame(snapWindowScroll);

    // Extra "kick" when keyboard dismisses: do a 1→0 scroll to force
    // WKWebView to process the UIScrollView reset even if it thinks it's
    // already at 0. Only fires when viewport grows (= keyboard closed).
    const vv = window.visualViewport;
    let prevVVHeight = vv?.height ?? window.innerHeight;
    let kickTimer: ReturnType<typeof setTimeout> | null = null;
    const onViewportResize = () => {
      const h = vv?.height ?? window.innerHeight;
      if (h > prevVVHeight + 50) {
        // Keyboard just closed — debounce until resize settles
        if (kickTimer) clearTimeout(kickTimer);
        kickTimer = setTimeout(() => {
          const root = document.getElementById('root');
          const savedTop = root ? root.scrollTop : 0;
          window.scrollTo(0, 1);
          if (root) root.scrollTop = savedTop;
          requestAnimationFrame(() => {
            window.scrollTo(0, 0);
            if (root) root.scrollTop = savedTop;
          });
        }, 100);
      }
      prevVVHeight = h;
    };
    vv?.addEventListener('resize', onViewportResize);

    // Snap on visibility-restore (app-switch / wake / close+reopen).
    // WKWebView can lie about BOTH scrollX and scrollY after resume — it reports
    // 0 while the UIScrollView contentOffset is actually non-zero, so a plain
    // scrollTo(0,0) is silently ignored. The 1→0 "kick" forces WKWebView to
    // process the reset even when it thinks it is already at the origin.
    // We kick both axes (X first, then Y) and repeat after 150 ms because
    // WKWebView's rendering pipeline may not have settled by the first kick.
    let resumeTimer1: ReturnType<typeof setTimeout> | null = null;
    let resumeTimer2: ReturnType<typeof setTimeout> | null = null;
    const doResumeKick = () => {
      const root = document.getElementById('root');
      const savedTop = root ? root.scrollTop : 0;

      // 1. Horizontal kick — WKWebView may report scrollX=0 while the
      //    UIScrollView contentOffset.x is non-zero; the 1→0 forces a real reset.
      window.scrollTo(1, 0);
      window.scrollTo(0, 0);

      // 2. Restore the user's vertical scroll position inside #root.
      if (root && root.scrollTop !== savedTop) root.scrollTop = savedTop;

      // 3. Dispatch a synthetic resize event so every hook/component that reads
      //    window.innerWidth / window.innerHeight (mobile detection, sticky
      //    panels, etc.) recalculates with the current, post-resume values.
      //    This also triggers safe-area env() recalculation in WKWebView.
      window.dispatchEvent(new Event('resize'));

      // 4. Force a synchronous reflow so WKWebView flushes stale cached
      //    viewport dimensions and re-evaluates position:fixed coordinates.
      void document.documentElement.getBoundingClientRect();
    };
    const onVisible = () => {
      doResumeKick();
      // Second kick at 150 ms — WKWebView's rendering pipeline may not have
      // finished settling when the first kick fires.
      if (resumeTimer1) clearTimeout(resumeTimer1);
      resumeTimer1 = setTimeout(() => {
        doResumeKick();
        resumeTimer1 = null;
      }, 150);
      // Third kick at 350 ms — catches late safe-area / UIScrollView updates
      // that only complete after the full transition animation finishes.
      if (resumeTimer2) clearTimeout(resumeTimer2);
      resumeTimer2 = setTimeout(() => {
        doResumeKick();
        resumeTimer2 = null;
      }, 350);
    };
    // visibilitychange fires on every background→foreground transition
    document.addEventListener('visibilitychange', onVisible);
    // focus fires as a backup (e.g. split-screen switches)
    window.addEventListener('focus', onVisible);
    // pageshow fires when iOS restores from bfcache after close+reopen
    window.addEventListener('pageshow', onVisible);
    // Capacitor native resume event — most reliable signal in a WKWebView shell
    document.addEventListener('resume', onVisible);

    return () => {
      cancelAnimationFrame(rafId);
      vv?.removeEventListener('resize', onViewportResize);
      if (kickTimer) clearTimeout(kickTimer);
      if (resumeTimer1) clearTimeout(resumeTimer1);
      if (resumeTimer2) clearTimeout(resumeTimer2);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('pageshow', onVisible);
      document.removeEventListener('resume', onVisible);
    };
  }, []);


  // Show nothing while loading to prevent 404 flash
  if (isLoading) {
    return (
      <BackgroundWrapper>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          </div>
        </div>
      </BackgroundWrapper>
    );
  }

  if (!isAuthenticated) {
    return (
      <BackgroundWrapper>
        <Switch>
          <Route path="/" component={Landing} />
          <Route path="/setup">
            <RedirectToLanding />
          </Route>
          <Route path="/link-device" component={LinkDevice} />
          <Route path="/kid-dashboard" component={KidDashboard} />
          <Route path="/pricing" component={Pricing} />
          <Route path="/privacy" component={Privacy} />
          <Route path="/admin" component={Admin} />
          <Route path="/dashboard">
            <RedirectToLanding />
          </Route>
          <Route component={NotFound} />
        </Switch>
      </BackgroundWrapper>
    );
  }

  return (
    <BackgroundWrapper>
      <Switch>
        <Route path="/" component={AutoRedirect} />
        <Route path="/setup" component={AutoRedirect} />
        <Route path="/dashboard">
          <Dashboard key={dashboardKey} />
        </Route>
        <Route path="/kid-dashboard">
          <KidDashboard key={dashboardKey} />
        </Route>
        <Route path="/kid-dashboard-old" component={KidDashboardOld} />
        <Route path="/my-rewards" component={MyRewards} />
        <Route path="/my-achievements" component={MyAchievements} />
        <Route path="/tasks">
          <Dashboard key={dashboardKey} />
        </Route>
        <Route path="/rewards">
          <Dashboard key={dashboardKey} />
        </Route>
        <Route path="/leaderboard">
          <Dashboard key={dashboardKey} />
        </Route>
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
        <Route path="/link-device" component={LinkDevice} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/admin" component={Admin} />
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
