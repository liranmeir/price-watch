/**
 * The Price Watch tool surface, served over HTTP at app/api/[transport]
 * behind the OAuth layer in lib/oauth.ts + app/oauth/authorize/. Unlike a
 * multi-tenant app, there's no per-caller scoping to worry about here — a
 * valid token already means "the one person who knows SITE_PASSWORD", same
 * as the dashboard itself, so every tool just talks to the shared `prisma`
 * directly.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { prisma } from '@/lib/prisma';
import { fetchProductInfo } from '@/lib/extract';
import { formatPrice, formatTargetPrice, storeNameFromUrl } from '@/lib/currency';
import { cheapestCurrentOffer, latestSnapshot, lowestEverPrice } from '@/lib/pricing';

export const SERVER_NAME = 'price-watch-mcp-server';
export const SERVER_VERSION = '1.0.0';

export const SERVER_INSTRUCTIONS =
  'Price Watch tracks products the user wants to buy across whichever stores sell them. ' +
  'Start with price_watch_list_items for an overview of everything tracked and its current ' +
  'cheapest price, then use price_watch_get_item for one item\'s full link/price-history detail. ' +
  'price_watch_add_item and price_watch_add_link are the only writes: adding a brand-new product, ' +
  'or another store\'s link for a product already tracked. Nothing here deletes or archives.';

/** Wraps a tool handler so failures come back as readable, actionable text. */
function withErrorHandling<TArgs>(
  toolName: string,
  handler: (args: TArgs) => Promise<CallToolResult>,
): (args: TArgs) => Promise<CallToolResult> {
  return async (args: TArgs) => {
    try {
      return await handler(args);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[${toolName}]`, error);
      return { content: [{ type: 'text', text: `Error in ${toolName}: ${message}` }], isError: true };
    }
  };
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function registerPriceWatchTools(server: McpServer): void {
  server.registerTool(
    'price_watch_list_items',
    {
      title: 'List Tracked Items',
      description: `List every tracked item (optionally including archived ones) with its cheapest current price across all its links, and its target price if one was set.

Use this for "what am I tracking?", "has anything dropped?" or "what's the cheapest I've found for X?". Follow up with price_watch_get_item for one item's full link list and price history.

Args:
  - include_archived (boolean): Include archived items too (default: false)

Returns: { "count": number, "items": [{ "id", "name", "note", "link_count", "current_price", "current_currency", "target_price", "target_currency", "below_target" }] }`,
      inputSchema: {
        include_archived: z.boolean().default(false).describe('Include archived items too.'),
      },
      outputSchema: {
        count: z.number(),
        items: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            note: z.string().nullable(),
            link_count: z.number(),
            current_price: z.number().nullable(),
            current_currency: z.string().nullable(),
            target_price: z.number().nullable(),
            target_currency: z.string().nullable(),
            below_target: z.boolean().nullable(),
          }),
        ),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    withErrorHandling('price_watch_list_items', async ({ include_archived }) => {
      const trackedItems = await prisma.trackedItem.findMany({
        where: include_archived ? {} : { archived: false },
        orderBy: { createdAt: 'desc' },
        include: { links: { include: { snapshots: { orderBy: { fetchedAt: 'desc' }, take: 1 } } } },
      });

      const items = trackedItems.map((item) => {
        const offer = cheapestCurrentOffer(
          item.links.map((l) => ({
            id: l.id,
            snapshots: l.snapshots.map((s) => ({
              price: toNumberOrNull(s.price),
              currency: s.currency,
              fetchedAt: s.fetchedAt,
            })),
          })),
        );
        const targetPrice = toNumberOrNull(item.targetPrice);
        return {
          id: item.id,
          name: item.name,
          note: item.note,
          link_count: item.links.length,
          current_price: offer?.price ?? null,
          current_currency: offer?.currency ?? null,
          target_price: targetPrice,
          target_currency: item.targetCurrency,
          below_target:
            targetPrice !== null && offer?.price !== undefined && offer?.price !== null
              ? offer.price <= targetPrice
              : null,
        };
      });

      const text = items.length
        ? items
            .map((i) => {
              const price = i.current_price !== null ? formatPrice(i.current_price, i.current_currency) : 'no price yet';
              const target = i.target_price !== null ? ` (target: ${formatTargetPrice(i.target_price, i.target_currency)})` : '';
              const flag = i.below_target ? ' ✅ at/below target' : '';
              return `- **${i.name}** [${i.id}] — ${price}${target}${flag}, ${i.link_count} link(s)`;
            })
            .join('\n')
        : 'Nothing tracked yet.';

      return { content: [{ type: 'text', text }], structuredContent: { count: items.length, items } };
    }),
  );

  server.registerTool(
    'price_watch_get_item',
    {
      title: 'Get Tracked Item Detail',
      description: `Full detail for one tracked item: every link (store, URL, last check status) with its latest price, plus the lowest price ever seen across all of them.

Args:
  - id (string, required): TrackedItem id, from price_watch_list_items

Returns: { "id", "name", "note", "target_price", "target_currency", "lowest_ever", "links": [{ "id", "store_name", "url", "last_checked_at", "last_status", "last_error", "latest_price", "latest_currency" }] }

Errors: "No tracked item with id '...'" if the id doesn't exist — call price_watch_list_items to find the right one.`,
      inputSchema: {
        id: z.string().min(1).describe('TrackedItem id.'),
      },
      outputSchema: {
        id: z.string(),
        name: z.string(),
        note: z.string().nullable(),
        target_price: z.number().nullable(),
        target_currency: z.string().nullable(),
        lowest_ever: z.number().nullable(),
        links: z.array(
          z.object({
            id: z.string(),
            store_name: z.string(),
            url: z.string(),
            last_checked_at: z.string().nullable(),
            last_status: z.string().nullable(),
            last_error: z.string().nullable(),
            latest_price: z.number().nullable(),
            latest_currency: z.string().nullable(),
          }),
        ),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    withErrorHandling('price_watch_get_item', async ({ id }) => {
      const item = await prisma.trackedItem.findUnique({
        where: { id },
        include: { links: { include: { snapshots: { orderBy: { fetchedAt: 'asc' } } } } },
      });

      if (!item) {
        throw new Error(`No tracked item with id '${id}'. Call price_watch_list_items to find the right one.`);
      }

      const linksForCalc = item.links.map((l) => ({
        id: l.id,
        storeName: l.storeName,
        snapshots: l.snapshots.map((s) => ({ price: toNumberOrNull(s.price), currency: s.currency, fetchedAt: s.fetchedAt })),
      }));
      const lowestEver = lowestEverPrice(linksForCalc);

      const links = item.links.map((link) => {
        const latest = latestSnapshot({
          snapshots: link.snapshots.map((s) => ({ price: toNumberOrNull(s.price), currency: s.currency, fetchedAt: s.fetchedAt })),
        });
        return {
          id: link.id,
          store_name: link.storeName,
          url: link.url,
          last_checked_at: link.lastCheckedAt?.toISOString() ?? null,
          last_status: link.lastStatus,
          last_error: link.lastError,
          latest_price: latest?.price ?? null,
          latest_currency: latest?.currency ?? null,
        };
      });

      const output = {
        id: item.id,
        name: item.name,
        note: item.note,
        target_price: toNumberOrNull(item.targetPrice),
        target_currency: item.targetCurrency,
        lowest_ever: lowestEver,
        links,
      };

      const lines = [
        `# ${item.name}`,
        item.note ? item.note : null,
        output.target_price !== null ? `Target: ${formatTargetPrice(output.target_price, output.target_currency)}` : null,
        lowestEver !== null ? `Lowest ever seen: ${lowestEver}` : null,
        '',
        ...links.map((l) => {
          const price = l.latest_price !== null ? formatPrice(l.latest_price, l.latest_currency) : 'no price yet';
          const status = l.last_status === 'error' ? ` ⚠️ last check failed: ${l.last_error}` : '';
          return `- **${l.store_name}**: ${price} — ${l.url}${status}`;
        }),
      ].filter((line): line is string => line !== null);

      return { content: [{ type: 'text', text: lines.join('\n') }], structuredContent: output };
    }),
  );

  server.registerTool(
    'price_watch_add_item',
    {
      title: 'Add a Tracked Item',
      description: `Starts tracking a new product from a store URL. Fetches the page once to auto-detect its name/image/price, same as pasting the link into the dashboard.

Args:
  - url (string, required): Product page URL
  - name (string, optional): Override the auto-detected name
  - note (string, optional): A short note
  - target_price (number, optional): Alert threshold price
  - target_currency (string, optional): ISO 4217 code for target_price (e.g. "ILS", "USD") — required if target_price is given, since there's no currency to infer it from yet

Returns: { "id": string, "extracted": boolean } — extracted=false means the page fetch failed (check with price_watch_get_item once a recheck succeeds) but the item was still created.`,
      inputSchema: {
        url: z.string().url().describe('Product page URL.'),
        name: z.string().trim().min(1).max(200).optional().describe('Override the auto-detected name.'),
        note: z.string().trim().max(2000).optional(),
        target_price: z.number().positive().optional().describe('Alert threshold price.'),
        target_currency: z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-Z]{3}$/)
          .optional()
          .describe('ISO 4217 code, e.g. "ILS" or "USD". Required if target_price is given.'),
      },
      outputSchema: {
        id: z.string(),
        extracted: z.boolean(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withErrorHandling('price_watch_add_item', async ({ url, name, note, target_price, target_currency }) => {
      if (target_price !== undefined && !target_currency) {
        throw new Error('target_currency is required when target_price is given (e.g. "ILS").');
      }

      const result = await fetchProductInfo(url);

      const item = await prisma.trackedItem.create({
        data: {
          name: name || result.info?.title || 'Untitled item',
          note,
          imageUrl: result.info?.imageUrl ?? null,
          targetPrice: target_price,
          targetCurrency: target_currency,
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

      const extracted = result.status === 'ok';
      const text = extracted
        ? `Tracking "${name || result.info?.title}" [${item.id}] — ${formatPrice(result.info?.price ?? null, result.info?.currency ?? null)} at ${storeNameFromUrl(url)}.`
        : `Tracking "${name || 'Untitled item'}" [${item.id}], but the first price check failed (${result.error}). It'll retry on the next daily cron run, or use the dashboard's "Check now" button to retry immediately.`;

      return { content: [{ type: 'text', text }], structuredContent: { id: item.id, extracted } };
    }),
  );

  server.registerTool(
    'price_watch_add_link',
    {
      title: 'Add a Link to a Tracked Item',
      description: `Adds another store's URL for a product that's already tracked — e.g. the user found the same item cheaper somewhere else.

Args:
  - item_id (string, required): TrackedItem id, from price_watch_list_items
  - url (string, required): The other store's product page URL
  - store_name (string, optional): Override the auto-detected store name

Returns: { "link_id": string, "extracted": boolean }

Errors: "No tracked item with id '...'" if item_id doesn't exist.`,
      inputSchema: {
        item_id: z.string().min(1).describe('TrackedItem id.'),
        url: z.string().url().describe("The other store's product page URL."),
        store_name: z.string().trim().max(100).optional(),
      },
      outputSchema: {
        link_id: z.string(),
        extracted: z.boolean(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withErrorHandling('price_watch_add_link', async ({ item_id, url, store_name }) => {
      const item = await prisma.trackedItem.findUnique({ where: { id: item_id }, select: { id: true, name: true } });
      if (!item) {
        throw new Error(`No tracked item with id '${item_id}'. Call price_watch_list_items to find the right one.`);
      }

      const result = await fetchProductInfo(url);

      const link = await prisma.productLink.create({
        data: {
          trackedItemId: item_id,
          url,
          storeName: store_name || storeNameFromUrl(url),
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

      const extracted = result.status === 'ok';
      const text = extracted
        ? `Added ${store_name || storeNameFromUrl(url)} as a link on "${item.name}" — ${formatPrice(result.info?.price ?? null, result.info?.currency ?? null)}.`
        : `Added ${store_name || storeNameFromUrl(url)} as a link on "${item.name}", but the first price check failed (${result.error}).`;

      return { content: [{ type: 'text', text }], structuredContent: { link_id: link.id, extracted } };
    }),
  );
}
