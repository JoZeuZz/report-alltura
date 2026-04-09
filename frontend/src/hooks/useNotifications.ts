import { useState, useEffect, useCallback } from 'react';
import {
  getInAppNotifications,
  getUnreadNotificationsCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteAllReadNotifications,
  getNotificationStats,
} from '@/shell/services/apiService';
import type {
  InAppNotification,
  NotificationStats,
} from '../types/clientNotes';

const DEFAULT_REFRESH_INTERVAL = 30000;

type PollListener = () => void;

type PollingEntry = {
  timerId: ReturnType<typeof window.setInterval>;
  listeners: Set<PollListener>;
};

const pollingRegistry = new Map<number, PollingEntry>();

const subscribeToSharedPolling = (intervalMs: number, listener: PollListener) => {
  const existingEntry = pollingRegistry.get(intervalMs);

  if (existingEntry) {
    existingEntry.listeners.add(listener);
  } else {
    const listeners = new Set<PollListener>([listener]);
    const timerId = window.setInterval(() => {
      listeners.forEach((callback) => callback());
    }, intervalMs);

    pollingRegistry.set(intervalMs, { timerId, listeners });
  }

  return () => {
    const current = pollingRegistry.get(intervalMs);
    if (!current) {
      return;
    }

    current.listeners.delete(listener);

    if (current.listeners.size === 0) {
      window.clearInterval(current.timerId);
      pollingRegistry.delete(intervalMs);
    }
  };
};

/**
 * Hook para gestionar notificaciones in-app
 */
export const useNotifications = (params?: {
  unreadOnly?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
  limit?: number;
  offset?: number;
}) => {
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setError(null);
      const response = (await getInAppNotifications({
        unread_only: params?.unreadOnly,
        limit: params?.limit || 20,
        offset: params?.offset || 0,
      })) as { data: InAppNotification[]; total?: number };
      setNotifications(response.data || []);
      if (response.total !== undefined) {
        setTotal(response.total);
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Error al cargar notificaciones';
      setError(errorMessage);
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [params?.unreadOnly, params?.limit, params?.offset]);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await getUnreadNotificationsCount();
      setUnreadCount(response.count);
    } catch (err: unknown) {
      console.error('Error fetching unread count:', err);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, [fetchNotifications, fetchUnreadCount]);

  const runRefreshCycle = useCallback(() => {
    void fetchNotifications();
    void fetchUnreadCount();
  }, [fetchNotifications, fetchUnreadCount]);

  // Auto-refresh compartido para evitar timers duplicados por componente
  useEffect(() => {
    if (!params?.autoRefresh) {
      return undefined;
    }

    const intervalMs = params.refreshInterval || DEFAULT_REFRESH_INTERVAL;
    return subscribeToSharedPolling(intervalMs, runRefreshCycle);
  }, [params?.autoRefresh, params?.refreshInterval, runRefreshCycle]);

  const markAsRead = async (notificationId: number) => {
    try {
      await markNotificationAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === notificationId
            ? { ...notif, is_read: true, read_at: new Date().toISOString() }
            : notif
        )
      );
      await fetchUnreadCount();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Error al marcar como leída';
      throw new Error(errorMessage);
    }
  };

  const markAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();
      await fetchNotifications();
      await fetchUnreadCount();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Error al marcar todas como leídas';
      throw new Error(errorMessage);
    }
  };

  const deleteNotif = async (notificationId: number) => {
    try {
      await deleteNotification(notificationId);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      await fetchUnreadCount();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Error al eliminar notificación';
      throw new Error(errorMessage);
    }
  };

  const clearAllRead = async () => {
    try {
      await deleteAllReadNotifications();
      await fetchNotifications();
      await fetchUnreadCount();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Error al limpiar notificaciones leídas';
      throw new Error(errorMessage);
    }
  };

  return {
    notifications,
    unreadCount,
    total,
    loading,
    error,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotif,
    clearAllRead,
  };
};

/**
 * Hook para estadísticas de notificaciones
 */
export const useNotificationStats = () => {
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = (await getNotificationStats()) as {
        data: NotificationStats;
      };
      setStats(response.data);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Error al cargar estadísticas';
      setError(errorMessage);
      console.error('Error fetching notification stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, fetchStats };
};
