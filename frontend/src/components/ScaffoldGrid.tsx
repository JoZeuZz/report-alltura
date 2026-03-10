import { Scaffold } from '../types/api';
import { ResponsiveGrid } from './layout';
import { useScaffoldPermissions } from '../hooks';
import ImageWithFallback from './ImageWithFallback';
import { buildImageUrl } from '../utils/image';
import { formatCubicMeters } from '../utils/format';

interface Props {
  scaffolds: Scaffold[];
  onScaffoldSelect: (scaffold: Scaffold) => void;
  onToggleCard?: (scaffoldId: number, currentStatus: 'green' | 'red') => void;
  onDisassemble?: (scaffoldId: number) => void;
  projectAssignedSupervisorId?: number | null;
  selectable?: boolean;
  selectedIds?: Set<number>;
  onToggleSelect?: (scaffoldId: number) => void;
}

export default function ScaffoldGrid({ 
  scaffolds, 
  onScaffoldSelect, 
  onToggleCard,
  onDisassemble,
  projectAssignedSupervisorId,
  selectable = false,
  selectedIds,
  onToggleSelect
}: Props) {
  if (scaffolds.length === 0) {
    return <p className="text-center text-gray-500 body-base">No se encontraron andamios.</p>;
  }

  return (
    <ResponsiveGrid variant="cards" gap="lg">
      {scaffolds.map((scaffold) => {
        const permissions = useScaffoldPermissions({
          scaffoldUserId: scaffold.user_id,
          projectAssignedSupervisorId,
          assemblyStatus: scaffold.assembly_status,
        });
        const isSelected = Boolean(selectedIds?.has(scaffold.id));

        return (
          <div
            key={scaffold.id}
            className={`bg-white rounded-lg shadow-md overflow-hidden transform hover:-translate-y-1 transition-transform duration-300 w-full relative ${
              isSelected ? 'ring-2 ring-primary-blue/70' : ''
            }`}
          >
            {/* Indicador de tarjeta - Esquina superior izquierda */}
            <div className="absolute top-3 left-3 z-10">
              <div
                className={`w-6 h-6 rounded-full shadow-lg border-2 border-white ${
                  scaffold.card_status === 'green' 
                    ? 'bg-green-500' 
                    : 'bg-red-500'
                }`}
                title={scaffold.card_status === 'green' ? 'Tarjeta Verde - Habilitado' : 'Tarjeta Roja - No Habilitado'}
              />
            </div>

            {selectable && onToggleSelect && (
              <div
                role="checkbox"
                tabIndex={0}
                aria-checked={isSelected}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleSelect(scaffold.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onToggleSelect(scaffold.id);
                  }
                }}
                className="absolute top-3 left-12 z-10 bg-white/90 border border-gray-200 rounded-md p-1 shadow-sm cursor-pointer"
                aria-label={`Seleccionar andamio ${scaffold.scaffold_number || scaffold.id}`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  readOnly
                  className="h-4 w-4 text-primary-blue rounded border-gray-300 pointer-events-none"
                />
              </div>
            )}

            {/* Indicador "Ver detalles" - Esquina superior derecha */}
            <div className="absolute top-3 right-3 z-10 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-md">
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span className="hidden sm:inline">Ver detalles</span>
              </div>
            </div>

            {/* Área clickeable principal */}
            <button
              type="button"
              onClick={() => onScaffoldSelect(scaffold)}
              aria-label={`Ver detalles del andamio ${scaffold.scaffold_number || scaffold.id}`}
              className="w-full text-left focus:outline-none focus:ring-2 focus:ring-primary-blue focus:ring-offset-2 rounded-lg"
            >
              <ImageWithFallback
                src={buildImageUrl(scaffold.assembly_image_url, 'thumb')}
                alt={`Andamio ${scaffold.id}`}
                className="h-40 sm:h-48 w-full object-cover"
              />
              <div className="p-3 sm:p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg sm:text-xl font-bold text-dark-blue">{formatCubicMeters(scaffold.cubic_meters)}</p>
                    <p className="text-sm text-gray-600">
                      {scaffold.height}x{scaffold.width}x{scaffold.length} m
                    </p>
                    {scaffold.permit_number && (
                      <p className="text-xs text-gray-700 mt-1 font-semibold">Permiso: {scaffold.permit_number}</p>
                    )}
                    {scaffold.scaffold_number && (
                      <p className="text-xs text-gray-500 mt-1">N° andamio: {scaffold.scaffold_number}</p>
                    )}
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                      {new Date(scaffold.assembly_created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!scaffold.modulation_pdf_url) return;
                        window.open(scaffold.modulation_pdf_url, '_blank', 'noopener,noreferrer');
                      }}
                      disabled={!scaffold.modulation_pdf_url}
                      className={`h-8 min-w-10 px-2 rounded-md text-[11px] font-bold border ${
                        scaffold.modulation_pdf_url
                          ? 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700'
                          : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      }`}
                      title={scaffold.modulation_pdf_url ? 'Abrir Modulación (PDF)' : 'Modulación no disponible'}
                    >
                      MOD
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!scaffold.calculation_memory_pdf_url) return;
                        window.open(scaffold.calculation_memory_pdf_url, '_blank', 'noopener,noreferrer');
                      }}
                      disabled={!scaffold.calculation_memory_pdf_url}
                      className={`h-8 min-w-10 px-2 rounded-md text-[11px] font-bold border ${
                        scaffold.calculation_memory_pdf_url
                          ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700'
                          : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      }`}
                      title={scaffold.calculation_memory_pdf_url ? 'Abrir Memoria de Cálculo (PDF)' : 'Memoria de Cálculo no disponible'}
                    >
                      MC
                    </button>
                  </div>
                </div>

                <span
                  className={`mt-2 inline-block capitalize px-2 py-1 text-xs font-semibold rounded-full ${
                    scaffold.assembly_status === 'assembled'
                      ? 'bg-green-100 text-green-800'
                      : scaffold.assembly_status === 'in_progress'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {scaffold.assembly_status === 'assembled' ? `Armado ${scaffold.progress_percentage}%` : 
                   scaffold.assembly_status === 'in_progress' ? `En Proceso ${scaffold.progress_percentage}%` : 
                   'Desarmado 0%'}
                </span>
              </div>
            </button>

            {/* Controles de acción - Solo si está 100% armado */}
            {scaffold.assembly_status === 'assembled' && scaffold.progress_percentage === 100 && (permissions.canToggleCard || permissions.canDisassemble) && (
              <div className="border-t border-gray-200 p-3 bg-gray-50">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Switch de tarjeta */}
                  {permissions.canToggleCard && onToggleCard && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleCard(scaffold.id, scaffold.card_status);
                      }}
                      className={`w-full px-4 py-2.5 rounded-lg text-sm font-semibold transition-all transform active:scale-95 flex items-center justify-center gap-2 ${
                        scaffold.card_status === 'green'
                          ? 'bg-green-500 text-white hover:bg-green-600'
                          : 'bg-red-500 text-white hover:bg-red-600'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Tarjeta {scaffold.card_status === 'green' ? 'Verde' : 'Roja'}
                    </button>
                  )}

                  {/* Botón desarmar */}
                  {permissions.canDisassemble && onDisassemble && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDisassemble(scaffold.id);
                      }}
                      className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Desarmar
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </ResponsiveGrid>
  );
}
