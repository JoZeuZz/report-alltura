import React, { useState } from 'react';
import { useLoaderData, useNavigate, useParams, useRevalidator } from 'react-router-dom';
import toast from 'react-hot-toast';
import Modal from '@/shell/components/Modal';
import { ProjectDashboard } from '@/shell';
import ScaffoldDetailsModal from '../../components/ScaffoldDetailsModal';
import ScaffoldTableView from '../../components/ScaffoldTableView';
import ScaffoldDataControls, {
  ScaffoldStatusFilter,
} from '../../components/ScaffoldDataControls';
import { Project, Scaffold } from '../../types/api';
import ImageWithFallback from '@/shell/components/ImageWithFallback';
import ProjectControlBar, {
  ProjectControlAction,
  ProjectControlStat,
} from '@/shell/components/ProjectControlBar';
import { buildImageUrl } from '../../utils/image';
import { apiService } from '@/shell/services/apiService';
import { formatCubicMeters } from '../../utils/format';

type ViewMode = 'dashboard' | 'cards' | 'table';

interface ProjectDashboardSummary {
  totalCubicMeters: number;
  assembledCubicMeters: number;
  disassembledCubicMeters: number;
  inProgressCubicMeters: number;
  historicalAssembledCubicMeters?: number;
  contractedCubicMeters?: number;
  completionPercentage?: number;
  assemblyProgressPercentage?: number;
  disassemblyProgressPercentage?: number;
  totalScaffolds: number;
  assembledScaffolds: number;
  disassembledScaffolds: number;
  inProgressScaffolds: number;
  greenCards: number;
  redCards: number;
  recentScaffoldsCount: number;
  avgProgress: number;
}

interface LoaderData {
  project: Project;
  scaffolds: Scaffold[];
  summary: ProjectDashboardSummary;
}

/**
 * Página de visualización de andamios para usuarios cliente
 * Vista de solo lectura con dashboard de métricas y andamios del proyecto
 */
