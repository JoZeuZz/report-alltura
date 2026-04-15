import React, { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/shell/context/AuthContext';
import { TourProvider } from '@/shell/context/TourContext';
import { router } from './router';

// Servicios
import { notificationService } from '@/shell/services/notificationService';
import { performanceService } from '@/shell/services/performanceService';

const SCROLLBAR_SELECTOR =
  '.app-scrollbar, .app-scrollbar-subtle, .app-scrollbar-contrast, .app-scrollbar-dark, .scrollbar-thin';
const SCROLLBAR_ACTIVE_CLASS = 'app-scrollbar-active';
const SCROLLBAR_IDLE_TIMEOUT_MS = 650;

const AppContent: React.FC = () => {
  useEffect(() => {
    // MODO DESARROLLO: Desregistrar service workers existentes
    notificationService.unregisterAll();
    
    // Inicializar notificaciones push
    // TEMPORALMENTE DESACTIVADO: notificationService.initialize();
    
    // Inicializar métricas de performance
    performanceService.initialize();

    const hideTimeouts = new Map<HTMLElement, number>();

    const clearHideTimeout = (element: HTMLElement) => {
      const timeoutId = hideTimeouts.get(element);
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
        hideTimeouts.delete(element);
      }
    };

    const scheduleHide = (element: HTMLElement, delay = SCROLLBAR_IDLE_TIMEOUT_MS) => {
      clearHideTimeout(element);
      const timeoutId = window.setTimeout(() => {
        element.classList.remove(SCROLLBAR_ACTIVE_CLASS);
        hideTimeouts.delete(element);
      }, delay);
      hideTimeouts.set(element, timeoutId);
    };

    const findScrollableTarget = (target: EventTarget | null): HTMLElement | null => {
      if (!(target instanceof Element)) {
        return null;
      }

      const match = target.closest(SCROLLBAR_SELECTOR);
      return match instanceof HTMLElement ? match : null;
    };

    // Mantiene el scrollbar visible solo durante la interacción del usuario.
    const activateScrollbar = (element: HTMLElement) => {
      if (!element.matches(SCROLLBAR_SELECTOR)) {
        return;
      }

      element.classList.add(SCROLLBAR_ACTIVE_CLASS);
      scheduleHide(element);
    };

    const handleScroll = (event: Event) => {
      if (event.target instanceof HTMLElement && event.target.matches(SCROLLBAR_SELECTOR)) {
        activateScrollbar(event.target);
        return;
      }

      const element = findScrollableTarget(event.target);
      if (element) {
        activateScrollbar(element);
      }
    };

    const handleWheel = (event: WheelEvent) => {
      const element = findScrollableTarget(event.target);
      if (element) {
        activateScrollbar(element);
      }
    };

    const handlePointerOver = (event: PointerEvent) => {
      const element = findScrollableTarget(event.target);
      if (!element) {
        return;
      }

      clearHideTimeout(element);
      element.classList.add(SCROLLBAR_ACTIVE_CLASS);
    };

    const handlePointerOut = (event: PointerEvent) => {
      const element = findScrollableTarget(event.target);
      if (!element) {
        return;
      }

      if (event.relatedTarget instanceof Node && element.contains(event.relatedTarget)) {
        return;
      }

      scheduleHide(element, 140);
    };

    document.addEventListener('scroll', handleScroll, true);
    document.addEventListener('wheel', handleWheel, { capture: true, passive: true });
    document.addEventListener('pointerover', handlePointerOver, true);
    document.addEventListener('pointerout', handlePointerOut, true);

    return () => {
      document.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('wheel', handleWheel, true);
      document.removeEventListener('pointerover', handlePointerOver, true);
      document.removeEventListener('pointerout', handlePointerOut, true);

      hideTimeouts.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      hideTimeouts.clear();
    };
  }, []);

  return null; // Este componente solo maneja efectos
};

function App() {
  return (
    <AuthProvider>
      <TourProvider>
        <Toaster
          position="top-right"
          reverseOrder={false}
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              duration: 5000,
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
        <AppContent />
        <RouterProvider router={router} />
      </TourProvider>
    </AuthProvider>
  );
}

export default App;
