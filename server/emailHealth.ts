import { createEmailVerificationUrl, createPasswordResetUrl, getAccountEmailBaseUrl } from "./authLinks";
import { explainEmailProviderError, getTransactionalEmailConfiguration, sendTransactionalEmail } from "./email";

type EmailHealthStatus = "healthy" | "warning" | "unhealthy";

type EmailHealthOptions = {
  testRecipient?: string;
  expectedProductionBaseUrl?: string;
  includeMissingTestRecipientIssue?: boolean;
};

export type EmailHealthResult = {
  status: EmailHealthStatus;
  configured: boolean;
  provider: string | null;
  credentialSource: string | null;
  fromAddress: string;
  baseUrl: string | null;
  linksUseExpectedDomain: boolean;
  productionLinksUseExpectedDomain: boolean;
  expectedProductionBaseUrl: string;
  verificationUrlSample: string | null;
  passwordResetUrlSample: string | null;
  testSend: {
    attempted: boolean;
    succeeded: boolean;
    recipient?: string;
    provider?: string;
    issue?: string;
  };
  issues: string[];
};

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

export async function checkTransactionalEmailHealth(options: EmailHealthOptions = {}): Promise<EmailHealthResult> {
  const expectedProductionBaseUrl = normalizeBaseUrl(options.expectedProductionBaseUrl || "https://herokids.app");
  const configuration = await getTransactionalEmailConfiguration();
  const issues: string[] = [];
  let baseUrl: string | null = null;
  let verificationUrlSample: string | null = null;
  let passwordResetUrlSample: string | null = null;
  let linksUseExpectedDomain = false;
  let productionLinksUseExpectedDomain = false;

  try {
    baseUrl = getAccountEmailBaseUrl();
    verificationUrlSample = createEmailVerificationUrl("health-check-verification-token");
    passwordResetUrlSample = createPasswordResetUrl("health-check-reset-token");
    linksUseExpectedDomain =
      baseUrl === expectedProductionBaseUrl &&
      verificationUrlSample.startsWith(`${expectedProductionBaseUrl}/`) &&
      passwordResetUrlSample.startsWith(`${expectedProductionBaseUrl}/`);
    productionLinksUseExpectedDomain = process.env.NODE_ENV !== "production" || linksUseExpectedDomain;

    if (process.env.NODE_ENV === "production" && !productionLinksUseExpectedDomain) {
      issues.push(`Production email links must use ${expectedProductionBaseUrl}. Current base URL is ${baseUrl}.`);
    }
  } catch (error) {
    issues.push(error instanceof Error ? error.message : "Unable to generate account email links.");
  }

  if (!configuration.configured) {
    issues.push(configuration.issue || "Transactional email is not configured.");
  }

  const result: EmailHealthResult = {
    status: "unhealthy",
    configured: configuration.configured,
    provider: configuration.provider,
    credentialSource: configuration.credentialSource,
    fromAddress: configuration.fromAddress,
    baseUrl,
    linksUseExpectedDomain,
    productionLinksUseExpectedDomain,
    expectedProductionBaseUrl,
    verificationUrlSample,
    passwordResetUrlSample,
    testSend: {
      attempted: false,
      succeeded: false,
    },
    issues,
  };

  if (!options.testRecipient) {
    if (options.includeMissingTestRecipientIssue !== false) {
      result.testSend.issue = "No test recipient was provided. Set EMAIL_HEALTH_TEST_RECIPIENT or pass --send-to to test real delivery.";
      result.issues.push(result.testSend.issue);
    }
    result.status = result.configured && result.productionLinksUseExpectedDomain ? "warning" : "unhealthy";
    return result;
  }

  result.testSend = {
    attempted: true,
    succeeded: false,
    recipient: options.testRecipient,
  };

  if (!configuration.configured || !verificationUrlSample || !passwordResetUrlSample) {
    result.status = "unhealthy";
    return result;
  }

  try {
    const delivery = await sendTransactionalEmail({
      to: options.testRecipient,
      subject: "HeroKids transactional email health check",
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2937">
          <h1>HeroKids email health check</h1>
          <p>This confirms that transactional email can be sent before families sign up.</p>
          <p>Verification link sample: ${verificationUrlSample}</p>
          <p>Password reset link sample: ${passwordResetUrlSample}</p>
        </div>
      `,
    });

    result.testSend.succeeded = true;
    result.testSend.provider = delivery.provider;
  } catch (error) {
    result.testSend.issue = explainEmailProviderError(error);
    result.issues.push(result.testSend.issue);
  }

  result.status = result.configured && result.productionLinksUseExpectedDomain && result.testSend.succeeded ? "healthy" : "unhealthy";
  return result;
}