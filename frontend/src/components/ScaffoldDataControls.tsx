import React from 'react';

export type ScaffoldStatusFilter = 'all' | 'assembled' | 'in_progress' | 'disassembled';

export interface ScaffoldStatusCounts {
  all: number;
  assembled: number;
  in_progress: number;
  disassembled: number;
}

interface ScaffoldDataControlsProps {
  statusFilter?: ScaffoldStatusFilter;
  statusCounts?: ScaffoldStatusCounts;
  onStatusFilterChange?: (status: ScaffoldStatusFilter) => void;
  onExportPDF: () => void;
  onExportExcel: () => void;
  exportingPDF?: boolean;
  exportingExcel?: boolean;
  exportPdfDataTour?: string;
  disablePDF?: boolean;
  disableExcel?: boolean;
  description?: string;
  showStatusFilters?: boolean;
}

const filterOptions: Array<{
  key: ScaffoldStatusFilter;
  label: string;
  activeClassName: string;
}> = [
  {
    key: 'all',
    label: 'Todos',
    activeClassName: 'bg-primary-blue text-white shadow-md',
  },
  {
    key: 'assembled',
    label: 'Armados',
    activeClassName: 'bg-green-600 text-white shadow-md',
  },
  {
    key: 'in_progress',
    label: 'En Proceso',
    activeClassName: 'bg-blue-600 text-white shadow-md',
  },
  {
    key: 'disassembled',
    label: 'Desarmados',
    activeClassName: 'bg-yellow-600 text-white shadow-md',
  },
];

const ScaffoldDataControls: React.FC<ScaffoldDataControlsProps> = ({
  statusFilter,
  statusCounts,
  onStatusFilterChange,
  onExportPDF,
  onExportExcel,
  exportingPDF = false,
  exportingExcel = false,
  exportPdfDataTour,
  disablePDF = false,
  disableExcel = false,
  description = 'Exporta el estado actual del proyecto y aplica filtros por avance.',
  showStatusFilters = true,
}) => {
  const canRenderStatusFilters =
    showStatusFilters &&
    statusFilter !== undefined &&
    statusCounts !== undefined &&
    onStatusFilterChange !== undefined;

  return (
    <div className="space-y-3 border-t border-gray-100 pt-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="body-small text-neutral-gray">
          {description}
        </p>
        <div className="flex gap-2">
          <button
            onClick={onExportPDF}
            disabled={exportingPDF || disablePDF}
            data-tour={exportPdfDataTour}
            className="touch-target flex items-center justify-center gap-1.5 rounded-lg bg-red-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-gray-400 sm:px-4 sm:text-sm"
          >
            {exportingPDF ? 'Generando...' : 'PDF'}
          </button>
          <button
            onClick={onExportExcel}
            disabled={exportingExcel || disableExcel}
            className="touch-target flex items-center justify-center gap-1.5 rounded-lg bg-green-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:bg-gray-400 sm:px-4 sm:text-sm"
          >
            {exportingExcel ? 'Generando...' : 'Excel'}
          </button>
        </div>
      </div>

      {canRenderStatusFilters && (
        <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
          {filterOptions.map((option) => (
            <button
              key={option.key}
              onClick={() => onStatusFilterChange(option.key)}
              className={`rounded-lg px-2.5 py-2 text-xs font-medium transition-all sm:px-4 sm:text-sm ${
                statusFilter === option.key
                  ? option.activeClassName
                  : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>
                {option.label} ({statusCounts[option.key]})
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ScaffoldDataControls;
