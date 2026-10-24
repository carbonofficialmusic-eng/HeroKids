// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import Dashboard from "@/pages/dashboard";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const fixture = vi.hoisted(() => ({
  member: {
    id: "runtime-parent", displayName: "Test Parent", role: "parent", familyName: "Runtime Test",
    color: "#0088cc", totalPoints: 0, totalEarned: 0, starsFound: 0,
    startSkinOptions: ["t-rex", "art-master", "junior-champion"],
    startCompletedAt: null, firstTaskCreatedAt: null, activeSkinId: null,
  } as Record<string, unknown>,
  user: { id: "runtime-user", firstName: "Test", onboardingCompletedAt: "2026-01-01" },
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: fixture.user, isAuthenticated: true, isLoading: false }) }));
vi.mock("@/hooks/useWebSocket", () => ({ useWebSocket: () => ({}) }));
vi.mock("@/hooks/useMidnightRefresh", () => ({ useMidnightRefresh: () => {} }));
vi.mock("@/hooks/useAppReview", () => ({ useAppReview: () => ({}) }));
vi.mock("@/lib/confetti", () => ({ celebrateTaskCompletion: () => {} }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: string | { defaultValue?: string }) => typeof options === "string" ? options : options?.defaultValue || key,
    i18n: { language: "de", resolvedLanguage: "de" },
  }),
}));
vi.mock("@/components/profile-menu", () => ({ ProfileMenu: () => null }));
vi.mock("@/components/notification-bell", () => ({ NotificationBell: () => null }));
vi.mock("@/components/task-dialog", () => ({
  TaskDialog: ({ open, editingTask }: { open: boolean; editingTask: unknown }) =>
    open ? <div data-testid="test-new-task-dialog" data-editing={!!editingTask} /> : null,
}));
vi.mock("@/components/reward-dialog", () => ({ RewardDialog: () => null }));
vi.mock("@/components/reward-request-dialog", () => ({ RewardRequestDialog: () => null }));
vi.mock("@/components/edit-member-dialog", () => ({ EditMemberDialog: () => null }));
vi.mock("@/components/switch-member-dialog", () => ({ SwitchMemberDialog: () => null }));
vi.mock("@/components/member-pause-dialog", () => ({ MemberPauseDialog: () => null }));
vi.mock("@/components/task-completion-dialog", () => ({ TaskCompletionDialog: () => null }));
vi.mock("@/components/onboarding-tour", () => ({ OnboardingTour: () => null }));
vi.mock("@/components/member-onboarding-modal", () => ({ MemberOnboardingModal: () => null }));
vi.mock("@/components/first-open-paywall", () => ({ FirstOpenPaywall: () => null }));
vi.mock("@/components/leaderboard", () => ({ Leaderboard: () => null }));
vi.mock("@/components/pinboard", () => ({ Pinboard: () => null }));
vi.mock("@/components/upcoming-appointments", () => ({ UpcomingAppointments: () => null }));

afterEach(() => {
  cleanup();
  fixture.member.startCompletedAt = null;
  window.history.replaceState(null, "", "/");
});

it("renders an authenticated parent dashboard while the starter offer is active", () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false, queryFn: () => [] } } });
  client.setQueryData(["/api/family-members/current"], fixture.member);
  client.setQueryData(["/api/family-members/real"], fixture.member);
  client.setQueryData(["/api/family-members"], [fixture.member]);
  client.setQueryData(["/api/families/current"], { familyName: "Runtime Test", subscriptionTier: "family" });
  render(<QueryClientProvider client={client}><Dashboard /></QueryClientProvider>);
  expect(screen.getByTestId("parent-start-screen")).toBeTruthy();
  expect(screen.getByTestId("button-approvals")).toBeTruthy();
  expect(screen.getByTestId("avatar-header-parent").closest("[data-app-header]")).toBeTruthy();
  expect(screen.queryByTestId("img-dashboard-logo")).toBeNull();
});

it("keeps the original large logo and member avatar after the starter offer is complete", () => {
  fixture.member.startCompletedAt = "2026-10-24T10:00:00.000Z";
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false, queryFn: () => [] } } });
  client.setQueryData(["/api/family-members/current"], fixture.member);
  client.setQueryData(["/api/family-members/real"], fixture.member);
  client.setQueryData(["/api/family-members"], [fixture.member]);
  client.setQueryData(["/api/families/current"], { familyName: "Runtime Test", subscriptionTier: "family" });
  render(<QueryClientProvider client={client}><Dashboard /></QueryClientProvider>);
  const logo = screen.getByTestId("img-dashboard-logo");
  expect(logo.closest("[data-app-header]")).toBeNull();
  expect(logo.className).toContain("h-36");
  expect(logo.className).toContain("w-36");
  expect(logo.getAttribute("width")).toBe("144");
  expect(logo.getAttribute("height")).toBe("144");
  expect(logo.getAttribute("src")).toContain("/images/little-champs-logo.webp");
  expect(screen.getByTestId("avatar-header-parent")).toBeTruthy();
  expect(screen.queryByTestId("parent-start-screen")).toBeNull();
});

it("opens a new task directly when arriving from the gallery and consumes the action", () => {
  window.history.replaceState(null, "", "/dashboard?createTask=1");
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false, queryFn: () => [] } } });
  client.setQueryData(["/api/family-members/current"], fixture.member);
  client.setQueryData(["/api/family-members/real"], fixture.member);
  client.setQueryData(["/api/family-members"], [fixture.member]);
  client.setQueryData(["/api/families/current"], { familyName: "Runtime Test", subscriptionTier: "family" });
  render(<QueryClientProvider client={client}><Dashboard /></QueryClientProvider>);
  expect(screen.getByTestId("test-new-task-dialog").getAttribute("data-editing")).toBe("false");
  expect(window.location.pathname).toBe("/dashboard");
  expect(window.location.search).toBe("");
});
