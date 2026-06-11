import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { usePushNotifications } from "@/hooks/usePushNotifications";
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
import Impressum from "@/pages/impressum";
import Terms from "@/pages/terms";
import IosTest from "@/pages/ios-test";
import AccountPage from "@/pages/account";

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
      {/* Background container - extends 60px above layout viewport so it always
          covers the native status-bar zone even when iOS sets the WKWebView
          layout viewport origin to y=safe-area-inset-top instead of y=0. */}
      <div className="fixed inset-x-0 bottom-0 pointer-events-none" style={{ zIndex: 0, top: '-60px' }}>
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

        {/* Dark vignette at the very top — ensures the status-bar area (behind
            the clock / wifi / battery icons) is always dark enough for iOS to
            keep its own .lightContent (white) icons without adding a solid
            black overlay of its own. The gradient fades out after the safe-area
            zone so it is invisible below the header. */}
        <div
          className="absolute inset-x-0 top-0 pointer-events-none"
          style={{
            height: 'calc(var(--sat, env(safe-area-inset-top)) + 4rem)',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.70) 0%, rgba(0,0,0,0.40) 60%, rgba(0,0,0,0) 100%)',
          }}
        />
      </div>
      
      {/* isolation:isolate creates a stacking context so this layer paints
          above the z-index:0 background, without assigning an explicit z-index
          that could confuse WKWebView's fixed/sticky descendant layout. */}
      <div style={{ isolation: 'isolate' }}>
        {children}
      </div>
    </div>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  usePushNotifications(isAuthenticated);
  // Use location-based key to force complete remount when navigating between dashboards
  const [location] = useLocation();
  const dashboardKey = `dashboard-${location}`;

  // Scroll #root (our scroll container) back to top on every navigation
  useEffect(() => {
    document.getElementById('root')?.scrollTo({ top: 0, behavior: 'instant' });
  }, [location]);

  // Cache env(safe-area-inset-top) as --sat CSS variable on :root.
  // Only set when value > 0 — if WKWebView hasn't resolved the inset yet it
  // returns 0, and a stored 0px would shadow the env() fallback permanently.
  useEffect(() => {
    const cacheSafeAreaTop = () => {
      const div = document.createElement('div');
      div.style.cssText = 'position:fixed;top:0;left:0;height:env(safe-area-inset-top,0px);width:0;visibility:hidden;pointer-events:none';
      document.documentElement.appendChild(div);
      const px = parseFloat(getComputedStyle(div).height) || 0;
      document.documentElement.removeChild(div);
      // Guard: plausible safe-area range only (0 < px < 100).
      // Transient WKWebView spikes (e.g. UIScrollView offset leaking in) are
      // rejected so a stale large value can never corrupt --sat.
      if (px > 0 && px < 100) {
        document.documentElement.style.setProperty('--sat', `${px}px`);
      }
    };
    cacheSafeAreaTop();
    // Retry shortly after — WKWebView may not know the inset on first paint
    const t1 = setTimeout(cacheSafeAreaTop, 100);
    const t2 = setTimeout(cacheSafeAreaTop, 500);
    window.addEventListener('orientationchange', cacheSafeAreaTop);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('orientationchange', cacheSafeAreaTop);
    };
  }, []);

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
    let resumeTimer3: ReturnType<typeof setTimeout> | null = null;
    let resumeTimer4: ReturnType<typeof setTimeout> | null = null;
    const refreshSat = () => {
      const div = document.createElement('div');
      div.style.cssText = 'position:fixed;top:0;left:0;height:env(safe-area-inset-top,0px);width:0;visibility:hidden;pointer-events:none';
      document.documentElement.appendChild(div);
      const px = parseFloat(getComputedStyle(div).height) || 0;
      document.documentElement.removeChild(div);
      if (px > 0) document.documentElement.style.setProperty('--sat', `${px}px`);
    };
    const doResumeKick = () => {
      const root = document.getElementById('root');
      const savedTop = root ? root.scrollTop : 0;

      // 0. Re-read safe-area-inset-top after resume/orientation and freeze as --sat.
      refreshSat();

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

      // 5. Force sticky/fixed headers to repaint by briefly toggling a style.
      //    After the camera dismisses, WKWebView may not re-composite the header
      //    layer until a visual change is detected.
      const header = document.querySelector('header');
      if (header) {
        const h = header as HTMLElement;
        h.style.opacity = '0.9999';
        requestAnimationFrame(() => { h.style.opacity = ''; });
      }
    };
    const onVisible = () => {
      doResumeKick();
      // Second kick at 150 ms
      if (resumeTimer1) clearTimeout(resumeTimer1);
      resumeTimer1 = setTimeout(() => { doResumeKick(); resumeTimer1 = null; }, 150);
      // Third kick at 400 ms
      if (resumeTimer2) clearTimeout(resumeTimer2);
      resumeTimer2 = setTimeout(() => { doResumeKick(); resumeTimer2 = null; }, 400);
      // Fourth kick at 700 ms — camera dismiss animation can take this long
      if (resumeTimer3) clearTimeout(resumeTimer3);
      resumeTimer3 = setTimeout(() => { doResumeKick(); resumeTimer3 = null; }, 700);
      // Fifth kick at 1200 ms — final catch for slow WKWebView compositor updates
      if (resumeTimer4) clearTimeout(resumeTimer4);
      resumeTimer4 = setTimeout(() => { doResumeKick(); resumeTimer4 = null; }, 1200);
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
      if (resumeTimer3) clearTimeout(resumeTimer3);
      if (resumeTimer4) clearTimeout(resumeTimer4);
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
          <Route path="/impressum" component={Impressum} />
          <Route path="/terms" component={Terms} />
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
        <Route path="/account" component={AccountPage} />
        <Route path="/family-goals" component={FamilyGoals} />
        <Route path="/link-device" component={LinkDevice} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/impressum" component={Impressum} />
        <Route path="/terms" component={Terms} />
        <Route path="/admin" component={Admin} />
        <Route path="/ios-test">
          <IosTest variant="a" />
        </Route>
        <Route path="/ios-test/:variant">
          {(params) => <IosTest variant={params.variant} />}
        </Route>
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
