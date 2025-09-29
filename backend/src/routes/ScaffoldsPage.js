import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from '../../components/Modal';

const ScaffoldsPage = () => {
  const [projects, setProjects] = useState([]);
  const [scaffolds, setScaffolds] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedScaffold, setSelectedScaffold] = useState(null);

  // Fetch projects for the dropdown
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await api.get('/projects');
        setProjects(response.data);
      } catch (err) {
        setError('Error al cargar los proyectos.');
        console.error(err);
      }
    };
    fetchProjects();
  }, []);

  // Fetch scaffolds when a project is selected
  useEffect(() => {
    if (!selectedProjectId) {
      setScaffolds([]);
      return;
    }

    const fetchScaffolds = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await api.get(`/scaffolds/project/${selectedProjectId}`);
        setScaffolds(response.data);
      } catch (err) {
        setError('Error al cargar los andamios para este proyecto.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchScaffolds();
  }, [selectedProjectId]);

  const handleCloseModal = () => {
    setSelectedScaffold(null);
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-dark-blue mb-6">Visualizador de Andamios</h1>

      {/* Controls */}
      <div className="bg-white p-4 rounded-lg shadow-md mb-8">
        <label htmlFor="project-select" className="block text-sm font-medium text-neutral-gray">
          Seleccionar Proyecto
        </label>
        <select
          id="project-select"
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-blue focus:border-primary-blue sm:text-sm rounded-md"
        >
          <option value="" disabled>-- Elija un proyecto --</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-red-500 bg-red-100 p-3 rounded-lg mb-4">{error}</p>}

      {/* Scaffolds Grid */}
      {loading ? (
        <p>Cargando andamios...</p>
      ) : selectedProjectId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {scaffolds.length > 0 ? (
            scaffolds.map((scaffold) => (
              <div
                key={scaffold.id}
                onClick={() => setSelectedScaffold(scaffold)}
                className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer transition-transform hover:-translate-y-1"
              >
                <img src={scaffold.assembly_image_url} alt={`Andamio ${scaffold.id}`} className="h-48 w-full object-cover" />
                <div className="p-4">
                  <p className="text-lg font-bold text-dark-blue">{scaffold.cubic_meters} m³</p>
                  <p className="text-sm text-neutral-gray">Reportado por: {scaffold.user_name}</p>
                  <p className="text-sm text-neutral-gray">{new Date(scaffold.assembly_created_at).toLocaleDateString()}</p>
                  <span className={`mt-2 inline-block capitalize px-2 text-xs font-semibold rounded-full ${scaffold.status === 'assembled' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {scaffold.status === 'assembled' ? 'Armado' : 'Desarmado'}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className="col-span-full text-center text-neutral-gray">No hay andamios reportados para este proyecto.</p>
          )}
        </div>
      )}

      {/* Details Modal */}
      <Modal isOpen={!!selectedScaffold} onClose={handleCloseModal}>
        {selectedScaffold && (
          <div>
            <h2 className="text-2xl font-bold mb-4 text-dark-blue">Detalle del Andamio #{selectedScaffold.id}</h2>
            <div className="space-y-4">
              <img src={selectedScaffold.assembly_image_url} alt="Foto de montaje" className="rounded-lg w-full object-contain max-h-[50vh]" />
              <div className="p-4 bg-light-gray-bg rounded-lg">
                <p><strong>Técnico:</strong> {selectedScaffold.user_name}</p>
                <p><strong>Fecha de Montaje:</strong> {new Date(selectedScaffold.assembly_created_at).toLocaleString()}</p>
                <p><strong>Dimensiones:</strong> {selectedScaffold.height}m x {selectedScaffold.width}m x {selectedScaffold.depth}m</p>
                <p><strong>Metros Cúbicos:</strong> {selectedScaffold.cubic_meters} m³</p>
                <p><strong>Progreso de Montaje:</strong> {selectedScaffold.progress_percentage}%</p>
                <p><strong>Estado:</strong> <span className="capitalize">{selectedScaffold.status === 'assembled' ? 'Armado' : 'Desarmado'}</span></p>
                {selectedScaffold.assembly_notes && <p className="mt-2"><strong>Notas de Montaje:</strong> {selectedScaffold.assembly_notes}</p>}
              </div>
              {selectedScaffold.status === 'disassembled' && (
                 <div className="p-4 bg-light-gray-bg rounded-lg border-t">
                    <h3 className="font-bold text-dark-blue">Información de Desmontaje</h3>
                    <img src={selectedScaffold.disassembly_image_url} alt="Foto de desmontaje" className="mt-2 rounded-lg w-full object-contain max-h-[50vh]" />
                    <p><strong>Fecha de Desmontaje:</strong> {new Date(selectedScaffold.disassembled_at).toLocaleString()}</p>
                    {selectedScaffold.disassembly_notes && <p className="mt-2"><strong>Notas de Desmontaje:</strong> {selectedScaffold.disassembly_notes}</p>}
                 </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ScaffoldsPage;