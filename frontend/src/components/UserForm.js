import React, { useState, useEffect } from 'react';

const UserForm = ({ user, onSubmit, onCancel }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('technician');

  const isEditing = !!user;

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setRole(user.role);
      setPassword(''); // Limpiar el campo de contraseña al editar
    } else {
      // Reset form for new user
      setName('');
      setEmail('');
      setPassword('');
      setRole('technician');
    }
  }, [user]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !email || (!isEditing && !password)) {
      alert('Todos los campos son obligatorios para un nuevo usuario.');
      return;
    }
    onSubmit({ name, email, password, role });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-4">
        <label htmlFor="name" className="block text-gray-700 text-sm font-bold mb-2">Nombre Completo</label>
        <input
          type="text" id="name" value={name} onChange={(e) => setName(e.target.value)}
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-primary-blue"
          required
        />
      </div>
      <div className="mb-4">
        <label htmlFor="email" className="block text-gray-700 text-sm font-bold mb-2">Email</label>
        <input
          type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-primary-blue"
          required
        />
      </div>
      <div className="mb-4">
        <label htmlFor="password" className="block text-gray-700 text-sm font-bold mb-2">
          Contraseña {isEditing && '(Dejar en blanco para no cambiar)'}
        </label>
        <input
          type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)}
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-primary-blue"
          required={!isEditing}
        />
      </div>
      <div className="mb-6">
        <label htmlFor="role" className="block text-gray-700 text-sm font-bold mb-2">Rol</label>
        <select
          id="role" value={role} onChange={(e) => setRole(e.target.value)}
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-primary-blue"
        >
          <option value="technician">Técnico</option>
          <option value="admin">Administrador</option>
        </select>
      </div>
      <div className="flex items-center justify-end">
        <button type="button" onClick={onCancel} className="bg-gray-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-600 mr-2">Cancelar</button>
        <button type="submit" className="bg-primary-blue text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700">Guardar</button>
      </div>
    </form>
  );
};

export default UserForm;