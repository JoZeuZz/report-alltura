import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { saveAs } from 'file-saver';

const ReportViewerPage = () => {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchParams] = useSearchParams();

  // On mount, check for URL params to auto-select project/report
  useEffect(() => {
    const projectIdFromUrl = searchParams.get('projectId');
    if (projectIdFromUrl) {
      setSelectedProjectId(projectIdFromUrl);
    }
  }, [searchParams]);

  // Fetch projects for the selector
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const { data } = await api.get('/projects');
        setProjects(data);
      } catch (error) {
        console.error('Failed to fetch projects', error);
      }
    };
    fetchProjects();
  }, []);

  // Fetch reports when a project is selected
  useEffect(() => {
    if (selectedProjectId) {
      const fetchReports = async () => {
        try {
          const { data } = await api.get(`/reports/project/${selectedProjectId}`);
          setReports(data);
        } catch (error) {
          console.error('Failed to fetch reports', error);
          setReports([]);
        }
      };
      fetchReports();
    } else {
      setReports([]);
    }
  }, [selectedProjectId]);

  // When reports are loaded, check if we need to auto-open a modal
  useEffect(() => {
    const reportIdFromUrl = searchParams.get('reportId');
    if (reportIdFromUrl && reports.length > 0) {
      const reportToSelect = reports.find(r => r.id === parseInt(reportIdFromUrl));
      if (reportToSelect) {
        setSelectedReport(reportToSelect);
      }
    }
  }, [reports, searchParams]);

  const filteredReports = useMemo(() => {
    return reports.filter(report => {
      const reportDate = new Date(report.created_at);
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      if (start && reportDate < start) return false;
      if (end && reportDate > end) return false;
      return true;
    });
  }, [reports, startDate, endDate]);

  const handleExport = async (format) => {
    if (!selectedProjectId) return;
    const endpoint = format === 'pdf' ? `/projects/${selectedProjectId}/export/pdf` : `/projects/${selectedProjectId}/export/excel`;
    const extension = format === 'pdf' ? 'pdf' : 'xlsx';
    try {
      const response = await api.get(endpoint, { responseType: 'blob' });
      const selectedProject = projects.find(p => p.id === parseInt(selectedProjectId));
      const projectName = selectedProject ? selectedProject.name : 'reporte';
      saveAs(response.data, `reporte_${projectName.replace(/\s+/g, '_')}.${extension}`);
    } catch (error) {
      console.error(`Failed to export ${format}`, error);
    }
  };

  return (
    <div>
      <h1 className="text-4xl font-bold text-dark-blue mb-8">Visualizador de Reportes</h1>

      {/* Controls */}
      <div className="bg-white p-4 rounded-lg shadow-md mb-8 flex flex-wrap items-center gap-4">
        <div className="flex-grow min-w-[200px]">
          <label htmlFor="project-select" className="block text-sm font-medium text-neutral-gray">Proyecto</label>
          <select 
            id="project-select"
            value={selectedProjectId} 
            onChange={e => setSelectedProjectId(e.target.value)} 
            className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-blue focus:border-primary-blue sm:text-sm"
          >
            <option value="" disabled>Selecciona un proyecto</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="start-date" className="block text-sm font-medium text-neutral-gray">Desde</label>
          <input type="date" id="start-date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-blue focus:border-primary-blue sm:text-sm" />
        </div>
        <div>
          <label htmlFor="end-date" className="block text-sm font-medium text-neutral-gray">Hasta</label>
          <input type="date" id="end-date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-blue focus:border-primary-blue sm:text-sm" />
        </div>
        <div className="flex items-end space-x-2">
          <button onClick={() => handleExport('pdf')} disabled={!selectedProjectId} className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-blue disabled:opacity-50">Exportar PDF</button>
          <button onClick={() => handleExport('excel')} disabled={!selectedProjectId} className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-blue disabled:opacity-50">Exportar Excel</button>
        </div>
      </div>

      {/* Report Grid */}
      {selectedProjectId ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredReports.length > 0 ? filteredReports.map(report => (
            <div key={report.id} className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer transform hover:-translate-y-1 transition-transform duration-300" onClick={() => setSelectedReport(report)}>
              <img src={report.image_url} alt="Reporte" className="h-48 w-full object-cover" />
              <div className="p-4">
                <p className="text-lg font-bold text-dark-blue">{report.cubic_meters} m³</p>
                <p className="text-sm text-neutral-gray">{report.user_name || 'N/A'}</p>
                <p className="text-sm text-neutral-gray">{new Date(report.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          )) : (
            <p className="text-neutral-gray col-span-full text-center">No se encontraron reportes para este proyecto y rango de fechas.</p>
          )}
        </div>
      ) : (
        <div className="text-center py-10 bg-white rounded-lg shadow-md">
          <p className="text-neutral-gray">Por favor, selecciona un proyecto para ver sus reportes.</p>
        </div>
      )}

      {/* Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={() => setSelectedReport(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-full overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 sm:p-6">
              <img src={selectedReport.image_url} alt="Reporte Detallado" className="rounded-lg w-full object-contain max-h-[70vh]" />
              <div className="mt-4">
                <h3 className="text-2xl font-bold text-dark-blue">Detalles del Reporte</h3>
                <p className="mt-2"><strong>Metros Cúbicos:</strong> {selectedReport.cubic_meters} m³</p>
                <p><strong>Progreso:</strong> {selectedReport.progress_percentage}%</p>
                <p><strong>Técnico:</strong> {selectedReport.user_name || 'N/A'}</p>
                <p><strong>Fecha:</strong> {new Date(selectedReport.created_at).toLocaleString()}</p>
                {selectedReport.notes && <p className="mt-2"><strong>Notas:</strong> {selectedReport.notes}</p>}
              </div>
              <div className="mt-6 text-right">
                <button onClick={() => setSelectedReport(null)} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-blue hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-blue">Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportViewerPage;