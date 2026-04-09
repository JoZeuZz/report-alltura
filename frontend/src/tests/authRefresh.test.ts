import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('authRefresh service', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('storeTokens y clearStoredTokens mantienen el contrato de storage', async () => {
    const authRefresh = await import('@/shell/services/authRefresh');

    authRefresh.storeTokens('access-1', 'refresh-1');
    expect(localStorage.getItem(authRefresh.TOKEN_STORAGE_KEYS.accessToken)).toBe('access-1');
    expect(localStorage.getItem(authRefresh.TOKEN_STORAGE_KEYS.refreshToken)).toBe('refresh-1');

    authRefresh.storeTokens('access-2');
    expect(localStorage.getItem(authRefresh.TOKEN_STORAGE_KEYS.accessToken)).toBe('access-2');
    expect(localStorage.getItem(authRefresh.TOKEN_STORAGE_KEYS.refreshToken)).toBe('refresh-1');

    authRefresh.clearStoredTokens();
    expect(localStorage.getItem(authRefresh.TOKEN_STORAGE_KEYS.accessToken)).toBeNull();
    expect(localStorage.getItem(authRefresh.TOKEN_STORAGE_KEYS.refreshToken)).toBeNull();
  });

  it('refreshAccessToken retorna null cuando no hay refresh token', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const authRefresh = await import('@/shell/services/authRefresh');

    const token = await authRefresh.refreshAccessToken();

    expect(token).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshAccessToken evita llamadas duplicadas concurrentes', async () => {
    localStorage.setItem('refreshToken', 'refresh-inicial');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: 'access-nuevo', refreshToken: 'refresh-nuevo' }),
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);
    const authRefresh = await import('@/shell/services/authRefresh');

    const [first, second] = await Promise.all([
      authRefresh.refreshAccessToken(),
      authRefresh.refreshAccessToken(),
    ]);

    expect(first).toBe('access-nuevo');
    expect(second).toBe('access-nuevo');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/refresh',
      expect.objectContaining({
        method: 'POST',
      })
    );
    expect(localStorage.getItem(authRefresh.TOKEN_STORAGE_KEYS.accessToken)).toBe('access-nuevo');
    expect(localStorage.getItem(authRefresh.TOKEN_STORAGE_KEYS.refreshToken)).toBe('refresh-nuevo');
  });
});
