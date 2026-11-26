'use client';

import { signIn } from 'next-auth/react';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Price Watch</h1>
        <p className="mt-1 text-sm text-slate-500">Sign in to see your tracked items.</p>
      </div>
      <button
        onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Sign in with Google
      </button>
    </main>
  );
}
