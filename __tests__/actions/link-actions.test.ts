import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    productLink: {
      create: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/extract', () => ({
  fetchProductInfo: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { fetchProductInfo } from '@/lib/extract';
import { addLink, recheckLink, removeLink } from '@/app/actions/link-actions';

const mockedFetchProductInfo = vi.mocked(fetchProductInfo);
const mockedCreate = vi.mocked(prisma.productLink.create);
const mockedDelete = vi.mocked(prisma.productLink.delete);
const mockedUpdate = vi.mocked(prisma.productLink.update);
const mockedFindUnique = vi.mocked(prisma.productLink.findUnique);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('addLink', () => {
  it('rejects an invalid URL', async () => {
    const result = await addLink({ trackedItemId: 'item1', url: 'nope' });
    expect(result.success).toBe(false);
    expect(mockedFetchProductInfo).not.toHaveBeenCalled();
  });

  it('derives a store name from the URL when none is given', async () => {
    mockedFetchProductInfo.mockResolvedValue({
      status: 'ok',
      error: null,
      info: { title: 'X', price: 10, currency: 'USD', imageUrl: null, inStock: null, source: 'json-ld' },
    });
    mockedCreate.mockResolvedValue({ id: 'link1' } as never);

    await addLink({ trackedItemId: 'item1', url: 'https://www.footlocker.com/p/shoe' });

    const callArgs = mockedCreate.mock.calls[0]?.[0];
    expect(callArgs?.data.storeName).toBe('Footlocker');
  });

  it('uses a user-supplied store name over the derived one', async () => {
    mockedFetchProductInfo.mockResolvedValue({ status: 'error', error: 'x', info: null });
    mockedCreate.mockResolvedValue({ id: 'link2' } as never);

    await addLink({ trackedItemId: 'item1', url: 'https://www.footlocker.com/p/shoe', storeName: 'Foot Locker' });

    expect(mockedCreate.mock.calls[0]?.[0]?.data.storeName).toBe('Foot Locker');
  });
});

describe('removeLink', () => {
  it('deletes the link', async () => {
    mockedDelete.mockResolvedValue({} as never);
    const result = await removeLink('link1', 'item1');
    expect(result.success).toBe(true);
    expect(mockedDelete).toHaveBeenCalledWith({ where: { id: 'link1' } });
  });
});

describe('recheckLink', () => {
  it('returns an error when the link does not exist', async () => {
    mockedFindUnique.mockResolvedValue(null);
    const result = await recheckLink('missing');
    expect(result.success).toBe(false);
    expect(mockedFetchProductInfo).not.toHaveBeenCalled();
  });

  it('re-fetches and records a new snapshot on success', async () => {
    mockedFindUnique.mockResolvedValue({ id: 'link1', url: 'https://x.com/p', trackedItemId: 'item1' } as never);
    mockedFetchProductInfo.mockResolvedValue({
      status: 'ok',
      error: null,
      info: { title: 'X', price: 55, currency: 'USD', imageUrl: null, inStock: true, source: 'json-ld' },
    });
    mockedUpdate.mockResolvedValue({} as never);

    const result = await recheckLink('link1');

    expect(result.success).toBe(true);
    // Prisma's nested-write union types are impractical to narrow in a test;
    // we're only inspecting the plain object this mock call actually got.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const callArgs = mockedUpdate.mock.calls[0]?.[0] as any;
    expect(callArgs?.data.snapshots?.create?.price).toBe(55);
    expect(callArgs?.data.lastStatus).toBe('ok');
  });

  it('records lastError and no snapshot when extraction fails', async () => {
    mockedFindUnique.mockResolvedValue({ id: 'link1', url: 'https://x.com/p', trackedItemId: 'item1' } as never);
    mockedFetchProductInfo.mockResolvedValue({ status: 'error', error: 'HTTP 403', info: null });
    mockedUpdate.mockResolvedValue({} as never);

    await recheckLink('link1');

    const callArgs = mockedUpdate.mock.calls[0]?.[0];
    expect(callArgs?.data.lastStatus).toBe('error');
    expect(callArgs?.data.lastError).toBe('HTTP 403');
    expect(callArgs?.data.snapshots).toBeUndefined();
  });
});
