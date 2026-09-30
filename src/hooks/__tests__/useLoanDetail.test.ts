import { act, renderHook } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { router } from 'expo-router';
import {
  getLoanById,
  getPaymentsByLoan,
  markPaymentAsPaid,
  revertPaymentToPending,
  deleteLoan,
} from '../../services/supabase';
import { cancelPaymentNotification, updateBadgeCount } from '../../services/notifications';
import { generateLoanPDF } from '../../services/pdf/loanPdf';
import { useSubscriptionStore } from '../../store';
import { useToast } from '../../components';
import { useLoanDetail } from '../useLoanDetail';

jest.mock('expo-router', () => {
  const React = require('react');
  return {
    router: { push: jest.fn(), back: jest.fn() },
    useFocusEffect: (cb: () => void) => React.useEffect(cb, [cb]),
  };
});

jest.mock('../../services/supabase', () => ({
  getLoanById: jest.fn(),
  getPaymentsByLoan: jest.fn(),
  markPaymentAsPaid: jest.fn(),
  revertPaymentToPending: jest.fn(),
  deleteLoan: jest.fn(),
}));

jest.mock('../../services/notifications', () => ({
  cancelPaymentNotification: jest.fn(),
  updateBadgeCount: jest.fn(),
}));

jest.mock('../../services/pdf/loanPdf', () => ({
  generateLoanPDF: jest.fn(),
}));

jest.mock('../../store', () => ({
  useSubscriptionStore: jest.fn(),
}));

jest.mock('../../components', () => ({
  useToast: jest.fn(),
}));

const makeLoan = (overrides: Partial<ReturnType<typeof baseLoan>> = {}) => ({
  ...baseLoan(),
  ...overrides,
});

function baseLoan() {
  return {
    id: 'loan-1',
    principal_amount: 100000,
    interest_rate: 24,
    term_value: 6,
    term_type: 'months' as const,
    interest_type: 'simple' as const,
    currency: 'ARS' as 'ARS' | 'USD',
    payment_amount: 18000,
    total_amount: 108000,
    total_interest: 8000,
    delivery_date: '2026-01-01',
    first_payment_date: '2026-02-01',
    end_date: '2026-07-01',
    status: 'active' as const,
    borrower: { id: 'b1', full_name: 'Juan Pérez', phone: '5491112345678', dni: '30111222' } as never,
    lender: { id: 'u1', full_name: 'Prestamista' },
    notes: null,
    transfer_proof_url: null,
    grace_period_days: 7,
    late_penalty_type: 'none' as const,
    late_penalty_rate: 0,
  };
}

const makePayment = (overrides: Partial<{
  id: string;
  payment_number: number;
  status: string;
  due_date: string;
  total_amount: number;
}> = {}) => ({
  id: 'pay-1',
  payment_number: 1,
  status: 'pending',
  due_date: '2026-02-01',
  total_amount: 18000,
  ...overrides,
}) as never;

