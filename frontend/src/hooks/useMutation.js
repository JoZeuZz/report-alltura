import { useState, useCallback } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

/**
 * Custom hook para manejar peticiones mutables (POST, PUT, DELETE) a la API
 * @param {string} url - URL base del endpoint de la API
 * @param {object} options - Opciones adicionales para la petición
 * @returns {object} { mutate, loading, error }
 */
const useMutation = (url, options = {}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const mutate = useCallback(async (method, data = null, id = null) => {
    try {
      setLoading(true);
      setError(null);

      const endpoint = id ? `${url}/${id}` : url;
      let response;

      switch (method.toLowerCase()) {
        case 'post':
          response = await api.post(endpoint, data, options);
          break;
        case 'put':
          response = await api.put(endpoint, data, options);
          break;
        case 'delete':
          response = await api.delete(endpoint, options);
          break;
        default:
          throw new Error(`Método HTTP no soportado: ${method}`);
      }

      return response.data;
    } catch (err) {
      setError(err);
      console.error(`Error en operación ${method} en ${url}:`, err);
      toast.error(err.response?.data?.message || 'Error al procesar la operación.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [url, options]);

  const create = useCallback((data) => mutate('post', data), [mutate]);
  const update = useCallback((id, data) => mutate('put', data, id), [mutate]);
  const remove = useCallback((id) => mutate('delete', null, id), [mutate]);

  return {
    create,
    update,
    remove,
    loading,
    error
  };
};

export default useMutation;