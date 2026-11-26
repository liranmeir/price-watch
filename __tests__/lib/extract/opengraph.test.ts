import { describe, expect, it } from 'vitest';
import { extractFromOpenGraph } from '@/lib/extract/opengraph';

describe('extractFromOpenGraph', () => {
  it('extracts title, image and price from standard product meta tags', () => {
    const html = `
      <html><head>
        <meta property="og:title" content="Dyson V10 Absolute" />
        <meta property="og:image" content="https://example.com/v10.jpg" />
        <meta property="product:price:amount" content="499.99" />
        <meta property="product:price:currency" content="USD" />
        <meta property="product:availability" content="instock" />
      </head></html>`;

    expect(extractFromOpenGraph(html)).toEqual({
      title: 'Dyson V10 Absolute',
      price: 499.99,
      currency: 'USD',
      imageUrl: 'https://example.com/v10.jpg',
      inStock: true,
      source: 'open-graph',
    });
  });

  it('handles content before property in the attribute order', () => {
    const html = `<meta content="Reversed Title" property="og:title" />`;
    expect(extractFromOpenGraph(html)?.title).toBe('Reversed Title');
  });

  it('handles name= instead of property=', () => {
    const html = `<meta name="og:title" content="Named Tag" />`;
    expect(extractFromOpenGraph(html)?.title).toBe('Named Tag');
  });

  it('decodes common HTML entities in content', () => {
    const html = `<meta property="og:title" content="Mom &amp; Dad&#39;s Shoes" />`;
    expect(extractFromOpenGraph(html)?.title).toBe("Mom & Dad's Shoes");
  });

  it('returns null when nothing usable is found', () => {
    expect(extractFromOpenGraph('<html><head></head></html>')).toBeNull();
  });

  it('still returns a result with just a title (no price)', () => {
    const html = `<meta property="og:title" content="Just a title" />`;
    const info = extractFromOpenGraph(html);
    expect(info?.title).toBe('Just a title');
    expect(info?.price).toBeNull();
  });

  it('treats unparseable price content as null rather than NaN', () => {
    const html = `
      <meta property="og:title" content="X" />
      <meta property="product:price:amount" content="Contact us" />`;
    expect(extractFromOpenGraph(html)?.price).toBeNull();
  });
});