describe('useLoanDetail', () => {
  const showSuccess = jest.fn();
  const showError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useToast as unknown as jest.Mock).mockReturnValue({ showSuccess, showError });
    (useSubscriptionStore as unknown as jest.Mock).mockReturnValue({ premium: true });
    (getLoanById as jest.Mock).mockResolvedValue(makeLoan());
    (getPaymentsByLoan as jest.Mock).mockResolvedValue([makePayment()]);
    jest.spyOn(Linking, 'openURL').mockImplementation(() => Promise.resolve());
  });

  it('carga el préstamo y los pagos al montar, y termina isLoading', async () => {
    const { result } = await renderHook(() => useLoanDetail('loan-1', false));

    await act(async () => {});

    expect(getLoanById).toHaveBeenCalledWith('loan-1');
    expect(getPaymentsByLoan).toHaveBeenCalledWith('loan-1');
    expect(result.current.loan?.id).toBe('loan-1');
    expect(result.current.payments).toHaveLength(1);
    expect(result.current.isLoading).toBe(false);
  });

  it('sin id, no llama a los servicios', async () => {
    await renderHook(() => useLoanDetail(undefined, false));

    await act(async () => {});

    expect(getLoanById).not.toHaveBeenCalled();
    expect(getPaymentsByLoan).not.toHaveBeenCalled();
  });

  it('si falla la carga, muestra un error', async () => {
    (getLoanById as jest.Mock).mockRejectedValue(new Error('network error'));
    const { result } = await renderHook(() => useLoanDetail('loan-1', false));

    await act(async () => {});

    expect(showError).toHaveBeenCalledWith('Error', 'No se pudo cargar el préstamo');
    expect(result.current.isLoading).toBe(false);
  });

  it('handlePaymentPress guarda el pago seleccionado', async () => {
    const { result } = await renderHook(() => useLoanDetail('loan-1', false));
    await act(async () => {});

    await act(() => {
      result.current.handlePaymentPress(makePayment(), 'pending', 500);
    });

    expect(result.current.selectedPayment).toEqual({
      payment: makePayment(),
      status: 'pending',
      penaltyAmount: 500,
    });
  });

  it('handleMarkPaid marca el pago, cancela la notificación y recarga', async () => {
    (markPaymentAsPaid as jest.Mock).mockResolvedValue(undefined);
    const { result } = await renderHook(() => useLoanDetail('loan-1', false));
    await act(async () => {});
    await act(() => {
      result.current.handlePaymentPress(makePayment(), 'pending', 0);
    });

    await act(async () => {
      await result.current.handleMarkPaid();
    });

    expect(markPaymentAsPaid).toHaveBeenCalledWith('pay-1', 18000);
    expect(cancelPaymentNotification).toHaveBeenCalledWith('pay-1');
    expect(updateBadgeCount).toHaveBeenCalledTimes(1);
    expect(showSuccess).toHaveBeenCalledWith('Pago registrado', 'El pago ha sido marcado como pagado');
    expect(result.current.selectedPayment).toBeNull();
    // recarga tras marcar el pago
    expect(getLoanById).toHaveBeenCalledTimes(2);
  });

  it('handleMarkPaid sin pago seleccionado no hace nada', async () => {
    const { result } = await renderHook(() => useLoanDetail('loan-1', false));
    await act(async () => {});

    await act(async () => {
      await result.current.handleMarkPaid();
    });

    expect(markPaymentAsPaid).not.toHaveBeenCalled();
  });

  it('handleMarkPaid muestra error si falla markPaymentAsPaid', async () => {
    (markPaymentAsPaid as jest.Mock).mockRejectedValue(new Error('boom'));
    const { result } = await renderHook(() => useLoanDetail('loan-1', false));
    await act(async () => {});
    await act(() => {
      result.current.handlePaymentPress(makePayment(), 'pending', 0);
    });

    await act(async () => {
      await result.current.handleMarkPaid();
    });

    expect(showError).toHaveBeenCalledWith('Error', 'No se pudo registrar el pago');
  });

  it('handleRevertPayment revierte el pago y recarga', async () => {
    (revertPaymentToPending as jest.Mock).mockResolvedValue(undefined);
    const { result } = await renderHook(() => useLoanDetail('loan-1', false));
    await act(async () => {});
    await act(() => {
      result.current.handlePaymentPress(makePayment({ status: 'paid' }), 'paid', 0);
    });

    await act(async () => {
      await result.current.handleRevertPayment();
    });

    expect(revertPaymentToPending).toHaveBeenCalledWith('pay-1');
    expect(showSuccess).toHaveBeenCalledWith('Pago revertido', 'El pago ha sido marcado como pendiente');
    expect(result.current.selectedPayment).toBeNull();
  });

  it('closeModal no cierra el modal mientras isProcessing es true', async () => {
    (markPaymentAsPaid as jest.Mock).mockImplementation(() => new Promise(() => {})); // nunca resuelve
    const { result } = await renderHook(() => useLoanDetail('loan-1', false));
    await act(async () => {});
    await act(() => {
      result.current.handlePaymentPress(makePayment(), 'pending', 0);
    });
    await act(() => {
      result.current.handleMarkPaid();
    });

    await act(() => {
      result.current.closeModal();
    });

    expect(result.current.selectedPayment).not.toBeNull();
  });

  it('handleExportPDF redirige a premium si el usuario no es premium', async () => {
    (useSubscriptionStore as unknown as jest.Mock).mockReturnValue({ premium: false });
    const { result } = await renderHook(() => useLoanDetail('loan-1', false));
    await act(async () => {});

    await act(async () => {
      await result.current.handleExportPDF();
    });

    expect(router.push).toHaveBeenCalledWith('/(main)/settings/premium');
    expect(generateLoanPDF).not.toHaveBeenCalled();
  });

  it('handleExportPDF genera el PDF si el usuario es premium', async () => {
    (generateLoanPDF as jest.Mock).mockResolvedValue(undefined);
    const { result } = await renderHook(() => useLoanDetail('loan-1', false));
    await act(async () => {});

    await act(async () => {
      await result.current.handleExportPDF();
    });

    expect(generateLoanPDF).toHaveBeenCalledTimes(1);
    expect(result.current.isExporting).toBe(false);
  });

  it('handleExportPDF muestra error si falla la generación', async () => {
    (generateLoanPDF as jest.Mock).mockRejectedValue(new Error('boom'));
    const { result } = await renderHook(() => useLoanDetail('loan-1', false));
    await act(async () => {});

    await act(async () => {
      await result.current.handleExportPDF();
    });

    expect(showError).toHaveBeenCalledWith('Error', 'No se pudo generar el PDF');
  });

  it('handleWhatsApp redirige a premium si el usuario no es premium', async () => {
    (useSubscriptionStore as unknown as jest.Mock).mockReturnValue({ premium: false });
    const { result } = await renderHook(() => useLoanDetail('loan-1', false));
    await act(async () => {});

    await act(() => {
      result.current.handleWhatsApp();
    });

    expect(router.push).toHaveBeenCalledWith('/(main)/settings/premium');
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it('handleWhatsApp muestra error si el prestatario no tiene teléfono', async () => {
    (getLoanById as jest.Mock).mockResolvedValue(makeLoan({ borrower: { id: 'b1', full_name: 'Juan', phone: null, dni: null } as never }));
    const { result } = await renderHook(() => useLoanDetail('loan-1', false));
    await act(async () => {});

    await act(() => {
      result.current.handleWhatsApp();
    });

    expect(showError).toHaveBeenCalledWith('Sin teléfono', 'El prestatario no tiene un número registrado');
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it('handleWhatsApp abre wa.me con el recordatorio de la próxima cuota pendiente', async () => {
    const { result } = await renderHook(() => useLoanDetail('loan-1', false));
    await act(async () => {});

    await act(() => {
      result.current.handleWhatsApp();
    });

    expect(Linking.openURL).toHaveBeenCalledWith(
      expect.stringContaining('https://wa.me/5491112345678?text=')
    );
    const url = (Linking.openURL as jest.Mock).mock.calls[0][0] as string;
    expect(decodeURIComponent(url)).toContain('cuota #1');
  });

  it('handleWhatsApp avisa que está al día si no hay cuotas pendientes', async () => {
    (getPaymentsByLoan as jest.Mock).mockResolvedValue([makePayment({ status: 'paid' })]);
    const { result } = await renderHook(() => useLoanDetail('loan-1', false));
    await act(async () => {});

    await act(() => {
      result.current.handleWhatsApp();
    });

    const url = (Linking.openURL as jest.Mock).mock.calls[0][0] as string;
    expect(decodeURIComponent(url)).toContain('está al día');
  });

  it('handleDeleteLoan abre el modal de confirmación', async () => {
    const { result } = await renderHook(() => useLoanDetail('loan-1', false));
    await act(async () => {});

    await act(() => {
      result.current.handleDeleteLoan();
    });

    expect(result.current.showDeleteModal).toBe(true);
  });

  it('confirmDeleteLoan elimina el préstamo, muestra éxito y vuelve atrás', async () => {
    (deleteLoan as jest.Mock).mockResolvedValue(undefined);
    const { result } = await renderHook(() => useLoanDetail('loan-1', false));
    await act(async () => {});

    await act(async () => {
      await result.current.confirmDeleteLoan();
    });

    expect(deleteLoan).toHaveBeenCalledWith('loan-1');
    expect(showSuccess).toHaveBeenCalledWith('Préstamo eliminado', 'El préstamo ha sido eliminado correctamente');
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('confirmDeleteLoan muestra el mensaje de error real cuando falla (ej. "solo completados")', async () => {
    (deleteLoan as jest.Mock).mockRejectedValue(new Error('Solo se pueden eliminar préstamos completados'));
    const { result } = await renderHook(() => useLoanDetail('loan-1', false));
    await act(async () => {});

    await act(async () => {
      await result.current.confirmDeleteLoan();
    });

    expect(showError).toHaveBeenCalledWith('Error', 'Solo se pueden eliminar préstamos completados');
    expect(router.back).not.toHaveBeenCalled();
  });

  it('formatCurrency usa la moneda del préstamo cargado', async () => {
    (getLoanById as jest.Mock).mockResolvedValue(makeLoan({ currency: 'USD' }));
    const { result } = await renderHook(() => useLoanDetail('loan-1', false));
    await act(async () => {});

    expect(result.current.formatCurrency(1000)).toContain('US$');
  });

  it('formatDate devuelve "—" para fechas nulas', async () => {
    const { result } = await renderHook(() => useLoanDetail('loan-1', false));
    await act(async () => {});

    expect(result.current.formatDate(null)).toBe('—');
  });
});
