import https from "https";
import crypto from "crypto";

interface ApnsPayload {
  aps: {
    alert: {
      title: string;
      body: string;
    };
    sound?: string;
    badge?: number;
    "content-available"?: number;
  };
  notificationType?: string;
  memberId?: string;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

function generateApnsJwt(): string {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const privateKey = process.env.APNS_PRIVATE_KEY;

  if (!keyId || !teamId || !privateKey) {
    throw new Error("APNS_KEY_ID, APNS_TEAM_ID, and APNS_PRIVATE_KEY must be set");
  }

  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: keyId })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ iss: teamId, iat: now })).toString("base64url");
  const signingInput = `${header}.${payload}`;

  const sign = crypto.createSign("SHA256");
  sign.update(signingInput);

  const normalizedKey = privateKey.includes("-----BEGIN")
    ? privateKey.replace(/\\n/g, "\n")
    : `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;

  const signature = sign.sign(normalizedKey, "base64url");
  return `${signingInput}.${signature}`;
}

function getJwtToken(): string {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.value;
  }
  const token = generateApnsJwt();
  cachedToken = { value: token, expiresAt: now + 50 * 60 * 1000 };
  return token;
}

export async function sendApnsPush(
  deviceToken: string,
  title: string,
  body: string,
  extra?: { notificationType?: string; memberId?: string }
): Promise<void> {
  const bundleId = process.env.APNS_BUNDLE_ID;
  if (!bundleId) throw new Error("APNS_BUNDLE_ID not set");

  if (!process.env.APNS_KEY_ID || !process.env.APNS_TEAM_ID || !process.env.APNS_PRIVATE_KEY) {
    console.warn("[APNs] Secrets not configured — skipping push");
    return;
  }

  const payload: ApnsPayload = {
    aps: {
      alert: { title, body },
      sound: "default",
    },
    ...extra,
  };

  const bodyStr = JSON.stringify(payload);
  const jwt = getJwtToken();

  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {
      hostname: "api.push.apple.com",
      port: 443,
      path: `/3/device/${deviceToken}`,
      method: "POST",
      headers: {
        authorization: `bearer ${jwt}`,
        "apns-topic": bundleId,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "content-type": "application/json",
        "content-length": Buffer.byteLength(bodyStr),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          console.error(`[APNs] Push failed ${res.statusCode}:`, data);
          resolve();
        }
      });
    });

    req.on("error", (err) => {
      console.error("[APNs] Request error:", err.message);
      resolve();
    });

    req.write(bodyStr);
    req.end();
  });
}

export async function sendPushToMembers(
  deviceTokens: string[],
  title: string,
  body: string,
  extra?: { notificationType?: string; memberId?: string }
): Promise<void> {
  if (!deviceTokens.length) return;
  await Promise.allSettled(
    deviceTokens.map((token) => sendApnsPush(token, title, body, extra))
  );
}
