'use server';

/**
 * Issuing the authorization code.
 *
 * This deliberately re-derives the one thing that matters — is the caller
 * actually holding the site password? — rather than trusting that middleware
 * already checked it. A server action's bound arguments travel to the
 * browser and back, so anything handed to it is request data, never proof.
 */
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { AUTH_COOKIE_NAME, expectedAuthToken } from '@/lib/site-auth';
import { AUTH_CODE_TTL_MS, buildRedirect, generateSecret, hashSecret } from '@/lib/oauth';

export interface AuthorizeParams {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state?: string;
}

export async function issueAuthorizationCode(params: AuthorizeParams, formData: FormData): Promise<void> {
  const { clientId, redirectUri, codeChallenge, state } = params;

  const client = await prisma.oAuthClient.findUnique({ where: { clientId } });
  if (!client || !client.redirectUris.includes(redirectUri)) {
    // Never redirect to an unregistered URI, not even to report an error.
    throw new Error('Unknown client or redirect URI');
  }

  if (formData.get('action') !== 'approve') {
    redirect(buildRedirect(redirectUri, { error: 'access_denied', state }));
  }

  const expected = await expectedAuthToken();
  const cookieStore = await cookies();
  const cookie = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!expected || cookie !== expected) {
    redirect(buildRedirect(redirectUri, { error: 'access_denied', state }));
  }

  const code = generateSecret(24);
  const expiresAt = new Date(Date.now() + AUTH_CODE_TTL_MS);

  await prisma.oAuthAuthCode.create({
    data: {
      codeHash: hashSecret(code),
      clientId: client.id,
      redirectUri,
      codeChallenge,
      codeChallengeMethod: 'S256',
      expiresAt,
    },
  });

  redirect(buildRedirect(redirectUri, { code, state }));
}
