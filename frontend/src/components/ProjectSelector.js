import React from 'react';

const ProjectSelector = ({ projects, selectedProjectId, onProjectSelect }) => (
  <div className="mb-6">
    <label htmlFor="project" className="block text-sm font-medium text-gray-700 mb-2">
      Seleccionar Proyecto
    </label>
    <select
      id="project"
      value={selectedProjectId}
      onChange={(e) => onProjectSelect(e.target.value)}
      className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-blue focus:border-primary-blue"
    >
      <option value="">Seleccione un proyecto</option>
      {projects.map((project) => (
        <option key={project.id} value={project.id}>
          {project.name}
        </option>
      ))}
    </select>
  </div>
);

export default ProjectSelector;