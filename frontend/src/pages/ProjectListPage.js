import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import Spinner from '../components/Spinner';

// ===== Assign Users Modal Component =====
const AssignUsersModal = ({ project, onClose }) => {
  const [technicians, setTechnicians] = useState([]);
  const [assignedUserIds, setAssignedUserIds] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch all technicians
        const techPromise = api.get('/users?role=technician');
        // Fetch users already assigned to this project
        const assignedPromise = api.get(`/projects/${project.id}/users`);
        
        const [techResponse, assignedResponse] = await Promise.all([techPromise, assignedPromise]);
        
        setTechnicians(techResponse.data);
        setAssignedUserIds(new Set(assignedResponse.data.map(u => u.user_id)));

      } catch (error) {
        console.error('Failed to fetch user data', error);
        toast.error('Error al cargar los datos de asignación.');
      } finally {
        setLoading(false);
      }
    };

    if (project) {
      fetchData();
    }
  }, [project]);

  const handleCheckboxChange = (userId) => {
    setAssignedUserIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    try {
      await api.post(`/projects/${project.id}/users`, { userIds: Array.from(assignedUserIds) });
      toast.success('Técnicos asignados con éxito.');
      onClose();
    } catch (error) {
      console.error('Failed to assign users', error);
      toast.error('Error al guardar la asignación.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <h3 className="text-2xl font-bold text-dark-blue mb-4">Asignar Técnicos a: {project.name}</h3>
          {loading ? <Spinner /> : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {technicians.map(tech => (
                <label key={tech.id} className="flex items-center p-2 rounded-md hover:bg-gray-100">
                  <input 
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-primary-blue focus:ring-primary-blue"
                    checked={assignedUserIds.has(tech.id)}
                    onChange={() => handleCheckboxChange(tech.id)}
                  />
                  <span className="ml-3 text-sm text-dark-blue">{tech.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-4 rounded-b-lg">
          <button onClick={onClose} className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSave} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-blue hover:bg-opacity-90">Guardar</button>
        </div>
      </div>
    </div>
  );
};

// ===== Main Project List Page Component =====
const ProjectListPage = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [assignModalProject, setAssignModalProject] = useState(null);

  useEffect(() => {
    const fetchProjects = async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/projects');
        setProjects(data);
      } catch (error) {
        console.error('Failed to fetch projects', error);
        toast.error('Error al cargar los proyectos.');
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este proyecto?')) {
      try {
        await api.delete(`/projects/${id}`);
        setProjects(projects.filter(p => p.id !== id));
        toast.success('Proyecto eliminado con éxito.');
      } catch (error) {
        console.error('Failed to delete project', error);
        toast.error('Error al eliminar el proyecto.');
      }
    }
  };

  const filteredProjects = useMemo(() => 
    projects.filter(project => 
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (project.client_name && project.client_name.toLowerCase().includes(searchTerm.toLowerCase()))
    ), [projects, searchTerm]);

  return (
    <div>
      {assignModalProject && <AssignUsersModal project={assignModalProject} onClose={() => setAssignModalProject(null)} />}

      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold text-dark-blue">Proyectos</h1>
        <Link 
          to="/admin/projects/new" 
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-blue hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-blue"
        >
          <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
          Nuevo Proyecto
        </Link>
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <input 
          type="text"
          placeholder="Buscar por nombre de proyecto o cliente..."
          className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-blue focus:border-primary-blue sm:text-sm"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Table Container */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-10"><Spinner /></div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-gray uppercase tracking-wider">Nombre del Proyecto</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-gray uppercase tracking-wider">Cliente</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-gray uppercase tracking-wider">Estado</th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProjects.length > 0 ? filteredProjects.map(project => (
                <tr key={project.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-dark-blue">{project.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-gray">{project.client_name || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusPill status={project.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                    <button onClick={() => setAssignModalProject(project)} className="text-gray-500 hover:text-primary-blue">
                      <UsersIcon className="h-5 w-5" />
                    </button>
                    <Link to={`/admin/projects/edit/${project.id}`} className="text-primary-blue hover:text-opacity-80">
                      <PencilIcon className="h-5 w-5" />
                    </Link>
                    <button onClick={() => handleDelete(project.id)} className="text-red-600 hover:text-red-800">
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="4" className="text-center py-10 text-neutral-gray">
                    {searchTerm ? 'No se encontraron resultados.' : 'No se encontraron proyectos.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

// ===== Sub-components and Icons =====
const StatusPill = ({ status }) => {
  const baseStyle = "px-2 inline-flex text-xs leading-5 font-semibold rounded-full";
  const styles = {
    active: `bg-green-100 text-green-800`,
    completed: `bg-gray-100 text-gray-800`,
  };
  return (
    <span className={`${baseStyle} ${styles[status] || styles.completed}`}>
      {status}
    </span>
  );
};

const PlusIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
);

const PencilIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 5.232z" />
    </svg>
);

const TrashIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
);

const UsersIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.124-1.28-.35-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.124-1.28.35-1.857m0 0a5.002 5.002 0 019.292 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

export default ProjectListPage;