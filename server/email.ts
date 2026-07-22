import { Resend } from "resend";

export class EmailProviderNotConfiguredError extends Error {
  constructor() {
    super("No transactional email provider is configured. Connect SendGrid or Resend and set an approved sender address.");
    this.name = "EmailProviderNotConfiguredError";
  }
}

type EmailInput = {
  to: string;
  subject: string;
  html: string;
};

const fromAddress = process.env.EMAIL_FROM || "Little Champs <no-reply@littlechamps.net>";

export type TransactionalEmailConfiguration = {
  configured: boolean;
  provider: "resend" | "sendgrid" | null;
  credentialSource: "replit_connection" | "environment_secret" | null;
  fromAddress: string;
  issue?: string;
};

async function getResendConnectorCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? `repl ${process.env.REPL_IDENTITY}`
    : process.env.WEB_REPL_RENEWAL
      ? `depl ${process.env.WEB_REPL_RENEWAL}`
      : null;

  if (!hostname || !xReplitToken) {
    return null;
  }

  const response = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=resend`,
    {
      headers: {
        Accept: "application/json",
        "X-Replit-Token": xReplitToken,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Resend connector lookup failed: ${response.status}`);
  }

  const data = await response.json();
  const settings = data.items?.[0]?.settings;

  if (!settings?.api_key) {
    return null;
  }

  return {
    apiKey: settings.api_key as string,
    fromEmail: settings.from_email as string | undefined,
  };
}

async function getResendCredentials() {
  if (process.env.RESEND_API_KEY) {
    return {
      apiKey: process.env.RESEND_API_KEY,
      fromEmail: fromAddress,
    };
  }

  return getResendConnectorCredentials();
}

export async function isTransactionalEmailConfigured() {
  const configuration = await getTransactionalEmailConfiguration();
  return configuration.configured;
}

export function explainEmailProviderError(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const sanitized = rawMessage
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, "Bearer [redacted]")
    .replace(/api[_-]?key["']?\s*[:=]\s*["']?[^"',\s]+/gi, "api_key=[redacted]")
    .slice(0, 500);

  if (/domain is not verified|domain.*not verified|verify your domain/i.test(sanitized)) {
    return "The email provider rejected the sender domain. Verify littlechamps.net and its required DNS records in the email provider dashboard before launch.";
  }

  if (/401|403|unauthorized|forbidden|invalid api key|permission/i.test(sanitized)) {
    return "The email provider credentials were rejected or do not have permission to complete this check. Reconnect the provider or update the email API key.";
  }

  if (/sender|from address|from_email|from email/i.test(sanitized)) {
    return "The sender address is not accepted by the email provider. Confirm EMAIL_FROM matches an approved sender for the verified domain.";
  }

  if (/rate limit|too many requests/i.test(sanitized)) {
    return "The email provider rate-limited the check. Try again later or review provider limits.";
  }

  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|fetch failed|network/i.test(sanitized)) {
    return "The email provider could not be reached. Check network/provider availability and try again.";
  }

  return `The email provider rejected the check: ${sanitized}`;
}

export async function getTransactionalEmailConfiguration(): Promise<TransactionalEmailConfiguration> {
  if (process.env.RESEND_API_KEY) {
    return {
      configured: true,
      provider: "resend",
      credentialSource: "environment_secret",
      fromAddress,
    };
  }

  if (process.env.REPLIT_CONNECTORS_HOSTNAME) {
    try {
      const credentials = await getResendConnectorCredentials();
      if (credentials?.apiKey) {
        return {
          configured: true,
          provider: "resend",
          credentialSource: "replit_connection",
          fromAddress: fromAddress,
        };
      }
    } catch (error) {
      return {
        configured: false,
        provider: "resend",
        credentialSource: "replit_connection",
        fromAddress,
        issue: explainEmailProviderError(error),
      };
    }
  }

  if (process.env.SENDGRID_API_KEY) {
    return {
      configured: true,
      provider: "sendgrid",
      credentialSource: "environment_secret",
      fromAddress,
    };
  }

  return {
    configured: false,
    provider: null,
    credentialSource: null,
    fromAddress,
    issue: "No transactional email provider is configured. Connect Resend or SendGrid and use an approved sender address.",
  };
}

async function sendWithResend(input: EmailInput) {
  const credentials = await getResendCredentials();
  if (!credentials?.apiKey) {
    throw new EmailProviderNotConfiguredError();
  }

  const resend = new Resend(credentials.apiKey);
  const result = await resend.emails.send({
    from: fromAddress,
    to: input.to,
    subject: input.subject,
    html: input.html,
  });

  if (result.error) {
    throw new Error(`Resend email failed: ${result.error.message}`);
  }
}

async function sendWithSendGrid(input: EmailInput) {
  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: input.to }] }],
      from: parseFromAddress(fromAddress),
      subject: input.subject,
      content: [{ type: "text/html", value: input.html }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`SendGrid email failed: ${response.status} ${body}`);
  }
}

function parseFromAddress(value: string) {
  const match = value.match(/^(.*)<(.+)>$/);
  if (!match) {
    return { email: value };
  }
  return { name: match[1].trim(), email: match[2].trim() };
}

export async function sendTransactionalEmail(input: EmailInput) {
  if (process.env.RESEND_API_KEY || process.env.REPLIT_CONNECTORS_HOSTNAME) {
    try {
      await sendWithResend(input);
      return { provider: "resend" };
    } catch (error) {
      if (!(error instanceof EmailProviderNotConfiguredError)) {
        throw error;
      }
    }
  }

  if (process.env.SENDGRID_API_KEY) {
    await sendWithSendGrid(input);
    return { provider: "sendgrid" };
  }

  throw new EmailProviderNotConfiguredError();
}

export async function sendVerificationEmail(email: string, firstName: string | null | undefined, verificationUrl: string) {
  return sendTransactionalEmail({
    to: email,
    subject: "HeroKids E-Mail bestätigen",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2937">
        <h1>Willkommen bei HeroKids${firstName ? `, ${firstName}` : ""}</h1>
        <p>Bitte bestätige deine E-Mail-Adresse, damit dein HeroKids-Konto vollständig eingerichtet ist.</p>
        <p><a href="${verificationUrl}" style="display:inline-block;background:#7c3aed;color:white;padding:12px 18px;border-radius:8px;text-decoration:none">E-Mail bestätigen</a></p>
        <p>Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:</p>
        <p>${verificationUrl}</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(email: string, firstName: string | null | undefined, resetUrl: string) {
  return sendTransactionalEmail({
    to: email,
    subject: "HeroKids Passwort zurücksetzen",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2937">
        <h1>Passwort zurücksetzen${firstName ? `, ${firstName}` : ""}</h1>
        <p>Über diesen Link kannst du ein neues Passwort für dein HeroKids-Konto setzen. Der Link ist zeitlich begrenzt.</p>
        <p><a href="${resetUrl}" style="display:inline-block;background:#7c3aed;color:white;padding:12px 18px;border-radius:8px;text-decoration:none">Neues Passwort setzen</a></p>
        <p>Falls du das nicht angefordert hast, kannst du diese E-Mail ignorieren.</p>
        <p>${resetUrl}</p>
      </div>
    `,
  });
}