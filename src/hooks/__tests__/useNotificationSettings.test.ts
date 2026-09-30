import { act, renderHook } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { usePreferencesStore } from '../../store';
import {
  getNotificationPreferences,
  saveNotificationPreferences,
  getActiveLoans,
  getPaymentsByLoan,
  getActivePersonalDebts,
  getDebtPayments,
} from '../../services/supabase';
import {
  cancelAllScheduledNotifications,
  schedulePaymentReminders,
  scheduleDebtPaymentReminders,
  scheduleLocalNotification,
  updateBadgeCount,
} from '../../services/notifications';
import { useToast } from '../../components';
import { useNotificationSettings } from '../useNotificationSettings';

jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
}));

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
}));

jest.mock('../../store', () => ({
  usePreferencesStore: jest.fn(),
}));

jest.mock('../../services/supabase', () => ({
  getNotificationPreferences: jest.fn(),
  saveNotificationPreferences: jest.fn(),
  getActiveLoans: jest.fn(),
  getPaymentsByLoan: jest.fn(),
  getActivePersonalDebts: jest.fn(),
  getDebtPayments: jest.fn(),
}));

jest.mock('../../services/notifications', () => ({
  cancelAllScheduledNotifications: jest.fn(),
  schedulePaymentReminders: jest.fn(),
  scheduleDebtPaymentReminders: jest.fn(),
  scheduleLocalNotification: jest.fn(),
  updateBadgeCount: jest.fn(),
}));

jest.mock('../../components', () => ({
  useToast: jest.fn(),
}));

