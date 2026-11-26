import { fetchText, HttpError } from './http';
import { extractFromJsonLd } from './jsonld';
import { extractFromOpenGraph } from './opengraph';
import { isUrlAllowedByRobots } from './robots';
import type { ExtractionResult } from './types';

export const DEFAULT_USER_AGENT =
  'price-watch/1.0 (+https://github.com/liranmeir/price-watch; personal price-tracking tool)';

export interface FetchProductInfoOptions {
  timeoutMs?: number;
  maxRetries?: number;
  userAgent?: string;
  fetchImpl?: typeof fetch;
  /** Skip the robots.txt check (used in tests; never disable this for real runs). */
  skipRobotsCheck?: boolean;
}

const DEFAULTS = {
  timeoutMs: 15_000,
  maxRetries: 2,
};

/**
 * Fetches a product page and extracts title/price/currency/image/stock
 * status using a fallback chain: JSON-LD (schema.org Product) first, then
 * Open Graph / product meta tags. This generic approach works across most
 * storefronts without a site-specific scraper — see README for why.
 */
export async function fetchProductInfo(url: string, options: FetchProductInfoOptions = {}): Promise<ExtractionResult> {
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
  const fetchImpl = options.fetchImpl;

  if (!options.skipRobotsCheck) {
    const allowed = await isUrlAllowedByRobots(url, userAgent, fetchImpl ?? fetch);
    if (!allowed) {
      return { status: 'error', info: null, error: 'Disallowed by robots.txt' };
    }
  }

  let html: string;
  try {
    html = await fetchText(url, {
      timeoutMs: options.timeoutMs ?? DEFAULTS.timeoutMs,
      maxRetries: options.maxRetries ?? DEFAULTS.maxRetries,
      userAgent,
      fetchImpl,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return { status: 'error', info: null, error: `HTTP ${error.status}` };
    }
    return { status: 'error', info: null, error: error instanceof Error ? error.message : String(error) };
  }

  const info = extractFromJsonLd(html) ?? extractFromOpenGraph(html);

  if (!info) {
    return { status: 'error', info: null, error: 'Could not find product data (no JSON-LD or Open Graph tags)' };
  }

  return { status: 'ok', info, error: null };
}
