import React from 'react';

const ScaffoldGrid = ({ scaffolds, onViewDetails, onViewImage }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {scaffolds.map((scaffold) => (
      <div key={scaffold.id} className="bg-white rounded-lg shadow-md overflow-hidden">
        <img
          src={scaffold.assembly_image_url}
          alt="Vista del andamio"
          className="w-full h-48 object-cover cursor-pointer"
          onClick={() => onViewImage(scaffold.assembly_image_url)}
        />
        <div className="p-4">
          <div className="flex justify-between items-start mb-2">
            <div>
              <span className="text-xs text-gray-500">ID: {scaffold.id}</span>
              <p className="font-medium text-gray-900">
                {scaffold.height}m × {scaffold.width}m × {scaffold.depth}m
              </p>
            </div>
            <span className={`px-2 py-1 text-xs font-medium rounded ${
              scaffold.status === 'assembled' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-800'
            }`}>
              {scaffold.status === 'assembled' ? 'Armado' : 'Desarmado'}
            </span>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            Metros cúbicos: {scaffold.cubic_meters}m³
          </p>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">
              {new Date(scaffold.assembly_created_at).toLocaleDateString()}
            </span>
            <button
              onClick={() => onViewDetails(scaffold)}
              className="text-primary-blue hover:text-blue-700 text-sm font-medium"
            >
              Ver Detalles
            </button>
          </div>
        </div>
      </div>
    ))}
  </div>
);

export default ScaffoldGrid;