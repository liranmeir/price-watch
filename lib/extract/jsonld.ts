import type { ProductInfo } from './types';

const JSON_LD_SCRIPT_RE = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function parsePrice(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.,-]/g, '').replace(/,(?=\d{3}\b)/g, '');
    const normalized = cleaned.replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function extractImage(node: Record<string, unknown>): string | null {
  const image = node.image;
  if (typeof image === 'string') return image;
  if (Array.isArray(image) && typeof image[0] === 'string') return image[0] as string;
  if (image && typeof image === 'object' && 'url' in image && typeof (image as { url?: unknown }).url === 'string') {
    return (image as { url: string }).url;
  }
  return null;
}

function availabilityToInStock(availability: unknown): boolean | null {
  if (typeof availability !== 'string') return null;
  const normalized = availability.toLowerCase();
  if (normalized.includes('instock') || normalized.includes('in_stock')) return true;
  if (normalized.includes('outofstock') || normalized.includes('out_of_stock') || normalized.includes('soldout')) {
    return false;
  }
  return null;
}

/** Finds the first node (recursing through @graph) whose @type is/includes "Product". */
function findProductNode(node: unknown): Record<string, unknown> | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findProductNode(item);
      if (found) return found;
    }
    return null;
  }
  if (!node || typeof node !== 'object') return null;

  const obj = node as Record<string, unknown>;
  const types = toArray(obj['@type'] as string | string[] | undefined);
  if (types.some((t) => typeof t === 'string' && t.toLowerCase() === 'product')) {
    return obj;
  }
  if (obj['@graph']) {
    return findProductNode(obj['@graph']);
  }
  return null;
}

function productInfoFromNode(node: Record<string, unknown>): ProductInfo {
  const offersRaw = node.offers;
  const offers = toArray(offersRaw as Record<string, unknown> | Record<string, unknown>[] | undefined);
  // Prefer the lowest-priced offer when several variants are listed.
  let price: number | null = null;
  let currency: string | null = null;
  let inStock: boolean | null = null;

  for (const offer of offers) {
    if (!offer || typeof offer !== 'object') continue;
    const offerObj = offer as Record<string, unknown>;
    const offerPrice = parsePrice(offerObj.price ?? offerObj.lowPrice);
    if (offerPrice !== null && (price === null || offerPrice < price)) {
      price = offerPrice;
      currency = typeof offerObj.priceCurrency === 'string' ? offerObj.priceCurrency : currency;
      inStock = availabilityToInStock(offerObj.availability) ?? inStock;
    }
  }

  return {
    title: typeof node.name === 'string' ? node.name : null,
    price,
    currency,
    imageUrl: extractImage(node),
    inStock,
    source: 'json-ld',
  };
}

/**
 * Scans HTML for `<script type="application/ld+json">` blocks containing a
 * schema.org Product (optionally wrapped in @graph or a top-level array)
 * and returns normalized product info from the first match found.
 * Returns null if no JSON-LD Product data is present or parseable.
 */
export function extractFromJsonLd(html: string): ProductInfo | null {
  const matches = html.matchAll(JSON_LD_SCRIPT_RE);

  for (const match of matches) {
    const raw = match[1]?.trim();
    if (!raw) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue; // malformed JSON-LD block; try the next script tag
    }

    const productNode = findProductNode(parsed);
    if (productNode) {
      return productInfoFromNode(productNode);
    }
  }

  return null;
}
