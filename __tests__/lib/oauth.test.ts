/**
 * @vitest-environment node
 *
 * These exercise Node's crypto directly, so they run in the node environment
 * rather than the project-wide jsdom default — under a production build Vite
 * externalizes `crypto` for the browser and the suite cannot load.
 */
import { describe, it, expect } from 'vitest';
import { createHash, randomBytes } from 'crypto';
import {
  buildRedirect,
  generateSecret,
  hashSecret,
  safeEqual,
  validateRedirectUri,
  verifyPkce,
} from '@/lib/oauth';

const s256 = (verifier: string) =>
  createHash('sha256').update(verifier).digest('base64url');

describe('lib/oauth', () => {
  describe('verifyPkce', () => {
    const verifier = randomBytes(32).toString('base64url'); // 43 chars

    it('accepts a correct S256 verifier', () => {
      expect(verifyPkce(verifier, s256(verifier), 'S256')).toBe(true);
    });

    it('rejects a wrong verifier', () => {
      expect(verifyPkce(verifier, s256('something-else-entirely'), 'S256')).toBe(false);
    });

    it('rejects the plain method even when the value matches', () => {
      // The downgrade this guards against: with `plain`, anyone who sees the
      // authorization request also holds the verifier.
      expect(verifyPkce('challenge-value', 'challenge-value', 'plain')).toBe(false);
    });

    it('rejects an unknown method', () => {
      expect(verifyPkce(verifier, s256(verifier), 'S512')).toBe(false);
      expect(verifyPkce(verifier, s256(verifier), '')).toBe(false);
    });

    it('rejects verifiers outside the RFC 7636 length bounds', () => {
      const short = 'a'.repeat(42);
      const long = 'a'.repeat(129);
      expect(verifyPkce(short, s256(short), 'S256')).toBe(false);
      expect(verifyPkce(long, s256(long), 'S256')).toBe(false);
    });
  });

  describe('validateRedirectUri', () => {
    it('accepts https', () => {
      expect(validateRedirectUri('https://claude.ai/api/mcp/auth_callback')).toBeNull();
    });

    it('accepts http only on loopback, for native clients', () => {
      expect(validateRedirectUri('http://localhost:4000/callback')).toBeNull();
      expect(validateRedirectUri('http://127.0.0.1:4000/callback')).toBeNull();
    });

    it('rejects plain http on a public host', () => {
      expect(validateRedirectUri('http://evil.example.com/cb')).toMatch(/must use https/);
    });

    it('rejects script and data URIs', () => {
      expect(validateRedirectUri('javascript:alert(1)')).toMatch(/must use https/);
      expect(validateRedirectUri('data:text/html,<script>')).toMatch(/must use https/);
    });

    it('rejects a fragment', () => {
      expect(validateRedirectUri('https://example.com/cb#frag')).toMatch(/fragment/);
    });

    it('rejects a non-absolute URI', () => {
      expect(validateRedirectUri('/relative/callback')).toMatch(/not an absolute URI/);
    });
  });

  describe('buildRedirect', () => {
    it('encodes parameters rather than concatenating them', () => {
      // A crafted state must not be able to inject its own query parameters.
      const url = buildRedirect('https://client.example/cb', {
        code: 'abc123',
        state: 'x&code=attacker-code',
      });
      const parsed = new URL(url);
      expect(parsed.searchParams.get('code')).toBe('abc123');
      expect(parsed.searchParams.get('state')).toBe('x&code=attacker-code');
      expect(parsed.searchParams.getAll('code')).toHaveLength(1);
    });

    it('preserves a query string the client registered', () => {
      const url = buildRedirect('https://client.example/cb?tenant=acme', { code: 'abc' });
      const parsed = new URL(url);
      expect(parsed.searchParams.get('tenant')).toBe('acme');
      expect(parsed.searchParams.get('code')).toBe('abc');
    });

    it('omits undefined parameters', () => {
      const url = buildRedirect('https://client.example/cb', { code: 'abc', state: undefined });
      expect(new URL(url).searchParams.has('state')).toBe(false);
    });
  });

  describe('hashSecret / safeEqual', () => {
    it('hashes deterministically and does not return the input', () => {
      const token = generateSecret();
      expect(hashSecret(token)).toBe(hashSecret(token));
      expect(hashSecret(token)).not.toBe(token);
      expect(hashSecret(token)).toHaveLength(64);
    });

    it('produces different hashes for different secrets', () => {
      expect(hashSecret('a')).not.toBe(hashSecret('b'));
    });

    it('compares equal and unequal values correctly', () => {
      expect(safeEqual('abc', 'abc')).toBe(true);
      expect(safeEqual('abc', 'abd')).toBe(false);
      expect(safeEqual('abc', 'abcd')).toBe(false);
      expect(safeEqual('', '')).toBe(true);
    });
  });

  describe('generateSecret', () => {
    it('returns distinct, URL-safe values', () => {
      const values = new Set(Array.from({ length: 50 }, () => generateSecret()));
      expect(values.size).toBe(50);
      for (const value of values) expect(value).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });
});
