import React, { useMemo, useState } from 'react';
import { useLoaderData } from 'react-router-dom';
import { useAuth } from '@/shell/context/AuthContext';
import { Project } from '../../types/api';
import { ResponsiveGrid } from '@/shell/layout';
import { formatNameParts } from '../../utils/name';
import ClientProjectCard from '../../components/ClientProjectCard';

/**
 * Dashboard para usuarios cliente
 * Permite visualizar los proyectos asignados y sus andamios
 */
const ClientDashboard: React.FC = () => {
  const { user } = useAuth();
  const { projects } = useLoaderData() as { projects: Project[] };
  const [searchTerm, setSearchTerm] = useState('');

  const totalProjects = projects?.length || 0;

  const statusSummary = useMemo(() => {
    return (projects || []).reduce(
      (acc, project) => {
        if (!project.active) {
          acc.inactive += 1;
          return acc;
        }

        if (project.status === 'completed') {
          acc.completed += 1;
          return acc;
        }

        acc.active += 1;
        return acc;
      },
      { active: 0, completed: 0, inactive: 0 },
    );
  }, [projects]);

  const filteredProjects = useMemo(() => {
    if (!projects?.length) return [];

    const normalizedTerm = searchTerm.trim().toLowerCase();
    if (!normalizedTerm) return projects;

    return projects.filter((project) => {
      return [
        project.name,
        project.client_name,
        project.contract_code,
        project.assigned_supervisor_name,
        project.assigned_client_name,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedTerm));
    });
  }, [projects, searchTerm]);

  const viewMode =
    filteredProjects.length === 1
      ? 'spotlight'
      : filteredProjects.length > 6
      ? 'compact'
      : 'standard';

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-dark-blue via-primary-blue to-blue-500 px-5 py-6 shadow-md sm:px-8 sm:py-8 reveal-soft">
        <div className="pointer-events-none absolute -top-16 right-0 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-12 h-40 w-40 rounded-full bg-cyan-300/20 blur-2xl" />

        <div className="relative z-10">
          <h1 className="heading-1 text-white mb-2">
            Bienvenido, {formatNameParts(user?.first_name, user?.last_name)}
          </h1>
          <p className="body-base text-blue-100 max-w-2xl sm:text-lg">
            Revisa el estado de tus proyectos y entra directo a la trazabilidad de andamios.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            <div className="rounded-lg border border-white/20 bg-white/10 p-3 backdrop-blur-sm">
              <p className="label-small text-blue-100">Total</p>
              <p className="stat-small text-white">{totalProjects}</p>
            </div>
            <div className="rounded-lg border border-white/20 bg-white/10 p-3 backdrop-blur-sm">
              <p className="label-small text-blue-100">Activos</p>
              <p className="stat-small text-white">{statusSummary.active}</p>
            </div>
            <div className="rounded-lg border border-white/20 bg-white/10 p-3 backdrop-blur-sm">
              <p className="label-small text-blue-100">Completados</p>
              <p className="stat-small text-white">{statusSummary.completed}</p>
            </div>
            <div className="rounded-lg border border-white/20 bg-white/10 p-3 backdrop-blur-sm">
              <p className="label-small text-blue-100">Inactivos</p>
              <p className="stat-small text-white">{statusSummary.inactive}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-md sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="heading-2 text-dark-blue">Mis Proyectos</h2>
            <p className="body-small text-neutral-gray">
            </p>
          </div>

          {totalProjects > 1 && (
            <div className="w-full sm:w-[320px]">
              <label htmlFor="client-project-search" className="label-small text-gray-600">
                Buscar proyecto
              </label>
              <input
                id="client-project-search"
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Nombre, contrato o responsable"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 body-small text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-blue"
              />
            </div>
          )}
        </div>

        {!projects || projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-light-gray-bg py-12 text-center">
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-3 heading-4 text-dark-blue">No hay proyectos asignados</h3>
            <p className="mt-1 body-small text-gray-600">
              Aun no tienes proyectos asignados. Contacta al administrador.
            </p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-6 text-center">
            <h3 className="heading-4 text-dark-blue">Sin resultados para tu busqueda</h3>
            <p className="mt-1 body-small text-gray-700">
              Ajusta el texto o limpia el filtro para volver a ver todos los proyectos.
            </p>
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="mt-4 rounded-lg bg-primary-blue px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-dark-blue"
            >
              Limpiar filtro
            </button>
          </div>
        ) : filteredProjects.length === 1 ? (
          <div className="mx-auto max-w-5xl">
            <ClientProjectCard
              project={filteredProjects[0]}
              linkTo={`/client/project/${filteredProjects[0].id}`}
              mode="spotlight"
              animationIndex={0}
            />
          </div>
        ) : (
          <ResponsiveGrid
            variant={filteredProjects.length > 6 ? 'auto' : 'cards'}
            gap={filteredProjects.length > 6 ? 'sm' : 'md'}
          >
            {filteredProjects.map((project, index) => (
              <ClientProjectCard
                key={project.id}
                project={project}
                linkTo={`/client/project/${project.id}`}
                mode={viewMode}
                animationIndex={index}
              />
            ))}
          </ResponsiveGrid>
        )}
      </section>

      <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800 reveal-soft">
        Como usuario cliente, esta vista es de solo lectura. Para cambios operativos, contacta a tu supervisor o al administrador del proyecto.
      </div>
    </div>
  );
};

export default ClientDashboard;
