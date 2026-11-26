/**
 * The remote MCP server: price_watch_list_items / get_item / add_item /
 * add_link, served over HTTP to authenticated clients (Claude on the web,
 * mobile, or any MCP client that can do OAuth).
 *
 * Unlike a multi-tenant app, verifyToken doesn't need to resolve "whose
 * data is this" — there's one shared SITE_PASSWORD, and a valid token
 * already proves its holder went through the password-gated consent
 * screen. See app/oauth/authorize/ for that gate, and lib/oauth.ts for the
 * token/PKCE primitives.
 */
import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { prisma } from '@/lib/prisma';
import { registerPriceWatchTools, SERVER_INSTRUCTIONS } from '@/lib/mcp';
import { hashSecret } from '@/lib/oauth';

/** Resolves a bearer token to its client, or undefined if it grants nothing. */
async function verifyToken(_req: Request, bearerToken?: string): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined;

  const record = await prisma.oAuthAccessToken.findUnique({
    where: { tokenHash: hashSecret(bearerToken) },
    include: { client: { select: { clientId: true } } },
  });

  if (!record || record.expiresAt < new Date()) return undefined;

  return {
    token: bearerToken,
    clientId: record.client.clientId,
    scopes: ['read', 'write'],
    expiresAt: Math.floor(record.expiresAt.getTime() / 1000),
  };
}

const handler = createMcpHandler((server) => registerPriceWatchTools(server), { instructions: SERVER_INSTRUCTIONS }, {
  basePath: '/api',
  maxDuration: 60,
  verboseLogs: false,
});

const authorized = withMcpAuth(handler, verifyToken, { required: true, requiredScopes: ['read'] });

export { authorized as GET, authorized as POST, authorized as DELETE };
