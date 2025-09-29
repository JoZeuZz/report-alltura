import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import Spinner from '../components/Spinner';

const UserFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('technician');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEditing = Boolean(id);

  useEffect(() => {
    if (isEditing) {
      const fetchUser = async () => {
        setLoading(true);
        try {
          const { data } = await api.get(`/users/${id}`);
          setName(data.name);
          setEmail(data.email);
          setRole(data.role);
        } catch (error) {
          console.error('Failed to fetch user', error);
          toast.error('Error al cargar el usuario.');
        } finally {
          setLoading(false);
        }
      };
      fetchUser();
    }
  }, [id, isEditing]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const userData = { name, email, role, password };
    if (isEditing && !password) {
      delete userData.password;
    }

    setSaving(true);
    try {
      if (isEditing) {
        await api.put(`/users/${id}`, userData);
        toast.success('Usuario actualizado con éxito.');
      } else {
        await api.post('/users', userData);
        toast.success('Usuario creado con éxito.');
      }
      navigate('/admin/users');
    } catch (error) {
      console.error('Failed to save user', error);
      toast.error('Error al guardar el usuario.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-10"><Spinner /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold text-dark-blue mb-8">{isEditing ? 'Editar Usuario' : 'Nuevo Usuario'}</h1>
      
      <div className="bg-white p-8 rounded-lg shadow-md">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-neutral-gray">Nombre</label>
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
            <label htmlFor="email" className="block text-sm font-medium text-neutral-gray">Email</label>
            <div className="mt-1">
              <input
                type="email"
                id="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-blue focus:border-primary-blue sm:text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-neutral-gray">Rol</label>
            <div className="mt-1">
              <select
                id="role"
                value={role}
                onChange={e => setRole(e.target.value)}
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-blue focus:border-primary-blue sm:text-sm"
              >
                <option value="technician">Técnico</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-neutral-gray">Contraseña</label>
            <div className="mt-1">
              <input
                type="password"
                id="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-blue focus:border-primary-blue sm:text-sm"
                placeholder={isEditing ? 'Dejar en blanco para no cambiar' : ''}
                required={!isEditing}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-4 pt-4">
            <button 
              type="button" 
              onClick={() => navigate('/admin/users')} 
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

export default UserFormPage;