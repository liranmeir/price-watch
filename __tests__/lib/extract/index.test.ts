import { describe, expect, it, vi } from 'vitest';
import { fetchProductInfo } from '@/lib/extract';

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, { status, headers: { 'content-type': 'text/html' } });
}

function productJsonLdHtml(): string {
  return `<html><head><script type="application/ld+json">${JSON.stringify({
    '@type': 'Product',
    name: 'Test Product',
    image: 'https://example.com/img.jpg',
    offers: { price: 42, priceCurrency: 'USD', availability: 'https://schema.org/InStock' },
  })}</script></head></html>`;
}

describe('fetchProductInfo', () => {
  it('returns ok with JSON-LD data when robots.txt allows and the page has it', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 404 })) // robots.txt
      .mockResolvedValueOnce(htmlResponse(productJsonLdHtml())); // page

    const result = await fetchProductInfo('https://example.com/product/1', { fetchImpl });

    expect(result.status).toBe('ok');
    expect(result.info?.title).toBe('Test Product');
    expect(result.info?.price).toBe(42);
    expect(result.info?.source).toBe('json-ld');
  });

  it('falls back to Open Graph when there is no JSON-LD', async () => {
    const html = `<meta property="og:title" content="OG Product" /><meta property="product:price:amount" content="19.99" />`;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(htmlResponse(html));

    const result = await fetchProductInfo('https://example.com/product/2', { fetchImpl });

    expect(result.status).toBe('ok');
    expect(result.info?.source).toBe('open-graph');
    expect(result.info?.price).toBe(19.99);
  });

  it('returns an error when robots.txt disallows the path', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(htmlResponse('User-agent: *\nDisallow: /product/', 200));

    const result = await fetchProductInfo('https://example.com/product/3', { fetchImpl });

    expect(result.status).toBe('error');
    expect(result.error).toMatch(/robots/i);
    expect(fetchImpl).toHaveBeenCalledTimes(1); // never fetched the page itself
  });

  it('returns an error when neither JSON-LD nor Open Graph data is present', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(htmlResponse('<html><body>nothing here</body></html>'));

    const result = await fetchProductInfo('https://example.com/product/4', { fetchImpl });

    expect(result.status).toBe('error');
    expect(result.info).toBeNull();
  });

  it('returns an HTTP error when the page fetch fails', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 404 })) // robots.txt
      .mockResolvedValue(new Response('', { status: 404 })); // page, also 404, no retry since not retryable

    const result = await fetchProductInfo('https://example.com/product/5', { fetchImpl, maxRetries: 0 });

    expect(result.status).toBe('error');
    expect(result.error).toMatch(/404/);
  });

  it('can skip the robots.txt check (used sparingly, e.g. in tests)', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(htmlResponse(productJsonLdHtml()));

    const result = await fetchProductInfo('https://example.com/product/6', {
      fetchImpl,
      skipRobotsCheck: true,
    });

    expect(result.status).toBe('ok');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
