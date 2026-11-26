/**
 * Dynamic client registration (RFC 7591).
 *
 * Open registration is what lets an MCP client connect without you pre-issuing
 * credentials, and it is safe only because a registered client can still do
 * nothing on its own: it must send the user through the /login + consent
 * screen, and the resulting token is only as powerful as the shared
 * SITE_PASSWORD it required to get there.
 *
 * No client secret is issued. These are public clients authenticated by PKCE,
 * which is the OAuth 2.1 answer for clients that cannot keep a secret. A
 * secret that is stored but never verified is worse than none.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MAX_REDIRECT_URIS, validateRedirectUri } from '@/lib/oauth';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse('OK', { status: 200, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  let body: { client_name?: unknown; redirect_uris?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'invalid_client_metadata', error_description: 'Body must be JSON' },
      { status: 400, headers: corsHeaders },
    );
  }

  const clientName = typeof body.client_name === 'string' ? body.client_name.trim() : '';
  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris : [];

  if (!clientName || clientName.length > 200) {
    return NextResponse.json(
      { error: 'invalid_client_metadata', error_description: 'client_name is required (max 200 chars)' },
      { status: 400, headers: corsHeaders },
    );
  }

  if (redirectUris.length === 0 || redirectUris.length > MAX_REDIRECT_URIS) {
    return NextResponse.json(
      {
        error: 'invalid_redirect_uri',
        error_description: `redirect_uris must contain 1-${MAX_REDIRECT_URIS} entries`,
      },
      { status: 400, headers: corsHeaders },
    );
  }

  for (const uri of redirectUris) {
    if (typeof uri !== 'string') {
      return NextResponse.json(
        { error: 'invalid_redirect_uri', error_description: 'redirect_uris must be strings' },
        { status: 400, headers: corsHeaders },
      );
    }
    const problem = validateRedirectUri(uri);
    if (problem) {
      return NextResponse.json({ error: 'invalid_redirect_uri', error_description: problem }, { status: 400, headers: corsHeaders });
    }
  }

  try {
    const client = await prisma.oAuthClient.create({
      data: { name: clientName, redirectUris: redirectUris as string[] },
    });

    return NextResponse.json(
      {
        client_id: client.clientId,
        client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
        client_name: client.name,
        redirect_uris: client.redirectUris,
        grant_types: ['authorization_code'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
      },
      { status: 201, headers: corsHeaders },
    );
  } catch (error) {
    console.error('[oauth/register]', error);
    return NextResponse.json({ error: 'server_error' }, { status: 500, headers: corsHeaders });
  }
}
