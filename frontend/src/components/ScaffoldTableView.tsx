import React from 'react';
import { format } from 'date-fns';
import { Scaffold } from '../types/api';

interface ScaffoldTableViewProps {
  scaffolds: Scaffold[];
  onScaffoldClick: (scaffold: Scaffold) => void;
  statusFilter?: string;
}

function rowBgColor(status: string): string {
  switch (status) {
    case 'assembled':
      return 'bg-[#E8F5E9]';
    case 'in_progress':
      return 'bg-[#FFFBEA]';
    case 'disassembled':
      return 'bg-[#FFEEEE]';
    default:
      return 'bg-white';
  }
}

const assemblyBadge: Record<string, { label: string; classes: string }> = {
  assembled:    { label: 'Armado',     classes: 'bg-green-100 text-green-800' },
  in_progress:  { label: 'En Proceso', classes: 'bg-yellow-100 text-yellow-800' },
  disassembled: { label: 'Desarmado',  classes: 'bg-red-100 text-red-800' },
};

const cardBadge: Record<string, { label: string; classes: string }> = {
  green: { label: 'Verde', classes: 'bg-green-100 text-green-700' },
  red:   { label: 'Roja',  classes: 'bg-red-100 text-red-700' },
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return format(new Date(dateStr), 'dd/MM/yyyy HH:mm');
  } catch {
    return '—';
  }
}

const statusLabel: Record<string, string> = {
  assembled:    'Armados',
  in_progress:  'En Proceso',
  disassembled: 'Desarmados',
};

const TOTAL_COLUMNS = 19; // # + 18 columnas de datos

