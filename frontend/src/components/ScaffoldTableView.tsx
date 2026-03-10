import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { format } from 'date-fns';
import { Scaffold } from '../types/api';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface ScaffoldTableViewProps {
  scaffolds: Scaffold[];
  onScaffoldClick: (scaffold: Scaffold) => void;
  statusFilter?: string;
}

type SortDirection = 'asc' | 'desc';

interface SortConfig {
  key: string;
  direction: SortDirection;
}

interface ColumnDef {
  key: string;
  label: string;
  defaultWidth: number;
  align: 'left' | 'right' | 'center';
  sortable: boolean;
  truncate?: boolean;
  isDate?: boolean;
  isNumber?: boolean;
}

// ─── Definición de columnas (fuente de verdad) ───────────────────────────────

const COLUMNS: ColumnDef[] = [
  { key: 'permit_number',       label: 'Nº Permiso',      defaultWidth: 120, align: 'left',  sortable: true  },
  { key: 'area',                label: 'Área',             defaultWidth: 90,  align: 'left',  sortable: true  },
  { key: 'tag',                 label: 'TAG',              defaultWidth: 80,  align: 'left',  sortable: true  },
  { key: 'modulation_pdf_url',  label: 'MOD',              defaultWidth: 70,  align: 'center', sortable: false },
  { key: 'calculation_memory_pdf_url', label: 'MC',        defaultWidth: 70,  align: 'center', sortable: false },
  { key: 'assembly_status',     label: 'Estado Armado',    defaultWidth: 120, align: 'left',  sortable: true  },
  { key: 'card_status',         label: 'Tarjeta',          defaultWidth: 90,  align: 'left',  sortable: true  },
  { key: 'progress_percentage', label: '% Avance',         defaultWidth: 90,  align: 'right', sortable: true,  isNumber: true },
  { key: 'height',              label: 'Alto (m)',         defaultWidth: 85,  align: 'right', sortable: true,  isNumber: true },
  { key: 'width',               label: 'Ancho (m)',        defaultWidth: 85,  align: 'right', sortable: true,  isNumber: true },
  { key: 'length',              label: 'Largo (m)',        defaultWidth: 85,  align: 'right', sortable: true,  isNumber: true },
  { key: 'cubic_meters',        label: 'm³',               defaultWidth: 80,  align: 'right', sortable: true,  isNumber: true },
  { key: 'location',            label: 'Ubicación',        defaultWidth: 160, align: 'left',  sortable: true  },
  { key: 'observations',        label: 'Observaciones',    defaultWidth: 200, align: 'left',  sortable: false, truncate: true },
  { key: 'user_name',           label: 'Supervisor',       defaultWidth: 130, align: 'left',  sortable: true  },
  { key: 'created_by_name',     label: 'Creado Por',       defaultWidth: 130, align: 'left',  sortable: true  },
  { key: 'assembly_created_at', label: 'Fecha Creación',   defaultWidth: 140, align: 'left',  sortable: true,  isDate: true },
  { key: 'assembly_notes',      label: 'Notas Montaje',    defaultWidth: 200, align: 'left',  sortable: false, truncate: true },
  { key: 'disassembled_at',     label: 'Fecha Desarmado',  defaultWidth: 140, align: 'left',  sortable: true,  isDate: true },
  { key: 'disassembly_notes',   label: 'Notas Desarmado',  defaultWidth: 200, align: 'left',  sortable: false, truncate: true },
];

const NUM_COL_WIDTH = 72;  // ancho fijo de la columna "#" (N° andamio)
const COL_MIN_WIDTH = 60;  // ancho mínimo al hacer resize

// ─── Helpers ─────────────────────────────────────────────────────────────────

const assemblyBadge: Record<string, { label: string; classes: string }> = {
  assembled:    { label: 'Armado',     classes: 'bg-green-100 text-green-800' },
  in_progress:  { label: 'En Proceso', classes: 'bg-amber-100 text-amber-800' },
  disassembled: { label: 'Desarmado',  classes: 'bg-red-100 text-red-800' },
};

const cardBadge: Record<string, { label: string; classes: string }> = {
  green: { label: 'Verde', classes: 'bg-green-100 text-green-700' },
  red:   { label: 'Roja',  classes: 'bg-red-100 text-red-700' },
};

