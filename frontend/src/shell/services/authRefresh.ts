type RefreshResponse = {
  accessToken?: string;
};

// Migración: eliminar tokens viejos de localStorage de sesiones anteriores
const LEGACY_KEYS = ['accessToken', 'refreshToken'] as const;
LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));

let inMemoryAccessToken: string | null = null;

export const TOKEN_STORAGE_KEYS = {
  accessToken: 'accessToken',
  refreshToken: 'refreshToken',
} as const;

export const getStoredAccessToken = (): string | null => inMemoryAccessToken;

export const storeTokens = (accessToken?: string) => {
  if (accessToken) {
    inMemoryAccessToken = accessToken;
  }
};

export const clearStoredTokens = () => {
  inMemoryAccessToken = null;
};

let refreshPromise: Promise<string | null> | null = null;

const runRefresh = async (): Promise<string | null> => {
  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as RefreshResponse;
    if (!data?.accessToken) {
      return null;
    }

    storeTokens(data.accessToken);
    return data.accessToken;
  } catch (_error) {
    return null;
  }
};

export const refreshAccessToken = async (): Promise<string | null> => {
  if (!refreshPromise) {
    refreshPromise = runRefresh().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
};
