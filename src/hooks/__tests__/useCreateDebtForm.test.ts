import { act, renderHook } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import {
  createPersonalDebt,
  getDebtPayments,
  getActivePersonalDebts,
  uploadTransferProof,
} from '../../services/supabase';
import { scheduleDebtPaymentReminders } from '../../services/notifications';
import { useSubscriptionStore, FREE_LIMITS, usePreferencesStore } from '../../store';
import { useToast } from '../../components';
import { useCreateDebtForm } from '../useCreateDebtForm';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
}));

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('../../services/supabase', () => ({
  createPersonalDebt: jest.fn(),
  getDebtPayments: jest.fn(),
  getActivePersonalDebts: jest.fn(),
  uploadTransferProof: jest.fn(),
}));

jest.mock('../../services/notifications', () => ({
  scheduleDebtPaymentReminders: jest.fn(),
}));

jest.mock('../../store', () => {
  const actualFreeLimits = { activeLoans: 3, personalDebts: 2, borrowers: 5 };
  return {
    useSubscriptionStore: jest.fn(),
    usePreferencesStore: jest.fn(),
    FREE_LIMITS: actualFreeLimits,
  };
});

jest.mock('../../components', () => ({
  useToast: jest.fn(),
}));

describe('useCreateDebtForm', () => {
  const showSuccess = jest.fn();
  const showError = jest.fn();

  const fillStep1 = async (result: { current: ReturnType<typeof useCreateDebtForm> }) => {
    await act(() => {
      result.current.setCreditorName('Banco Nación');
    });
  };

  const fillStep2 = async (result: { current: ReturnType<typeof useCreateDebtForm> }) => {
    await act(() => {
      result.current.setPrincipal('50000');
      result.current.setInterestRate('24');
      result.current.setTermValue('6');
      result.current.setDeliveryDate('2026-01-01');
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (usePreferencesStore as unknown as jest.Mock).mockReturnValue({
      defaultCurrency: 'ARS',
      reminderDaysBefore: 3,
    });
    (useSubscriptionStore as unknown as jest.Mock).mockReturnValue({ premium: true });
    (useToast as unknown as jest.Mock).mockReturnValue({ showSuccess, showError });
    (getActivePersonalDebts as jest.Mock).mockResolvedValue([]);
    (createPersonalDebt as jest.Mock).mockResolvedValue({ id: 'debt-1' });
    (getDebtPayments as jest.Mock).mockResolvedValue([]);
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('empieza en el paso 1, con la moneda por defecto del usuario', async () => {
    const { result } = await renderHook(() => useCreateDebtForm());

    expect(result.current.step).toBe(1);
    expect(result.current.currency).toBe('ARS');
    expect(result.current.payment).toBeNull();
  });

  it('handleNext no avanza de paso 1 sin nombre del acreedor', async () => {
    const { result } = await renderHook(() => useCreateDebtForm());

    await act(() => {
      result.current.handleNext();
    });

    expect(result.current.step).toBe(1);
    expect(result.current.errors.creditorName).toBe('El nombre es obligatorio');
  });

  it('handleBack en paso 1 llama a router.back()', async () => {
    const { result } = await renderHook(() => useCreateDebtForm());

    await act(() => {
      result.current.handleBack();
    });

    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('handleNext avanza de paso 1 a 2, y de 2 a 3 con datos válidos', async () => {
    const { result } = await renderHook(() => useCreateDebtForm());
    await fillStep1(result);
    await act(() => result.current.handleNext());
    expect(result.current.step).toBe(2);

    await fillStep2(result);
    await act(() => result.current.handleNext());
    expect(result.current.step).toBe(3);
  });

  it('validateStep2 rechaza monto, tasa y plazo inválidos', async () => {
    const { result } = await renderHook(() => useCreateDebtForm());
    await fillStep1(result);
    await act(() => result.current.handleNext());

    await act(() => {
      result.current.handleNext();
    });

    expect(result.current.step).toBe(2);
    expect(result.current.errors.principal).toBe('El monto es obligatorio');
    expect(result.current.errors.interestRate).toBe('La tasa de interés es obligatoria');
    expect(result.current.errors.termValue).toBe('El plazo es obligatorio');
  });

  it('firstPaymentDate suma 31 días a la fecha de entrega', async () => {
    const { result } = await renderHook(() => useCreateDebtForm());

    await act(() => {
      result.current.setDeliveryDate('2026-01-01');
    });

    expect(result.current.firstPaymentDate).toBe('2026-02-01');
  });

  it('payment se calcula con calculateLoanPayment cuando hay monto, tasa y plazo', async () => {
    const { result } = await renderHook(() => useCreateDebtForm());
    await fillStep2(result);

    expect(result.current.payment).not.toBeNull();
    expect(result.current.payment?.paymentAmount).toBeGreaterThan(0);
  });

  it('handlePickImage con permiso concedido guarda la uri de la foto tomada', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://comprobante.jpg' }],
    });
    const { result } = await renderHook(() => useCreateDebtForm());

    await act(() => {
      result.current.handlePickImage();
    });
    const buttons = alertSpy.mock.calls[0][2];
    const cameraButton = buttons!.find((b) => b.text === 'Cámara')!;

    await act(async () => {
      await cameraButton.onPress?.();
    });

    expect(result.current.transferProofUri).toBe('file://comprobante.jpg');
    alertSpy.mockRestore();
  });

  it('handleCreate no hace nada si el pago no se calculó', async () => {
    const { result } = await renderHook(() => useCreateDebtForm());
    await fillStep1(result);

    await act(async () => {
      await result.current.handleCreate();
    });

    expect(createPersonalDebt).not.toHaveBeenCalled();
  });

  it('handleCreate redirige a premium si no es premium y ya llegó al límite de deudas activas', async () => {
    (useSubscriptionStore as unknown as jest.Mock).mockReturnValue({ premium: false });
    (getActivePersonalDebts as jest.Mock).mockResolvedValue(
      Array.from({ length: FREE_LIMITS.personalDebts }, (_, i) => ({ id: `d${i}` }))
    );
    const { result } = await renderHook(() => useCreateDebtForm());
    await fillStep1(result);
    await fillStep2(result);

    await act(async () => {
      await result.current.handleCreate();
    });

    expect(router.push).toHaveBeenCalledWith('/(main)/settings/premium');
    expect(createPersonalDebt).not.toHaveBeenCalled();
  });

  it('handleCreate: camino feliz -- crea la deuda, agenda recordatorios y muestra éxito', async () => {
    jest.useFakeTimers();
    (getDebtPayments as jest.Mock).mockResolvedValue([
      { id: 'p1', due_date: '2026-02-01', total_amount: 9000, payment_number: 1 },
    ]);
    const { result } = await renderHook(() => useCreateDebtForm());
    await fillStep1(result);
    await fillStep2(result);

    await act(async () => {
      await result.current.handleCreate();
    });

    expect(createPersonalDebt).toHaveBeenCalledWith(
      expect.objectContaining({
        creditor_name: 'Banco Nación',
        principal_amount: 50000,
        currency: 'ARS',
        term_value: 6,
      })
    );
    expect(scheduleDebtPaymentReminders).toHaveBeenCalledWith(
      'debt-1',
      'Banco Nación',
      [{ id: 'p1', dueDate: '2026-02-01', amount: 9000, paymentNumber: 1 }],
      3
    );
    expect(showSuccess).toHaveBeenCalledWith('Deuda creada', expect.stringContaining('Banco Nación'));
    expect(router.back).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1500);
    });
    expect(router.back).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('handleCreate no bloquea la creación si falla la subida del comprobante', async () => {
    (uploadTransferProof as jest.Mock).mockRejectedValue(new Error('upload failed'));
    const { result } = await renderHook(() => useCreateDebtForm());
    await fillStep1(result);
    await fillStep2(result);
    await act(() => {
      result.current.setTransferProofUri('file://comprobante.jpg');
    });

    await act(async () => {
      await result.current.handleCreate();
    });

    expect(createPersonalDebt).toHaveBeenCalledWith(
      expect.objectContaining({ transfer_proof_url: null })
    );
    expect(showError).not.toHaveBeenCalled();
  });

  it('handleCreate muestra el error real si falla createPersonalDebt', async () => {
    (createPersonalDebt as jest.Mock).mockRejectedValue(new Error('Violación de constraint'));
    const { result } = await renderHook(() => useCreateDebtForm());
    await fillStep1(result);
    await fillStep2(result);

    await act(async () => {
      await result.current.handleCreate();
    });

    expect(showError).toHaveBeenCalledWith('Error', 'Violación de constraint');
    expect(result.current.isLoading).toBe(false);
    expect(showSuccess).not.toHaveBeenCalled();
  });
});