describe('useNotificationSettings', () => {
  const setReminderDaysBefore = jest.fn();
  const setPushEnabled = jest.fn();
  const showSuccess = jest.fn();
  const showError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (usePreferencesStore as unknown as jest.Mock).mockReturnValue({
      reminderDaysBefore: 3,
      pushEnabled: true,
      setReminderDaysBefore,
      setPushEnabled,
    });
    (useToast as unknown as jest.Mock).mockReturnValue({ showSuccess, showError });
    (getNotificationPreferences as jest.Mock).mockResolvedValue(null);
    (getActiveLoans as jest.Mock).mockResolvedValue([]);
    (getActivePersonalDebts as jest.Mock).mockResolvedValue([]);
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('empieza con los valores del store local mientras no llegó la respuesta de Supabase', async () => {
    const { result } = await renderHook(() => useNotificationSettings());

    expect(result.current.localDays).toBe(3);
    expect(result.current.localPush).toBe(true);
  });

  it('al montar, si Supabase tiene preferencias guardadas, sincroniza el estado local y el store', async () => {
    (getNotificationPreferences as jest.Mock).mockResolvedValue({
      reminder_days_before: 7,
      push_enabled: false,
    });

    const { result } = await renderHook(() => useNotificationSettings());
    await act(async () => {});

    expect(result.current.localDays).toBe(7);
    expect(result.current.localPush).toBe(false);
    expect(setReminderDaysBefore).toHaveBeenCalledWith(7);
    expect(setPushEnabled).toHaveBeenCalledWith(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('si falla la carga de preferencias, mantiene los valores del store sin romper', async () => {
    (getNotificationPreferences as jest.Mock).mockRejectedValue(new Error('network'));

    const { result } = await renderHook(() => useNotificationSettings());
    await act(async () => {});

    expect(result.current.localDays).toBe(3);
    expect(result.current.isLoading).toBe(false);
  });

  it('handleTestNotification con permiso ya concedido programa la notificación y avisa', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (scheduleLocalNotification as jest.Mock).mockResolvedValue('abcdefgh-1234');
    const { result } = await renderHook(() => useNotificationSettings());
    await act(async () => {});

    await act(async () => {
      await result.current.handleTestNotification();
    });

    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(scheduleLocalNotification).toHaveBeenCalledTimes(1);
    expect(updateBadgeCount).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith('Listo ✓', expect.stringContaining('abcdefgh'), expect.anything());
  });

  it('handleTestNotification pide permiso si no está concedido, y avisa si lo vuelven a negar', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined' });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
    const { result } = await renderHook(() => useNotificationSettings());
    await act(async () => {});

    await act(async () => {
      await result.current.handleTestNotification();
    });

    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith('Sin permisos', expect.stringContaining('denied'));
    expect(scheduleLocalNotification).not.toHaveBeenCalled();
  });

  it('handleTestNotification avisa error si scheduleLocalNotification devuelve null', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (scheduleLocalNotification as jest.Mock).mockResolvedValue(null);
    const { result } = await renderHook(() => useNotificationSettings());
    await act(async () => {});

    await act(async () => {
      await result.current.handleTestNotification();
    });

    expect(Alert.alert).toHaveBeenCalledWith('Error', expect.stringContaining('scheduleLocalNotification'));
  });

  it('handleTestNotification captura excepciones inesperadas', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockRejectedValue(new Error('boom'));
    const { result } = await renderHook(() => useNotificationSettings());
    await act(async () => {});

    await act(async () => {
      await result.current.handleTestNotification();
    });

    expect(Alert.alert).toHaveBeenCalledWith('Error inesperado', 'boom');
    expect(result.current.isTesting).toBe(false);
  });

  it('handleSave: camino feliz -- guarda, actualiza el store, reprograma recordatorios y vuelve atrás', async () => {
    (saveNotificationPreferences as jest.Mock).mockResolvedValue(undefined);
    (getActiveLoans as jest.Mock).mockResolvedValue([{ id: 'loan-1', borrower: { full_name: 'Ana' } }]);
    (getPaymentsByLoan as jest.Mock).mockResolvedValue([
      { id: 'p1', due_date: '2026-02-01', total_amount: 1000, payment_number: 1 },
    ]);
    (getActivePersonalDebts as jest.Mock).mockResolvedValue([{ id: 'debt-1', creditor_name: 'Banco' }]);
    (getDebtPayments as jest.Mock).mockResolvedValue([
      { id: 'dp1', due_date: '2026-02-05', total_amount: 500, payment_number: 1 },
    ]);
    const { result } = await renderHook(() => useNotificationSettings());
    await act(async () => {});
    await act(() => {
      result.current.setLocalDays(5);
      result.current.setLocalPush(false);
    });

    await act(async () => {
      await result.current.handleSave();
    });

    expect(saveNotificationPreferences).toHaveBeenCalledWith({
      reminder_days_before: 5,
      push_enabled: false,
    });
    expect(setReminderDaysBefore).toHaveBeenCalledWith(5);
    expect(setPushEnabled).toHaveBeenCalledWith(false);
    expect(cancelAllScheduledNotifications).toHaveBeenCalledTimes(1);
    expect(schedulePaymentReminders).toHaveBeenCalledWith(
      'loan-1',
      'Ana',
      [{ id: 'p1', dueDate: '2026-02-01', amount: 1000, paymentNumber: 1 }],
      5
    );
    expect(scheduleDebtPaymentReminders).toHaveBeenCalledWith(
      'debt-1',
      'Banco',
      [{ id: 'dp1', dueDate: '2026-02-05', amount: 500, paymentNumber: 1 }],
      5
    );
    expect(showSuccess).toHaveBeenCalledWith('Guardado', expect.any(String));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('handleSave usa "Prestatario" como nombre por defecto si el préstamo no tiene borrower', async () => {
    (saveNotificationPreferences as jest.Mock).mockResolvedValue(undefined);
    (getActiveLoans as jest.Mock).mockResolvedValue([{ id: 'loan-1' }]);
    (getPaymentsByLoan as jest.Mock).mockResolvedValue([]);
    const { result } = await renderHook(() => useNotificationSettings());
    await act(async () => {});

    await act(async () => {
      await result.current.handleSave();
    });

    expect(schedulePaymentReminders).toHaveBeenCalledWith('loan-1', 'Prestatario', [], 3);
  });

  it('handleSave muestra error y no vuelve atrás si falla el guardado', async () => {
    (saveNotificationPreferences as jest.Mock).mockRejectedValue(new Error('boom'));
    const { result } = await renderHook(() => useNotificationSettings());
    await act(async () => {});

    await act(async () => {
      await result.current.handleSave();
    });

    expect(showError).toHaveBeenCalledWith('Error', 'No se pudieron guardar las preferencias');
    expect(router.back).not.toHaveBeenCalled();
    expect(result.current.isSaving).toBe(false);
  });
});
