import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import ProjectForm from '../../components/ProjectForm';
import Modal from '../../components/Modal';
import AssignTechniciansForm from '../../components/AssignTechniciansForm';
import ConfirmationModal from '../../components/ConfirmationModal';

const ProjectsPage = () => {
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [projectToAssign, setProjectToAssign] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Hacemos ambas peticiones en paralelo para optimizar la carga
      const [projectsResponse, clientsResponse] = await Promise.all([
        api.get('/projects'),
        api.get('/clients'),
      ]);
      setProjects(projectsResponse.data);
      setClients(clientsResponse.data);
      setError('');
    } catch (err) {
      setError('Error al cargar los datos. Por favor, intente de nuevo.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (project = null) => {
    setSelectedProject(project);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedProject(null);
  };

  const handleOpenAssignModal = (project) => {
    setProjectToAssign(project);
    setIsAssignModalOpen(true);
  };

  const handleCloseAssignModal = () => {
    setIsAssignModalOpen(false);
    setProjectToAssign(null);
  };

  const handleSubmit = async (projectData) => {
    try {
      if (selectedProject) {
        await api.put(`/projects/${selectedProject.id}`, projectData);
      } else {
        await api.post('/projects', projectData);
      }
      fetchData();
      handleCloseModal();
    } catch (err) {
      setError('Error al guardar el proyecto.');
      console.error(err);
    }
  };

  const handleAssignSubmit = async ({ projectId, userIds }) => {
    try {
      await api.post(`/projects/${projectId}/users`, { userIds });
      handleCloseAssignModal();
    } catch (err) {
      setError('Error al asignar los técnicos.');
      console.error(err);
    }
  };

  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);

  const handleDeleteClick = (projectId) => {
    setProjectToDelete(projectId);
    setIsConfirmDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!projectToDelete) return;
    
    try {
      await api.delete(`/projects/${projectToDelete}`);
      fetchData();
    } catch (err) {
      setError('Error al eliminar el proyecto.');
      console.error(err);
    }
    setProjectToDelete(null);
  };

  if (loading) {
    return <p>Cargando proyectos...</p>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-dark-blue">Gestión de Proyectos</h1>
        <button
          onClick={() => handleOpenModal()}
          className="bg-primary-blue text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Añadir Proyecto
        </button>
      </div>

      {error && <p className="text-red-500 bg-red-100 p-3 rounded-lg mb-4">{error}</p>}

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full leading-normal">
          <thead>
            <tr>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Nombre del Proyecto</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Cliente</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Estado</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id}>
                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                  <p className="text-gray-900 whitespace-no-wrap">{project.name}</p>
                </td>
                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                  <p className="text-gray-900 whitespace-no-wrap">{project.client_name}</p>
                </td>
                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${project.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {project.status === 'active' ? 'Activo' : 'Completado'}
                  </span>
                </td>
                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm whitespace-nowrap">
                  <button onClick={() => handleOpenAssignModal(project)} className="text-green-600 hover:text-green-900 mr-4">
                    Asignar
                  </button>
                  <button onClick={() => handleOpenModal(project)} className="text-indigo-600 hover:text-indigo-900 mr-4">Editar</button>
                  <button onClick={() => handleDeleteClick(project.id)} className="text-red-600 hover:text-red-900">Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal}>
        <h2 className="text-2xl font-bold mb-4">{selectedProject ? 'Editar Proyecto' : 'Nuevo Proyecto'}</h2>
        <ProjectForm
          project={selectedProject}
          clients={clients}
          onSubmit={handleSubmit}
          onCancel={handleCloseModal}
        />
      </Modal>

      <Modal isOpen={isAssignModalOpen} onClose={handleCloseAssignModal}>
        <h2 className="text-2xl font-bold mb-4">Asignar Técnicos</h2>
        <AssignTechniciansForm
          project={projectToAssign}
          onSubmit={handleAssignSubmit}
          onCancel={handleCloseAssignModal}
        />
      </Modal>

      <ConfirmationModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Eliminar Proyecto"
        message="¿Está seguro de que desea eliminar este proyecto? Esta acción no se puede deshacer."
      />
    </div>
  );
};

export default ProjectsPage;