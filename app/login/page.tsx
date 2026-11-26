'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/app/actions/site-auth-actions';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    const password = String(formData.get('password') ?? '');

    startTransition(async () => {
      const result = await login(password);
      if (!result.success) {
        setError(result.error ?? 'Incorrect password');
        return;
      }
      // Read callbackUrl directly from the browser location rather than
      // Next.js's useSearchParams(), which would force this page out of
      // static rendering and require a Suspense boundary for one query
      // param. middleware.ts sets this when it bounces an unauthenticated
      // request here (e.g. from /oauth/authorize) so login returns there.
      const callbackUrl = new URLSearchParams(window.location.search).get('callbackUrl');
      router.push(callbackUrl && callbackUrl.startsWith('/') ? callbackUrl : '/dashboard');
      router.refresh();
    });
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Price Watch</h1>
        <p className="mt-1 text-sm text-slate-500">Enter the site password to continue.</p>
      </div>
      <form action={handleSubmit} className="flex w-full max-w-xs flex-col gap-3">
        <input
          name="password"
          type="password"
          required
          autoFocus
          placeholder="Password"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? 'Checking…' : 'Enter'}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </main>
  );
}
