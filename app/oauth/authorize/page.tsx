/**
 * The consent screen.
 *
 * Getting here at all already required the shared site password — middleware.ts
 * gates /oauth/authorize exactly like /dashboard/*. This page only needs to
 * validate the *request* (client_id, redirect_uri, PKCE), not re-derive who's
 * asking; the server action below re-checks the password cookie independently
 * before issuing a code, since bound server-action arguments travel to the
 * browser and back and should never be trusted as proof of anything.
 *
 * PKCE is required. A request without an S256 challenge is rejected rather than
 * downgraded, because a code issued without one can be exchanged by anyone who
 * intercepts it.
 */
import { prisma } from '@/lib/prisma';
import { issueAuthorizationCode } from './actions';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function ErrorCard({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4" dir="ltr">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="mb-2 text-xl font-bold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-600">{detail}</p>
      </div>
    </div>
  );
}

export default async function AuthorizePage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const get = (key: string): string | undefined => {
    const value = raw[key];
    return typeof value === 'string' ? value : undefined;
  };

  const clientId = get('client_id');
  const redirectUri = get('redirect_uri');
  const responseType = get('response_type');
  const state = get('state');
  const codeChallenge = get('code_challenge');
  const codeChallengeMethod = get('code_challenge_method') ?? 'S256';

  if (responseType !== 'code' || !clientId || !redirectUri) {
    return (
      <ErrorCard
        title="Invalid authorization request"
        detail="response_type=code, client_id and redirect_uri are all required."
      />
    );
  }

  // Validate the client and redirect_uri BEFORE showing anything, so an
  // unregistered URI is shown here rather than being redirected to.
  const client = await prisma.oAuthClient.findUnique({ where: { clientId } });
  if (!client || !client.redirectUris.includes(redirectUri)) {
    return (
      <ErrorCard
        title="Unknown client"
        detail="This client is not registered, or the redirect URI does not match its registration."
      />
    );
  }

  if (!codeChallenge || codeChallengeMethod !== 'S256') {
    return (
      <ErrorCard
        title="PKCE required"
        detail="This server requires a code_challenge with code_challenge_method=S256."
      />
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4" dir="ltr">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Authorize access</h1>
        <p className="mb-6 text-gray-500">
          <span className="font-medium text-gray-800">{client.name}</span> is requesting access to
          your Price Watch tracked items.
        </p>

        <div className="mb-6 rounded-lg bg-blue-50 p-4 text-sm text-blue-900">
          <p className="mb-1 font-medium">This grants access to:</p>
          <ul className="list-inside list-disc space-y-1">
            <li>Read your tracked items and their current/target prices</li>
            <li>Add a new tracked item from a product URL</li>
            <li>Add another store&apos;s link to an existing tracked item</li>
            <li>Re-check one link&apos;s price right now</li>
          </ul>
          <p className="mt-3 text-xs text-blue-800">It cannot remove or archive anything.</p>
        </div>

        <form
          action={issueAuthorizationCode.bind(null, { clientId, redirectUri, codeChallenge, state })}
          className="flex gap-3"
        >
          <button
            type="submit"
            name="action"
            value="deny"
            className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Deny
          </button>
          <button
            type="submit"
            name="action"
            value="approve"
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Authorize
          </button>
        </form>
      </div>
    </div>
  );
}
