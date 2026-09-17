import crypto from "crypto";
import { describe, expect, it } from "vitest";
import {
  cancelQueuedChatPush,
  createApnsProviderToken,
  isChildPushQuietHours,
  queueChatPush,
} from "../apns";

function makeKey() {
  return crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
}

function verifyToken(token: string, publicKey: crypto.KeyObject) {
  const [header, payload, signature] = token.split(".");
  expect(Buffer.from(signature, "base64url")).toHaveLength(64);
  expect(
    crypto.verify(
      "sha256",
      Buffer.from(`${header}.${payload}`),
      { key: publicKey, dsaEncoding: "ieee-p1363" },
      Buffer.from(signature, "base64url")
    )
  ).toBe(true);
  expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({
    alg: "ES256",
    kid: "KEY123",
  });
  expect(JSON.parse(Buffer.from(payload, "base64url").toString())).toEqual({
    iss: "TEAM123",
    iat: 1_700_000_000,
  });
}

describe("APNs provider token", () => {
  it("normalizes a quoted PEM with escaped newlines and creates a valid ES256 JWT", () => {
    const { privateKey, publicKey } = makeKey();
    const pem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
    const escapedPem = `"${pem.trim().replace(/\n/g, "\\n")}"`;

    verifyToken(
      createApnsProviderToken("KEY123", "TEAM123", escapedPem, 1_700_000_000),
      publicKey
    );
  });

  it("normalizes a PEM stored entirely on one line", () => {
    const { privateKey, publicKey } = makeKey();
    const oneLinePem = privateKey
      .export({ format: "pem", type: "pkcs8" })
      .toString()
      .replace(/\n/g, "");

    verifyToken(
      createApnsProviderToken("KEY123", "TEAM123", oneLinePem, 1_700_000_000),
      publicKey
    );
  });

  it("accepts a base64-encoded PKCS#8 key", () => {
    const { privateKey, publicKey } = makeKey();
    const derBase64 = privateKey
      .export({ format: "der", type: "pkcs8" })
      .toString("base64");

    verifyToken(
      createApnsProviderToken("KEY123", "TEAM123", derBase64, 1_700_000_000),
      publicKey
    );
  });
});

describe("APNs child quiet hours", () => {
  it("suppresses child pushes from 20:00 through 06:59 in the family timezone", () => {
    expect(isChildPushQuietHours(new Date("2026-09-17T18:00:00Z"), "Europe/Berlin")).toBe(true);
    expect(isChildPushQuietHours(new Date("2026-09-18T04:59:00Z"), "Europe/Berlin")).toBe(true);
    expect(isChildPushQuietHours(new Date("2026-09-18T05:00:00Z"), "Europe/Berlin")).toBe(false);
    expect(isChildPushQuietHours(new Date("2026-09-17T17:59:00Z"), "Europe/Berlin")).toBe(false);
  });

  it("supports a parent-defined quiet period", () => {
    expect(isChildPushQuietHours(new Date("2026-09-17T17:30:00Z"), "Europe/Berlin", "19:00", "06:30")).toBe(true);
    expect(isChildPushQuietHours(new Date("2026-09-18T04:29:00Z"), "Europe/Berlin", "19:00", "06:30")).toBe(true);
    expect(isChildPushQuietHours(new Date("2026-09-18T04:30:00Z"), "Europe/Berlin", "19:00", "06:30")).toBe(false);
  });

  it("supports a same-day quiet period", () => {
    expect(isChildPushQuietHours(new Date("2026-09-17T11:00:00Z"), "Europe/Berlin", "12:00", "15:00")).toBe(true);
    expect(isChildPushQuietHours(new Date("2026-09-17T14:00:00Z"), "Europe/Berlin", "12:00", "15:00")).toBe(false);
  });
});

describe("APNs chat batching", () => {
  it("cancels a pending chat push after the recipient reads the chat", () => {
    queueChatPush("member-reading-chat", ["device-token"], "Family Chat");
    expect(cancelQueuedChatPush("member-reading-chat")).toBe(true);
    expect(cancelQueuedChatPush("member-reading-chat")).toBe(false);
  });
});