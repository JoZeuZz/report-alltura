import React from 'react';

export interface ProjectControlStat {
  label: string;
  value: React.ReactNode;
}

export type ProjectControlActionVariant = 'primary' | 'neutral' | 'danger';

export interface ProjectControlAction {
  key: string;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  variant?: ProjectControlActionVariant;
  dataTour?: string;
  dataTourRoute?: string;
}

interface ProjectControlBarProps {
  contextLabel?: string;
  title: string;
  subtitle?: string;
  stats?: ProjectControlStat[];
  actions: ProjectControlAction[];
  children?: React.ReactNode;
  className?: string;
}

const actionBaseClass =
  'touch-target rounded-lg px-3 py-2 text-xs font-semibold transition-all sm:px-4 sm:text-sm disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500';

const actionVariantClass: Record<ProjectControlActionVariant, string> = {
  primary: 'bg-primary-blue text-white shadow-sm hover:bg-dark-blue',
  neutral: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
  danger: 'bg-red-500 text-white shadow-sm hover:bg-red-600',
};

const resolveActionClassName = (action: ProjectControlAction): string => {
  if (action.active) {
    return 'bg-primary-blue text-white shadow-md';
  }

  return actionVariantClass[action.variant || 'neutral'];
};

const ProjectControlBar: React.FC<ProjectControlBarProps> = ({
  contextLabel,
  title,
  subtitle,
  stats,
  actions,
  children,
  className = '',
}) => {
  return (
    <section
      className={`overflow-hidden rounded-xl border border-blue-100 bg-white shadow-md reveal-soft ${className}`.trim()}
    >
      <div className="bg-gradient-to-r from-dark-blue via-primary-blue to-blue-500 px-4 py-4 text-white sm:px-6 sm:py-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            {contextLabel && (
              <p className="label-small uppercase tracking-wide text-blue-100">{contextLabel}</p>
            )}
            <h1 className="heading-2 break-words text-white">{title}</h1>
            {subtitle && <p className="body-small text-blue-100 sm:text-base">{subtitle}</p>}
          </div>

          {Boolean(stats?.length) && (
            <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
              {stats?.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-center backdrop-blur-sm"
                >
                  <p className="label-small text-blue-100">{stat.label}</p>
                  <p className="text-lg font-semibold text-white">{stat.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
              data-tour={action.dataTour}
              data-tour-route={action.dataTourRoute}
              className={`${actionBaseClass} ${resolveActionClassName(action)}`.trim()}
            >
              {action.label}
            </button>
          ))}
        </div>

        {children}
      </div>
    </section>
  );
};

export default ProjectControlBar;
