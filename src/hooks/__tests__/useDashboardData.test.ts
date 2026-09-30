import { act, renderHook } from '@testing-library/react-native';
import { router } from 'expo-router';
import {
  getLoans,
  getLoanStats,
  getUpcomingPayments,
  getOverduePayments,
  getDebtStats,
  getNextPendingPaymentDatesByLoan,
} from '../../services/supabase';
import { getReadIds } from '../../services/notifications';
import { usePreferencesStore } from '../../store';
import { emptyLoanStats, LoanStats } from '../../services/supabase/loans';
import { emptyDebtStats, DebtStats } from '../../services/supabase/personalDebts';
import { useDashboardData, formatShortCurrency } from '../useDashboardData';

jest.mock('expo-router', () => {
  const React = require('react');
  return {
    router: { push: jest.fn() },
    useFocusEffect: (cb: () => void) => React.useEffect(cb, [cb]),
  };
});

jest.mock('../../services/supabase', () => ({
  getLoans: jest.fn(),
  getLoanStats: jest.fn(),
  getUpcomingPayments: jest.fn(),
  getOverduePayments: jest.fn(),
  getDebtStats: jest.fn(),
  getNextPendingPaymentDatesByLoan: jest.fn(),
}));

jest.mock('../../services/notifications', () => ({
  getReadIds: jest.fn(),
}));

jest.mock('../../store', () => ({
  usePreferencesStore: jest.fn(),
}));

function makeLoanStats(overrides: Partial<LoanStats> = {}): LoanStats {
  return { ...emptyLoanStats(), ...overrides };
}

function makeDebtStats(overrides: Partial<DebtStats> = {}): DebtStats {
  return { ...emptyDebtStats(), ...overrides };
}

const makeLoan = (overrides: Record<string, unknown> = {}) => ({
  id: 'loan-1',
  principal_amount: 100000,
  total_amount: 108000,
  payment_amount: 18000,
  status: 'active',
  color_code: '#FFCC00',
  first_payment_date: '2026-02-01',
  end_date: '2026-07-01',
  borrower: { id: 'b1', full_name: 'Juan Pérez' },
  ...overrides,
});

