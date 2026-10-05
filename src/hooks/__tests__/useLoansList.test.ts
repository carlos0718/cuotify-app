import { act, renderHook } from '@testing-library/react-native';
import { router } from 'expo-router';
import { getLoans, getLoanStats, getNextPendingPaymentDatesByLoan } from '../../services/supabase';
import { emptyLoanStats } from '../../services/supabase/loans';
import { useLoansList } from '../useLoansList';

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
  getNextPendingPaymentDatesByLoan: jest.fn(),
}));

const makeLoan = (overrides: Record<string, unknown> = {}) => ({
  id: 'loan-1',
  principal_amount: 100000,
  total_amount: 108000,
  status: 'active',
  color_code: '#FFCC00',
  currency: 'ARS',
  first_payment_date: '2026-02-01',
  borrower: { id: 'b1', full_name: 'Juan Pérez' },
  ...overrides,
});

describe('useLoansList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getLoans as jest.Mock).mockResolvedValue([]);
    (getLoanStats as jest.Mock).mockResolvedValue(emptyLoanStats());
    (getNextPendingPaymentDatesByLoan as jest.Mock).mockResolvedValue({});
  });

  it('carga préstamos y stats al montar, y termina isLoading', async () => {
    (getLoans as jest.Mock).mockResolvedValue([makeLoan()]);
    const { result } = await renderHook(() => useLoansList());
    await act(async () => {});

    expect(getLoans).toHaveBeenCalledTimes(1);
    expect(getLoanStats).toHaveBeenCalledTimes(1);
    expect(result.current.filteredLoans).toHaveLength(1);
    expect(result.current.isLoading).toBe(false);
  });

  it('pide las próximas fechas de pago solo para los préstamos activos', async () => {
    (getLoans as jest.Mock).mockResolvedValue([
      makeLoan({ id: 'a1', status: 'active' }),
      makeLoan({ id: 'c1', status: 'completed' }),
    ]);

    await renderHook(() => useLoansList());
    await act(async () => {});

    expect(getNextPendingPaymentDatesByLoan).toHaveBeenCalledWith(['a1']);
  });

  it('onRefresh vuelve a pedir los datos', async () => {
    const { result } = await renderHook(() => useLoansList());
    await act(async () => {});
    (getLoans as jest.Mock).mockClear();

    await act(() => {
      result.current.onRefresh();
    });
    await act(async () => {});

    expect(getLoans).toHaveBeenCalledTimes(1);
    expect(result.current.refreshing).toBe(false);
  });

  it('handleNewLoan y handleLinkLoan navegan a las rutas correctas', async () => {
    const { result } = await renderHook(() => useLoansList());
    await act(async () => {});

    await act(() => result.current.handleNewLoan());
    expect(router.push).toHaveBeenCalledWith('/(main)/loans/create');

    await act(() => result.current.handleLinkLoan());
    expect(router.push).toHaveBeenCalledWith('/(main)/loans/link');
  });

  it('filtra por estado', async () => {
    (getLoans as jest.Mock).mockResolvedValue([
      makeLoan({ id: 'a1', status: 'active' }),
      makeLoan({ id: 'c1', status: 'completed' }),
    ]);
    const { result } = await renderHook(() => useLoansList());
    await act(async () => {});

    await act(() => {
      result.current.setFilter('completed');
    });

    expect(result.current.filteredLoans.map((l) => l.id)).toEqual(['c1']);
  });

  it('filtra por nombre del prestatario (case-insensitive)', async () => {
    (getLoans as jest.Mock).mockResolvedValue([
      makeLoan({ id: 'a1', borrower: { id: 'b1', full_name: 'Ana Pérez' } }),
      makeLoan({ id: 'a2', borrower: { id: 'b2', full_name: 'Carlos Gómez' } }),
    ]);
    const { result } = await renderHook(() => useLoansList());
    await act(async () => {});

    await act(() => {
      result.current.setSearchQuery('ana');
    });

    expect(result.current.filteredLoans.map((l) => l.id)).toEqual(['a1']);
  });

  it('formatCurrency usa el formato correcto según la moneda', async () => {
    const { result } = await renderHook(() => useLoansList());
    await act(async () => {});

    expect(result.current.formatCurrency(1000, 'USD')).toContain('$');
    expect(result.current.formatCurrency(1000, 'ARS')).toContain('$');
  });

  it('getLoanStatus: "completed" solo si el préstamo está completado, si no "active"', async () => {
    const { result } = await renderHook(() => useLoansList());
    await act(async () => {});

    expect(result.current.getLoanStatus(makeLoan({ status: 'completed' }) as never)).toBe('completed');
    expect(result.current.getLoanStatus(makeLoan({ status: 'active' }) as never)).toBe('active');
  });

  it('getDueInfo: "Completado" para préstamos completados, "Al día" sin próxima fecha', async () => {
    const { result } = await renderHook(() => useLoansList());
    await act(async () => {});

    expect(result.current.getDueInfo(makeLoan({ status: 'completed' }) as never)).toBe('Completado');
    expect(result.current.getDueInfo(makeLoan({ id: 'sin-fecha' }) as never)).toBe('Al día');
  });
});
