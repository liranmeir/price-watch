import { describe, expect, it } from 'vitest';
import { extractFromJsonLd } from '@/lib/extract/jsonld';

function withJsonLd(json: unknown): string {
  return `<html><head><script type="application/ld+json">${JSON.stringify(json)}</script></head><body></body></html>`;
}

describe('extractFromJsonLd', () => {
  it('extracts a simple Product node', () => {
    const html = withJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Dyson V10 Absolute',
      image: 'https://example.com/v10.jpg',
      offers: { '@type': 'Offer', price: '499.99', priceCurrency: 'USD', availability: 'https://schema.org/InStock' },
    });

    const info = extractFromJsonLd(html);

    expect(info).toEqual({
      title: 'Dyson V10 Absolute',
      price: 499.99,
      currency: 'USD',
      imageUrl: 'https://example.com/v10.jpg',
      inStock: true,
      source: 'json-ld',
    });
  });

  it('finds a Product node nested inside @graph', () => {
    const html = withJsonLd({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebSite', name: 'Some Store' },
        { '@type': 'Product', name: 'Kids Basketball Shoes', offers: { price: 59.99, priceCurrency: 'USD' } },
      ],
    });

    const info = extractFromJsonLd(html);
    expect(info?.title).toBe('Kids Basketball Shoes');
    expect(info?.price).toBe(59.99);
  });

  it('picks the lowest-priced offer when several are listed (size/color variants)', () => {
    const html = withJsonLd({
      '@type': 'Product',
      name: 'Shoe',
      offers: [
        { price: 100, priceCurrency: 'USD' },
        { price: 80, priceCurrency: 'USD' },
        { price: 120, priceCurrency: 'USD' },
      ],
    });

    expect(extractFromJsonLd(html)?.price).toBe(80);
  });

  it('handles @type as an array including Product', () => {
    const html = withJsonLd({ '@type': ['Thing', 'Product'], name: 'Widget', offers: { price: 10 } });
    expect(extractFromJsonLd(html)?.title).toBe('Widget');
  });

  it('reads image as an array', () => {
    const html = withJsonLd({ '@type': 'Product', name: 'X', image: ['https://a.com/1.jpg', 'https://a.com/2.jpg'] });
    expect(extractFromJsonLd(html)?.imageUrl).toBe('https://a.com/1.jpg');
  });

  it('reads image as an ImageObject', () => {
    const html = withJsonLd({ '@type': 'Product', name: 'X', image: { url: 'https://a.com/1.jpg' } });
    expect(extractFromJsonLd(html)?.imageUrl).toBe('https://a.com/1.jpg');
  });

  it('marks out-of-stock availability correctly', () => {
    const html = withJsonLd({
      '@type': 'Product',
      name: 'X',
      offers: { price: 10, availability: 'https://schema.org/OutOfStock' },
    });
    expect(extractFromJsonLd(html)?.inStock).toBe(false);
  });

  it('returns null when no script tag is present', () => {
    expect(extractFromJsonLd('<html><body>no data here</body></html>')).toBeNull();
  });

  it('returns null and does not throw on malformed JSON', () => {
    const html = '<script type="application/ld+json">{ not valid json </script>';
    expect(extractFromJsonLd(html)).toBeNull();
  });

  it('skips malformed blocks and finds a later valid one', () => {
    const html =
      '<script type="application/ld+json">{ not valid </script>' +
      '<script type="application/ld+json">' +
      JSON.stringify({ '@type': 'Product', name: 'Valid', offers: { price: 5 } }) +
      '</script>';
    expect(extractFromJsonLd(html)?.title).toBe('Valid');
  });

  it('returns null when JSON-LD is present but has no Product type', () => {
    const html = withJsonLd({ '@type': 'Organization', name: 'Acme' });
    expect(extractFromJsonLd(html)).toBeNull();
  });

  it('parses prices with thousands separators', () => {
    const html = withJsonLd({ '@type': 'Product', name: 'X', offers: { price: '1,299.00', priceCurrency: 'USD' } });
    expect(extractFromJsonLd(html)?.price).toBe(1299);
  });
});
