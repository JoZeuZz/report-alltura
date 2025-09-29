import React, { useState, useEffect } from 'react';
import api from '../services/api';

const AssignTechniciansForm = ({ project, onSubmit, onCancel }) => {
  const [technicians, setTechnicians] = useState([]);
  const [assigned, setAssigned] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');
        // Fetch all technicians and currently assigned technicians in parallel
        const [techResponse, assignedResponse] = await Promise.all([
          api.get('/users?role=technician'),
          api.get(`/projects/${project.id}/users`),
        ]);
        setTechnicians(techResponse.data);
        setAssigned(new Set(assignedResponse.data));
      } catch (err) {
        setError('Error al cargar los datos de asignación.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (project) {
      fetchData();
    }
  }, [project]);

  const handleCheckboxChange = (techId) => {
    setAssigned(prevAssigned => {
      const newAssigned = new Set(prevAssigned);
      if (newAssigned.has(techId)) {
        newAssigned.delete(techId);
      } else {
        newAssigned.add(techId);
      }
      return newAssigned;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ projectId: project.id, userIds: Array.from(assigned) });
  };

  if (loading) return <p>Cargando técnicos...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <form onSubmit={handleSubmit}>
      <p className="mb-4">Seleccione los técnicos que trabajarán en el proyecto <strong>{project.name}</strong>.</p>
      <div className="max-h-60 overflow-y-auto border rounded-lg p-4 space-y-2 mb-6">
        {technicians.length > 0 ? (
          technicians.map(tech => (
            <label key={tech.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-light-gray-bg">
              <input
                type="checkbox"
                checked={assigned.has(tech.id)}
                onChange={() => handleCheckboxChange(tech.id)}
                className="h-5 w-5 rounded border-gray-300 text-primary-blue focus:ring-primary-blue"
              />
              <span className="text-gray-700">{tech.name}</span>
            </label>
          ))
        ) : (
          <p className="text-neutral-gray">No hay técnicos disponibles para asignar.</p>
        )}
      </div>
      <div className="flex items-center justify-end">
        <button type="button" onClick={onCancel} className="bg-gray-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-600 mr-2">Cancelar</button>
        <button type="submit" className="bg-primary-blue text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700">Guardar Asignaciones</button>
      </div>
    </form>
  );
};

export default AssignTechniciansForm;