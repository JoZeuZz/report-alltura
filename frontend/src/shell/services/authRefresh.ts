type RefreshResponse = {
  accessToken?: string;
  refreshToken?: string;
};

export const TOKEN_STORAGE_KEYS = {
  accessToken: 'accessToken',
  refreshToken: 'refreshToken',
} as const;

let refreshPromise: Promise<string | null> | null = null;

export const getStoredAccessToken = () =>
  localStorage.getItem(TOKEN_STORAGE_KEYS.accessToken);

export const getStoredRefreshToken = () =>
  localStorage.getItem(TOKEN_STORAGE_KEYS.refreshToken);

export const storeTokens = (accessToken?: string, refreshToken?: string) => {
  if (accessToken) {
    localStorage.setItem(TOKEN_STORAGE_KEYS.accessToken, accessToken);
  }

  if (refreshToken) {
    localStorage.setItem(TOKEN_STORAGE_KEYS.refreshToken, refreshToken);
  }
};

export const clearStoredTokens = () => {
  localStorage.removeItem(TOKEN_STORAGE_KEYS.accessToken);
  localStorage.removeItem(TOKEN_STORAGE_KEYS.refreshToken);
};

const runRefresh = async (): Promise<string | null> => {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    return null;
  }

  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as RefreshResponse;
    if (!data?.accessToken) {
      return null;
    }

    storeTokens(data.accessToken, data.refreshToken);
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
