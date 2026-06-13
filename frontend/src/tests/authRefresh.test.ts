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

  it('storeTokens guarda en memoria, getStoredAccessToken lo lee', async () => {
    const authRefresh = await import('@/shell/services/authRefresh');

    authRefresh.storeTokens('access-1');
    expect(authRefresh.getStoredAccessToken()).toBe('access-1');

    authRefresh.storeTokens('access-2');
    expect(authRefresh.getStoredAccessToken()).toBe('access-2');

    authRefresh.clearStoredTokens();
    expect(authRefresh.getStoredAccessToken()).toBeNull();
  });

  it('storeTokens nunca escribe en localStorage', async () => {
    const authRefresh = await import('@/shell/services/authRefresh');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    authRefresh.storeTokens('access-1');

    expect(setItemSpy).not.toHaveBeenCalledWith(authRefresh.TOKEN_STORAGE_KEYS.accessToken, expect.anything());
    expect(setItemSpy).not.toHaveBeenCalledWith(authRefresh.TOKEN_STORAGE_KEYS.refreshToken, expect.anything());
  });

  it('refreshAccessToken llama fetch con credentials include', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);
    const authRefresh = await import('@/shell/services/authRefresh');

    const token = await authRefresh.refreshAccessToken();

    expect(token).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/refresh',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      })
    );
  });

  it('refreshAccessToken guarda access token en memoria tras éxito', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: 'access-nuevo' }),
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);
    const authRefresh = await import('@/shell/services/authRefresh');

    const token = await authRefresh.refreshAccessToken();

    expect(token).toBe('access-nuevo');
    expect(authRefresh.getStoredAccessToken()).toBe('access-nuevo');
    // No debe escribir en localStorage
    expect(localStorage.getItem(authRefresh.TOKEN_STORAGE_KEYS.accessToken)).toBeNull();
  });

  it('refreshAccessToken evita llamadas duplicadas concurrentes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: 'access-nuevo' }),
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
  });
});
