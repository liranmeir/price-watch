'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { fetchProductInfo } from '@/lib/extract';
import { prisma } from '@/lib/prisma';
import { storeNameFromUrl } from '@/lib/currency';
import type { ActionResult } from './tracked-item-actions';

const addLinkSchema = z.object({
  trackedItemId: z.string().min(1),
  url: z.string().url(),
  storeName: z.string().trim().max(100).optional(),
});

/** Adds another store's link to an existing tracked item and records its first price snapshot. */
export async function addLink(input: z.infer<typeof addLinkSchema>): Promise<ActionResult<{ id: string }>> {
  const parsed = addLinkSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const { trackedItemId, url, storeName } = parsed.data;

  const result = await fetchProductInfo(url);

  try {
    const link = await prisma.productLink.create({
      data: {
        trackedItemId,
        url,
        storeName: storeName || storeNameFromUrl(url),
        lastCheckedAt: new Date(),
        lastStatus: result.status,
        lastError: result.error,
        snapshots:
          result.status === 'ok' && result.info
            ? {
                create: {
                  price: result.info.price,
                  currency: result.info.currency,
                  title: result.info.title,
                  imageUrl: result.info.imageUrl,
                  inStock: result.info.inStock,
                },
              }
            : undefined,
      },
      select: { id: true },
    });

    revalidatePath(`/dashboard/${trackedItemId}`);
    revalidatePath('/dashboard');
    return { success: true, data: { id: link.id } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to add link' };
  }
}

export async function removeLink(linkId: string, trackedItemId: string): Promise<ActionResult<null>> {
  try {
    await prisma.productLink.delete({ where: { id: linkId } });
    revalidatePath(`/dashboard/${trackedItemId}`);
    revalidatePath('/dashboard');
    return { success: true, data: null };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to remove link' };
  }
}

/** Manually re-fetches one link right now, instead of waiting for the next cron run. */
export async function recheckLink(linkId: string): Promise<ActionResult<null>> {
  const link = await prisma.productLink.findUnique({ where: { id: linkId } });
  if (!link) {
    return { success: false, error: 'Link not found' };
  }

  const result = await fetchProductInfo(link.url);

  try {
    await prisma.productLink.update({
      where: { id: linkId },
      data: {
        lastCheckedAt: new Date(),
        lastStatus: result.status,
        lastError: result.error,
        snapshots:
          result.status === 'ok' && result.info
            ? {
                create: {
                  price: result.info.price,
                  currency: result.info.currency,
                  title: result.info.title,
                  imageUrl: result.info.imageUrl,
                  inStock: result.info.inStock,
                },
              }
            : undefined,
      },
    });

    revalidatePath(`/dashboard/${link.trackedItemId}`);
    revalidatePath('/dashboard');
    return { success: true, data: null };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to recheck link' };
  }
}
