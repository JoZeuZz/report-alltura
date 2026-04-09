import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '@/hooks/useNotifications';
import NotificationItem from './NotificationItem';
import { useAuth } from '@/shell/context/AuthContext';
import Modal from './Modal';
import { useMediaQuery } from '@/hooks/useMediaQuery';

interface NotificationBellProps {
  variant?: 'light' | 'dark';
}

export default function NotificationBell({ variant = 'light' }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useMediaQuery('(max-width: 639px)');
  
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotif,
  } = useNotifications({ autoRefresh: true, refreshInterval: 30000 });

  const closePanel = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Cerrar dropdown en desktop al hacer click fuera
  useEffect(() => {
    if (!isOpen || isMobile) {
      return undefined;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        closePanel();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, isMobile, closePanel]);

  // Cerrar por Escape en desktop y mobile
  useEffect(() => {
    if (!isOpen || isMobile) {
      return undefined;
    }

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closePanel();
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, isMobile, closePanel]);

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const recentNotifications = useMemo(() => notifications.slice(0, 5), [notifications]);

  // Estilos dinámicos basados en la variante
  const buttonClasses = variant === 'dark'
    ? "relative p-2 text-white hover:text-gray-200 hover:bg-gray-700 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
    : "relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500";

  const panelContent = (
    <div className="flex h-full flex-col bg-white">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50 flex-shrink-0">
        <h3 className="text-base font-semibold text-gray-900">Notificaciones</h3>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={() => {
                void handleMarkAllAsRead();
              }}
              className="text-sm text-primary-blue hover:text-dark-blue font-medium whitespace-nowrap"
            >
              {isMobile ? 'Marcar' : 'Marcar todas como leídas'}
            </button>
          )}
          {isMobile && (
            <button
              type="button"
              onClick={closePanel}
              className="text-gray-500 hover:text-gray-700 p-1 rounded-md"
              aria-label="Cerrar notificaciones"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-blue"></div>
          </div>
        ) : recentNotifications.length === 0 ? (
          <div className="text-center py-8 text-neutral-gray">
            <svg
              className="w-12 h-12 mx-auto mb-2 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
            <p className="text-sm">No hay notificaciones</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentNotifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={markAsRead}
                onDelete={deleteNotif}
                variant="compact"
                onInteractionEnd={closePanel}
              />
            ))}
          </div>
        )}
      </div>

      {recentNotifications.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <button
            onClick={() => {
              const notificationsUrl = user?.role ? `/${user.role}/notifications` : '/notifications';
              navigate(notificationsUrl);
              closePanel();
            }}
            className="text-sm text-primary-blue hover:text-dark-blue font-medium block text-center w-full"
          >
            Ver todas
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={buttonClasses}
        aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} no leídas)` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup={isMobile ? 'dialog' : 'menu'}
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full transform translate-x-1/2 -translate-y-1/2">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {!isMobile && isOpen && (
        <div
          className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden max-h-[32rem] flex flex-col"
          role="menu"
          aria-label="Notificaciones"
        >
          {panelContent}
        </div>
      )}

      {isMobile && (
        <Modal
          isOpen={isOpen}
          onClose={closePanel}
          title="Notificaciones"
          description="Panel de notificaciones recientes"
          showCloseButton={false}
          overlayClassName="!p-0 items-stretch sm:items-center sm:p-4"
          panelClassName="!p-0 !rounded-none !shadow-none !w-screen !max-w-none !h-screen !max-h-screen sm:!rounded-2xl sm:!max-w-md sm:!max-h-[80vh] sm:!shadow-2xl"
        >
          {panelContent}
        </Modal>
      )}
    </div>
  );
}
