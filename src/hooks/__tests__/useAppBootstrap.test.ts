import { act, renderHook } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useAuthStore, useSubscriptionStore } from '../../store';
import { initializePurchases } from '../../services/subscription';
import {
  registerForPushNotifications,
  savePushToken,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  updateBadgeCount,
} from '../../services/notifications';
import { useAppBootstrap } from '../useAppBootstrap';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.mock('../../store', () => ({
  useAuthStore: jest.fn(),
  useSubscriptionStore: jest.fn(),
}));

jest.mock('../../services/subscription', () => ({
  initializePurchases: jest.fn(),
}));

jest.mock('../../services/notifications', () => ({
  registerForPushNotifications: jest.fn(),
  savePushToken: jest.fn(),
  addNotificationReceivedListener: jest.fn(),
  addNotificationResponseListener: jest.fn(),
  updateBadgeCount: jest.fn(),
}));

describe('useAppBootstrap', () => {
  const initialize = jest.fn();
  const startListening = jest.fn();
  const stopListening = jest.fn();
  const removeReceivedListener = jest.fn();
  const removeResponseListener = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      initialize,
      isInitialized: true,
      user: null,
    });
    (useSubscriptionStore as unknown as jest.Mock).mockReturnValue({ startListening });
    startListening.mockReturnValue(stopListening);
    (initializePurchases as jest.Mock).mockResolvedValue(undefined);
    (registerForPushNotifications as jest.Mock).mockResolvedValue(null);
    (updateBadgeCount as jest.Mock).mockResolvedValue(undefined);
    (addNotificationReceivedListener as jest.Mock).mockReturnValue({ remove: removeReceivedListener });
    (addNotificationResponseListener as jest.Mock).mockReturnValue({ remove: removeResponseListener });
  });

  it('llama a initialize() al montar', async () => {
    await renderHook(() => useAppBootstrap());
    await act(async () => {});

    expect(initialize).toHaveBeenCalledTimes(1);
  });

  it('devuelve isInitialized del store', async () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({ initialize, isInitialized: false, user: null });

    const { result } = await renderHook(() => useAppBootstrap());
    await act(async () => {});

    expect(result.current.isInitialized).toBe(false);
  });

  it('sin usuario, no configura RevenueCat, push ni listeners', async () => {
    await renderHook(() => useAppBootstrap());
    await act(async () => {});

    expect(initializePurchases).not.toHaveBeenCalled();
    expect(registerForPushNotifications).not.toHaveBeenCalled();
    expect(updateBadgeCount).not.toHaveBeenCalled();
    expect(addNotificationReceivedListener).not.toHaveBeenCalled();
  });

  it('con usuario, inicializa RevenueCat, arranca el listener, registra push y limpia el badge', async () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      initialize,
      isInitialized: true,
      user: { id: 'user-1' },
    });
    (registerForPushNotifications as jest.Mock).mockResolvedValue('push-token-abc');

    await renderHook(() => useAppBootstrap());
    await act(async () => {});

    expect(initializePurchases).toHaveBeenCalledWith('user-1');
    expect(startListening).toHaveBeenCalledTimes(1);
    expect(registerForPushNotifications).toHaveBeenCalledTimes(1);
    expect(savePushToken).toHaveBeenCalledWith('user-1', 'push-token-abc');
    expect(updateBadgeCount).toHaveBeenCalledTimes(1);
    expect(addNotificationReceivedListener).toHaveBeenCalledTimes(1);
    expect(addNotificationResponseListener).toHaveBeenCalledTimes(1);
  });

  it('no guarda el push token si registerForPushNotifications devuelve null', async () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      initialize,
      isInitialized: true,
      user: { id: 'user-1' },
    });

    await renderHook(() => useAppBootstrap());
    await act(async () => {});

    expect(savePushToken).not.toHaveBeenCalled();
  });

  it('al tocar una notificación de pago vencido con loanId, navega al préstamo', async () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      initialize,
      isInitialized: true,
      user: { id: 'user-1' },
    });

    await renderHook(() => useAppBootstrap());
    await act(async () => {});

    const responseCallback = (addNotificationResponseListener as jest.Mock).mock.calls[0][0];
    await act(() => {
      responseCallback({
        notification: { request: { content: { data: { type: 'payment_overdue', loanId: 'loan-1' } } } },
      });
    });

    expect(router.push).toHaveBeenCalledWith('/(main)/loans/loan-1');
  });

  it('al tocar una notificación de comentario de prestatario con loanId, navega al préstamo', async () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      initialize,
      isInitialized: true,
      user: { id: 'user-1' },
    });

    await renderHook(() => useAppBootstrap());
    await act(async () => {});

    const responseCallback = (addNotificationResponseListener as jest.Mock).mock.calls[0][0];
    await act(() => {
      responseCallback({
        notification: { request: { content: { data: { type: 'borrower_comment', loanId: 'loan-2' } } } },
      });
    });

    expect(router.push).toHaveBeenCalledWith('/(main)/loans/loan-2');
  });

  it('no navega si la notificación no trae loanId', async () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      initialize,
      isInitialized: true,
      user: { id: 'user-1' },
    });

    await renderHook(() => useAppBootstrap());
    await act(async () => {});

    const responseCallback = (addNotificationResponseListener as jest.Mock).mock.calls[0][0];
    await act(() => {
      responseCallback({ notification: { request: { content: { data: { type: 'payment_reminder' } } } } });
    });

    expect(router.push).not.toHaveBeenCalled();
  });

  it('al desmontar (o cuando el usuario cambia), limpia el listener de RevenueCat y las suscripciones', async () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      initialize,
      isInitialized: true,
      user: { id: 'user-1' },
    });

    const { unmount } = await renderHook(() => useAppBootstrap());
    await act(async () => {});

    await act(async () => {
      await unmount();
    });

    expect(stopListening).toHaveBeenCalledTimes(1);
    expect(removeReceivedListener).toHaveBeenCalledTimes(1);
    expect(removeResponseListener).toHaveBeenCalledTimes(1);
  });
});
