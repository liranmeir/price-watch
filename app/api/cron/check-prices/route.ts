import { NextRequest, NextResponse } from 'next/server';
import { fetchProductInfo } from '@/lib/extract';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Politeness delay between checking successive links so we don't hammer
// any one store (or look like abuse across all of them at once).
const DELAY_BETWEEN_CHECKS_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed if misconfigured
  const header = request.headers.get('authorization');
  return header === `Bearer ${secret}`;
}

/**
 * Re-checks the price of every active ProductLink belonging to a
 * non-archived TrackedItem. Intended to be invoked by Vercel Cron (see
 * vercel.json) with the Authorization header it adds automatically when
 * CRON_SECRET is set as an environment variable.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const links = await prisma.productLink.findMany({
    where: { active: true, trackedItem: { archived: false } },
    select: { id: true, url: true },
  });

  const results: { linkId: string; status: string }[] = [];

  for (const [index, link] of links.entries()) {
    if (index > 0) await sleep(DELAY_BETWEEN_CHECKS_MS);

    const result = await fetchProductInfo(link.url);

    await prisma.productLink.update({
      where: { id: link.id },
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

    results.push({ linkId: link.id, status: result.status });
  }

  return NextResponse.json({
    checked: results.length,
    ok: results.filter((r) => r.status === 'ok').length,
    failed: results.filter((r) => r.status === 'error').length,
  });
}
