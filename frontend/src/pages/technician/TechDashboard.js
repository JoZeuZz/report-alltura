import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Link } from 'react-router-dom';

const TechDashboard = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        // La API /api/projects devuelve los proyectos asignados si el rol es 'technician'
        const response = await api.get('/projects');
        setProjects(response.data);
        setError('');
      } catch (err) {
        setError('Error al cargar los proyectos. Por favor, intente de nuevo.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  // Filter projects based on search term
  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <p className="text-center text-neutral-gray">Cargando mis proyectos...</p>;
  }

  if (error) {
    return <p className="text-red-500 bg-red-100 p-3 rounded-lg">{error}</p>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-dark-blue mb-6">Mis Proyectos Activos</h1>
      
      <div className="mb-6">
        <input
          type="text"
          placeholder="Buscar proyecto por nombre..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue"
        />
      </div>
      
      {filteredProjects.length === 0 ? (
        <p className="text-neutral-gray text-center py-8">
          {searchTerm
            ? 'No se encontraron proyectos que coincidan con tu búsqueda.'
            : 'No tienes proyectos asignados en este momento.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <Link to={`/tech/project/${project.id}`} key={project.id} className="block p-6 bg-white rounded-lg border border-gray-200 shadow-md hover:bg-gray-100 transition-colors">
              <h5 className="mb-2 text-2xl font-bold tracking-tight text-dark-blue">{project.name}</h5>
              <p className="font-normal text-neutral-gray mb-3">Cliente: {project.client_name}</p>
              <div className="flex items-center justify-between">
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${project.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                  {project.status === 'active' ? 'Activo' : 'Completado'}
                </span>
                <span className="text-primary-blue font-semibold">Ver detalles &rarr;</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default TechDashboard;