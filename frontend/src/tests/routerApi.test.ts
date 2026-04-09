import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  putMock: vi.fn(),
  patchMock: vi.fn(),
  delMock: vi.fn(),
  uploadWithProgressMock: vi.fn(),
}));

vi.mock('@/shell/services/apiService', () => ({
  get: apiMocks.getMock,
  post: apiMocks.postMock,
  put: apiMocks.putMock,
  patch: apiMocks.patchMock,
  del: apiMocks.delMock,
  uploadWithProgress: apiMocks.uploadWithProgressMock,
}));

import { normalizeRouterApiError, requestRouterApi } from '@/router/routerApi';

describe('routerApi helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('usa GET por defecto', async () => {
    apiMocks.getMock.mockResolvedValue({ ok: true });

    const result = await requestRouterApi('/dashboard/summary');

    expect(apiMocks.getMock).toHaveBeenCalledWith('/dashboard/summary');
    expect(result).toEqual({ ok: true });
  });

  it('parsea body JSON y delega en POST', async () => {
    apiMocks.postMock.mockResolvedValue({ id: 123 });

    const result = await requestRouterApi('/clients', {
      method: 'POST',
      body: JSON.stringify({ name: 'ACME' }),
    });

    expect(apiMocks.postMock).toHaveBeenCalledWith('/clients', { name: 'ACME' });
    expect(result).toEqual({ id: 123 });
  });

  it('usa uploadWithProgress para FormData', async () => {
    const formData = new FormData();
    formData.append('assembly_image', new Blob(['file-content']), 'scaffold.jpg');
    apiMocks.uploadWithProgressMock.mockResolvedValue({ success: true });

    const result = await requestRouterApi('/scaffolds', {
      method: 'POST',
      body: formData,
    });

    expect(apiMocks.uploadWithProgressMock).toHaveBeenCalledWith('post', '/scaffolds', formData);
    expect(result).toEqual({ success: true });
  });

  it('normaliza 401 a mensaje estandar y conserva validationErrors', async () => {
    apiMocks.getMock.mockRejectedValue({
      response: {
        status: 401,
        data: {
          message: 'Token expirado',
          errors: [{ field: 'email', message: 'Email requerido' }],
        },
      },
    });

    await expect(requestRouterApi('/clients')).rejects.toMatchObject({
      message: 'No autorizado',
      validationErrors: [{ field: 'email', message: 'Email requerido' }],
    });
  });

  it('normaliza errores sin response preservando message', () => {
    const error = normalizeRouterApiError(new Error('Network down'));

    expect(error.message).toBe('Network down');
    expect(error.validationErrors).toEqual([]);
  });
});
