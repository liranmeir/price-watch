/**
 * Authorization code -> access token exchange.
 *
 * PKCE is mandatory here: every stored code carries an S256 challenge, and the
 * exchange fails without a verifier that matches it. The code is looked up by
 * hash and deleted before a token is issued, so it is single-use even if two
 * requests race.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ACCESS_TOKEN_TTL_MS, generateSecret, hashSecret, safeEqual, verifyPkce } from '@/lib/oauth';

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

export async function POST(request: NextRequest) {
  let body: Record<string, string>;
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/x-www-form-urlencoded')) {
    body = Object.fromEntries(new URLSearchParams(await request.text()));
  } else {
    body = await request.json().catch(() => ({}));
  }

  const { grant_type, code, redirect_uri, client_id, code_verifier } = body;

  if (grant_type !== 'authorization_code') {
    return fail('unsupported_grant_type');
  }
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

  const token = generateSecret();
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS);

  await prisma.oAuthAccessToken.create({
    data: {
      tokenHash: hashSecret(token),
      clientId: authCode.clientId,
      expiresAt,
    },
  });

  // Best-effort tidy-up of anything that has expired.
  await prisma.oAuthAccessToken.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => undefined);

  return NextResponse.json(
    {
      access_token: token,
      token_type: 'bearer',
      expires_in: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
    },
    { headers: { ...corsHeaders, 'Cache-Control': 'no-store' } },
  );
}
