/** RFC 8414 authorization server metadata. S256 only, no client secrets. */
import { NextResponse } from 'next/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse('OK', { status: 200, headers: corsHeaders });
}

export async function GET() {
  const base = process.env.APP_URL;
  if (!base) {
    return NextResponse.json(
      { error: 'server_error', error_description: 'APP_URL is not configured' },
      { status: 500, headers: corsHeaders },
    );
  }

  return NextResponse.json(
    {
      issuer: base,
      authorization_endpoint: `${base}/oauth/authorize`,
      token_endpoint: `${base}/api/oauth/token`,
      registration_endpoint: `${base}/api/oauth/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      scopes_supported: ['read', 'write'],
    },
    { headers: corsHeaders },
  );
}
