import Link from 'next/link';
import { LogoutButton } from '@/components/LogoutButton';

// Gated by a single shared password (middleware.ts checks a signed cookie
// against SITE_PASSWORD) - not per-user accounts, just a deterrent against
// the open internet. See the README's "Access control" section for how
// to move to real per-user auth (NextAuth + Google) if that's ever needed.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="text-lg font-semibold">
            Price Watch
          </Link>
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
