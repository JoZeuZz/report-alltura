import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import Spinner from '../components/Spinner';

const ProjectFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [status, setStatus] = useState('active');
  const [clients, setClients] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [assignedTechnicians, setAssignedTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isEditing = Boolean(id);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const clientsPromise = api.get('/clients');
        const techniciansPromise = api.get('/users?role=technician');
        
        const promises = [clientsPromise, techniciansPromise];

        if (isEditing) {
          promises.push(api.get(`/projects/${id}`));
          promises.push(api.get(`/projects/${id}/users`));
        }

        const [clientsRes, techniciansRes, projectRes, assignedUsersRes] = await Promise.all(promises);

        setClients(clientsRes.data);
        setTechnicians(techniciansRes.data);

        if (isEditing) {
          const projectData = projectRes.data;
          setName(projectData.name);
          setClientId(projectData.client_id);
          setStatus(projectData.status);
          setAssignedTechnicians(assignedUsersRes.data);
        }

      } catch (error) {
        console.error('Failed to fetch project form data', error);
        toast.error('Error al cargar los datos del formulario.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, isEditing]);

  const handleTechnicianToggle = (technicianId) => {
    setAssignedTechnicians(prev => 
      prev.includes(technicianId) 
        ? prev.filter(id => id !== technicianId) 
        : [...prev, technicianId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const projectData = { name, client_id: parseInt(clientId), status };
    setSaving(true);

    try {
      let projectResponse;
      if (isEditing) {
        projectResponse = await api.put(`/projects/${id}`, projectData);
        toast.success('Proyecto actualizado con éxito.');
      } else {
        projectResponse = await api.post('/projects', projectData);
        toast.success('Proyecto creado con éxito.');
      }
      
      const projectId = projectResponse.data.id;
      await api.post(`/projects/${projectId}/users`, { userIds: assignedTechnicians });

      navigate('/admin/projects');
    } catch (error) {
      console.error('Failed to save project', error);
      toast.error('Error al guardar el proyecto.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-10"><Spinner /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold text-dark-blue mb-8">{isEditing ? 'Editar Proyecto' : 'Nuevo Proyecto'}</h1>
      
      <div className="bg-white p-8 rounded-lg shadow-md">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Project Details Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-neutral-gray">Nombre del Proyecto</label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={e => setName(e.target.value)}
                className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-blue focus:border-primary-blue sm:text-sm"
                required
              />
            </div>

            <div>
              <label htmlFor="client" className="block text-sm font-medium text-neutral-gray">Cliente</label>
              <select
                id="client"
                value={clientId}
                onChange={e => setClientId(e.target.value)}
                className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-blue focus:border-primary-blue sm:text-sm"
                required
              >
                <option value="" disabled>Selecciona un cliente</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium text-neutral-gray">Estado</label>
              <select
                id="status"
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-blue focus:border-primary-blue sm:text-sm"
              >
                <option value="active">Activo</option>
                <option value="completed">Completado</option>
              </select>
            </div>
          </div>

          {/* Technician Assignment Section */}
          <div>
            <h3 className="text-lg font-medium text-dark-blue">Asignar Técnicos</h3>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 border-t pt-4">
              {technicians.length > 0 ? technicians.map(tech => (
                <div key={tech.id} className="flex items-center">
                  <input
                    id={`tech-${tech.id}`}
                    type="checkbox"
                    className="h-4 w-4 text-primary-blue border-gray-300 rounded focus:ring-primary-blue"
                    checked={assignedTechnicians.includes(tech.id)}
                    onChange={() => handleTechnicianToggle(tech.id)}
                  />
                  <label htmlFor={`tech-${tech.id}`} className="ml-3 block text-sm text-gray-700">
                    {tech.name}
                  </label>
                </div>
              )) : <p className="text-sm text-neutral-gray">No hay técnicos disponibles.</p>}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4 pt-4 border-t mt-8">
            <button 
              type="button" 
              onClick={() => navigate('/admin/projects')}
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
              {saving ? 'Guardando...' : 'Guardar Proyecto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProjectFormPage;
