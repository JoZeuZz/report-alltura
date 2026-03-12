import React from 'react';
import { Scaffold } from '../types/api';

interface ScaffoldStatusBadgeProps {
  scaffold: Scaffold;
  showDetails?: boolean;
}

/**
 * Componente de badges para mostrar el estado de un andamio
 * Muestra indicadores visuales de tarjeta y estado de armado
 */
export const ScaffoldStatusBadge: React.FC<ScaffoldStatusBadgeProps> = React.memo(({
  scaffold,
  showDetails = false,
}) => {
  const isDisassembled = scaffold.assembly_status === 'disassembled';
  const isGreen = scaffold.card_status === 'green';
  const cardClass = isDisassembled
    ? 'bg-gray-500'
    : isGreen
    ? 'bg-green-500'
    : 'bg-red-500';
  const cardTitle = isDisassembled
    ? 'Desarmado - Sin tarjeta activa'
    : isGreen
    ? 'Tarjeta Verde - Todo OK'
    : 'Tarjeta Roja - Hay problemas';
  const cardAria = isDisassembled
    ? 'Estado de tarjeta: no aplica, andamio desarmado'
    : isGreen
    ? 'Estado de tarjeta: verde, todo OK'
    : 'Estado de tarjeta: roja, hay problemas';

  return (
    <div className="flex items-center space-x-2">
      {/* Badge de Tarjeta */}
      <div
        className={`flex items-center space-x-1 px-3 py-1 rounded-full text-white text-sm font-medium ${cardClass}`}
        title={cardTitle}
        role={!showDetails ? 'status' : undefined}
        aria-live={!showDetails ? 'polite' : undefined}
        aria-label={!showDetails ? cardAria : undefined}
      >
        <span>{isDisassembled ? '•' : isGreen ? '✓' : '✗'}</span>
        {showDetails && (
          <span>{isDisassembled ? 'Desarmado' : isGreen ? 'Verde' : 'Roja'}</span>
        )}
      </div>

      {/* Badge de Armado */}
      <div
        className={`flex items-center space-x-1 px-3 py-1 rounded-full text-white text-sm font-medium ${
          scaffold.assembly_status === 'assembled'
            ? 'bg-blue-500'
            : 'bg-gray-500'
        }`}
        title={scaffold.assembly_status === 'assembled' ? 'Armado' : 'Desarmado'}
        role={!showDetails ? 'status' : undefined}
        aria-live={!showDetails ? 'polite' : undefined}
        aria-label={!showDetails ? `Estado de armado: ${scaffold.assembly_status === 'assembled' ? 'armado' : 'desarmado'}` : undefined}
      >
        <span>{scaffold.assembly_status === 'assembled' ? '🏗️' : '📦'}</span>
        {showDetails && (
          <span>{scaffold.assembly_status === 'assembled' ? 'Armado' : 'Desarmado'}</span>
        )}
      </div>

      {/* Badge de Progreso (opcional) */}
      {showDetails && (
        <div
          className="flex items-center space-x-1 px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-sm font-medium"
          title={`Progreso: ${scaffold.progress_percentage}%`}
          role="status"
          aria-label={`Progreso del andamio: ${scaffold.progress_percentage} por ciento`}
        >
          <span>📊</span>
          <span>{scaffold.progress_percentage}%</span>
        </div>
      )}
    </div>
  );
});

ScaffoldStatusBadge.displayName = 'ScaffoldStatusBadge';

export default ScaffoldStatusBadge;
