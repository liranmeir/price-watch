'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { fetchProductInfo } from '@/lib/extract';
import { prisma } from '@/lib/prisma';
import { storeNameFromUrl } from '@/lib/currency';

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const createItemSchema = z.object({
  url: z.string().url(),
  name: z.string().trim().min(1).max(200).optional(),
  note: z.string().trim().max(2000).optional(),
  targetPrice: z.number().positive().optional(),
});

/**
 * Creates a new tracked item from its first product link: fetches the page
 * once to prefill name/image and record an initial price snapshot, then
 * saves everything in one go. The user can add more links (other stores
 * selling the same thing) afterwards from the item's detail page.
 */
export async function createTrackedItemFromUrl(
  input: z.infer<typeof createItemSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createItemSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const { url, name, note, targetPrice } = parsed.data;

  const result = await fetchProductInfo(url);

  try {
    const item = await prisma.trackedItem.create({
      data: {
        name: name || result.info?.title || 'Untitled item',
        note,
        imageUrl: result.info?.imageUrl ?? null,
        targetPrice,
        links: {
          create: {
            url,
            storeName: storeNameFromUrl(url),
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
        },
      },
      select: { id: true },
    });

    revalidatePath('/dashboard');
    return { success: true, data: { id: item.id } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create tracked item' };
  }
}

const updateItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(200).optional(),
  note: z.string().trim().max(2000).nullable().optional(),
  targetPrice: z.number().positive().nullable().optional(),
});

export async function updateTrackedItem(
  input: z.infer<typeof updateItemSchema>,
): Promise<ActionResult<null>> {
  const parsed = updateItemSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const { id, ...rest } = parsed.data;

  try {
    await prisma.trackedItem.update({ where: { id }, data: rest });
    revalidatePath('/dashboard');
    revalidatePath(`/dashboard/${id}`);
    return { success: true, data: null };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update tracked item' };
  }
}

export async function archiveTrackedItem(id: string, archived: boolean): Promise<ActionResult<null>> {
  try {
    await prisma.trackedItem.update({ where: { id }, data: { archived } });
    revalidatePath('/dashboard');
    return { success: true, data: null };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to archive tracked item' };
  }
}

export async function deleteTrackedItem(id: string): Promise<ActionResult<null>> {
  try {
    await prisma.trackedItem.delete({ where: { id } });
    revalidatePath('/dashboard');
    return { success: true, data: null };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to delete tracked item' };
  }
}
