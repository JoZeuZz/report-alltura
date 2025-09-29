import React, { useState, useEffect } from 'react';

const ClientForm = ({ client, onSubmit, onCancel }) => {
  const [name, setName] = useState('');
  const [contactInfo, setContactInfo] = useState('');

  useEffect(() => {
    if (client) {
      setName(client.name);
      setContactInfo(client.contact_info || '');
    } else {
      setName('');
      setContactInfo('');
    }
  }, [client]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name) {
      alert('El nombre del cliente es obligatorio.');
      return;
    }
    onSubmit({ name, contact_info: contactInfo });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-4">
        <label htmlFor="name" className="block text-gray-700 text-sm font-bold mb-2">
          Nombre del Cliente
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
      <div className="mb-6">
        <label htmlFor="contact_info" className="block text-gray-700 text-sm font-bold mb-2">
          Información de Contacto (Email, Teléfono, etc.)
        </label>
        <textarea
          id="contact_info"
          value={contactInfo}
          onChange={(e) => setContactInfo(e.target.value)}
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-primary-blue"
          rows="3"
        ></textarea>
      </div>
      <div className="flex items-center justify-end">
        <button type="button" onClick={onCancel} className="bg-gray-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-600 mr-2">Cancelar</button>
        <button type="submit" className="bg-primary-blue text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700">Guardar</button>
      </div>
    </form>
  );
};

export default ClientForm;