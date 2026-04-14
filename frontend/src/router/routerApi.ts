import { del, get, patch, post, put, uploadWithProgress } from '@/shell/services/apiService';

type RouterMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type UploadMethod = 'post' | 'put' | 'patch';

export type ValidationErrorItem = {
  field: string;
  message: string;
};

export type RouterApiError = Error & {
  validationErrors: ValidationErrorItem[];
  statusCode?: number;
};

const toUploadMethod = (method: RouterMethod): UploadMethod => {
  if (method === 'POST') return 'post';
  if (method === 'PUT') return 'put';
  return 'patch';
};

const parseBody = (body: BodyInit | null | undefined) => {
  if (body == null) {
    return undefined;
  }

  if (typeof body !== 'string') {
    return body;
  }

  const trimmed = body.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return body;
  }
};

const sanitizeValidationErrors = (errors: unknown): ValidationErrorItem[] => {
  if (!Array.isArray(errors)) {
    return [];
  }

  return errors
    .filter((item): item is ValidationErrorItem => {
      if (typeof item !== 'object' || item === null) {
        return false;
      }

      const maybeError = item as Partial<ValidationErrorItem>;
      return typeof maybeError.field === 'string' && typeof maybeError.message === 'string';
    })
    .map((item) => ({
      field: item.field,
      message: item.message,
    }));
};

export const normalizeRouterApiError = (error: unknown): RouterApiError => {
  const fallbackMessage = 'Error del servidor';
  let statusCode: number | undefined;
  let message = fallbackMessage;
  let validationErrors: ValidationErrorItem[] = [];

  if (typeof error === 'object' && error !== null) {
    const maybeError = error as {
      message?: string;
      response?: {
        status?: number;
        data?: {
          message?: string;
          errors?: unknown;
        };
      };
    };

    statusCode = maybeError.response?.status;

    const errorData = maybeError.response?.data;
    validationErrors = sanitizeValidationErrors(errorData?.errors);

    if (validationErrors.length > 0) {
      message = errorData?.message || 'Error de validación';
    } else if (typeof errorData?.message === 'string' && errorData.message.trim().length > 0) {
      message = errorData.message;
    } else if (typeof maybeError.message === 'string' && maybeError.message.trim().length > 0) {
      message = maybeError.message;
    }
  }

  if (statusCode === 401) {
    message = 'No autorizado';
  } else if (statusCode === 404) {
    message = 'No encontrado';
  }

  const normalizedError = new Error(message) as RouterApiError;
  normalizedError.validationErrors = validationErrors;
  normalizedError.statusCode = statusCode;
  return normalizedError;
};

export const requestRouterApi = async <T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const method = (options.method || 'GET').toUpperCase() as RouterMethod;

  try {
    if (options.body instanceof FormData) {
      if (method !== 'POST' && method !== 'PUT' && method !== 'PATCH') {
        throw new Error(`Método ${method} no soportado para FormData`);
      }

      return await uploadWithProgress<T>(toUploadMethod(method), endpoint, options.body);
    }

    const payload = parseBody(options.body);

    switch (method) {
      case 'GET':
        return await get<T>(endpoint);
      case 'POST':
        return await post<T>(endpoint, payload);
      case 'PUT':
        return await put<T>(endpoint, payload);
      case 'PATCH':
        return await patch<T>(endpoint, payload);
      case 'DELETE':
        return await del<T>(endpoint);
      default:
        throw new Error(`Método no soportado: ${method}`);
    }
  } catch (error) {
    throw normalizeRouterApiError(error);
  }
};
