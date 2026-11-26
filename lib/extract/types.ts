/** Outcome of trying to extract product info from a URL. */
export type ExtractionStatus = 'ok' | 'error';

export interface ProductInfo {
  title: string | null;
  price: number | null;
  currency: string | null;
  imageUrl: string | null;
  inStock: boolean | null;
  /** Which strategy produced this result, for debugging/trust level. */
  source: 'json-ld' | 'open-graph' | 'none';
}

export interface ExtractionResult {
  status: ExtractionStatus;
  info: ProductInfo | null;
  error: string | null;
}

export const EMPTY_PRODUCT_INFO: ProductInfo = {
  title: null,
  price: null,
  currency: null,
  imageUrl: null,
  inStock: null,
  source: 'none',
};
