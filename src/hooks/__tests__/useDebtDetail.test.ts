import { act, renderHook } from '@testing-library/react-native';
import { router } from 'expo-router';
import {
  getPersonalDebtById,
  getDebtPayments,
  markDebtPaymentAsPaid,
  revertDebtPaymentToPending,
  deletePersonalDebt,
} from '../../services/supabase';
import { cancelPaymentNotification, updateBadgeCount } from '../../services/notifications';
import { useToast } from '../../components';
import { useDebtDetail } from '../useDebtDetail';

jest.mock('expo-router', () => {
  const React = require('react');
  return {
    router: { replace: jest.fn() },
    useFocusEffect: (cb: () => void) => React.useEffect(cb, [cb]),
  };
});

jest.mock('../../services/supabase', () => ({
  getPersonalDebtById: jest.fn(),
  getDebtPayments: jest.fn(),
  markDebtPaymentAsPaid: jest.fn(),
  revertDebtPaymentToPending: jest.fn(),
  deletePersonalDebt: jest.fn(),
}));

jest.mock('../../services/notifications', () => ({
  cancelPaymentNotification: jest.fn(),
  updateBadgeCount: jest.fn(),
}));

jest.mock('../../components', () => ({
  useToast: jest.fn(),
}));

const makeDebt = (overrides: Record<string, unknown> = {}) => ({
  id: 'debt-1',
  creditor_name: 'Banco',
  status: 'active',
  currency: 'ARS',
  principal_amount: 10000,
  ...overrides,
});

const makePayment = (overrides: Record<string, unknown> = {}) => ({
  id: 'pay-1',
  payment_number: 1,
  status: 'pending',
  due_date: '2026-02-01',
  total_amount: 1000,
  penalty_amount: 0,
  ...overrides,
});

describe('useDebtDetail', () => {
  const showSuccess = jest.fn();
  const showError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useToast as unknown as jest.Mock).mockReturnValue({ showSuccess, showError });
    (getPersonalDebtById as jest.Mock).mockResolvedValue(makeDebt());
    (getDebtPayments as jest.Mock).mockResolvedValue([makePayment()]);
  });

  it('carga la deuda y los pagos al montar', async () => {
    const { result } = await renderHook(() => useDebtDetail('debt-1'));
    await act(async () => {});

    expect(getPersonalDebtById).toHaveBeenCalledWith('debt-1');
    expect(getDebtPayments).toHaveBeenCalledWith('debt-1');
    expect(result.current.debt?.id).toBe('debt-1');
    expect(result.current.isLoading).toBe(false);
  });

  it('sin id, no llama a los servicios', async () => {
    await renderHook(() => useDebtDetail(undefined));
    await act(async () => {});

    expect(getPersonalDebtById).not.toHaveBeenCalled();
  });

  it('si falla la carga, muestra un error', async () => {
    (getPersonalDebtById as jest.Mock).mockRejectedValue(new Error('boom'));
    const { result } = await renderHook(() => useDebtDetail('debt-1'));
    await act(async () => {});

    expect(showError).toHaveBeenCalledWith('Error', 'No se pudo cargar la deuda');
    expect(result.current.isLoading).toBe(false);
  });

  it('handleMarkPaid suma la penalización al monto pagado, cancela la notificación y recarga', async () => {
    (markDebtPaymentAsPaid as jest.Mock).mockResolvedValue(undefined);
    const { result } = await renderHook(() => useDebtDetail('debt-1'));
    await act(async () => {});
    await act(() => {
      result.current.handlePaymentPress(makePayment({ penalty_amount: 100 }) as never, 'pending');
    });

    await act(async () => {
      await result.current.handleMarkPaid();
    });

    expect(markDebtPaymentAsPaid).toHaveBeenCalledWith('pay-1', 1100);
    expect(cancelPaymentNotification).toHaveBeenCalledWith('pay-1');
    expect(updateBadgeCount).toHaveBeenCalledTimes(1);
    expect(showSuccess).toHaveBeenCalledWith('Pago registrado', expect.any(String));
    expect(result.current.selectedPayment).toBeNull();
  });

  it('handleMarkPaid muestra error si falla', async () => {
    (markDebtPaymentAsPaid as jest.Mock).mockRejectedValue(new Error('boom'));
    const { result } = await renderHook(() => useDebtDetail('debt-1'));
    await act(async () => {});
    await act(() => {
      result.current.handlePaymentPress(makePayment() as never, 'pending');
    });

    await act(async () => {
      await result.current.handleMarkPaid();
    });

    expect(showError).toHaveBeenCalledWith('Error', 'No se pudo registrar el pago');
  });

  it('handleRevertPayment revierte el pago y recarga', async () => {
    (revertDebtPaymentToPending as jest.Mock).mockResolvedValue(undefined);
    const { result } = await renderHook(() => useDebtDetail('debt-1'));
    await act(async () => {});
    await act(() => {
      result.current.handlePaymentPress(makePayment({ status: 'paid' }) as never, 'paid');
    });

    await act(async () => {
      await result.current.handleRevertPayment();
    });

    expect(revertDebtPaymentToPending).toHaveBeenCalledWith('pay-1');
    expect(showSuccess).toHaveBeenCalledWith('Pago revertido', expect.any(String));
  });

  it('closeModal no cierra el modal mientras isProcessing es true', async () => {
    (markDebtPaymentAsPaid as jest.Mock).mockImplementation(() => new Promise(() => {}));
    const { result } = await renderHook(() => useDebtDetail('debt-1'));
    await act(async () => {});
    await act(() => {
      result.current.handlePaymentPress(makePayment() as never, 'pending');
    });

    await act(() => {
      result.current.handleMarkPaid();
    });
    await act(() => {
      result.current.closeModal();
    });

    expect(result.current.selectedPayment).not.toBeNull();
  });

  it('handleDeleteDebt abre el modal de confirmación', async () => {
    const { result } = await renderHook(() => useDebtDetail('debt-1'));
    await act(async () => {});

    await act(() => {
      result.current.handleDeleteDebt();
    });

    expect(result.current.showDeleteModal).toBe(true);
  });

  it('confirmDeleteDebt elimina la deuda, muestra éxito y redirige a /debts', async () => {
    (deletePersonalDebt as jest.Mock).mockResolvedValue(undefined);
    const { result } = await renderHook(() => useDebtDetail('debt-1'));
    await act(async () => {});

    await act(async () => {
      await result.current.confirmDeleteDebt();
    });

    expect(deletePersonalDebt).toHaveBeenCalledWith('debt-1');
    expect(showSuccess).toHaveBeenCalledWith('Deuda eliminada', expect.any(String));
    expect(router.replace).toHaveBeenCalledWith('/(main)/debts');
  });

  it('confirmDeleteDebt muestra el error real cuando falla (ej. "deuda activa")', async () => {
    (deletePersonalDebt as jest.Mock).mockRejectedValue(new Error('No se puede eliminar una deuda activa. Primero cancélala.'));
    const { result } = await renderHook(() => useDebtDetail('debt-1'));
    await act(async () => {});

    await act(async () => {
      await result.current.confirmDeleteDebt();
    });

    expect(showError).toHaveBeenCalledWith('Error', 'No se puede eliminar una deuda activa. Primero cancélala.');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('formatCurrency usa la moneda de la deuda cargada', async () => {
    (getPersonalDebtById as jest.Mock).mockResolvedValue(makeDebt({ currency: 'USD' }));
    const { result } = await renderHook(() => useDebtDetail('debt-1'));
    await act(async () => {});

    expect(result.current.formatCurrency(1000)).toContain('US$');
  });
});
