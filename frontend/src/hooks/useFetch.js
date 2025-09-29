import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

/**
 * Custom hook para manejar peticiones a la API con estados de carga y error
 * @param {string} url - URL del endpoint de la API
 * @param {object} options - Opciones adicionales para la petición
 * @returns {object} { data, loading, error, refetch, setData }
 */
const useFetch = (url, options = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(url, options);
      setData(response.data);
    } catch (err) {
      setError(err);
      console.error(`Error fetching data from ${url}:`, err);
      toast.error(err.response?.data?.message || 'Error al cargar los datos.');
    } finally {
      setLoading(false);
    }
  }, [url, options]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch, setData };
};

export default useFetch;