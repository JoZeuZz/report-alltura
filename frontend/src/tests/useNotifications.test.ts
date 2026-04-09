import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNotifications } from '../hooks/useNotifications';

const apiMocks = vi.hoisted(() => ({
  getInAppNotificationsMock: vi.fn(),
  getUnreadNotificationsCountMock: vi.fn(),
  markNotificationAsReadMock: vi.fn(),
  markAllNotificationsAsReadMock: vi.fn(),
  deleteNotificationMock: vi.fn(),
  deleteAllReadNotificationsMock: vi.fn(),
  getNotificationStatsMock: vi.fn(),
}));

vi.mock('@/shell/services/apiService', () => ({
  getInAppNotifications: apiMocks.getInAppNotificationsMock,
  getUnreadNotificationsCount: apiMocks.getUnreadNotificationsCountMock,
  markNotificationAsRead: apiMocks.markNotificationAsReadMock,
  markAllNotificationsAsRead: apiMocks.markAllNotificationsAsReadMock,
  deleteNotification: apiMocks.deleteNotificationMock,
  deleteAllReadNotifications: apiMocks.deleteAllReadNotificationsMock,
  getNotificationStats: apiMocks.getNotificationStatsMock,
}));

describe('useNotifications polling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    apiMocks.getInAppNotificationsMock.mockResolvedValue({ data: [], total: 0 });
    apiMocks.getUnreadNotificationsCountMock.mockResolvedValue({ count: 0 });
    apiMocks.markNotificationAsReadMock.mockResolvedValue({});
    apiMocks.markAllNotificationsAsReadMock.mockResolvedValue({});
    apiMocks.deleteNotificationMock.mockResolvedValue({});
    apiMocks.deleteAllReadNotificationsMock.mockResolvedValue({});
    apiMocks.getNotificationStatsMock.mockResolvedValue({ data: null });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('comparte un solo timer entre múltiples instancias con el mismo intervalo', async () => {
    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');

    const first = renderHook(() =>
      useNotifications({
        autoRefresh: true,
        refreshInterval: 30000,
      })
    );

    const second = renderHook(() =>
      useNotifications({
        autoRefresh: true,
        refreshInterval: 30000,
      })
    );

    await flushEffects();

    expect(apiMocks.getInAppNotificationsMock).toHaveBeenCalledTimes(2);
    expect(apiMocks.getUnreadNotificationsCountMock).toHaveBeenCalledTimes(2);

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(30000);
    });

    await flushEffects();

    expect(apiMocks.getInAppNotificationsMock).toHaveBeenCalledTimes(4);
    expect(apiMocks.getUnreadNotificationsCountMock).toHaveBeenCalledTimes(4);

    first.unmount();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(0);

    second.unmount();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });

  it('no crea timer cuando autoRefresh es false', async () => {
    const setIntervalSpy = vi.spyOn(window, 'setInterval');

    const instance = renderHook(() =>
      useNotifications({
        autoRefresh: false,
      })
    );

    await flushEffects();

    expect(apiMocks.getInAppNotificationsMock).toHaveBeenCalledTimes(1);
    expect(apiMocks.getUnreadNotificationsCountMock).toHaveBeenCalledTimes(1);

    expect(setIntervalSpy).not.toHaveBeenCalled();
    instance.unmount();
  });
});

const flushEffects = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};
