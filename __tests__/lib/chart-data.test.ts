import { describe, expect, it } from 'vitest';
import { buildPriceChartData } from '@/lib/chart-data';

describe('buildPriceChartData', () => {
  it('merges snapshots from multiple links into dated points keyed by store name', () => {
    const links = [
      {
        id: 'a',
        storeName: 'Nike',
        snapshots: [
          { price: 160, fetchedAt: new Date('2026-01-01T10:00:00Z') },
          { price: 150, fetchedAt: new Date('2026-01-02T10:00:00Z') },
        ],
      },
      {
        id: 'b',
        storeName: 'Footlocker',
        snapshots: [{ price: 170, fetchedAt: new Date('2026-01-02T10:00:00Z') }],
      },
    ];

    const data = buildPriceChartData(links);

    expect(data).toEqual([
      { date: '2026-01-01', Nike: 160 },
      { date: '2026-01-02', Nike: 150, Footlocker: 170 },
    ]);
  });

  it('keeps only the latest reading when a store has two snapshots the same day', () => {
    const links = [
      {
        id: 'a',
        storeName: 'Nike',
        snapshots: [
          { price: 160, fetchedAt: new Date('2026-01-01T08:00:00Z') },
          { price: 140, fetchedAt: new Date('2026-01-01T20:00:00Z') },
        ],
      },
    ];

    expect(buildPriceChartData(links)).toEqual([{ date: '2026-01-01', Nike: 140 }]);
  });

  it('skips null-price snapshots', () => {
    const links = [
      { id: 'a', storeName: 'Nike', snapshots: [{ price: null, fetchedAt: new Date('2026-01-01') }] },
    ];
    expect(buildPriceChartData(links)).toEqual([]);
  });

  it('returns an empty array for no links', () => {
    expect(buildPriceChartData([])).toEqual([]);
  });

  it('sorts points chronologically regardless of input order', () => {
    const links = [
      {
        id: 'a',
        storeName: 'Nike',
        snapshots: [
          { price: 1, fetchedAt: new Date('2026-01-03') },
          { price: 2, fetchedAt: new Date('2026-01-01') },
        ],
      },
    ];
    expect(buildPriceChartData(links).map((p) => p.date)).toEqual(['2026-01-01', '2026-01-03']);
  });
});
