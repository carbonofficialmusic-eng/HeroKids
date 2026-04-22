// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import express from "express";
import type { Server } from "node:http";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import AdminPage from "../pages/admin";
import { queryClient } from "../lib/queryClient";
import { registerAdminEmailHealthRoutes } from "../../../server/adminEmailHealthRoutes";
import { checkTransactionalEmailHealth } from "../../../server/emailHealth";
import {
  jsonResponse,
  healthyEmailStatus,
  makeDefaultAdminFamilyDetails,
  makeAdminFetchMock,
  type AdminFamilyDetails,
} from "./adminTestHelpers";

vi.mock("recharts", async () => {
  const { rechartsModuleMock: mock } = await import("./adminTestHelpers");
  return mock;
});

vi.mock("../../../server/emailHealth", () => ({
  checkTransactionalEmailHealth: vi.fn(),
}));

const mockCheckTransactionalEmailHealth = vi.mocked(checkTransactionalEmailHealth);

type TestEmailHealthStatus = typeof healthyEmailStatus & {
  status: "healthy" | "warning" | "unhealthy";
  configured: boolean;
  provider: string | null;
  credentialSource: string | null;
  baseUrl: string | null;
  linksUseExpectedDomain: boolean;
  issues: string[];
};

async function startAdminEmailHealthServer() {
  const app = express();
  app.use(express.json());
  const isAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.headers.authorization !== "Bearer admin-secret") {
      return res.status(401).json({ message: "Admin authentication required" });
    }
    next();
  };

  registerAdminEmailHealthRoutes(app, isAdmin);

  const server = await new Promise<Server>((resolve) => {
    const listeningServer = app.listen(0, () => resolve(listeningServer));
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to start admin email health test server");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

describe("admin email health routes", () => {
  let server: Awaited<ReturnType<typeof startAdminEmailHealthServer>> | null = null;

  beforeEach(() => {
    mockCheckTransactionalEmailHealth.mockReset();
  });

  afterEach(async () => {
    if (server) {
      await server.close();
      server = null;
    }
  });

  it("requires admin authorization for the email health status endpoint", async () => {
    server = await startAdminEmailHealthServer();

    const response = await fetch(`${server.baseUrl}/api/admin/email-health`);

    expect(response.status).toBe(401);
    expect(mockCheckTransactionalEmailHealth).not.toHaveBeenCalled();
  });

  it("returns protected email health status without forcing a test recipient issue", async () => {
    mockCheckTransactionalEmailHealth.mockResolvedValue(healthyEmailStatus);
    server = await startAdminEmailHealthServer();

    const response = await fetch(`${server.baseUrl}/api/admin/email-health`, {
      headers: { Authorization: "Bearer admin-secret" },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "healthy",
      provider: "resend",
      fromAddress: "noreply@herokids.app",
    });
    expect(mockCheckTransactionalEmailHealth).toHaveBeenCalledWith({
      includeMissingTestRecipientIssue: false,
    });
  });

  it("rejects invalid test-send recipients before calling the email provider", async () => {
    server = await startAdminEmailHealthServer();

    const response = await fetch(`${server.baseUrl}/api/admin/email-health/test`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer admin-secret",
      },
      body: JSON.stringify({ recipient: "not-an-email" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      message: "Enter a valid recipient email address",
    });
    expect(mockCheckTransactionalEmailHealth).not.toHaveBeenCalled();
  });
});

describe("admin email health UI", () => {
  let currentEmailStatus: TestEmailHealthStatus;
  let adminFamilyDetails: AdminFamilyDetails;

  const setupFetchMock = () => {
    vi.stubGlobal(
      "fetch",
      makeAdminFetchMock(
        () => adminFamilyDetails,
        (d) => { adminFamilyDetails = d; },
        {
          "GET /api/admin/email-health": () => jsonResponse(currentEmailStatus),
          "POST /api/admin/email-health/test": (init) => {
            const body = JSON.parse(String(init?.body));
            currentEmailStatus = {
              ...healthyEmailStatus,
              testSend: {
                attempted: true,
                succeeded: true,
                recipient: body.recipient,
                provider: "resend",
              },
            };
            return jsonResponse(currentEmailStatus);
          },
        },
      ),
    );
  };

  beforeEach(() => {
    queryClient.clear();
    localStorage.setItem("admin_token", "admin-secret");
    localStorage.setItem("admin_actor", "Test Admin");
    currentEmailStatus = healthyEmailStatus;
    adminFamilyDetails = makeDefaultAdminFamilyDetails();
    setupFetchMock();
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  const renderAdmin = () =>
    render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(AdminPage),
      ),
    );

  it("shows provider and launch domain status to admins", async () => {
    renderAdmin();

    expect((await screen.findByTestId("badge-email-health-status")).textContent).toContain("Ready");
    expect(screen.getByTestId("text-email-provider").textContent).toContain("resend");
    expect(screen.getByTestId("text-email-sender").textContent).toContain("noreply@herokids.app");
    expect(screen.getByTestId("text-email-link-domain").textContent).toContain("Matches launch domain");
  });

  it("lets admins submit a test recipient from the email tab", async () => {
    const user = userEvent.setup();
    renderAdmin();

    await user.click(await screen.findByTestId("tab-email"));
    expect((await screen.findByTestId("text-email-detail-provider")).textContent).toContain("resend");
    expect(screen.getByTestId("text-email-current-domain").textContent).toContain("https://herokids.app");

    await user.type(screen.getByTestId("input-email-test-recipient"), "owner@example.com");
    await user.click(screen.getByTestId("button-send-email-health-test"));

    await waitFor(() => {
      expect(screen.getByTestId("text-email-test-result").textContent).toContain("Test to owner@example.com: succeeded");
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/admin/email-health/test",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ recipient: "owner@example.com" }),
      }),
    );
  });

  it("shows a prominent monitoring alert when transactional email becomes unhealthy", async () => {
    currentEmailStatus = {
      ...healthyEmailStatus,
      status: "unhealthy",
      configured: false,
      provider: null,
      credentialSource: null,
      baseUrl: null,
      linksUseExpectedDomain: false,
      issues: ["Resend credentials are missing."],
    };

    renderAdmin();

    expect((await screen.findByTestId("alert-email-health-monitoring")).textContent).toContain("Transactional email needs attention");
    expect(screen.getByTestId("text-email-health-alert-status").textContent).toContain("Status: Not ready");
    expect(screen.getByTestId("text-email-health-alert-issue").textContent).toContain("Resend credentials are missing.");
    expect(screen.getByTestId("button-refresh-email-health-alert")).toBeTruthy();
  });

});
