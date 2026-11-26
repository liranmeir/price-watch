import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    trackedItem: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
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
import {
  archiveTrackedItem,
  createTrackedItemFromUrl,
  deleteTrackedItem,
  updateTrackedItem,
} from '@/app/actions/tracked-item-actions';

const mockedFetchProductInfo = vi.mocked(fetchProductInfo);
const mockedCreate = vi.mocked(prisma.trackedItem.create);
const mockedUpdate = vi.mocked(prisma.trackedItem.update);
const mockedDelete = vi.mocked(prisma.trackedItem.delete);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createTrackedItemFromUrl', () => {
  it('rejects an invalid URL before ever calling fetchProductInfo', async () => {
    const result = await createTrackedItemFromUrl({ url: 'not-a-url' });
    expect(result.success).toBe(false);
    expect(mockedFetchProductInfo).not.toHaveBeenCalled();
  });

  it('prefills name and image from extracted product info when no name is given', async () => {
    mockedFetchProductInfo.mockResolvedValue({
      status: 'ok',
      error: null,
      info: { title: 'Dyson V10', price: 499.99, currency: 'USD', imageUrl: 'https://x/img.jpg', inStock: true, source: 'json-ld' },
    });
    mockedCreate.mockResolvedValue({ id: 'item1' } as never);

    const result = await createTrackedItemFromUrl({ url: 'https://example.com/v10' });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: 'item1' });
    // Prisma's nested-write union types are impractical to narrow in a test;
    // we're only inspecting the plain object this mock call actually got.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const callArgs = mockedCreate.mock.calls[0]?.[0] as any;
    expect(callArgs?.data.name).toBe('Dyson V10');
    expect(callArgs?.data.imageUrl).toBe('https://x/img.jpg');
    expect(callArgs?.data.links.create.snapshots.create.price).toBe(499.99);
  });

  it('prefers a user-supplied name over the extracted title', async () => {
    mockedFetchProductInfo.mockResolvedValue({
      status: 'ok',
      error: null,
      info: { title: 'Extracted Title', price: 10, currency: 'USD', imageUrl: null, inStock: null, source: 'open-graph' },
    });
    mockedCreate.mockResolvedValue({ id: 'item2' } as never);

    await createTrackedItemFromUrl({ url: 'https://example.com/x', name: 'My Custom Name' });

    const callArgs = mockedCreate.mock.calls[0]?.[0];
    expect(callArgs?.data.name).toBe('My Custom Name');
  });

  it('still creates the item when extraction fails, with no snapshot and lastStatus=error', async () => {
    mockedFetchProductInfo.mockResolvedValue({ status: 'error', error: 'Disallowed by robots.txt', info: null });
    mockedCreate.mockResolvedValue({ id: 'item3' } as never);

    const result = await createTrackedItemFromUrl({ url: 'https://example.com/y' });

    expect(result.success).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const callArgs = mockedCreate.mock.calls[0]?.[0] as any;
    expect(callArgs?.data.name).toBe('Untitled item');
    expect(callArgs?.data.links.create.lastStatus).toBe('error');
    expect(callArgs?.data.links.create.snapshots).toBeUndefined();
  });

  it('returns a failure result if the database write throws', async () => {
    mockedFetchProductInfo.mockResolvedValue({ status: 'error', error: 'x', info: null });
    mockedCreate.mockRejectedValue(new Error('DB is down'));

    const result = await createTrackedItemFromUrl({ url: 'https://example.com/z' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('DB is down');
  });
});

describe('updateTrackedItem', () => {
  it('rejects a missing id', async () => {
    // @ts-expect-error intentionally omitting required field
    const result = await updateTrackedItem({ name: 'x' });
    expect(result.success).toBe(false);
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it('updates only the provided fields', async () => {
    mockedUpdate.mockResolvedValue({} as never);
    const result = await updateTrackedItem({ id: 'item1', targetPrice: 100 });
    expect(result.success).toBe(true);
    expect(mockedUpdate).toHaveBeenCalledWith({ where: { id: 'item1' }, data: { targetPrice: 100 } });
  });
});

describe('archiveTrackedItem / deleteTrackedItem', () => {
  it('archives an item', async () => {
    mockedUpdate.mockResolvedValue({} as never);
    const result = await archiveTrackedItem('item1', true);
    expect(result.success).toBe(true);
    expect(mockedUpdate).toHaveBeenCalledWith({ where: { id: 'item1' }, data: { archived: true } });
  });

  it('deletes an item', async () => {
    mockedDelete.mockResolvedValue({} as never);
    const result = await deleteTrackedItem('item1');
    expect(result.success).toBe(true);
    expect(mockedDelete).toHaveBeenCalledWith({ where: { id: 'item1' } });
  });
});
