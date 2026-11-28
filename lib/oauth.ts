/**
 * OAuth 2.1 primitives for the remote MCP server.
 *
 * Deliberate choices, all of them load-bearing:
 * - codes and tokens are stored as SHA-256 hashes, so the database never holds
 *   a usable credential;
 * - PKCE is required and only S256 is accepted — `plain` is not a fallback, it
 *   is a downgrade;
 * - redirect URIs must be https, or loopback for native clients. Anything else
 *   (`javascript:`, `data:`, plain http on a public host) is refused at
 *   registration rather than at redirect time.
 */
import { createHash, randomBytes, timingSafeEqual } from 'crypto';

export const AUTH_CODE_TTL_MS = 10 * 60 * 1000;
export const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;
/** Long-lived since there's no silent re-auth otherwise - just the login/consent screen again. */
export const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;
export const MAX_REDIRECT_URIS = 10;

/** Codes and tokens are opaque; only their hash is persisted. */
export function hashSecret(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function generateSecret(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Constant-time comparison that tolerates differing lengths. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * S256 only. A `plain` challenge is indistinguishable from no protection once
 * an attacker can read the authorization request, so it is rejected outright.
 */
export function verifyPkce(codeVerifier: string, codeChallenge: string, method: string): boolean {
  if (method !== 'S256') return false;
  if (codeVerifier.length < 43 || codeVerifier.length > 128) return false;
  const computed = createHash('sha256').update(codeVerifier).digest('base64url');
  return safeEqual(computed, codeChallenge);
}

/**
 * Returns null when acceptable, or a human-readable reason to reject.
 * Loopback http is allowed because native clients cannot serve https locally.
 */
export function validateRedirectUri(uri: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return `'${uri}' is not an absolute URI`;
  }
  if (parsed.hash) return 'redirect_uri must not contain a fragment';

  const isLoopback =
    parsed.hostname === 'localhost' ||
    parsed.hostname === '127.0.0.1' ||
    parsed.hostname === '[::1]' ||
    parsed.hostname === '::1';

  if (parsed.protocol === 'https:') return null;
  if (parsed.protocol === 'http:' && isLoopback) return null;
  return `'${uri}' must use https, or http on localhost`;
}

/**
 * Builds the redirect back to the client. Using URL/searchParams rather than
 * string concatenation keeps a crafted `state` from injecting its own
 * parameters, and works whether or not the registered URI already has a query.
 */
export function buildRedirect(redirectUri: string, params: Record<string, string | undefined>): string {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  return url.toString();
}
