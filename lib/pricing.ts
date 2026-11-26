export interface SnapshotLike {
  price: number | null;
  currency?: string | null;
  fetchedAt: Date;
}

export interface LinkLike {
  id: string;
  snapshots: SnapshotLike[];
}

/** Most recent snapshot for a link, or null if it has none yet. */
export function latestSnapshot<T extends SnapshotLike>(link: { snapshots: T[] }): T | null {
  if (link.snapshots.length === 0) return null;
  return link.snapshots.reduce((latest, s) => (s.fetchedAt > latest.fetchedAt ? s : latest));
}

/**
 * Among a tracked item's links, finds the cheapest *current* price (based
 * on each link's most recent snapshot), ignoring links with no price data.
 */
export function cheapestCurrentOffer<T extends LinkLike>(
  links: T[],
): { link: T; price: number; currency: string | null } | null {
  let best: { link: T; price: number; currency: string | null } | null = null;

  for (const link of links) {
    const snapshot = latestSnapshot(link);
    if (!snapshot || snapshot.price === null) continue;
    if (!best || snapshot.price < best.price) {
      best = { link, price: snapshot.price, currency: snapshot.currency ?? null };
    }
  }

  return best;
}

/** The lowest price ever recorded across all of an item's links, if any. */
export function lowestEverPrice<T extends LinkLike & { snapshots: SnapshotLike[] }>(links: T[]): number | null {
  let lowest: number | null = null;
  for (const link of links) {
    for (const snapshot of link.snapshots) {
      if (snapshot.price === null) continue;
      if (lowest === null || snapshot.price < lowest) lowest = snapshot.price;
    }
  }
  return lowest;
}
