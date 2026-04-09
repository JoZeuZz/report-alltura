import { beforeEach, describe, expect, it, vi } from 'vitest';

type RequestConfig = {
  url?: string;
  headers?: Record<string, string>;
  _retry?: boolean;
};

const axiosState: {
  requestInterceptor: ((config: RequestConfig) => RequestConfig | Promise<RequestConfig>) | null;
  responseErrorInterceptor: ((error: unknown) => Promise<unknown>) | null;
} = {
  requestInterceptor: null,
  responseErrorInterceptor: null,
};

const axiosInstance = vi.fn();

Object.assign(axiosInstance, {
  interceptors: {
    request: {
      use: vi.fn((handler: (config: RequestConfig) => RequestConfig | Promise<RequestConfig>) => {
        axiosState.requestInterceptor = handler;
        return 0;
      }),
    },
    response: {
      use: vi.fn((_: unknown, errorHandler: (error: unknown) => Promise<unknown>) => {
        axiosState.responseErrorInterceptor = errorHandler;
        return 0;
      }),
    },
  },
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  request: vi.fn(),
});


const createMock = vi.fn(() => axiosInstance);

const refreshAccessTokenMock = vi.fn();
const clearStoredTokensMock = vi.fn();
const getStoredAccessTokenMock = vi.fn();

vi.mock('axios', () => ({
  default: {
    create: createMock,
  },
}));

vi.mock('@/shell/services/authRefresh', () => ({
  refreshAccessToken: refreshAccessTokenMock,
  clearStoredTokens: clearStoredTokensMock,
  getStoredAccessToken: getStoredAccessTokenMock,
}));

const loadApiService = async () => {
  vi.resetModules();

  axiosState.requestInterceptor = null;
  axiosState.responseErrorInterceptor = null;

  createMock.mockClear();
  axiosInstance.mockReset();
  refreshAccessTokenMock.mockReset();
  clearStoredTokensMock.mockReset();
  getStoredAccessTokenMock.mockReset();

  await import('@/shell/services/apiService');

  return {
    requestInterceptor: axiosState.requestInterceptor,
    responseErrorInterceptor: axiosState.responseErrorInterceptor,
  };
};

describe('apiService interceptors', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/login');
  });

  it('agrega Authorization al request cuando hay access token', async () => {
    const { requestInterceptor } = await loadApiService();
    getStoredAccessTokenMock.mockReturnValue('access-123');

    expect(requestInterceptor).not.toBeNull();
    const config = await requestInterceptor!({ headers: {} });

    expect(getStoredAccessTokenMock).toHaveBeenCalledTimes(1);
    expect(config.headers?.Authorization).toBe('Bearer access-123');
  });

  it('reintenta una vez en 401 si refresh retorna token', async () => {
    const { responseErrorInterceptor } = await loadApiService();
    refreshAccessTokenMock.mockResolvedValue('access-refresh');
    axiosInstance.mockResolvedValueOnce({ data: { ok: true } });

    expect(responseErrorInterceptor).not.toBeNull();
    const error = {
      response: { status: 401 },
      config: { url: '/projects', headers: {} },
    };

    const result = await responseErrorInterceptor!(error);

    expect(refreshAccessTokenMock).toHaveBeenCalledTimes(1);
    expect(axiosInstance).toHaveBeenCalledTimes(1);
    const retriedRequest = axiosInstance.mock.calls[0][0] as RequestConfig;
    expect(retriedRequest._retry).toBe(true);
    expect(retriedRequest.headers?.Authorization).toBe('Bearer access-refresh');
    expect(result).toEqual({ data: { ok: true } });
  });

  it('no reintenta si _retry ya estaba activo y limpia sesión', async () => {
    const { responseErrorInterceptor } = await loadApiService();

    expect(responseErrorInterceptor).not.toBeNull();
    const error = {
      response: { status: 401 },
      config: { url: '/projects', _retry: true, headers: {} },
    };

    await expect(responseErrorInterceptor!(error)).rejects.toBe(error);

    expect(refreshAccessTokenMock).not.toHaveBeenCalled();
    expect(clearStoredTokensMock).toHaveBeenCalledTimes(1);
    expect(axiosInstance).not.toHaveBeenCalled();
  });

  it('limpia sesión cuando refresh falla', async () => {
    const { responseErrorInterceptor } = await loadApiService();
    refreshAccessTokenMock.mockResolvedValue(null);

    expect(responseErrorInterceptor).not.toBeNull();
    const error = {
      response: { status: 401 },
      config: { url: '/projects', headers: {} },
    };

    await expect(responseErrorInterceptor!(error)).rejects.toBe(error);

    expect(refreshAccessTokenMock).toHaveBeenCalledTimes(1);
    expect(clearStoredTokensMock).toHaveBeenCalledTimes(1);
    expect(axiosInstance).not.toHaveBeenCalled();
  });
});