import jwt from "jsonwebtoken";
import crypto from "crypto";
import { db } from "./db";
import { mobileRefreshTokens, mobilePushTokens, familyMembers } from "@shared/schema";
import { eq, and, isNull, gt } from "drizzle-orm";
import type { FamilyMember } from "@shared/schema";

const envJwtSecret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
if (!envJwtSecret) {
  throw new Error("JWT_SECRET or SESSION_SECRET environment variable must be set for mobile authentication");
}
const JWT_SECRET: string = envJwtSecret;
const ACCESS_TOKEN_EXPIRY = "15m"; // 15 minutes
const REFRESH_TOKEN_EXPIRY_DAYS = 30;

export interface JWTPayload {
  memberId: string;
  familyName: string;
  role: "parent" | "child";
  type: "access" | "refresh";
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function generateAccessToken(member: FamilyMember): string {
  const payload: JWTPayload = {
    memberId: member.id,
    familyName: member.familyName,
    role: member.role,
    type: "access",
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export async function generateTokenPair(member: FamilyMember, deviceId?: string): Promise<TokenPair> {
  const accessToken = generateAccessToken(member);
  const refreshToken = generateRefreshToken();
  const tokenHash = hashToken(refreshToken);
  
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  await db.insert(mobileRefreshTokens).values({
    memberId: member.id,
    tokenHash,
    deviceId,
    expiresAt,
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: 15 * 60, // 15 minutes in seconds
  };
}

export function verifyAccessToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    if (decoded.type !== "access") {
      return null;
    }
    return decoded;
  } catch (error) {
    return null;
  }
}

export async function refreshAccessToken(refreshToken: string, deviceId?: string): Promise<TokenPair | null> {
  const tokenHash = hashToken(refreshToken);
  
  const [storedToken] = await db
    .select()
    .from(mobileRefreshTokens)
    .where(
      and(
        eq(mobileRefreshTokens.tokenHash, tokenHash),
        isNull(mobileRefreshTokens.revokedAt),
        gt(mobileRefreshTokens.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!storedToken) {
    return null;
  }

  const [member] = await db
    .select()
    .from(familyMembers)
    .where(eq(familyMembers.id, storedToken.memberId))
    .limit(1);

  if (!member) {
    return null;
  }

  await db
    .update(mobileRefreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(mobileRefreshTokens.id, storedToken.id));

  return generateTokenPair(member, deviceId);
}

export async function revokeRefreshToken(refreshToken: string): Promise<boolean> {
  const tokenHash = hashToken(refreshToken);
  
  const result = await db
    .update(mobileRefreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(mobileRefreshTokens.tokenHash, tokenHash));

  return true;
}

export async function revokeAllMemberTokens(memberId: string): Promise<void> {
  await db
    .update(mobileRefreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(mobileRefreshTokens.memberId, memberId),
        isNull(mobileRefreshTokens.revokedAt)
      )
    );
}

export async function registerPushToken(
  memberId: string,
  token: string,
  platform: "ios" | "android" | "expo",
  deviceId?: string
): Promise<void> {
  await db
    .insert(mobilePushTokens)
    .values({
      memberId,
      token,
      platform,
      deviceId,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: [mobilePushTokens.memberId, mobilePushTokens.token],
      set: {
        isActive: true,
        lastUsedAt: new Date(),
        deviceId,
      },
    });
}

export async function unregisterPushToken(memberId: string, token: string): Promise<void> {
  await db
    .update(mobilePushTokens)
    .set({ isActive: false })
    .where(
      and(
        eq(mobilePushTokens.memberId, memberId),
        eq(mobilePushTokens.token, token)
      )
    );
}

export async function getMemberPushTokens(memberId: string): Promise<string[]> {
  const tokens = await db
    .select({ token: mobilePushTokens.token })
    .from(mobilePushTokens)
    .where(
      and(
        eq(mobilePushTokens.memberId, memberId),
        eq(mobilePushTokens.isActive, true)
      )
    );

  return tokens.map(t => t.token);
}

export async function getFamilyPushTokens(familyName: string): Promise<{ memberId: string; token: string }[]> {
  const tokens = await db
    .select({
      memberId: mobilePushTokens.memberId,
      token: mobilePushTokens.token,
    })
    .from(mobilePushTokens)
    .innerJoin(familyMembers, eq(mobilePushTokens.memberId, familyMembers.id))
    .where(
      and(
        eq(familyMembers.familyName, familyName),
        eq(mobilePushTokens.isActive, true)
      )
    );

  return tokens;
}
