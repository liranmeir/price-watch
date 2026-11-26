import { describe, expect, it } from 'vitest';
import { formatPrice, formatTargetPrice, storeNameFromUrl } from '@/lib/currency';

describe('formatPrice', () => {
  it('formats a USD price', () => {
    expect(formatPrice(499.99, 'USD')).toBe('$499.99');
  });

  it('falls back to USD for a missing/invalid currency code', () => {
    expect(formatPrice(10, null)).toBe('$10.00');
    expect(formatPrice(10, 'not-a-code')).toBe('$10.00');
  });

  it('renders an em dash for a missing price', () => {
    expect(formatPrice(null, 'USD')).toBe('—');
    expect(formatPrice(undefined, 'USD')).toBe('—');
  });
});

describe('formatTargetPrice', () => {
  it('formats with the given currency when it is a valid 3-letter code', () => {
    expect(formatTargetPrice(150, 'ILS')).toBe('₪150.00');
    expect(formatTargetPrice(150, 'USD')).toBe('$150.00');
  });

  it('renders a bare number (no currency symbol) when the currency is unknown, rather than guessing USD', () => {
    expect(formatTargetPrice(150, null)).toBe('150.00');
    expect(formatTargetPrice(150, undefined)).toBe('150.00');
    expect(formatTargetPrice(150, 'not-a-code')).toBe('150.00');
  });

  it('renders an em dash for a missing price regardless of currency', () => {
    expect(formatTargetPrice(null, 'USD')).toBe('—');
    expect(formatTargetPrice(undefined, null)).toBe('—');
  });
});

describe('storeNameFromUrl', () => {
  it('strips www and the TLD, and capitalizes the result', () => {
    expect(storeNameFromUrl('https://www.nike.com/t/abc')).toBe('Nike');
  });

  it('keeps multi-part domains before the TLD', () => {
    expect(storeNameFromUrl('https://shop.example.co.uk/p/1')).toBe('Shop.example.co');
  });

  it('returns a fallback label for an invalid URL', () => {
    expect(storeNameFromUrl('not a url')).toBe('Unknown store');
  });
});
