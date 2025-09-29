import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import Spinner from '../components/Spinner';

const ClientFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [name, setName] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEditing = Boolean(id);

  useEffect(() => {
    if (isEditing) {
      const fetchClient = async () => {
        setLoading(true);
        try {
          const { data } = await api.get(`/clients/${id}`);
          setName(data.name);
          setContactInfo(data.contact_info);
        } catch (error) {
          console.error('Failed to fetch client', error);
          toast.error('Error al cargar el cliente.');
        } finally {
          setLoading(false);
        }
      };
      fetchClient();
    }
  }, [id, isEditing]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const clientData = { name, contact_info: contactInfo };
    setSaving(true);
    try {
      if (isEditing) {
        await api.put(`/clients/${id}`, clientData);
        toast.success('Cliente actualizado con éxito.');
      } else {
        await api.post('/clients', clientData);
        toast.success('Cliente creado con éxito.');
      }
      navigate('/admin/clients');
    } catch (error) {
      console.error('Failed to save client', error);
      toast.error('Error al guardar el cliente.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-10"><Spinner /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold text-dark-blue mb-8">{isEditing ? 'Editar Cliente' : 'Nuevo Cliente'}</h1>
      
      <div className="bg-white p-8 rounded-lg shadow-md">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-neutral-gray">
              Nombre del Cliente
            </label>
            <div className="mt-1">
              <input
                type="text"
                id="name"
                value={name}
                onChange={e => setName(e.target.value)}
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-blue focus:border-primary-blue sm:text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="contactInfo" className="block text-sm font-medium text-neutral-gray">
              Información de Contacto
            </label>
            <div className="mt-1">
              <textarea
                id="contactInfo"
                value={contactInfo}
                onChange={e => setContactInfo(e.target.value)}
                rows={4}
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-blue focus:border-primary-blue sm:text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-4 pt-4">
            <button 
              type="button" 
              onClick={() => navigate('/admin/clients')} 
              className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-blue"
              disabled={saving}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-blue hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-blue disabled:opacity-50"
              disabled={saving}
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClientFormPage;