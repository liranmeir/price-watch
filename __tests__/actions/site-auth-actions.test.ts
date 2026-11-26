import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCookieStore = {
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => mockCookieStore),
}));

vi.mock('@/lib/site-auth', () => ({
  AUTH_COOKIE_NAME: 'price_watch_auth',
  AUTH_COOKIE_MAX_AGE: 2592000,
  isCorrectPassword: vi.fn(),
  expectedAuthToken: vi.fn(),
}));

import { isCorrectPassword, expectedAuthToken } from '@/lib/site-auth';
import { login, logout } from '@/app/actions/site-auth-actions';

const mockedIsCorrectPassword = vi.mocked(isCorrectPassword);
const mockedExpectedAuthToken = vi.mocked(expectedAuthToken);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('login', () => {
  it('rejects a wrong password without setting a cookie', async () => {
    mockedIsCorrectPassword.mockResolvedValue(false);

    const result = await login('wrong');

    expect(result).toEqual({ success: false, error: 'Incorrect password' });
    expect(mockCookieStore.set).not.toHaveBeenCalled();
  });

  it('sets the signed cookie on a correct password', async () => {
    mockedIsCorrectPassword.mockResolvedValue(true);
    mockedExpectedAuthToken.mockResolvedValue('deadbeef');

    const result = await login('correct-horse');

    expect(result).toEqual({ success: true });
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      'price_watch_auth',
      'deadbeef',
      expect.objectContaining({ httpOnly: true, path: '/' }),
    );
  });

  it('fails closed if SITE_PASSWORD became unset between the two checks', async () => {
    mockedIsCorrectPassword.mockResolvedValue(true);
    mockedExpectedAuthToken.mockResolvedValue(null);

    const result = await login('correct-horse');

    expect(result.success).toBe(false);
    expect(mockCookieStore.set).not.toHaveBeenCalled();
  });
});

describe('logout', () => {
  it('deletes the auth cookie', async () => {
    await logout();
    expect(mockCookieStore.delete).toHaveBeenCalledWith('price_watch_auth');
  });
});
