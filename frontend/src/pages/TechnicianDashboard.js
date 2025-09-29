
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/Spinner';

const TechnicianDashboard = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchProjects = async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/projects');
        const activeProjects = data.filter(p => p.status === 'active');
        setProjects(activeProjects);
      } catch (error) {
        console.error('Failed to fetch projects', error);
        toast.error('Error al cargar los proyectos asignados.');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchProjects();
    }
  }, [user]);

  return (
    <div>
      <h1 className="text-3xl font-bold text-dark-blue mb-6">Mis Proyectos Activos</h1>
      
      {loading ? (
        <div className="flex h-full w-full items-center justify-center p-10"><Spinner /></div>
      ) : projects.length > 0 ? (
        <div className="flex flex-col gap-4">
          {projects.map(project => (
            <div key={project.id} className="bg-white p-6 rounded-lg shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between">
              <div className="mb-4 sm:mb-0">
                <h2 className="text-xl font-bold text-dark-blue">{project.name}</h2>
                <p className="text-sm text-neutral-gray">Cliente: {project.client_name || 'N/A'}</p>
              </div>
              <div className="flex items-center gap-4">
                <Link 
                  to={`/admin/reports?projectId=${project.id}`}
                  className="text-sm font-medium text-primary-blue hover:text-opacity-80"
                >
                  Ver Reportes
                </Link>
                <Link 
                  to={`/tech/project/${project.id}/report`} 
                  className="px-4 py-2 bg-primary-blue text-white text-sm font-medium rounded-md hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-blue"
                >
                  Nuevo Reporte
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-10 bg-white rounded-lg shadow-md">
          <p className="text-neutral-gray">No tienes proyectos activos asignados.</p>
        </div>
      )}
    </div>
  );
};

export default TechnicianDashboard;
