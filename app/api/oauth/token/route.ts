/**
 * Authorization code -> access token exchange, and refresh_token -> new
 * access token.
 *
 * PKCE is mandatory for the authorization_code grant: every stored code
 * carries an S256 challenge, and the exchange fails without a verifier that
 * matches it. The code is looked up by hash and deleted before a token is
 * issued, so it is single-use even if two requests race.
 *
 * Every access token is issued together with a refresh token, since this is
 * a public client (PKCE, no secret) with no other way to silently re-auth.
 * Refresh tokens rotate: each refresh deletes the old row and creates a new
 * one with fresh hashes, rather than reusing the same refresh token, so a
 * stolen-then-replayed refresh token is detectable (the legitimate holder's
 * next refresh fails because its hash no longer matches any row).
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  ACCESS_TOKEN_TTL_MS,
  REFRESH_TOKEN_TTL_MS,
  generateSecret,
  hashSecret,
  safeEqual,
  verifyPkce,
} from '@/lib/oauth';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function fail(error: string, description?: string, status = 400) {
  return NextResponse.json({ error, ...(description ? { error_description: description } : {}) }, { status, headers: corsHeaders });
}

export async function OPTIONS() {
  return new NextResponse('OK', { status: 200, headers: corsHeaders });
}

/** Issues a fresh access+refresh token pair for a client, returning the token response body. */
async function issueTokenPair(clientId: string) {
  const token = generateSecret();
  const refreshToken = generateSecret();
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS);
  const refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await prisma.oAuthAccessToken.create({
    data: {
      tokenHash: hashSecret(token),
      clientId,
      expiresAt,
      refreshTokenHash: hashSecret(refreshToken),
      refreshTokenExpiresAt,
    },
  });

  // Best-effort tidy-up: a row is dead once both its access token AND its
  // refresh token (if any) have expired - an expired access token alone must
  // survive, since its refresh token can still be used to replace it.
  await prisma.oAuthAccessToken
    .deleteMany({
      where: {
        expiresAt: { lt: new Date() },
        OR: [{ refreshTokenHash: null }, { refreshTokenExpiresAt: { lt: new Date() } }],
      },
    })
    .catch(() => undefined);

  return {
    access_token: token,
    token_type: 'bearer',
    expires_in: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
    refresh_token: refreshToken,
  };
}

export async function POST(request: NextRequest) {
  let body: Record<string, string>;
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/x-www-form-urlencoded')) {
    body = Object.fromEntries(new URLSearchParams(await request.text()));
  } else {
    body = await request.json().catch(() => ({}));
  }

  const { grant_type } = body;

  if (grant_type === 'refresh_token') {
    const { refresh_token } = body;
    if (!refresh_token) {
      return fail('invalid_request', 'refresh_token is required');
    }

    const existing = await prisma.oAuthAccessToken.findUnique({
      where: { refreshTokenHash: hashSecret(refresh_token) },
    });

    // Nothing below distinguishes "no such token" from "expired", so a caller
    // cannot probe for valid refresh tokens.
    if (!existing || !existing.refreshTokenExpiresAt || existing.refreshTokenExpiresAt < new Date()) {
      return fail('invalid_grant');
    }

    // Rotate: delete the old row (burns the refresh token even if the new
    // insert below somehow fails) before issuing its replacement.
    await prisma.oAuthAccessToken.delete({ where: { id: existing.id } }).catch(() => undefined);

    const tokens = await issueTokenPair(existing.clientId);
    return NextResponse.json(tokens, { headers: { ...corsHeaders, 'Cache-Control': 'no-store' } });
  }

  if (grant_type !== 'authorization_code') {
    return fail('unsupported_grant_type');
  }

  const { code, redirect_uri, client_id, code_verifier } = body;

  if (!code || !redirect_uri || !client_id) {
    return fail('invalid_request', 'code, redirect_uri and client_id are required');
  }
  if (!code_verifier) {
    return fail('invalid_request', 'code_verifier is required (PKCE)');
  }

  const authCode = await prisma.oAuthAuthCode.findUnique({
    where: { codeHash: hashSecret(code) },
    include: { client: true },
  });

  // Nothing below distinguishes "no such code" from "wrong client" or "expired",
  // so a caller cannot probe for valid codes.
  if (!authCode) return fail('invalid_grant');

  // Burn the code first: a replay, or a second racing request, finds nothing.
  await prisma.oAuthAuthCode.delete({ where: { id: authCode.id } }).catch(() => undefined);

  if (authCode.expiresAt < new Date()) return fail('invalid_grant', 'Authorization code expired');
  if (!safeEqual(authCode.client.clientId, client_id)) return fail('invalid_grant');
  if (!safeEqual(authCode.redirectUri, redirect_uri)) return fail('invalid_grant');

  if (!verifyPkce(code_verifier, authCode.codeChallenge, authCode.codeChallengeMethod)) {
    return fail('invalid_grant', 'PKCE verification failed');
  }

  const tokens = await issueTokenPair(authCode.clientId);
  return NextResponse.json(tokens, { headers: { ...corsHeaders, 'Cache-Control': 'no-store' } });
}