function rowBorderColor(status: string): string {
  switch (status) {
    case 'assembled':    return 'border-l-green-400';
    case 'in_progress':  return 'border-l-amber-400';
    case 'disassembled': return 'border-l-red-400';
    default:             return 'border-l-gray-200';
  }
}

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

function getScaffoldValue(scaffold: Scaffold, key: string): unknown {
  return (scaffold as unknown as Record<string, unknown>)[key];
}

// ─── Icono de sort ────────────────────────────────────────────────────────────

function SortIcon({ direction }: { direction: SortDirection | null }) {
  if (direction === 'asc') {
    return (
      <svg className="w-3 h-3 inline-block ml-1 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 4l4 8H4l4-8z" />
      </svg>
    );
  }
  if (direction === 'desc') {
    return (
      <svg className="w-3 h-3 inline-block ml-1 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 12L4 4h8l-4 8z" />
      </svg>
    );
  }
  return (
    <svg className="w-3 h-3 inline-block ml-1 flex-shrink-0 opacity-40" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 3l3 5H5l3-5zm0 10l-3-5h6l-3 5z" />
    </svg>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

const ScaffoldTableView: React.FC<ScaffoldTableViewProps> = ({
  scaffolds,
  onScaffoldClick,
  statusFilter,
}) => {
  const filtroLabel =
    statusFilter && statusFilter !== 'all' ? (statusLabel[statusFilter] ?? statusFilter) : null;

  // ── Sorting ────────────────────────────────────────────────────────────────
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (!prev || prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return null; // 3er clic → resetea
    });
  };

  const sortedScaffolds = useMemo(() => {
    if (!sortConfig) return scaffolds;
    const { key, direction } = sortConfig;
    const col = COLUMNS.find((c) => c.key === key);
    return [...scaffolds].sort((a, b) => {
      const av = getScaffoldValue(a, key);
      const bv = getScaffoldValue(b, key);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      let cmp = 0;
      if (col?.isDate) {
        cmp = new Date(av as string).getTime() - new Date(bv as string).getTime();
      } else if (col?.isNumber) {
        cmp = Number(av) - Number(bv);
      } else {
        cmp = String(av).localeCompare(String(bv), 'es', { sensitivity: 'base' });
      }
      return direction === 'asc' ? cmp : -cmp;
    });
  }, [scaffolds, sortConfig]);

  // ── Resize de columnas ─────────────────────────────────────────────────────
  const initWidths = useMemo(() => {
    const map: Record<string, number> = {};
    COLUMNS.forEach((c) => { map[c.key] = c.defaultWidth; });
    return map;
  }, []);

  const [colWidths, setColWidths] = useState<Record<string, number>>(initWidths);

  const resizingKey = useRef<string | null>(null);
  const startX      = useRef(0);
  const startWidth  = useRef(0);
  const rafId       = useRef<number | null>(null);

  const handleResizeMouseMove = useCallback((e: MouseEvent) => {
    if (!resizingKey.current) return;
    const delta = e.clientX - startX.current;
    const next  = Math.max(COL_MIN_WIDTH, startWidth.current + delta);
    const key   = resizingKey.current;
    if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      setColWidths((prev) => ({ ...prev, [key]: next }));
    });
  }, []);

  const handleResizeMouseUp = useCallback(() => {
    resizingKey.current = null;
    document.removeEventListener('mousemove', handleResizeMouseMove);
    document.removeEventListener('mouseup', handleResizeMouseUp);
  }, [handleResizeMouseMove]);

  const handleResizeMouseDown = (key: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingKey.current = key;
    startX.current      = e.clientX;
    startWidth.current  = colWidths[key];
    document.addEventListener('mousemove', handleResizeMouseMove);
    document.addEventListener('mouseup', handleResizeMouseUp);
  };

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleResizeMouseMove);
      document.removeEventListener('mouseup', handleResizeMouseUp);
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    };
  }, [handleResizeMouseMove, handleResizeMouseUp]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Encabezado informativo */}
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm text-gray-500">
            {scaffolds.length} andamio{scaffolds.length !== 1 ? 's' : ''}
            {filtroLabel ? ` · filtrado por: ${filtroLabel}` : ''}
          </p>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded border">
            Solo lectura — Haz clic en una fila para ver detalles
          </span>
        </div>
        <p className="text-xs text-gray-400 md:hidden">← Desliza para ver más →</p>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] rounded-lg border border-gray-200 shadow-sm select-none">
        <table
          className="w-full border-collapse text-sm"
          style={{ tableLayout: 'fixed', minWidth: 'max-content' }}
        >
          {/* Colgroup para anchos */}
          <colgroup>
            <col style={{ width: NUM_COL_WIDTH, minWidth: NUM_COL_WIDTH }} />
            {COLUMNS.map((col) => (
              <col key={col.key} style={{ width: colWidths[col.key], minWidth: COL_MIN_WIDTH }} />
            ))}
          </colgroup>

          {/* THEAD sticky */}
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-100 text-slate-700">
              {/* Columna # (N° andamio) */}
              <th
                scope="col"
                aria-label="Número de andamio"
                className="sticky left-0 z-20 bg-slate-100 px-2 py-2.5 text-center font-semibold whitespace-nowrap border-r border-slate-300 text-xs"
                style={{ width: NUM_COL_WIDTH, minWidth: NUM_COL_WIDTH }}
              >
                #
              </th>

              {/* Columnas dinámicas */}
              {COLUMNS.map((col, i) => {
                const isLast = i === COLUMNS.length - 1;
                const dir    = sortConfig?.key === col.key ? sortConfig.direction : null;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    className={[
                      'relative px-3 py-2.5 font-semibold whitespace-nowrap text-xs',
                      col.align === 'right' ? 'text-right' : 'text-left',
                      !isLast ? 'border-r border-slate-300' : '',
                      col.sortable ? 'cursor-pointer hover:bg-slate-200 transition-colors' : '',
                    ].join(' ')}
                    style={{ width: colWidths[col.key], minWidth: COL_MIN_WIDTH }}
                    onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  >
                    <span className="inline-flex items-center gap-0.5">
                      {col.label}
                      {col.sortable && <SortIcon direction={dir} />}
                    </span>
                    {/* Handle de resize */}
                    <div
                      className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-blue-400/30 z-10"
                      onMouseDown={(e) => handleResizeMouseDown(col.key, e)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* TBODY */}
          <tbody>
            {sortedScaffolds.length === 0 ? (
              <tr>
                <td
                  colSpan={COLUMNS.length + 1}
                  className="text-center py-12 text-gray-500"
                >
                  No hay andamios que coincidan con el filtro seleccionado.
                </td>
              </tr>
            ) : (
              sortedScaffolds.map((scaffold) => {
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
                    className="bg-white cursor-pointer border-b border-gray-100 hover:bg-slate-50 transition-colors group"
                  >
                    {/* Columna # — muestra N° andamio y borde izquierdo por estado */}
                    <td
                      className={[
                        'sticky left-0 z-10 px-2 py-2 text-center font-medium text-gray-400',
                        'border-r border-gray-200 whitespace-nowrap',
                        'bg-white group-hover:bg-slate-50',
                        'border-l-4',
                        rowBorderColor(scaffold.assembly_status),
                      ].join(' ')}
                      style={{ width: NUM_COL_WIDTH, minWidth: NUM_COL_WIDTH }}
                    >
                      {scaffold.scaffold_number || scaffold.id}
                    </td>

                    {/* Nº Permiso */}
                    <td className="px-3 py-2 whitespace-nowrap border-r border-gray-100 overflow-hidden text-ellipsis">
                      {scaffold.permit_number || '—'}
                    </td>

                    {/* Área */}
                    <td className="px-3 py-2 whitespace-nowrap border-r border-gray-100 overflow-hidden text-ellipsis">
                      {scaffold.area || '—'}
                    </td>

                    {/* TAG */}
                    <td className="px-3 py-2 whitespace-nowrap border-r border-gray-100 overflow-hidden text-ellipsis">
                      {scaffold.tag || '—'}
                    </td>

                    {/* MOD */}
                    <td className="px-3 py-2 whitespace-nowrap border-r border-gray-100 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!scaffold.modulation_pdf_url) return;
                          window.open(scaffold.modulation_pdf_url, '_blank', 'noopener,noreferrer');
                        }}
                        disabled={!scaffold.modulation_pdf_url}
                        className={`h-7 min-w-7 px-2 rounded text-[11px] font-bold border ${
                          scaffold.modulation_pdf_url
                            ? 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700'
                            : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                        }`}
                        title={scaffold.modulation_pdf_url ? 'Abrir Modulación (PDF)' : 'Modulación no disponible'}
                      >
                        MOD
                      </button>
                    </td>

                    {/* MC */}
                    <td className="px-3 py-2 whitespace-nowrap border-r border-gray-100 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!scaffold.calculation_memory_pdf_url) return;
                          window.open(scaffold.calculation_memory_pdf_url, '_blank', 'noopener,noreferrer');
                        }}
                        disabled={!scaffold.calculation_memory_pdf_url}
                        className={`h-7 min-w-7 px-2 rounded text-[11px] font-bold border ${
                          scaffold.calculation_memory_pdf_url
                            ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700'
                            : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                        }`}
                        title={scaffold.calculation_memory_pdf_url ? 'Abrir Memoria de Cálculo (PDF)' : 'Memoria de Cálculo no disponible'}
                      >
                        MC
                      </button>
                    </td>

                    {/* Estado Armado */}
                    <td className="px-3 py-2 whitespace-nowrap border-r border-gray-100">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${asmBadge.classes}`}>
                        {asmBadge.label}
                      </span>
                    </td>

                    {/* Tarjeta */}
                    <td className="px-3 py-2 whitespace-nowrap border-r border-gray-100">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${crdBadge.classes}`}>
                        {crdBadge.label}
                      </span>
                    </td>

                    {/* % Avance */}
                    <td className="px-3 py-2 text-right whitespace-nowrap border-r border-gray-100">
                      {scaffold.progress_percentage}%
                    </td>

                    {/* Alto */}
                    <td className="px-3 py-2 text-right whitespace-nowrap border-r border-gray-100">
                      {Number(scaffold.height).toFixed(2)}
                    </td>

                    {/* Ancho */}
                    <td className="px-3 py-2 text-right whitespace-nowrap border-r border-gray-100">
                      {Number(scaffold.width).toFixed(2)}
                    </td>

                    {/* Largo */}
                    <td className="px-3 py-2 text-right whitespace-nowrap border-r border-gray-100">
                      {Number(scaffold.length).toFixed(2)}
                    </td>

                    {/* m³ */}
                    <td className="px-3 py-2 text-right whitespace-nowrap border-r border-gray-100">
                      {Number(scaffold.cubic_meters).toFixed(2)}
                    </td>

                    {/* Ubicación */}
                    <td className="px-3 py-2 whitespace-nowrap border-r border-gray-100 overflow-hidden text-ellipsis">
                      {scaffold.location || '—'}
                    </td>

                    {/* Observaciones */}
                    <td
                      className="px-3 py-2 whitespace-nowrap border-r border-gray-100 overflow-hidden text-ellipsis"
                      title={scaffold.observations || ''}
                    >
                      {scaffold.observations || '—'}
                    </td>

                    {/* Supervisor */}
                    <td className="px-3 py-2 whitespace-nowrap border-r border-gray-100 overflow-hidden text-ellipsis">
                      {scaffold.user_name || '—'}
                    </td>

                    {/* Creado Por */}
                    <td className="px-3 py-2 whitespace-nowrap border-r border-gray-100 overflow-hidden text-ellipsis">
                      {scaffold.created_by_name || '—'}
                    </td>

                    {/* Fecha Creación */}
                    <td className="px-3 py-2 whitespace-nowrap border-r border-gray-100">
                      {formatDate(scaffold.assembly_created_at)}
                    </td>

                    {/* Notas Montaje */}
                    <td
                      className="px-3 py-2 whitespace-nowrap border-r border-gray-100 overflow-hidden text-ellipsis"
                      title={scaffold.assembly_notes || ''}
                    >
                      {scaffold.assembly_notes || '—'}
                    </td>

                    {/* Fecha Desarmado */}
                    <td className="px-3 py-2 whitespace-nowrap border-r border-gray-100">
                      {formatDate(scaffold.disassembled_at)}
                    </td>

                    {/* Notas Desarmado */}
                    <td
                      className="px-3 py-2 whitespace-nowrap overflow-hidden text-ellipsis"
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
