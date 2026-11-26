import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { expectedAuthToken, isCorrectPassword } from '@/lib/site-auth';

const ORIGINAL_SITE_PASSWORD = process.env.SITE_PASSWORD;

afterEach(() => {
  if (ORIGINAL_SITE_PASSWORD === undefined) {
    delete process.env.SITE_PASSWORD;
  } else {
    process.env.SITE_PASSWORD = ORIGINAL_SITE_PASSWORD;
  }
});

describe('isCorrectPassword', () => {
  it('returns true for the exact configured password', async () => {
    process.env.SITE_PASSWORD = 'correct-horse';
    expect(await isCorrectPassword('correct-horse')).toBe(true);
  });

  it('returns false for a wrong password', async () => {
    process.env.SITE_PASSWORD = 'correct-horse';
    expect(await isCorrectPassword('wrong')).toBe(false);
  });

  it('fails closed (false) when SITE_PASSWORD is unset, for any input', async () => {
    delete process.env.SITE_PASSWORD;
    expect(await isCorrectPassword('')).toBe(false);
    expect(await isCorrectPassword('anything')).toBe(false);
  });
});

describe('expectedAuthToken', () => {
  beforeEach(() => {
    process.env.SITE_PASSWORD = 'correct-horse';
  });

  it('returns a stable sha256 hex digest of the password', async () => {
    const token = await expectedAuthToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(await expectedAuthToken()).toBe(token); // deterministic
  });

  it('changes when the password changes', async () => {
    const first = await expectedAuthToken();
    process.env.SITE_PASSWORD = 'different-password';
    expect(await expectedAuthToken()).not.toBe(first);
  });

  it('returns null when SITE_PASSWORD is unset', async () => {
    delete process.env.SITE_PASSWORD;
    expect(await expectedAuthToken()).toBeNull();
  });

  it('never leaks the plaintext password into the token', async () => {
    const token = await expectedAuthToken();
    expect(token).not.toContain('correct-horse');
  });
});
