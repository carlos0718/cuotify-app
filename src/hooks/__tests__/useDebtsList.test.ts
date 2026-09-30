import { act, renderHook } from '@testing-library/react-native';
import {
  getPersonalDebts,
  getDebtStats,
  getNextPendingPaymentDates,
  getLinkedLoans,
  getNextPendingPaymentDatesByLoan,
  getLinkedLoanPaymentStats,
} from '../../services/supabase';
import { emptyDebtStats } from '../../services/supabase/personalDebts';
import { emptyLinkedLoanStats } from '../../services/supabase/loans';
import { useDebtsList } from '../useDebtsList';

jest.mock('expo-router', () => {
  const React = require('react');
  return {
    router: { push: jest.fn() },
    useFocusEffect: (cb: () => void) => React.useEffect(cb, [cb]),
  };
});

jest.mock('../../services/supabase', () => ({
  getPersonalDebts: jest.fn(),
  getDebtStats: jest.fn(),
  getNextPendingPaymentDates: jest.fn(),
  getLinkedLoans: jest.fn(),
  getNextPendingPaymentDatesByLoan: jest.fn(),
  getLinkedLoanPaymentStats: jest.fn(),
}));

const makeDebt = (overrides: Record<string, unknown> = {}) => ({
  id: 'debt-1',
  creditor_name: 'Banco',
  status: 'active',
  currency: 'ARS',
  ...overrides,
});

const makeLoan = (overrides: Record<string, unknown> = {}) => ({
  id: 'loan-1',
  status: 'active',
  ...overrides,
});

describe('useDebtsList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getPersonalDebts as jest.Mock).mockResolvedValue([]);
    (getDebtStats as jest.Mock).mockResolvedValue(emptyDebtStats());
    (getLinkedLoans as jest.Mock).mockResolvedValue([]);
    (getLinkedLoanPaymentStats as jest.Mock).mockResolvedValue(emptyLinkedLoanStats());
    (getNextPendingPaymentDates as jest.Mock).mockResolvedValue({});
    (getNextPendingPaymentDatesByLoan as jest.Mock).mockResolvedValue({});
  });

  it('carga deudas, préstamos vinculados y stats al montar', async () => {
    (getPersonalDebts as jest.Mock).mockResolvedValue([makeDebt()]);
    (getLinkedLoans as jest.Mock).mockResolvedValue([makeLoan()]);

    const { result } = await renderHook(() => useDebtsList());
    await act(async () => {});

    expect(result.current.isLoading).toBe(false);
    expect(result.current.filteredDebts).toHaveLength(1);
    expect(result.current.linkedLoans).toHaveLength(1);
  });

  it('pide las próximas fechas solo para deudas y préstamos activos', async () => {
    (getPersonalDebts as jest.Mock).mockResolvedValue([
      makeDebt({ id: 'active-debt', status: 'active' }),
      makeDebt({ id: 'done-debt', status: 'completed' }),
    ]);
    (getLinkedLoans as jest.Mock).mockResolvedValue([
      makeLoan({ id: 'active-loan', status: 'active' }),
      makeLoan({ id: 'done-loan', status: 'completed' }),
    ]);

    await renderHook(() => useDebtsList());
    await act(async () => {});

    expect(getNextPendingPaymentDates).toHaveBeenCalledWith(['active-debt']);
    expect(getNextPendingPaymentDatesByLoan).toHaveBeenCalledWith(['active-loan']);
  });

  it('fusiona los stats de deudas propias con los de préstamos vinculados por moneda (L2)', async () => {
    (getDebtStats as jest.Mock).mockResolvedValue({
      ...emptyDebtStats(),
      currencies: ['ARS'],
      byCurrency: {
        ARS: { totalOwed: 1000, totalToPay: 1200, totalPaid: 200, remainingToPay: 1000 },
        USD: { totalOwed: 0, totalToPay: 0, totalPaid: 0, remainingToPay: 0 },
      },
    });
    (getLinkedLoanPaymentStats as jest.Mock).mockResolvedValue({
      ARS: { totalToPay: 300, totalPaid: 100, remainingToPay: 200 },
      USD: { totalToPay: 0, totalPaid: 0, remainingToPay: 0 },
    });

    const { result } = await renderHook(() => useDebtsList());
    await act(async () => {});

    expect(result.current.stats.byCurrency.ARS).toEqual({
      totalOwed: 1000,
      totalToPay: 1500,
      totalPaid: 300,
      remainingToPay: 1200,
    });
    expect(result.current.stats.currencies).toEqual(['ARS']);
  });

  it('onRefresh vuelve a pedir los datos', async () => {
    const { result } = await renderHook(() => useDebtsList());
    await act(async () => {});
    (getPersonalDebts as jest.Mock).mockClear();

    await act(() => {
      result.current.onRefresh();
    });
    await act(async () => {});

    expect(getPersonalDebts).toHaveBeenCalledTimes(1);
    expect(result.current.refreshing).toBe(false);
  });

  it('filtra las deudas por estado', async () => {
    (getPersonalDebts as jest.Mock).mockResolvedValue([
      makeDebt({ id: 'a1', status: 'active' }),
      makeDebt({ id: 'c1', status: 'completed' }),
    ]);
    const { result } = await renderHook(() => useDebtsList());
    await act(async () => {});

    await act(() => {
      result.current.setFilter('completed');
    });

    expect(result.current.filteredDebts.map((d) => d.id)).toEqual(['c1']);
  });

  it('getDueInfo: "Completada"/"Cancelada" para esos estados, "Al día" sin próxima fecha', async () => {
    const { result } = await renderHook(() => useDebtsList());
    await act(async () => {});

    expect(result.current.getDueInfo(makeDebt({ status: 'completed' }) as never)).toBe('Completada');
    expect(result.current.getDueInfo(makeDebt({ status: 'cancelled' }) as never)).toBe('Cancelada');
    expect(result.current.getDueInfo(makeDebt({ id: 'sin-fecha' }) as never)).toBe('Al día');
  });

  it('getDueLoanInfo: "Completado" para préstamos completados, "Al día" sin próxima fecha', async () => {
    const { result } = await renderHook(() => useDebtsList());
    await act(async () => {});

    expect(result.current.getDueLoanInfo(makeLoan({ status: 'completed' }) as never)).toBe('Completado');
    expect(result.current.getDueLoanInfo(makeLoan({ id: 'sin-fecha' }) as never)).toBe('Al día');
  });

  it('formatCurrency formatea según la moneda', async () => {
    const { result } = await renderHook(() => useDebtsList());
    await act(async () => {});

    expect(result.current.formatCurrency(1000, 'USD')).toContain('US$');
  });
});
