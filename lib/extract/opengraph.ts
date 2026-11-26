import type { ProductInfo } from './types';

/** Matches `<meta property="og:title" content="...">` in either attribute order, single or double quotes. */
function findMetaContent(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${property}["']`, 'i'),
    // Some sites use name= instead of property= for these tags.
    new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${property}["']`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtmlEntities(match[1]);
  }
  return null;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parsePrice(value: string | null): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[^0-9.,-]/g, '').replace(',', '.');
  if (cleaned === '') return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Falls back to Open Graph / product meta tags, which are far more common
 * and stable than any site-specific markup: `og:title`, `og:image`, and
 * the `product:price:amount` / `product:price:currency` pair used by
 * Shopify, WooCommerce, and many other storefronts.
 */
export function extractFromOpenGraph(html: string): ProductInfo | null {
  const title = findMetaContent(html, 'og:title');
  const imageUrl = findMetaContent(html, 'og:image');
  const priceAmount = findMetaContent(html, 'product:price:amount') ?? findMetaContent(html, 'og:price:amount');
  const currency = findMetaContent(html, 'product:price:currency') ?? findMetaContent(html, 'og:price:currency');
  const availability = findMetaContent(html, 'product:availability');

  const price = parsePrice(priceAmount);

  if (!title && price === null && !imageUrl) {
    return null; // nothing usable found
  }

  return {
    title,
    price,
    currency,
    imageUrl,
    inStock: availability ? availability.toLowerCase().includes('instock') : null,
    source: 'open-graph',
  };
}
