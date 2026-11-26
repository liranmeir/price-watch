import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { formatPrice, formatTargetPrice } from '@/lib/currency';
import { cheapestCurrentOffer, latestSnapshot, lowestEverPrice } from '@/lib/pricing';
import { PriceHistoryChart } from '@/components/PriceHistoryChart';
import { AddLinkForm } from '@/components/AddLinkForm';
import { RecheckButton } from '@/components/RecheckButton';
import { RemoveLinkButton } from '@/components/RemoveLinkButton';
import { ItemActions } from '@/components/ItemActions';

export const dynamic = 'force-dynamic';

export default async function TrackedItemPage({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;

  const item = await prisma.trackedItem.findUnique({
    where: { id: itemId },
    include: {
      links: {
        include: { snapshots: { orderBy: { fetchedAt: 'asc' } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!item) notFound();

  const linksForCalc = item.links.map((l) => ({
    id: l.id,
    storeName: l.storeName,
    snapshots: l.snapshots.map((s) => ({
      price: s.price ? Number(s.price) : null,
      currency: s.currency,
      fetchedAt: s.fetchedAt,
    })),
  }));

  const cheapest = cheapestCurrentOffer(linksForCalc);
  const lowestEver = lowestEverPrice(linksForCalc);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div className="flex gap-4">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imageUrl} alt="" className="h-24 w-24 rounded object-contain" />
          ) : (
            <div className="h-24 w-24 rounded bg-slate-100" />
          )}
          <div>
            <h1 className="text-xl font-semibold">{item.name}</h1>
            {item.note && <p className="mt-1 text-sm text-slate-500">{item.note}</p>}
            <p className="mt-2 text-2xl font-bold">
              {cheapest ? formatPrice(cheapest.price, cheapest.currency) : 'No price yet'}
            </p>
            <div className="mt-1 flex gap-3 text-xs text-slate-500">
              {lowestEver !== null && <span>Lowest ever: {formatPrice(lowestEver, cheapest?.currency ?? null)}</span>}
              {item.targetPrice && (
                <span>Target: {formatTargetPrice(Number(item.targetPrice), item.targetCurrency)}</span>
              )}
            </div>
          </div>
        </div>
        <ItemActions itemId={item.id} />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-slate-500">Price history</h2>
        <PriceHistoryChart links={linksForCalc} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-slate-500">Tracked links</h2>
        <div className="flex flex-col divide-y divide-slate-100">
          {item.links.map((link) => {
            const latest = latestSnapshot({
              snapshots: link.snapshots.map((s) => ({ price: s.price ? Number(s.price) : null, currency: s.currency, fetchedAt: s.fetchedAt })),
            });
            return (
              <div key={link.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="truncate text-sm font-medium text-blue-600 hover:underline">
                    {link.storeName}
                  </a>
                  <p className="truncate text-xs text-slate-400">{link.url}</p>
                  {link.lastStatus === 'error' && (
                    <p className="text-xs text-red-600">Last check failed: {link.lastError}</p>
                  )}
                </div>
                <div className="text-right text-sm font-medium">
                  {latest ? formatPrice(latest.price, latest.currency) : '—'}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <RecheckButton linkId={link.id} />
                  <RemoveLinkButton linkId={link.id} trackedItemId={item.id} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4">
          <AddLinkForm trackedItemId={item.id} />
        </div>
      </section>
    </div>
  );
}
