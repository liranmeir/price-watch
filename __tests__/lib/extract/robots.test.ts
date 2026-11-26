import { describe, expect, it } from 'vitest';
import { isPathAllowed, isUrlAllowedByRobots, parseRobotsTxt } from '@/lib/extract/robots';

const ROBOTS_TXT = `
User-agent: *
Disallow: /private/
Allow: /private/public-page
Disallow: /search

User-agent: BadBot
Disallow: /
`;

describe('parseRobotsTxt + isPathAllowed', () => {
  it('disallows a path under a blanket Disallow', () => {
    const rules = parseRobotsTxt(ROBOTS_TXT, '*');
    expect(isPathAllowed(rules, '/private/secret')).toBe(false);
  });

  it('allows a more specific Allow to override a shorter Disallow', () => {
    const rules = parseRobotsTxt(ROBOTS_TXT, '*');
    expect(isPathAllowed(rules, '/private/public-page')).toBe(true);
  });

  it('allows unrelated paths by default', () => {
    const rules = parseRobotsTxt(ROBOTS_TXT, '*');
    expect(isPathAllowed(rules, '/product/123')).toBe(true);
  });
});

describe('isUrlAllowedByRobots', () => {
  it('returns true when robots.txt is a 404 (most sites)', async () => {
    const fetchImpl = (async () => new Response('', { status: 404 })) as typeof fetch;
    expect(await isUrlAllowedByRobots('https://example.com/product/1', 'test-agent', fetchImpl)).toBe(true);
  });

  it('returns false when the path is disallowed', async () => {
    const fetchImpl = (async () => new Response(ROBOTS_TXT, { status: 200 })) as typeof fetch;
    expect(await isUrlAllowedByRobots('https://example.com/search?q=x', 'test-agent', fetchImpl)).toBe(false);
  });

  it('returns true when the path is allowed', async () => {
    const fetchImpl = (async () => new Response(ROBOTS_TXT, { status: 200 })) as typeof fetch;
    expect(await isUrlAllowedByRobots('https://example.com/product/1', 'test-agent', fetchImpl)).toBe(true);
  });

  it('fails closed (false) when robots.txt cannot be fetched at all', async () => {
    const fetchImpl = (async () => {
      throw new Error('network down');
    }) as typeof fetch;
    expect(await isUrlAllowedByRobots('https://example.com/product/1', 'test-agent', fetchImpl)).toBe(false);
  });

  it('fails closed (false) on a non-404 error status', async () => {
    const fetchImpl = (async () => new Response('', { status: 500 })) as typeof fetch;
    expect(await isUrlAllowedByRobots('https://example.com/product/1', 'test-agent', fetchImpl)).toBe(false);
  });
});
