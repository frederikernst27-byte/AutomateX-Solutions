import { afterEach, describe, expect, it } from "vitest";
import { createGmailOAuthState, gmailMessageBody, parseGmailOAuthState } from "./gmail";
import { decryptIntegrationSecret, encryptIntegrationSecret } from "./gmail-store";

const previousAuthSecret = process.env.AUTH_SECRET;
const previousEncryptionKey = process.env.INTEGRATION_ENCRYPTION_KEY;

afterEach(() => {
  if (previousAuthSecret === undefined) delete process.env.AUTH_SECRET; else process.env.AUTH_SECRET = previousAuthSecret;
  if (previousEncryptionKey === undefined) delete process.env.INTEGRATION_ENCRYPTION_KEY; else process.env.INTEGRATION_ENCRYPTION_KEY = previousEncryptionKey;
});

describe("Gmail integration security", () => {
  it("signs OAuth state and rejects tampering", () => {
    process.env.AUTH_SECRET = "a-test-auth-secret-with-at-least-32-characters";
    const state = createGmailOAuthState({ orgId: "org-1", userId: "user-1" });
    expect(parseGmailOAuthState(state)).toEqual({ orgId: "org-1", userId: "user-1" });
    expect(parseGmailOAuthState(`${state.slice(0, -1)}x`)).toBeNull();
  });

  it("encrypts refresh tokens with authenticated encryption", () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = "an-integration-encryption-key-with-32-chars";
    const encrypted = encryptIntegrationSecret("refresh-token-secret");
    expect(encrypted).not.toContain("refresh-token-secret");
    expect(decryptIntegrationSecret(encrypted)).toBe("refresh-token-secret");
  });

  it("prefers the plain-text body over HTML", () => {
    const encode = (value: string) => Buffer.from(value).toString("base64url");
    const body = gmailMessageBody({ mimeType: "multipart/alternative", parts: [
      { mimeType: "text/html", body: { data: encode("<p>HTML-Inhalt</p>") } },
      { mimeType: "text/plain", body: { data: encode("Klartext-Inhalt") } },
    ] });
    expect(body).toBe("Klartext-Inhalt");
  });
});
