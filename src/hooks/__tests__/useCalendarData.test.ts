import { act, renderHook } from '@testing-library/react-native';
import { router } from 'expo-router';
import {
  getUpcomingPayments,
  getOverduePayments,
  getUpcomingDebtPayments,
  getOverdueDebtPayments,
} from '../../services/supabase';
import { useCalendarData } from '../useCalendarData';

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
  getUpcomingDebtPayments: jest.fn(),
  getOverdueDebtPayments: jest.fn(),
}));

const makeLoanPayment = (overrides: Record<string, unknown> = {}) => ({
  id: 'p1',
  due_date: '2026-03-10',
  total_amount: 1000,
  status: 'pending',
  payment_number: 1,
  loan: { id: 'loan-1', borrower: { full_name: 'Ana Pérez' }, currency: 'ARS' },
  ...overrides,
});

const makeDebtPayment = (overrides: Record<string, unknown> = {}) => ({
  id: 'dp1',
  due_date: '2026-03-12',
  total_amount: 2000,
  status: 'pending',
  payment_number: 1,
  debt: { id: 'debt-1', creditor_name: 'Banco', currency: 'USD' },
  ...overrides,
});

describe('useCalendarData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getUpcomingPayments as jest.Mock).mockResolvedValue([]);
    (getOverduePayments as jest.Mock).mockResolvedValue([]);
    (getUpcomingDebtPayments as jest.Mock).mockResolvedValue([]);
    (getOverdueDebtPayments as jest.Mock).mockResolvedValue([]);
  });

  it('carga y mapea pagos de préstamos y deudas, ordenados por fecha', async () => {
    (getUpcomingPayments as jest.Mock).mockResolvedValue([
      makeLoanPayment({ id: 'p2', due_date: '2026-03-20' }),
      makeLoanPayment({ id: 'p1', due_date: '2026-03-05' }),
    ]);
    (getUpcomingDebtPayments as jest.Mock).mockResolvedValue([makeDebtPayment()]);

    const { result } = await renderHook(() => useCalendarData());
    await act(async () => {});

    expect(result.current.payments.map((p) => p.id)).toEqual(['p1', 'dp1', 'p2']);
    expect(result.current.payments[0]).toMatchObject({
      type: 'loan',
      name: 'Ana Pérez',
      parentId: 'loan-1',
      currency: 'ARS',
    });
    expect(result.current.isLoading).toBe(false);
  });

  it('usa "Sin nombre" y parentId vacío cuando falta el préstamo/deuda relacionado', async () => {
    (getUpcomingPayments as jest.Mock).mockResolvedValue([makeLoanPayment({ loan: null })]);

    const { result } = await renderHook(() => useCalendarData());
    await act(async () => {});

    expect(result.current.payments[0].name).toBe('Sin nombre');
    expect(result.current.payments[0].parentId).toBe('');
    expect(result.current.payments[0].currency).toBe('ARS');
  });

  it('onRefresh vuelve a pedir los datos', async () => {
    const { result } = await renderHook(() => useCalendarData());
    await act(async () => {});
    (getUpcomingPayments as jest.Mock).mockClear();

    await act(() => {
      result.current.onRefresh();
    });
    await act(async () => {});

    expect(getUpcomingPayments).toHaveBeenCalledTimes(1);
    expect(result.current.refreshing).toBe(false);
  });

  it('handleDayPress guarda la fecha seleccionada', async () => {
    const { result } = await renderHook(() => useCalendarData());
    await act(async () => {});

    await act(() => {
      result.current.handleDayPress({ dateString: '2026-03-15' } as never);
    });

    expect(result.current.selectedDate).toBe('2026-03-15');
  });

  it('handlePaymentPress no navega si no hay parentId', async () => {
    const { result } = await renderHook(() => useCalendarData());
    await act(async () => {});

    await act(() => {
      result.current.handlePaymentPress({ parentId: '', type: 'loan' } as never);
    });

    expect(router.push).not.toHaveBeenCalled();
  });

  it('handlePaymentPress navega a /loans/:id para préstamos y /debts/:id para deudas', async () => {
    const { result } = await renderHook(() => useCalendarData());
    await act(async () => {});

    await act(() => {
      result.current.handlePaymentPress({ parentId: 'loan-1', type: 'loan' } as never);
    });
    expect(router.push).toHaveBeenCalledWith('/(main)/loans/loan-1');

    await act(() => {
      result.current.handlePaymentPress({ parentId: 'debt-1', type: 'debt' } as never);
    });
    expect(router.push).toHaveBeenCalledWith('/(main)/debts/debt-1');
  });

  it('getSelectedDatePayments filtra entre pendientes y vencidos por fecha', async () => {
    (getUpcomingPayments as jest.Mock).mockResolvedValue([makeLoanPayment({ due_date: '2026-03-10' })]);
    (getOverduePayments as jest.Mock).mockResolvedValue([makeLoanPayment({ id: 'p-overdue', due_date: '2026-03-01' })]);
    const { result } = await renderHook(() => useCalendarData());
    await act(async () => {});

    await act(() => {
      result.current.handleDayPress({ dateString: '2026-03-01' } as never);
    });

    expect(result.current.getSelectedDatePayments().map((p) => p.id)).toEqual(['p-overdue']);
  });

  it('getUpcomingPaymentsList antepone los vencidos y se limita a 5', async () => {
    (getOverduePayments as jest.Mock).mockResolvedValue([makeLoanPayment({ id: 'overdue-1' })]);
    (getUpcomingPayments as jest.Mock).mockResolvedValue(
      Array.from({ length: 6 }, (_, i) => makeLoanPayment({ id: `up-${i}`, due_date: `2026-03-${10 + i}` }))
    );
    const { result } = await renderHook(() => useCalendarData());
    await act(async () => {});

    const list = result.current.getUpcomingPaymentsList();
    expect(list).toHaveLength(5);
    expect(list[0].id).toBe('overdue-1');
  });

  it('getMarkedDates marca con dot de warning los pendientes y de error los vencidos', async () => {
    (getUpcomingPayments as jest.Mock).mockResolvedValue([makeLoanPayment({ due_date: '2026-03-10' })]);
    (getOverduePayments as jest.Mock).mockResolvedValue([makeLoanPayment({ id: 'p-overdue', due_date: '2026-03-01' })]);
    const { result } = await renderHook(() => useCalendarData());
    await act(async () => {});

    const marks = result.current.getMarkedDates();

    expect(marks['2026-03-10'].marked).toBe(true);
    expect(marks['2026-03-01'].marked).toBe(true);
  });

  it('getMarkedDates marca la fecha seleccionada aunque no tenga pagos', async () => {
    const { result } = await renderHook(() => useCalendarData());
    await act(async () => {});
    await act(() => {
      result.current.handleDayPress({ dateString: '2026-03-25' } as never);
    });

    const marks = result.current.getMarkedDates();

    expect(marks['2026-03-25'].selected).toBe(true);
  });

  it('getPaymentStatus: "paid" tiene prioridad, si no compara la fecha con hoy', async () => {
    const { result } = await renderHook(() => useCalendarData());
    await act(async () => {});

    expect(result.current.getPaymentStatus(makeLoanPayment({ status: 'paid', due_date: '2000-01-01' }) as never)).toBe('paid');

    const past = new Date();
    past.setDate(past.getDate() - 5);
    const pastStr = past.toISOString().split('T')[0];
    expect(result.current.getPaymentStatus(makeLoanPayment({ status: 'pending', due_date: pastStr }) as never)).toBe('overdue');

    const future = new Date();
    future.setDate(future.getDate() + 5);
    const futureStr = future.toISOString().split('T')[0];
    expect(result.current.getPaymentStatus(makeLoanPayment({ status: 'pending', due_date: futureStr }) as never)).toBe('pending');
  });

  it('formatCurrency formatea según la moneda', async () => {
    const { result } = await renderHook(() => useCalendarData());
    await act(async () => {});

    expect(result.current.formatCurrency(1000, 'USD')).toContain('US$');
    expect(result.current.formatCurrency(1000, 'ARS')).toContain('$');
  });
});
