import { act, renderHook } from '@testing-library/react-native';
import { router } from 'expo-router';
import { getUpcomingPayments, getOverduePayments } from '../../services/supabase';
import { getUpcomingDebtPayments, getOverdueDebtPayments } from '../../services/supabase/personalDebts';
import { setBadgeCount } from '../../services/notifications/pushNotifications';
import { getReadIds, markAsRead, markAllAsRead } from '../../services/notifications/readNotifications';
import { useAuthStore } from '../../store/authStore';
import { useNotificationsList } from '../useNotificationsList';

jest.mock('expo-router', () => {
  const React = require('react');
  return {
    router: { push: jest.fn() },
    useFocusEffect: (cb: () => void) => React.useEffect(cb, [cb]),
  };
});

jest.mock('../../services/supabase', () => ({
  getUpcomingPayments: jest.fn(),
  getOverduePayments: jest.fn(),
}));

jest.mock('../../services/supabase/personalDebts', () => ({
  getUpcomingDebtPayments: jest.fn(),
  getOverdueDebtPayments: jest.fn(),
}));

jest.mock('../../services/notifications/pushNotifications', () => ({
  setBadgeCount: jest.fn(),
}));

jest.mock('../../services/notifications/readNotifications', () => ({
  getReadIds: jest.fn(),
  markAsRead: jest.fn(),
  markAllAsRead: jest.fn(),
}));

jest.mock('../../store/authStore', () => ({
  useAuthStore: jest.fn(),
}));

const makeLoanPayment = (overrides: Record<string, unknown> = {}) => ({
  id: 'p1',
  due_date: '2026-03-10',
  total_amount: 1000,
  status: 'pending',
  payment_number: 1,
  loan: { id: 'loan-1', principal_amount: 1000, currency: 'ARS', borrower: { full_name: 'Ana Pérez' } },
  ...overrides,
});

const makeDebtPayment = (overrides: Record<string, unknown> = {}) => ({
  id: 'dp1',
  debt_id: 'debt-1',
  due_date: '2026-03-12',
  total_amount: 500,
  payment_number: 1,
  status: 'pending',
  debt: { id: 'debt-1', creditor_name: 'Banco', currency: 'ARS' },
  ...overrides,
});

