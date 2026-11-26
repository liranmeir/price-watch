import { format } from 'date-fns';

export interface ChartSnapshot {
  price: number | null;
  fetchedAt: Date;
}

export interface ChartLink {
  id: string;
  storeName: string;
  snapshots: ChartSnapshot[];
}

export type ChartPoint = { date: string } & Record<string, number | string>;

/**
 * Merges each link's price history into one array of { date, [storeName]: price }
 * points suitable for a multi-line recharts chart, keyed by day. When a
 * store has more than one reading on the same day, the latest one wins.
 */
export function buildPriceChartData(links: ChartLink[]): ChartPoint[] {
  const byDate = new Map<string, Record<string, number>>();

  for (const link of links) {
    const sorted = [...link.snapshots].sort((a, b) => a.fetchedAt.getTime() - b.fetchedAt.getTime());
    for (const snapshot of sorted) {
      if (snapshot.price === null) continue;
      const dateKey = format(snapshot.fetchedAt, 'yyyy-MM-dd');
      const entry = byDate.get(dateKey) ?? {};
      entry[link.storeName] = snapshot.price;
      byDate.set(dateKey, entry);
    }
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, prices]) => ({ date, ...prices }));
}
