import React from 'react';
import { Link } from 'react-router-dom';
import { Project } from '../types/api';

type ClientProjectCardMode = 'spotlight' | 'standard' | 'compact';

interface ClientProjectCardProps {
  project: Project;
  linkTo: string;
  mode?: ClientProjectCardMode;
  animationIndex?: number;
}

const formatDate = (dateString?: string): string => {
  if (!dateString) return 'Sin fecha';

  try {
    return new Date(dateString).toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  } catch {
    return 'Sin fecha';
  }
};

const ProjectStatusBadge: React.FC<{ project: Project }> = ({ project }) => {
  if (!project.active) {
    return (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-800">
        Proyecto inactivo
      </span>
    );
  }

  if (!project.client_active) {
    return (
      <span className="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-800">
        Cliente inactivo
      </span>
    );
  }

  if (project.status === 'completed') {
    return (
      <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
        Completado
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
      Activo
    </span>
  );
};

const ClientProjectCard: React.FC<ClientProjectCardProps> = ({
  project,
  linkTo,
  mode = 'standard',
  animationIndex = 0,
}) => {
  const isCompact = mode === 'compact';
  const isSpotlight = mode === 'spotlight';

  const cardPadding = isCompact ? 'p-4' : 'p-5';
  const panelPadding = isCompact ? 'p-4' : 'p-5';

  return (
    <Link
      to={linkTo}
      data-tour="client-projects"
      className="group block h-full reveal-up"
      style={{ animationDelay: `${Math.min(animationIndex * 70, 350)}ms` }}
    >
      <article className="h-full overflow-hidden rounded-xl border border-blue-100 bg-white shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
        <div className={`h-full ${isSpotlight ? 'lg:grid lg:grid-cols-[1.2fr_1fr]' : ''}`}>
          <div className={`${cardPadding} relative overflow-hidden`}>
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary-blue via-blue-500 to-cyan-500" />

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3
                  className={`${isCompact ? 'heading-4' : 'heading-3'} text-dark-blue leading-tight break-words`}
                  title={project.name}
                >
                  {project.name}
                </h3>
                <p className="mt-1 body-small text-neutral-gray break-words">{project.client_name}</p>
              </div>
              <ProjectStatusBadge project={project} />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {project.contract_code && (
                <span className="inline-flex items-center rounded-md border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-primary-blue">
                  Contrato {project.contract_code}
                </span>
              )}
              {typeof project.contracted_cubic_meters === 'number' && (
                <span className="inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700">
                  {project.contracted_cubic_meters.toFixed(2)} m3
                </span>
              )}
            </div>
          </div>

          <div className={`${panelPadding} border-t border-gray-100 bg-light-gray-bg/80 ${isSpotlight ? 'lg:border-l lg:border-t-0' : ''}`}>
            <dl className="space-y-2 text-sm text-gray-700">
              <div className="flex items-start justify-between gap-2">
                <dt className="label-base text-neutral-gray">Supervisor</dt>
                <dd className="text-right font-medium text-dark-blue break-words">
                  {project.assigned_supervisor_name || 'Sin asignar'}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-2">
                <dt className="label-base text-neutral-gray">Contacto cliente</dt>
                <dd className="text-right font-medium text-dark-blue break-words">
                  {project.assigned_client_name || 'Sin asignar'}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-2">
                <dt className="label-base text-neutral-gray">Creado</dt>
                <dd className="text-right font-medium text-dark-blue">{formatDate(project.created_at)}</dd>
              </div>
            </dl>

            <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-blue px-3 py-2 text-sm font-semibold text-white transition-colors duration-300 group-hover:bg-dark-blue">
              Ver andamios
              <svg className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
};

export default ClientProjectCard;