describe('useNotificationsList', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-10T12:00:00'));
    jest.clearAllMocks();
    (useAuthStore as unknown as jest.Mock).mockReturnValue({ session: { user: { id: 'user-1' } } });
    (getUpcomingPayments as jest.Mock).mockResolvedValue([]);
    (getOverduePayments as jest.Mock).mockResolvedValue([]);
    (getUpcomingDebtPayments as jest.Mock).mockResolvedValue([]);
    (getOverdueDebtPayments as jest.Mock).mockResolvedValue([]);
    (getReadIds as jest.Mock).mockResolvedValue(new Set());
    (setBadgeCount as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('carga y transforma pagos de préstamos y deudas en notificaciones, ordenadas por urgencia', async () => {
    (getOverduePayments as jest.Mock).mockResolvedValue([makeLoanPayment({ id: 'overdue-loan', due_date: '2026-03-05' })]);
    (getUpcomingPayments as jest.Mock).mockResolvedValue([makeLoanPayment({ id: 'upcoming-loan', due_date: '2026-03-20' })]);

    const { result } = await renderHook(() => useNotificationsList());
    await act(async () => {});

    expect(result.current.isLoading).toBe(false);
    expect(result.current.notifications.map((n) => n.paymentId)).toEqual(['overdue-loan', 'upcoming-loan']);
    expect(result.current.notifications[0].type).toBe('payment_overdue');
    expect(setBadgeCount).toHaveBeenCalledWith(0);
  });

  it('un pago de préstamo que vence hoy se etiqueta "payment_today"', async () => {
    (getUpcomingPayments as jest.Mock).mockResolvedValue([makeLoanPayment({ due_date: '2026-03-10' })]);

    const { result } = await renderHook(() => useNotificationsList());
    await act(async () => {});

    expect(result.current.notifications[0]).toMatchObject({ type: 'payment_today', time: 'Hoy' });
  });

  it('una cuota de deuda vencida se etiqueta "debt_overdue" con el nombre del acreedor', async () => {
    (getOverdueDebtPayments as jest.Mock).mockResolvedValue([makeDebtPayment({ due_date: '2026-03-01' })]);

    const { result } = await renderHook(() => useNotificationsList());
    await act(async () => {});

    expect(result.current.notifications[0]).toMatchObject({ type: 'debt_overdue', debtId: 'debt-1' });
    expect(result.current.notifications[0].body).toContain('Banco');
  });

  it('marca isBorrowerLoan cuando el prestatario vinculado es el usuario actual', async () => {
    (getUpcomingPayments as jest.Mock).mockResolvedValue([
      makeLoanPayment({
        due_date: '2026-03-15',
        loan: { id: 'loan-1', principal_amount: 1000, currency: 'ARS', borrower: { full_name: 'Ana', linked_profile_id: 'user-1' } },
      }),
    ]);

    const { result } = await renderHook(() => useNotificationsList());
    await act(async () => {});

    expect(result.current.notifications[0].isBorrowerLoan).toBe(true);
  });

  it('onRefresh vuelve a pedir los datos', async () => {
    const { result } = await renderHook(() => useNotificationsList());
    await act(async () => {});
    (getUpcomingPayments as jest.Mock).mockClear();

    await act(() => {
      result.current.onRefresh();
    });
    await act(async () => {});

    expect(getUpcomingPayments).toHaveBeenCalledTimes(1);
    expect(result.current.refreshing).toBe(false);
  });

  it('handleNotificationPress marca como leída y navega a la deuda si tiene debtId', async () => {
    (getOverdueDebtPayments as jest.Mock).mockResolvedValue([makeDebtPayment()]);
    (markAsRead as jest.Mock).mockResolvedValue(undefined);
    const { result } = await renderHook(() => useNotificationsList());
    await act(async () => {});
    const notif = result.current.notifications[0];

    await act(async () => {
      await result.current.handleNotificationPress(notif);
    });

    expect(markAsRead).toHaveBeenCalledWith(notif.id);
    expect(router.push).toHaveBeenCalledWith(`/(main)/debts/debt-1?readonly=true`);
  });

  it('handleNotificationPress navega a /loans/:id sin readonly cuando no es préstamo vinculado', async () => {
    (getUpcomingPayments as jest.Mock).mockResolvedValue([makeLoanPayment({ due_date: '2026-03-15' })]);
    const { result } = await renderHook(() => useNotificationsList());
    await act(async () => {});
    const notif = result.current.notifications[0];

    await act(async () => {
      await result.current.handleNotificationPress(notif);
    });

    expect(router.push).toHaveBeenCalledWith('/(main)/loans/loan-1');
  });

  it('handleNotificationPress no vuelve a marcar como leída si ya lo estaba', async () => {
    (getUpcomingPayments as jest.Mock).mockResolvedValue([makeLoanPayment({ id: 'p-read', due_date: '2026-03-15' })]);
    (getReadIds as jest.Mock).mockResolvedValue(new Set(['upcoming-p-read']));
    const { result } = await renderHook(() => useNotificationsList());
    await act(async () => {});
    const notif = result.current.notifications[0];

    await act(async () => {
      await result.current.handleNotificationPress(notif);
    });

    expect(markAsRead).not.toHaveBeenCalled();
  });

  it('handleMarkAllAsRead marca todas y actualiza unreadCount a 0', async () => {
    (getUpcomingPayments as jest.Mock).mockResolvedValue([
      makeLoanPayment({ id: 'a', due_date: '2026-03-15' }),
      makeLoanPayment({ id: 'b', due_date: '2026-03-16' }),
    ]);
    (markAllAsRead as jest.Mock).mockResolvedValue(undefined);
    const { result } = await renderHook(() => useNotificationsList());
    await act(async () => {});
    expect(result.current.unreadCount).toBe(2);

    await act(async () => {
      await result.current.handleMarkAllAsRead();
    });

    expect(markAllAsRead).toHaveBeenCalledWith(['upcoming-a', 'upcoming-b']);
    expect(result.current.unreadCount).toBe(0);
  });

  it('agrupa notificaciones en vencidas/hoy/próximas correctamente', async () => {
    (getOverduePayments as jest.Mock).mockResolvedValue([makeLoanPayment({ id: 'overdue', due_date: '2026-03-01' })]);
    (getUpcomingPayments as jest.Mock).mockResolvedValue([
      makeLoanPayment({ id: 'today', due_date: '2026-03-10' }),
      makeLoanPayment({ id: 'later', due_date: '2026-03-20' }),
    ]);

    const { result } = await renderHook(() => useNotificationsList());
    await act(async () => {});

    expect(result.current.overdueNotifs.map((n) => n.paymentId)).toEqual(['overdue']);
    expect(result.current.todayNotifs.map((n) => n.paymentId)).toEqual(['today']);
    expect(result.current.upcomingNotifs.map((n) => n.paymentId)).toEqual(['later']);
  });
});
