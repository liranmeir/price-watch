export interface FetchTextOptions {
  timeoutMs: number;
  maxRetries: number;
  userAgent: string;
  fetchImpl?: typeof fetch;
}

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly url: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function backoffDelay(attempt: number): number {
  const base = Math.min(500 * 2 ** attempt, 8_000);
  return base + Math.random() * 250;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches a URL as text with a timeout and retry/backoff on transient
 * failures (429, 5xx, network errors). Throws HttpError for non-retryable
 * HTTP errors and after exhausting retries on retryable ones.
 */
export async function fetchText(url: string, options: FetchTextOptions): Promise<string> {
  const doFetch = options.fetchImpl ?? fetch;
  let lastError: Error = new Error('fetchText: no attempts made');

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
      const response = await doFetch(url, {
        headers: {
          'User-Agent': options.userAgent,
          Accept: 'text/html,application/xhtml+xml',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        if (isRetryableStatus(response.status) && attempt < options.maxRetries) {
          await sleep(backoffDelay(attempt));
          continue;
        }
        throw new HttpError(`Request failed with status ${response.status}`, response.status, url);
      }

      return await response.text();
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof HttpError) throw error;

      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < options.maxRetries) {
        await sleep(backoffDelay(attempt));
        continue;
      }
    }
  }

  throw lastError;
}
