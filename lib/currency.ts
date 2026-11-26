/** Formats a price for display, falling back gracefully when data is missing. */
export function formatPrice(price: number | null | undefined, currency: string | null | undefined): string {
  if (price === null || price === undefined) return '—';
  const safeCurrency = currency && /^[A-Z]{3}$/.test(currency) ? currency : 'USD';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: safeCurrency }).format(price);
  } catch {
    return `${price.toFixed(2)} ${safeCurrency}`;
  }
}

/** Derives a human-readable store name from a URL's hostname, e.g. "www.nike.com" -> "Nike". */
export function storeNameFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    const label = hostname.split('.').slice(0, -1).join('.') || hostname;
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return 'Unknown store';
  }
}
