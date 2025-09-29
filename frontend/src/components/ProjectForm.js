import React, { useState, useEffect } from 'react';

const ProjectForm = ({ project, clients, onSubmit, onCancel }) => {
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [status, setStatus] = useState('active');

  useEffect(() => {
    if (project) {
      setName(project.name);
      setClientId(project.client_id);
      setStatus(project.status);
    } else {
      // Reset form for new project
      setName('');
      setClientId(clients.length > 0 ? clients[0].id : '');
      setStatus('active');
    }
  }, [project, clients]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !clientId) {
      alert('El nombre y el cliente del proyecto son obligatorios.');
      return;
    }
    onSubmit({ name, client_id: clientId, status });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-4">
        <label htmlFor="name" className="block text-gray-700 text-sm font-bold mb-2">
          Nombre del Proyecto
        </label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-primary-blue"
          required
        />
      </div>
      <div className="mb-4">
        <label htmlFor="client_id" className="block text-gray-700 text-sm font-bold mb-2">
          Cliente
        </label>
        <select
          id="client_id"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-primary-blue"
          required
        >
          <option value="" disabled>Seleccione un cliente</option>
          {clients.map(client => (
            <option key={client.id} value={client.id}>{client.name}</option>
          ))}
        </select>
      </div>
      <div className="mb-6">
        <label htmlFor="status" className="block text-gray-700 text-sm font-bold mb-2">
          Estado
        </label>
        <select
          id="status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-primary-blue"
        >
          <option value="active">Activo</option>
          <option value="completed">Completado</option>
        </select>
      </div>
      <div className="flex items-center justify-end">
        <button type="button" onClick={onCancel} className="bg-gray-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-600 mr-2">Cancelar</button>
        <button type="submit" className="bg-primary-blue text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700">Guardar</button>
      </div>
    </form>
  );
};

export default ProjectForm;