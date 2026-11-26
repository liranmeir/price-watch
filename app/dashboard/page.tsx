import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { formatPrice, formatTargetPrice } from '@/lib/currency';
import { cheapestCurrentOffer } from '@/lib/pricing';
import { AddItemForm } from '@/components/AddItemForm';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const items = await prisma.trackedItem.findMany({
    where: { archived: false },
    orderBy: { createdAt: 'desc' },
    include: {
      links: {
        include: {
          snapshots: { orderBy: { fetchedAt: 'desc' }, take: 1 },
        },
      },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-slate-500">Track a new item</h2>
        <AddItemForm />
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {items.length === 0 && (
          <p className="text-sm text-slate-500">Nothing tracked yet — paste a product link above to get started.</p>
        )}
        {items.map((item) => {
          const offer = cheapestCurrentOffer(
            item.links.map((l) => ({
              id: l.id,
              snapshots: l.snapshots.map((s) => ({
                price: s.price ? Number(s.price) : null,
                currency: s.currency,
                fetchedAt: s.fetchedAt,
              })),
            })),
          );
          return (
            <Link
              key={item.id}
              href={`/dashboard/${item.id}`}
              className="flex gap-4 rounded-lg border border-slate-200 bg-white p-4 hover:border-blue-300"
            >
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.imageUrl} alt="" className="h-20 w-20 rounded object-contain" />
              ) : (
                <div className="h-20 w-20 rounded bg-slate-100" />
              )}
              <div className="flex-1">
                <h3 className="font-medium">{item.name}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {item.links.length} link{item.links.length === 1 ? '' : 's'} tracked
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {offer ? formatPrice(offer.price, offer.currency) : 'No price yet'}
                </p>
                {item.targetPrice && (
                  <p className="text-xs text-slate-500">
                    Target: {formatTargetPrice(Number(item.targetPrice), item.targetCurrency)}
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
