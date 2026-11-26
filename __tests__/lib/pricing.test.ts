import { describe, expect, it } from 'vitest';
import { cheapestCurrentOffer, latestSnapshot, lowestEverPrice } from '@/lib/pricing';

function d(daysAgo: number): Date {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
}

describe('latestSnapshot', () => {
  it('returns the most recent snapshot by fetchedAt', () => {
    const link = {
      snapshots: [
        { price: 10, fetchedAt: d(5) },
        { price: 8, fetchedAt: d(1) },
        { price: 9, fetchedAt: d(3) },
      ],
    };
    expect(latestSnapshot(link)?.price).toBe(8);
  });

  it('returns null for a link with no snapshots', () => {
    expect(latestSnapshot({ snapshots: [] })).toBeNull();
  });
});

describe('cheapestCurrentOffer', () => {
  it('picks the link whose latest snapshot has the lowest price', () => {
    const links = [
      { id: 'a', snapshots: [{ price: 100, currency: 'USD', fetchedAt: d(1) }] },
      { id: 'b', snapshots: [{ price: 80, currency: 'USD', fetchedAt: d(1) }] },
      { id: 'c', snapshots: [{ price: 120, currency: 'USD', fetchedAt: d(1) }] },
    ];
    const best = cheapestCurrentOffer(links);
    expect(best?.link.id).toBe('b');
    expect(best?.price).toBe(80);
  });

  it('ignores links with no price data, even if they have snapshots', () => {
    const links = [
      { id: 'a', snapshots: [{ price: null, currency: null, fetchedAt: d(1) }] },
      { id: 'b', snapshots: [{ price: 50, currency: 'USD', fetchedAt: d(1) }] },
    ];
    expect(cheapestCurrentOffer(links)?.link.id).toBe('b');
  });

  it('uses each link\'s most recent snapshot, not its cheapest historical one', () => {
    const links = [
      {
        id: 'a',
        snapshots: [
          { price: 50, currency: 'USD', fetchedAt: d(10) }, // was cheap long ago
          { price: 200, currency: 'USD', fetchedAt: d(1) }, // now expensive
        ],
      },
      { id: 'b', snapshots: [{ price: 100, currency: 'USD', fetchedAt: d(1) }] },
    ];
    expect(cheapestCurrentOffer(links)?.link.id).toBe('b');
  });

  it('returns null when no link has any price data', () => {
    const links = [{ id: 'a', snapshots: [] }, { id: 'b', snapshots: [{ price: null, fetchedAt: d(1) }] }];
    expect(cheapestCurrentOffer(links)).toBeNull();
  });
});

describe('lowestEverPrice', () => {
  it('finds the lowest price across all snapshots of all links', () => {
    const links = [
      { id: 'a', snapshots: [{ price: 100, fetchedAt: d(5) }, { price: 60, fetchedAt: d(2) }] },
      { id: 'b', snapshots: [{ price: 90, fetchedAt: d(1) }] },
    ];
    expect(lowestEverPrice(links)).toBe(60);
  });

  it('returns null when there is no price data at all', () => {
    expect(lowestEverPrice([{ id: 'a', snapshots: [] }])).toBeNull();
  });
});
