import Link from 'next/link';

// No authentication layer right now (removed to get a first deploy working
// quickly) - anyone with this app's URL can view and edit everything. Before
// treating this as more than a personal/throwaway deployment, put something
// in front of it: NextAuth + an email allowlist is straightforward to add
// back (that's how it worked before - see git history), or at minimum
// enable Vercel's own Deployment Protection in the project settings so only
// your team can reach it until a custom domain is attached.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="text-lg font-semibold">
            Price Watch
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