const ScaffoldTableView: React.FC<ScaffoldTableViewProps> = ({
  scaffolds,
  onScaffoldClick,
  statusFilter,
}) => {
  const filtroLabel =
    statusFilter && statusFilter !== 'all' ? statusLabel[statusFilter] ?? statusFilter : null;

  return (
    <div>
      {/* Encabezado informativo */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm text-gray-500">
            {scaffolds.length} andamio{scaffolds.length !== 1 ? 's' : ''}
            {filtroLabel ? ` · filtrado por: ${filtroLabel}` : ''}
          </p>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded border">
            Solo lectura — Haz clic en una fila para ver detalles
          </span>
        </div>
        <p className="text-xs text-gray-400 md:hidden">
          ← Desliza para ver más →
        </p>
      </div>

      {/* Contenedor con scroll horizontal + vertical limitado */}
      <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-max w-full border-collapse text-sm" role="table">
          {/* THEAD sticky */}
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#1E2A4A] text-white">
              <th
                scope="col"
                aria-label="Número de fila"
                className="sticky left-0 z-20 bg-[#1E2A4A] px-3 py-2 text-center font-semibold whitespace-nowrap border-r border-blue-800 text-xs"
              >
                #
              </th>
              <th scope="col" className="px-3 py-2 text-left font-semibold whitespace-nowrap border-r border-blue-800 text-xs">
                Nº Andamio
              </th>
              <th scope="col" className="px-3 py-2 text-left font-semibold whitespace-nowrap border-r border-blue-800 text-xs">
                Área
              </th>
              <th scope="col" className="px-3 py-2 text-left font-semibold whitespace-nowrap border-r border-blue-800 text-xs">
                TAG
              </th>
              <th scope="col" className="px-3 py-2 text-left font-semibold whitespace-nowrap border-r border-blue-800 text-xs">
                Estado Armado
              </th>
              <th scope="col" className="px-3 py-2 text-left font-semibold whitespace-nowrap border-r border-blue-800 text-xs">
                Tarjeta
              </th>
              <th scope="col" className="px-3 py-2 text-right font-semibold whitespace-nowrap border-r border-blue-800 text-xs">
                % Avance
              </th>
              <th scope="col" className="px-3 py-2 text-right font-semibold whitespace-nowrap border-r border-blue-800 text-xs">
                Alto (m)
              </th>
              <th scope="col" className="px-3 py-2 text-right font-semibold whitespace-nowrap border-r border-blue-800 text-xs">
                Ancho (m)
              </th>
              <th scope="col" className="px-3 py-2 text-right font-semibold whitespace-nowrap border-r border-blue-800 text-xs">
                Largo (m)
              </th>
              <th scope="col" className="px-3 py-2 text-right font-semibold whitespace-nowrap border-r border-blue-800 text-xs">
                m³
              </th>
              <th scope="col" className="px-3 py-2 text-left font-semibold whitespace-nowrap border-r border-blue-800 text-xs">
                Ubicación
              </th>
              <th scope="col" className="px-3 py-2 text-left font-semibold whitespace-nowrap border-r border-blue-800 text-xs">
                Observaciones
              </th>
              <th scope="col" className="px-3 py-2 text-left font-semibold whitespace-nowrap border-r border-blue-800 text-xs">
                Supervisor
              </th>
              <th scope="col" className="px-3 py-2 text-left font-semibold whitespace-nowrap border-r border-blue-800 text-xs">
                Creado Por
              </th>
              <th scope="col" className="px-3 py-2 text-left font-semibold whitespace-nowrap border-r border-blue-800 text-xs">
                Fecha Creación
              </th>
              <th scope="col" className="px-3 py-2 text-left font-semibold whitespace-nowrap border-r border-blue-800 text-xs">
                Notas Montaje
              </th>
              <th scope="col" className="px-3 py-2 text-left font-semibold whitespace-nowrap border-r border-blue-800 text-xs">
                Fecha Desarmado
              </th>
              <th scope="col" className="px-3 py-2 text-left font-semibold whitespace-nowrap text-xs">
                Notas Desarmado
              </th>
            </tr>
          </thead>

          {/* TBODY */}
          <tbody>
            {scaffolds.length === 0 ? (
              <tr>
                <td
                  colSpan={TOTAL_COLUMNS}
                  className="text-center py-12 text-gray-500"
                >
                  No hay andamios que coincidan con el filtro seleccionado.
                </td>
              </tr>
            ) : (
              scaffolds.map((scaffold, index) => {
                const asmBadge = assemblyBadge[scaffold.assembly_status] ?? {
                  label: scaffold.assembly_status,
                  classes: 'bg-gray-100 text-gray-700',
                };
                const crdBadge = cardBadge[scaffold.card_status] ?? {
                  label: scaffold.card_status,
                  classes: 'bg-gray-100 text-gray-700',
                };

                return (
                  <tr
                    key={scaffold.id}
                    onClick={() => onScaffoldClick(scaffold)}
                    onKeyDown={(e) => e.key === 'Enter' && onScaffoldClick(scaffold)}
                    tabIndex={0}
                    className={`cursor-pointer border-b border-gray-200 transition-colors group ${rowBgColor(scaffold.assembly_status)}`}
                  >
                    {/* Columna # sticky */}
                    <td
                      className="sticky left-0 z-10 px-3 py-2 text-center font-medium text-gray-500 border-r border-gray-200 whitespace-nowrap group-hover:bg-black/5"
                      style={{ backgroundColor: 'inherit' }}
                    >
                      {index + 1}
                    </td>

                    {/* Nº Andamio */}
                    <td className="px-3 py-2 whitespace-nowrap border-r border-gray-100 group-hover:bg-black/5">
                      {scaffold.scaffold_number || `#${scaffold.id}`}
                    </td>

                    {/* Área */}
                    <td className="px-3 py-2 whitespace-nowrap border-r border-gray-100 group-hover:bg-black/5">
                      {scaffold.area || '—'}
                    </td>

                    {/* TAG */}
                    <td className="px-3 py-2 whitespace-nowrap border-r border-gray-100 group-hover:bg-black/5">
                      {scaffold.tag || '—'}
                    </td>

                    {/* Estado Armado */}
                    <td className="px-3 py-2 whitespace-nowrap border-r border-gray-100 group-hover:bg-black/5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${asmBadge.classes}`}
                      >
                        {asmBadge.label}
                      </span>
                    </td>

                    {/* Tarjeta */}
                    <td className="px-3 py-2 whitespace-nowrap border-r border-gray-100 group-hover:bg-black/5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${crdBadge.classes}`}
                      >
                        {crdBadge.label}
                      </span>
                    </td>

                    {/* % Avance */}
                    <td className="px-3 py-2 text-right whitespace-nowrap border-r border-gray-100 group-hover:bg-black/5">
                      {scaffold.progress_percentage}%
                    </td>

                    {/* Alto */}
                    <td className="px-3 py-2 text-right whitespace-nowrap border-r border-gray-100 group-hover:bg-black/5">
                      {Number(scaffold.height).toFixed(2)}
                    </td>

                    {/* Ancho */}
                    <td className="px-3 py-2 text-right whitespace-nowrap border-r border-gray-100 group-hover:bg-black/5">
                      {Number(scaffold.width).toFixed(2)}
                    </td>

                    {/* Largo */}
                    <td className="px-3 py-2 text-right whitespace-nowrap border-r border-gray-100 group-hover:bg-black/5">
                      {Number(scaffold.length).toFixed(2)}
                    </td>

                    {/* m³ */}
                    <td className="px-3 py-2 text-right whitespace-nowrap border-r border-gray-100 group-hover:bg-black/5">
                      {Number(scaffold.cubic_meters).toFixed(2)}
                    </td>

                    {/* Ubicación */}
                    <td className="px-3 py-2 whitespace-nowrap border-r border-gray-100 group-hover:bg-black/5">
                      {scaffold.location || '—'}
                    </td>

                    {/* Observaciones — truncado + tooltip */}
                    <td
                      className="px-3 py-2 max-w-[200px] truncate whitespace-nowrap border-r border-gray-100 group-hover:bg-black/5"
                      title={scaffold.observations || ''}
                    >
                      {scaffold.observations || '—'}
                    </td>

                    {/* Supervisor */}
                    <td className="px-3 py-2 whitespace-nowrap border-r border-gray-100 group-hover:bg-black/5">
                      {scaffold.user_name || '—'}
                    </td>

                    {/* Creado Por */}
                    <td className="px-3 py-2 whitespace-nowrap border-r border-gray-100 group-hover:bg-black/5">
                      {scaffold.created_by_name || '—'}
                    </td>

                    {/* Fecha Creación */}
                    <td className="px-3 py-2 whitespace-nowrap border-r border-gray-100 group-hover:bg-black/5">
                      {formatDate(scaffold.assembly_created_at)}
                    </td>

                    {/* Notas Montaje — truncado + tooltip */}
                    <td
                      className="px-3 py-2 max-w-[200px] truncate whitespace-nowrap border-r border-gray-100 group-hover:bg-black/5"
                      title={scaffold.assembly_notes || ''}
                    >
                      {scaffold.assembly_notes || '—'}
                    </td>

                    {/* Fecha Desarmado */}
                    <td className="px-3 py-2 whitespace-nowrap border-r border-gray-100 group-hover:bg-black/5">
                      {formatDate(scaffold.disassembled_at)}
                    </td>

                    {/* Notas Desarmado — truncado + tooltip */}
                    <td
                      className="px-3 py-2 max-w-[200px] truncate whitespace-nowrap group-hover:bg-black/5"
                      title={scaffold.disassembly_notes || ''}
                    >
                      {scaffold.disassembly_notes || '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ScaffoldTableView;