describe('useDashboardData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (usePreferencesStore as unknown as jest.Mock).mockImplementation(
      (selector: (s: { defaultCurrency: 'ARS' | 'USD' }) => unknown) =>
        selector({ defaultCurrency: 'ARS' })
    );
    (getLoans as jest.Mock).mockResolvedValue([]);
    (getLoanStats as jest.Mock).mockResolvedValue(emptyLoanStats());
    (getUpcomingPayments as jest.Mock).mockResolvedValue([]);
    (getOverduePayments as jest.Mock).mockResolvedValue([]);
    (getDebtStats as jest.Mock).mockResolvedValue(emptyDebtStats());
    (getReadIds as jest.Mock).mockResolvedValue(new Set());
    (getNextPendingPaymentDatesByLoan as jest.Mock).mockResolvedValue({});
  });

  it('carga todo al montar y termina isLoading', async () => {
    const { result } = await renderHook(() => useDashboardData());
    await act(async () => {});

    expect(getLoans).toHaveBeenCalledTimes(1);
    expect(getLoanStats).toHaveBeenCalledTimes(1);
    expect(getUpcomingPayments).toHaveBeenCalledWith(7);
    expect(getOverduePayments).toHaveBeenCalledTimes(1);
    expect(getDebtStats).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(false);
  });

  it('cuenta como no leídas las notificaciones de pagos próximos/vencidos que no están en readIds', async () => {
    (getUpcomingPayments as jest.Mock).mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);
    (getOverduePayments as jest.Mock).mockResolvedValue([{ id: 'p3' }]);
    (getReadIds as jest.Mock).mockResolvedValue(new Set(['upcoming-p1']));

    const { result } = await renderHook(() => useDashboardData());
    await act(async () => {});

    // upcoming-p1 leída, upcoming-p2 y overdue-p3 no leídas => 2
    expect(result.current.unreadNotifCount).toBe(2);
  });

  it('pide las próximas fechas de pago solo para los préstamos activos', async () => {
    (getLoans as jest.Mock).mockResolvedValue([
      makeLoan({ id: 'a1', status: 'active' }),
      makeLoan({ id: 'c1', status: 'completed' }),
      makeLoan({ id: 'a2', status: 'active' }),
    ]);

    await renderHook(() => useDashboardData());
    await act(async () => {});

    expect(getNextPendingPaymentDatesByLoan).toHaveBeenCalledWith(['a1', 'a2']);
  });

  it('onRefresh vuelve a pedir los datos', async () => {
    const { result } = await renderHook(() => useDashboardData());
    await act(async () => {});
    (getLoans as jest.Mock).mockClear();

    await act(() => {
      result.current.onRefresh();
    });
    await act(async () => {});

    expect(getLoans).toHaveBeenCalledTimes(1);
    expect(result.current.refreshing).toBe(false);
  });

  it('handleNewLoan/handleViewLoans/handleViewLoan navegan a las rutas correctas', async () => {
    const { result } = await renderHook(() => useDashboardData());
    await act(async () => {});

    await act(() => result.current.handleNewLoan());
    expect(router.push).toHaveBeenCalledWith('/(main)/loans/create');

    await act(() => result.current.handleViewLoans());
    expect(router.push).toHaveBeenCalledWith('/(main)/loans');

    await act(() => result.current.handleViewLoan('loan-9'));
    expect(router.push).toHaveBeenCalledWith('/(main)/loans/loan-9');
  });

  it('activeLoans se limita a los primeros 2 préstamos activos', async () => {
    (getLoans as jest.Mock).mockResolvedValue([
      makeLoan({ id: 'a1', status: 'active' }),
      makeLoan({ id: 'a2', status: 'active' }),
      makeLoan({ id: 'a3', status: 'active' }),
      makeLoan({ id: 'c1', status: 'completed' }),
    ]);

    const { result } = await renderHook(() => useDashboardData());
    await act(async () => {});

    expect(result.current.activeLoans.map((l) => l.id)).toEqual(['a1', 'a2']);
  });

  it('primaryCurrency usa la moneda por defecto si tiene movimiento, si no la primera con datos', async () => {
    (usePreferencesStore as unknown as jest.Mock).mockImplementation(
      (selector: (s: { defaultCurrency: 'ARS' | 'USD' }) => unknown) =>
        selector({ defaultCurrency: 'USD' })
    );
    (getLoanStats as jest.Mock).mockResolvedValue(
      makeLoanStats({ currencies: ['ARS'] })
    );

    const { result } = await renderHook(() => useDashboardData());
    await act(async () => {});

    // preferida (USD) no tiene movimiento -> cae a la primera con datos (ARS)
    expect(result.current.primaryCurrency).toBe('ARS');
  });

  it('lenderPercentage es 0 cuando no hay nada esperado, y el % correcto cuando sí', async () => {
    (getLoanStats as jest.Mock).mockResolvedValue(
      makeLoanStats({
        currencies: ['ARS'],
        byCurrency: {
          ARS: { totalLent: 100, totalExpected: 200, totalRecovered: 50, totalPending: 150 },
          USD: { totalLent: 0, totalExpected: 0, totalRecovered: 0, totalPending: 0 },
        },
      })
    );

    const { result } = await renderHook(() => useDashboardData());
    await act(async () => {});

    expect(result.current.lenderPercentage).toBe(25);
  });

  it('lenderPercentage nunca supera 100 aunque se cobre de más', async () => {
    (getLoanStats as jest.Mock).mockResolvedValue(
      makeLoanStats({
        currencies: ['ARS'],
        byCurrency: {
          ARS: { totalLent: 100, totalExpected: 100, totalRecovered: 150, totalPending: 0 },
          USD: { totalLent: 0, totalExpected: 0, totalRecovered: 0, totalPending: 0 },
        },
      })
    );

    const { result } = await renderHook(() => useDashboardData());
    await act(async () => {});

    expect(result.current.lenderPercentage).toBe(100);
  });

  it('hasDebtData es true solo si hay deudas activas', async () => {
    (getDebtStats as jest.Mock).mockResolvedValue(makeDebtStats({ activeDebts: 2 }));

    const { result } = await renderHook(() => useDashboardData());
    await act(async () => {});

    expect(result.current.hasDebtData).toBe(true);
  });

  it('getDueInfo: "Completado" para préstamos completados', async () => {
    const { result } = await renderHook(() => useDashboardData());
    await act(async () => {});

    expect(result.current.getDueInfo(makeLoan({ status: 'completed' }) as never)).toBe('Completado');
  });

  it('getDueInfo: "Al día" cuando no hay próxima fecha de pago', async () => {
    const { result } = await renderHook(() => useDashboardData());
    await act(async () => {});

    expect(result.current.getDueInfo(makeLoan({ id: 'sin-fecha' }) as never)).toBe('Al día');
  });

  it('getDueInfo: "Vencido hace N días" cuando la próxima fecha ya pasó', async () => {
    // Fijamos "ahora" al mediodía para que el diff en días no dependa de la
    // hora real de ejecución del test (getDueInfo compara contra un `new
    // Date()` sin normalizar, y el vencimiento se parsea a las 12:00 local).
    jest.useFakeTimers().setSystemTime(new Date('2026-06-15T12:00:00'));
    (getLoans as jest.Mock).mockResolvedValue([makeLoan({ id: 'a1' })]);
    (getNextPendingPaymentDatesByLoan as jest.Mock).mockResolvedValue({
      a1: '2026-06-12',
    });

    const { result } = await renderHook(() => useDashboardData());
    await act(async () => {});

    expect(result.current.getDueInfo(makeLoan({ id: 'a1' }) as never)).toBe('Vencido hace 3 días');

    jest.useRealTimers();
  });

  it('getCurrentMonth devuelve el mes y año actuales en español', async () => {
    const { result } = await renderHook(() => useDashboardData());
    await act(async () => {});

    const now = new Date();
    expect(result.current.getCurrentMonth()).toContain(String(now.getFullYear()));
  });

  it('getUpcomingDays devuelve 7 días, el primero marcado como hoy', async () => {
    const { result } = await renderHook(() => useDashboardData());
    await act(async () => {});

    const days = result.current.getUpcomingDays();
    expect(days).toHaveLength(7);
    expect(days[0].isToday).toBe(true);
    expect(days[1].isToday).toBe(false);
  });

  it('formatShortCurrency abrevia montos grandes con K/M', () => {
    expect(formatShortCurrency(500)).toBe('$500');
    expect(formatShortCurrency(1500)).toBe('$2K');
    expect(formatShortCurrency(2500000)).toBe('$2.5M');
  });
});