const ClientProjectScaffoldsPage: React.FC = () => {
  const revalidator = useRevalidator();
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const { project, scaffolds, summary } = useLoaderData() as LoaderData;
  const [selectedScaffold, setSelectedScaffold] = useState<Scaffold | null>(null);
  const [statusFilter, setStatusFilter] = useState<ScaffoldStatusFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (sessionStorage.getItem(`view-project-${projectId}`) as ViewMode) || 'cards';
  });
  const [exporting, setExporting] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    sessionStorage.setItem(`view-project-${projectId}`, mode);
  };

  const refetchScaffolds = async () => {
    revalidator.revalidate();
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const response = await apiService.get(
        `/projects/${project.id}/report/pdf`,
        { responseType: 'blob' },
      );
      
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      const filename = `Reporte-${project?.name.replace(/\s/g, '_') || 'proyecto'}.pdf`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
      toast.success('PDF generado exitosamente');
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { message?: string } } };
      const errorMsg = apiError?.response?.data?.message || 'Error al generar el PDF';
      toast.error(errorMsg);
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      const response = await apiService.get(
        `/projects/${project.id}/report/excel`,
        { responseType: 'blob' },
      );
      
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      const filename = `Reporte-${project?.name.replace(/\s/g, '_') || 'proyecto'}.xlsx`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
      toast.success('Excel generado exitosamente');
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { message?: string } } };
      const errorMsg = apiError?.response?.data?.message || 'Error al generar el Excel';
      toast.error(errorMsg);
      console.error(err);
    } finally {
      setExportingExcel(false);
    }
  };

  const filteredScaffolds = scaffolds?.filter((scaffold) => {
    if (statusFilter === 'all') return true;
    return scaffold.assembly_status === statusFilter;
  });

  const totalScaffolds = scaffolds?.length || 0;
  const hasScaffolds = totalScaffolds > 0;
  const isDataView = viewMode === 'cards' || viewMode === 'table';
  const shouldShowDataControls = isDataView && hasScaffolds;

  const statusCounts = {
    all: totalScaffolds,
    assembled: scaffolds?.filter((item) => item.assembly_status === 'assembled').length || 0,
    in_progress: scaffolds?.filter((item) => item.assembly_status === 'in_progress').length || 0,
    disassembled: scaffolds?.filter((item) => item.assembly_status === 'disassembled').length || 0,
  };

  const controlActions: ProjectControlAction[] = [
    {
      key: 'dashboard',
      label: 'Dashboard',
      onClick: () => handleViewChange('dashboard'),
      active: viewMode === 'dashboard',
    },
    {
      key: 'cards',
      label: 'Andamios',
      onClick: () => handleViewChange('cards'),
      active: viewMode === 'cards',
      dataTour: 'client-scaffolds',
    },
    {
      key: 'table',
      label: 'Tabla',
      onClick: () => handleViewChange('table'),
      active: viewMode === 'table',
    },
    {
      key: 'gallery',
      label: 'Galeria',
      onClick: () => navigate(`/client/project/${project.id}/gallery`),
      variant: 'neutral',
      dataTour: 'client-gallery',
    },
  ];

  const controlStats: ProjectControlStat[] = [
    {
      label: 'Andamios',
      value: totalScaffolds,
    },
    {
      label: 'Volumen',
      value: formatCubicMeters(summary.totalCubicMeters),
    },
  ];

  return (
    <div className="pb-4 space-y-4">
      <ProjectControlBar
        contextLabel="Proyecto cliente"
        title={project?.name || 'Proyecto'}
        subtitle={`Cliente: ${project?.client_name || '-'}`}
        stats={controlStats}
        actions={controlActions}
      >
        {shouldShowDataControls && (
          <ScaffoldDataControls
            statusFilter={statusFilter}
            statusCounts={statusCounts}
            onStatusFilterChange={setStatusFilter}
            onExportPDF={handleExportPDF}
            onExportExcel={handleExportExcel}
            exportingPDF={exporting}
            exportingExcel={exportingExcel}
            exportPdfDataTour="client-pdf"
          />
        )}
      </ProjectControlBar>

      {/* Dashboard */}
      {viewMode === 'dashboard' && (
        <div data-tour="client-metrics" className="reveal-up">
          <ProjectDashboard summary={summary} projectName={project?.name} />
        </div>
      )}

      {/* Vistas cards y tabla: filtros + contenido */}
      {(viewMode === 'cards' || viewMode === 'table') && (
        <>
          {/* Vista Cards o Tabla */}
          {!filteredScaffolds || filteredScaffolds.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center reveal-soft">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
              <h3 className="mt-2 heading-4 text-dark-blue">No hay andamios</h3>
              <p className="mt-1 body-small text-gray-600">
                {statusFilter === 'all'
                  ? 'Aún no hay andamios creados en este proyecto.'
                  : `No hay andamios ${
                      statusFilter === 'assembled'
                        ? 'armados'
                        : statusFilter === 'in_progress'
                        ? 'en proceso'
                        : 'desarmados'
                    } en este momento.`}
              </p>
            </div>
          ) : viewMode === 'table' ? (
            <ScaffoldTableView
              scaffolds={filteredScaffolds}
              onScaffoldClick={setSelectedScaffold}
              statusFilter={statusFilter}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredScaffolds.map((scaffold) => {
                const displayScaffoldNumber = scaffold.scaffold_number || scaffold.id;
                return (
                <div
                  key={scaffold.id}
                  onClick={() => setSelectedScaffold(scaffold)}
                  className="cursor-pointer overflow-hidden rounded-xl border border-gray-100 bg-white shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                >
                  {/* Imagen */}
                  <div className="relative h-48 bg-gray-200">
                    <ImageWithFallback
                      src={buildImageUrl(scaffold.assembly_image_url || '/placeholder-scaffold.png', 'thumb')}
                      alt={`Andamio #${displayScaffoldNumber}`}
                      className="w-full h-full object-cover"
                    />
                    {/* Badge de estado de ensamblaje */}
                    <div className="absolute top-2 right-2">
                      <span
                        className={`px-3 py-1 text-xs font-bold rounded-full shadow-lg ${
                          scaffold.assembly_status === 'assembled'
                            ? 'bg-green-500 text-white'
                            : scaffold.assembly_status === 'in_progress'
                            ? 'bg-blue-500 text-white'
                            : 'bg-yellow-500 text-white'
                        }`}
                      >
                        {scaffold.assembly_status === 'assembled'
                          ? `Armado ${scaffold.progress_percentage}%`
                          : scaffold.assembly_status === 'in_progress'
                          ? `En Proceso ${scaffold.progress_percentage}%`
                          : 'Desarmado'}
                      </span>
                    </div>
                    {/* Badge de estado de tarjeta */}
                    <div className="absolute top-2 left-2">
                      <div className="flex items-center gap-2">
                        {(() => {
                          const isDisassembled = scaffold.assembly_status === 'disassembled';
                          const isGreen = scaffold.card_status === 'green';
                          const dotClass = isDisassembled
                            ? 'bg-gray-400'
                            : isGreen
                            ? 'bg-green-500'
                            : 'bg-red-500';
                          const title = isDisassembled
                            ? 'Desarmado - Sin tarjeta activa'
                            : isGreen
                            ? 'Tarjeta Verde - Habilitado'
                            : 'Tarjeta Roja - No Habilitado';

                          return (
                            <div
                              className={`w-8 h-8 rounded-full shadow-lg border-2 border-white flex items-center justify-center ${dotClass}`}
                              title={title}
                            >
                              {!isDisassembled && scaffold.card_status === 'red' && (
                                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Información */}
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-lg font-bold text-dark-blue">
                        Andamio #{displayScaffoldNumber}
                      </h3>
                    </div>
                    
                    {/* Indicadores de estado */}
                    <div className="flex gap-2 mb-3">
                      {(() => {
                        const isDisassembled = scaffold.assembly_status === 'disassembled';
                        const badgeClass = isDisassembled
                          ? 'bg-gray-100 text-gray-700 border border-gray-300'
                          : scaffold.card_status === 'green'
                          ? 'bg-green-100 text-green-800 border border-green-300'
                          : 'bg-red-100 text-red-800 border border-red-300';

                        return (
                          <div className={`px-3 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1 ${badgeClass}`}>
                            {isDisassembled ? (
                              <>
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-3 8h6v2H7V26z" clipRule="evenodd" />
                                </svg>
                                Desarmado
                              </>
                            ) : scaffold.card_status === 'green' ? (
                              <>
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                Tarjeta Verde
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                                </svg>
                                Tarjeta Roja
                              </>
                            )}
                          </div>
                        );
                      })()}
                      {scaffold.assembly_status === 'disassembled' && (
                        <div className="px-3 py-1 rounded-lg text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-300 inline-flex items-center gap-1">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                          Desarmado
                        </div>
                      )}
                    </div>

                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 text-sm text-gray-600 min-w-0">
                        {scaffold.location && (
                          <p>
                            <span className="font-semibold">Ubicación:</span> {scaffold.location}
                          </p>
                        )}
                        <p>
                          <span className="font-semibold">Dimensiones:</span> {scaffold.height}m ×{' '}
                          {scaffold.width}m × {scaffold.length}m
                        </p>
                        <p>
                          <span className="font-semibold">Volumen:</span> {formatCubicMeters(scaffold.cubic_meters)}
                        </p>
                        {scaffold.assembly_status === 'in_progress' && (
                          <p>
                            <span className="font-semibold">Avance:</span>{' '}
                            {scaffold.progress_percentage}%
                          </p>
                        )}
                        <p>
                          <span className="font-semibold">Fecha:</span>{' '}
                          {new Date(scaffold.assembly_created_at).toLocaleDateString('es-CL')}
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
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Modal de detalles */}
      <Modal isOpen={!!selectedScaffold} onClose={() => setSelectedScaffold(null)}>
        {selectedScaffold && (
          <ScaffoldDetailsModal
            scaffold={selectedScaffold}
            onUpdate={() => {
              refetchScaffolds();
              setSelectedScaffold(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
};

export default ClientProjectScaffoldsPage;
