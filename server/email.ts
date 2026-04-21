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

const fromAddress = process.env.EMAIL_FROM || "HeroKids <no-reply@herokids.app>";

async function sendWithResend(input: EmailInput) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress,
      to: input.to,
      subject: input.subject,
      html: input.html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend email failed: ${response.status} ${body}`);
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
  if (process.env.RESEND_API_KEY) {
    await sendWithResend(input);
    return { provider: "resend" };
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