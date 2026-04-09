import { useState, Fragment, useRef, useEffect, Suspense } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '@/shell/context/AuthContext';
import { useTour } from '@/shell/context/TourContext';
import TourOverlay from '@/shell/components/TourOverlay';
import type { TourRole } from '@/shell/utils/tourSteps';
import { getContextualStepsForRoute } from '@/shell/utils/tourSteps';
import { useBreakpoints } from '@/hooks';
import logoWhite from '@/assets/logo-alltura-white.png';
import UserIcon from '@/components/icons/UserIcon';
import NotificationBell from '@/shell/components/NotificationBell';
import { formatNameParts } from '@/utils/name';

// --- Iconos SVG ---
const MenuIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const ChevronDownIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const ChevronLeftIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const ChevronRightIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const SIDEBAR_STORAGE_KEY = 'sidebarCollapsed';

const AppLayout = () => {
  const { user, logout } = useAuth();
  const { startOnboarding, startContextual, isActive, steps, stepIndex } = useTour();
  const { isMobile } = useBreakpoints();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Estado inicial: expandida en desktop, cerrada en móvil.
  // En desktop se restaura desde localStorage para mantener preferencia.
  const [isSidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
    const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (saved !== null && isDesktop) {
      return !JSON.parse(saved); // invertir porque guardamos "collapsed"
    }
    return isDesktop; // true en desktop, false en móvil
  });
  
  const [isProfileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const hasAutoStartedTour = useRef(false);
  const autoOpenedSidebar = useRef(false);
  const guideTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (user?.role && !hasAutoStartedTour.current) {
      hasAutoStartedTour.current = true;
      startOnboarding(user.role as TourRole);
    }
  }, [startOnboarding, user?.role]);

  useEffect(() => {
    return () => {
      if (guideTimeoutRef.current) {
        window.clearTimeout(guideTimeoutRef.current);
        guideTimeoutRef.current = null;
      }
    };
  }, []);

  const currentStep = steps[stepIndex];

  useEffect(() => {
    if (!isMobile) {
      autoOpenedSidebar.current = false;
      return;
    }

    const isLauncherStep = Boolean(currentStep?.id && currentStep.id.includes('tour-launcher'));

    if (isActive && isLauncherStep) {
      if (!isSidebarOpen) {
        setSidebarOpen(true);
        autoOpenedSidebar.current = true;
      }
    } else if (autoOpenedSidebar.current) {
      setSidebarOpen(false);
      autoOpenedSidebar.current = false;
    }
  }, [currentStep?.id, isActive, isMobile, isSidebarOpen]);

  // Cerrar el menú de perfil al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };

    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isProfileMenuOpen]);

  // Cerrar menú de perfil al cambiar de ruta para evitar overlays colgados.
  useEffect(() => {
    setProfileMenuOpen(false);
  }, [location.pathname]);

  // Sincronizar comportamiento desktop/mobile al cambiar breakpoint.
  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');

    const applyLayoutState = (isDesktop: boolean) => {
      if (isDesktop) {
        const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY);
        if (saved !== null) {
          setSidebarOpen(!JSON.parse(saved));
          return;
        }
        setSidebarOpen(true);
        return;
      }

      setSidebarOpen(false);
      setProfileMenuOpen(false);
    };

    const handleChange = (event: MediaQueryListEvent) => {
      applyLayoutState(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Guardar estado de sidebar en localStorage (solo desktop)
  useEffect(() => {
    if (!isMobile) {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(!isSidebarOpen));
    }
  }, [isSidebarOpen, isMobile]);

  if (!user) {
    // O un spinner/loading component
    return null;
  }

  // Cierra la sidebar después de hacer clic en un enlace (móvil y escritorio).
  const handleLinkClick = () => {
    // Solo cerrar en móvil
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const roleLabel =
    user?.role === 'admin'
      ? 'Administrador'
      : user?.role === 'supervisor'
        ? 'Supervisor'
        : 'Cliente';

  const linkClass = `flex items-center px-3 py-2 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors ${
    !isSidebarOpen ? 'lg:justify-center lg:px-2' : ''
  }`;
  const activeLinkClass = `flex items-center px-3 py-2 text-white bg-primary-blue rounded-lg ${
    !isSidebarOpen ? 'lg:justify-center lg:px-2' : ''
  }`;
  const sectionTitleClass = `px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider ${
    !isSidebarOpen ? 'lg:hidden' : ''
  }`;

  const adminLinks = (
    <Fragment>
      {/* Dashboard */}
      <NavLink
        to="/admin/dashboard"
        onClick={handleLinkClick}
        className={({ isActive }) => (isActive ? activeLinkClass : linkClass)}
      >
        <svg className={`w-5 h-5 ${isSidebarOpen ? 'mr-3' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
        <span className={!isSidebarOpen ? 'lg:hidden' : ''}>Dashboard</span>
      </NavLink>

      {/* Operaciones */}
      <div className={sectionTitleClass}>Operaciones</div>
      <NavLink
        to="/admin/projects"
        onClick={handleLinkClick}
        className={({ isActive }) => (isActive ? activeLinkClass : linkClass)}
      >
        <svg className={`w-5 h-5 ${isSidebarOpen ? 'mr-3' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <span className={!isSidebarOpen ? 'lg:hidden' : ''}>Proyectos</span>
      </NavLink>
      <NavLink
        to="/admin/scaffolds"
        onClick={handleLinkClick}
        className={({ isActive }) => (isActive ? activeLinkClass : linkClass)}
      >
        <svg className={`w-5 h-5 ${isSidebarOpen ? 'mr-3' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <span className={!isSidebarOpen ? 'lg:hidden' : ''}>Andamios</span>
      </NavLink>

      {/* Catálogos */}
      <div className={sectionTitleClass + ' mt-4'}>Catálogos</div>
      <NavLink
        to="/admin/clients"
        className={({ isActive }) => (isActive ? activeLinkClass : linkClass)}
        onClick={handleLinkClick}
      >
        <svg className={`w-5 h-5 ${isSidebarOpen ? 'mr-3' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <span className={!isSidebarOpen ? 'lg:hidden' : ''}>Clientes</span>
      </NavLink>

      {/* Configuración */}
      <div className={sectionTitleClass + ' mt-4'}>Configuración</div>
      <NavLink
        to="/admin/users"
        onClick={handleLinkClick}
        className={({ isActive }) => (isActive ? activeLinkClass : linkClass)}
      >
        <svg className={`w-5 h-5 ${isSidebarOpen ? 'mr-3' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        <span className={!isSidebarOpen ? 'lg:hidden' : ''}>Usuarios del Sistema</span>
      </NavLink>
    </Fragment>
  );

  const supervisorLinks = (
    <Fragment>
      <NavLink
        to="/supervisor/dashboard"
        onClick={handleLinkClick}
        className={({ isActive }) => (isActive ? activeLinkClass : linkClass)}
      >
        <svg className={`w-5 h-5 ${isSidebarOpen ? 'mr-3' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <span className={!isSidebarOpen ? 'lg:hidden' : ''}>Mis Proyectos</span>
      </NavLink>
      <NavLink
        to="/supervisor/history"
        className={({ isActive }) => (isActive ? activeLinkClass : linkClass)}
        onClick={handleLinkClick}
      >
        <svg className={`w-5 h-5 ${isSidebarOpen ? 'mr-3' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className={!isSidebarOpen ? 'lg:hidden' : ''}>Historial</span>
      </NavLink>
    </Fragment>
  );

  const clientLinks = (
    <Fragment>
      <NavLink
        to="/client/dashboard"
        onClick={handleLinkClick}
        className={({ isActive }) => (isActive ? activeLinkClass : linkClass)}
      >
        <svg className={`w-5 h-5 ${isSidebarOpen ? 'mr-3' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
        <span className={!isSidebarOpen ? 'lg:hidden' : ''}>Mis Proyectos</span>
      </NavLink>
    </Fragment>
  );

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Skip to main content link */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary-blue focus:text-white focus:rounded-md"
      >
        Ir al contenido principal
      </a>

      {/* --- Overlay para móvil/tablet (solo visible cuando sidebar está abierto en pantallas < lg) --- */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        ></div>
      )}

      {/* --- Sidebar Responsive --- */}
      <nav
        aria-label="Navegación principal"
        data-tour="shell-sidebar"
        className={`fixed lg:static inset-y-0 left-0 z-40 bg-dark-blue text-white flex flex-col 
          transform lg:transform-none transition-all duration-300 ease-in-out
          ${isSidebarOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full lg:translate-x-0 lg:w-16'}`}
      >
        {/* Contenido de la Sidebar */}
        <div className={`flex flex-col h-full overflow-hidden transition-all duration-300 ${
          isSidebarOpen ? 'w-64' : 'w-64 lg:w-16'
        }`}>
          <div className="flex items-center justify-between h-20 border-b border-gray-700 px-4 flex-shrink-0 overflow-hidden">
            <img 
              src={logoWhite} 
              alt="Alltura Logo" 
              className={`h-12 w-auto transition-all duration-300 ${
                isSidebarOpen ? 'opacity-100' : 'opacity-100 lg:opacity-0 lg:absolute lg:-left-full'
              }`} 
            />
            {/* Botón de cerrar en móvil / Botón collapse en desktop */}
            <button 
              onClick={() => setSidebarOpen(!isSidebarOpen)} 
              className={`text-white flex-shrink-0 ${!isSidebarOpen ? 'lg:mx-auto' : ''}`}
              aria-label={isSidebarOpen ? "Contraer menú" : "Expandir menú"}
            >
              {isSidebarOpen ? <ChevronLeftIcon aria-hidden="true" /> : <ChevronRightIcon aria-hidden="true" />}
            </button>
          </div>
          <nav data-tour="shell-navigation" className="flex-1 px-2 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
            <div className={!isSidebarOpen ? 'lg:space-y-2' : ''}>
              {user?.role === 'admin' ? adminLinks : user?.role === 'supervisor' ? supervisorLinks : clientLinks}
            </div>
          </nav>
          
          {/* Botón de guía */}
          <div className="px-2 pb-2 border-t border-gray-700">
            <button
              type="button"
              data-tour="tour-launcher"
              onClick={() => {
                if (guideTimeoutRef.current) {
                  window.clearTimeout(guideTimeoutRef.current);
                }
                const contextualSteps = getContextualStepsForRoute(
                  user.role as TourRole,
                  location.pathname
                );
                if (contextualSteps.length === 0) {
                  toast('Aún no hay una guía disponible para esta pantalla.');
                  return;
                }
                if (isMobile) {
                  setSidebarOpen(false);
                  guideTimeoutRef.current = window.setTimeout(() => {
                    startContextual(user.role as TourRole, contextualSteps);
                  }, 150);
                } else {
                  startContextual(user.role as TourRole, contextualSteps);
                }
              }}
              title="Guía"
              className={`w-full flex items-center gap-2 p-2 mt-3 rounded-lg text-gray-300 hover:bg-gray-700 transition-colors ${
                !isSidebarOpen ? 'lg:justify-center' : ''
              }`}
            >
              <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.2 5.3 8.2 4.5 6 4.5a4 4 0 00-2 .5v13a4 4 0 012-.5c2.2 0 4.2.8 6 1.753m0-13c1.8-.953 3.8-1.753 6-1.753a4 4 0 012 .5v13a4 4 0 00-2-.5c-2.2 0-4.2.8-6 1.753"
                />
              </svg>
              <span className={!isSidebarOpen ? 'lg:hidden' : ''}>Guía</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Contenedor para Header y Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header Unificado */}
        <header data-tour="shell-header" className="bg-dark-blue text-white flex items-center justify-between p-4 z-30 shadow-lg flex-shrink-0 relative">
          <div className="flex items-center gap-2">
            {/* Botón de menú: solo visible en móvil/tablet */}
            <button
              type="button"
              data-tour="shell-mobile-menu-toggle"
              onClick={() => setSidebarOpen(!isSidebarOpen)}
              className="text-white lg:hidden p-2 -ml-2"
              aria-label={isSidebarOpen ? "Cerrar menú de navegación" : "Abrir menú de navegación"}
              aria-expanded={isSidebarOpen}
            >
              <MenuIcon aria-hidden="true" />
            </button>

            <img data-tour="shell-logo" src={logoWhite} alt="Alltura Logo" className="h-8 w-auto" />
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div data-tour="shell-notifications" className="p-1">
              <NotificationBell variant="dark" />
            </div>

            <div data-tour="shell-profile-menu" className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => setProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-700 transition-colors"
                aria-expanded={isProfileMenuOpen}
                aria-label="Abrir menú de perfil"
              >
                <div className="w-9 h-9 rounded-full bg-gray-500 flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {user.profile_picture_url ? (
                    <img src={user.profile_picture_url} alt="Perfil" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-5 h-5 text-gray-300" />
                  )}
                </div>

                <div className="hidden md:block text-left max-w-[180px]">
                  <p className="text-sm font-medium text-white truncate">
                    {formatNameParts(user?.first_name, user?.last_name)}
                  </p>
                  <p className="text-xs text-gray-300 truncate">{roleLabel}</p>
                </div>

                <ChevronDownIcon
                  className={`text-gray-300 transition-transform ${isProfileMenuOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isProfileMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-60 bg-gray-800 rounded-lg shadow-xl border border-gray-700 py-2 z-[100]">
                  <button
                    type="button"
                    onClick={() => {
                      navigate(`/${user.role}/profile`);
                      setProfileMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 flex items-center whitespace-nowrap"
                  >
                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Mi Perfil
                  </button>
                  <hr className="my-1 border-gray-700" />
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      setProfileMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700 flex items-center whitespace-nowrap"
                  >
                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Cerrar Sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* --- Main Content --- */}
        <main id="main-content" className="flex-1 w-full p-4 sm:p-6 lg:p-10 overflow-y-auto">
          <Suspense fallback={
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-blue"></div>
            </div>
          }>
            <Outlet />
          </Suspense>
        </main>
      </div>

      <TourOverlay />
    </div>
  )
};

export default AppLayout;
