import { act, renderHook } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import {
  getOrCreateBorrower,
  createLoan,
  getPaymentsByLoan,
  getLastLoanColor,
  uploadTransferProof,
  getActiveLoans,
} from '../../services/supabase';
import { schedulePaymentReminders } from '../../services/notifications';
import { useAuthStore, usePreferencesStore, useSubscriptionStore, FREE_LIMITS } from '../../store';
import { useToast } from '../../components';
import { useCreateLoanForm } from '../useCreateLoanForm';

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
  getOrCreateBorrower: jest.fn(),
  createLoan: jest.fn(),
  getPaymentsByLoan: jest.fn(),
  getLastLoanColor: jest.fn(),
  uploadTransferProof: jest.fn(),
  getActiveLoans: jest.fn(),
}));

jest.mock('../../services/notifications', () => ({
  schedulePaymentReminders: jest.fn(),
}));

jest.mock('../../store', () => {
  const actualFreeLimits = { activeLoans: 3, personalDebts: 2, borrowers: 5 };
  return {
    useAuthStore: jest.fn(),
    usePreferencesStore: jest.fn(),
    useSubscriptionStore: jest.fn(),
    FREE_LIMITS: actualFreeLimits,
  };
});

jest.mock('../../components', () => ({
  useToast: jest.fn(),
}));

describe('useCreateLoanForm', () => {
  const showSuccess = jest.fn();
  const showError = jest.fn();

  const fillStep1 = async (result: { current: ReturnType<typeof useCreateLoanForm> }) => {
    await act(() => {
      result.current.setBorrowerName('Ana Pérez');
    });
  };

  const fillStep2Simple = async (result: { current: ReturnType<typeof useCreateLoanForm> }) => {
    await act(() => {
      result.current.setPrincipal('100000');
      result.current.setInterestRate('2');
      result.current.setTermValue('6');
      result.current.setDeliveryDateInput('2026-01-01');
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuthStore as unknown as jest.Mock).mockReturnValue({ user: { id: 'user-1' } });
    (usePreferencesStore as unknown as jest.Mock).mockReturnValue({
      defaultCurrency: 'ARS',
      reminderDaysBefore: 3,
    });
    (useSubscriptionStore as unknown as jest.Mock).mockReturnValue({ premium: true });
    (useToast as unknown as jest.Mock).mockReturnValue({ showSuccess, showError });
    (getActiveLoans as jest.Mock).mockResolvedValue([]);
    (getOrCreateBorrower as jest.Mock).mockResolvedValue({
      borrower: { id: 'borrower-1' },
      isNew: true,
    });
    (createLoan as jest.Mock).mockResolvedValue({ id: 'loan-1' });
    (getPaymentsByLoan as jest.Mock).mockResolvedValue([]);
    (getLastLoanColor as jest.Mock).mockResolvedValue(null);
    (uploadTransferProof as jest.Mock).mockResolvedValue('https://storage/proof.jpg');
  });

  it('empieza en el paso 1, con la moneda por defecto del usuario y la fecha de hoy', async () => {
    const { result } = await renderHook(() => useCreateLoanForm());

    expect(result.current.step).toBe(1);
    expect(result.current.currency).toBe('ARS');
    expect(result.current.deliveryDateInput).toBe(new Date().toISOString().split('T')[0]);
    expect(result.current.payment).toBeNull();
  });

  it('handleNext no avanza de paso 1 sin nombre del prestatario', async () => {
    const { result } = await renderHook(() => useCreateLoanForm());

    await act(() => {
      result.current.handleNext();
    });

    expect(result.current.step).toBe(1);
    expect(result.current.errors.borrowerName).toBe('El nombre es obligatorio');
  });

  it('handleNext rechaza un DNI que no tenga 7 u 8 dígitos', async () => {
    const { result } = await renderHook(() => useCreateLoanForm());
    await fillStep1(result);
    await act(() => {
      result.current.setBorrowerDni('123');
    });

    await act(() => {
      result.current.handleNext();
    });

    expect(result.current.step).toBe(1);
    expect(result.current.errors.borrowerDni).toBe('El DNI debe tener 7 u 8 dígitos');
  });

  it('handleNext avanza de paso 1 a 2 con datos válidos', async () => {
    const { result } = await renderHook(() => useCreateLoanForm());
    await fillStep1(result);

    await act(() => {
      result.current.handleNext();
    });

    expect(result.current.step).toBe(2);
  });

  it('handleBack en paso 1 llama a router.back()', async () => {
    const { result } = await renderHook(() => useCreateLoanForm());

    await act(() => {
      result.current.handleBack();
    });

    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('handleBack en paso > 1 retrocede un paso y limpia errores', async () => {
    const { result } = await renderHook(() => useCreateLoanForm());
    await fillStep1(result);
    await act(() => result.current.handleNext());
    expect(result.current.step).toBe(2);

    await act(() => {
      result.current.handleBack();
    });

    expect(result.current.step).toBe(1);
    expect(router.back).not.toHaveBeenCalled();
  });

  it('validateStep2 rechaza monto, tasa y plazo inválidos', async () => {
    const { result } = await renderHook(() => useCreateLoanForm());
    await fillStep1(result);
    await act(() => result.current.handleNext());

    await act(() => {
      result.current.handleNext(); // step2 sin llenar nada
    });

    expect(result.current.step).toBe(2);
    expect(result.current.errors.principal).toBe('El monto es obligatorio');
    expect(result.current.errors.interestRate).toBe('La tasa de interés es obligatoria');
    expect(result.current.errors.termValue).toBe('El plazo es obligatorio');
  });

  it('validateStep2 no exige plazo cuando el tipo de interés es "open"', async () => {
    const { result } = await renderHook(() => useCreateLoanForm());
    await fillStep1(result);
    await act(() => result.current.handleNext());
    await act(() => {
      result.current.setInterestType('open');
      result.current.setPrincipal('50000');
      result.current.setInterestRate('15');
    });

    await act(() => {
      result.current.handleNext();
    });

    expect(result.current.step).toBe(3);
  });

  it('validateStep2 rechaza una tasa mayor a 999', async () => {
    const { result } = await renderHook(() => useCreateLoanForm());
    await fillStep1(result);
    await act(() => result.current.handleNext());
    await act(() => {
      result.current.setPrincipal('1000');
      result.current.setInterestRate('1500');
      result.current.setTermValue('6');
    });

    await act(() => {
      result.current.handleNext();
    });

    expect(result.current.step).toBe(2);
    expect(result.current.errors.interestRate).toBe('La tasa parece muy alta, verificá');
  });

  it('handleNext avanza de paso 2 a 3 con datos válidos', async () => {
    const { result } = await renderHook(() => useCreateLoanForm());
    await fillStep1(result);
    await act(() => result.current.handleNext());
    await fillStep2Simple(result);

    await act(() => {
      result.current.handleNext();
    });

    expect(result.current.step).toBe(3);
  });

  it('firstPaymentDateCalc suma 1 mes para termType "months" y 7 días para "weeks"', async () => {
    const { result } = await renderHook(() => useCreateLoanForm());

    await act(() => {
      result.current.setDeliveryDateInput('2026-01-15');
    });
    expect(result.current.firstPaymentDateCalc).toBe('2026-02-15');

    await act(() => {
      result.current.setTermType('weeks');
    });
    expect(result.current.firstPaymentDateCalc).toBe('2026-01-22');
  });

  it('firstPaymentDateCalc es cadena vacía con una fecha inválida o incompleta', async () => {
    const { result } = await renderHook(() => useCreateLoanForm());

    await act(() => {
      result.current.setDeliveryDateInput('fecha-invalida');
    });

    expect(result.current.firstPaymentDateCalc).toBe('');
  });

  it('payment se calcula con calculateLoanPayment (simple) cuando hay monto, tasa y plazo', async () => {
    const { result } = await renderHook(() => useCreateLoanForm());
    await fillStep2Simple(result);

    expect(result.current.payment).not.toBeNull();
    expect(result.current.payment?.paymentAmount).toBeGreaterThan(0);
  });

  it('handlePickImage abre un Alert con las opciones Cámara/Galería/Cancelar', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { result } = await renderHook(() => useCreateLoanForm());

    await act(() => {
      result.current.handlePickImage();
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Adjuntar comprobante',
      'Seleccioná el origen de la imagen',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cámara' }),
        expect.objectContaining({ text: 'Galería' }),
        expect.objectContaining({ text: 'Cancelar', style: 'cancel' }),
      ])
    );
    alertSpy.mockRestore();
  });

  it('openCamera (vía el botón "Cámara") pide permiso y, si se niega, muestra error', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
    const { result } = await renderHook(() => useCreateLoanForm());

    await act(() => {
      result.current.handlePickImage();
    });
    const [, , buttons] = alertSpy.mock.calls[0];
    const cameraButton = buttons!.find((b) => b.text === 'Cámara')!;

    await act(async () => {
      await cameraButton.onPress?.();
    });

    expect(showError).toHaveBeenCalledWith('Permiso requerido', 'Necesitamos acceso a la cámara');
    expect(result.current.transferProofUri).toBeNull();
    alertSpy.mockRestore();
  });

  it('openCamera con permiso concedido guarda la uri de la foto tomada', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://foto.jpg' }],
    });
    const { result } = await renderHook(() => useCreateLoanForm());

    await act(() => {
      result.current.handlePickImage();
    });
    const [, , buttons] = alertSpy.mock.calls[0];
    const cameraButton = buttons!.find((b) => b.text === 'Cámara')!;

    await act(async () => {
      await cameraButton.onPress?.();
    });

    expect(result.current.transferProofUri).toBe('file://foto.jpg');
    alertSpy.mockRestore();
  });

  it('openGallery cancelado no cambia transferProofUri', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: true, assets: [] });
    const { result } = await renderHook(() => useCreateLoanForm());

    await act(() => {
      result.current.handlePickImage();
    });
    const [, , buttons] = alertSpy.mock.calls[0];
    const galleryButton = buttons!.find((b) => b.text === 'Galería')!;

    await act(async () => {
      await galleryButton.onPress?.();
    });

    expect(result.current.transferProofUri).toBeNull();
    alertSpy.mockRestore();
  });

  it('handleCreate no hace nada sin usuario autenticado', async () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({ user: null });
    const { result } = await renderHook(() => useCreateLoanForm());
    await fillStep1(result);
    await fillStep2Simple(result);

    await act(async () => {
      await result.current.handleCreate();
    });

    expect(createLoan).not.toHaveBeenCalled();
  });

  it('handleCreate no hace nada si el préstamo no es "open" y el pago no se calculó', async () => {
    const { result } = await renderHook(() => useCreateLoanForm());
    await fillStep1(result); // sin llenar monto/tasa/plazo -> payment null

    await act(async () => {
      await result.current.handleCreate();
    });

    expect(createLoan).not.toHaveBeenCalled();
  });

  it('handleCreate redirige a premium si no es premium y ya llegó al límite de préstamos activos', async () => {
    (useSubscriptionStore as unknown as jest.Mock).mockReturnValue({ premium: false });
    (getActiveLoans as jest.Mock).mockResolvedValue(
      Array.from({ length: FREE_LIMITS.activeLoans }, (_, i) => ({ id: `l${i}` }))
    );
    const { result } = await renderHook(() => useCreateLoanForm());
    await fillStep1(result);
    await fillStep2Simple(result);

    await act(async () => {
      await result.current.handleCreate();
    });

    expect(router.push).toHaveBeenCalledWith('/(main)/settings/premium');
    expect(createLoan).not.toHaveBeenCalled();
  });

  it('handleCreate: camino feliz -- crea el préstamo, agenda recordatorios y muestra éxito', async () => {
    jest.useFakeTimers();
    (getPaymentsByLoan as jest.Mock).mockResolvedValue([
      { id: 'p1', due_date: '2026-02-01', total_amount: 18000, payment_number: 1 },
    ]);
    const { result } = await renderHook(() => useCreateLoanForm());
    await fillStep1(result);
    await fillStep2Simple(result);

    await act(async () => {
      await result.current.handleCreate();
    });

    expect(getOrCreateBorrower).toHaveBeenCalledWith({
      lender_id: 'user-1',
      full_name: 'Ana Pérez',
      dni: null,
      phone: null,
    });
    expect(createLoan).toHaveBeenCalledWith(
      expect.objectContaining({
        lender_id: 'user-1',
        borrower_id: 'borrower-1',
        principal_amount: 100000,
        currency: 'ARS',
        term_value: 6,
        interest_type: 'simple',
      })
    );
    expect(schedulePaymentReminders).toHaveBeenCalledWith(
      'loan-1',
      'Ana Pérez',
      [{ id: 'p1', dueDate: '2026-02-01', amount: 18000, paymentNumber: 1 }],
      3
    );
    expect(showSuccess).toHaveBeenCalledWith(
      'Préstamo creado',
      expect.stringContaining('Ana Pérez')
    );
    expect(router.back).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1500);
    });
    expect(router.back).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('handleCreate para un préstamo "open": term_value null y total_amount = capital', async () => {
    const { result } = await renderHook(() => useCreateLoanForm());
    await fillStep1(result);
    await act(() => result.current.handleNext());
    await act(() => {
      result.current.setInterestType('open');
      result.current.setPrincipal('50000');
      result.current.setInterestRate('15');
      result.current.setDeliveryDateInput('2026-01-01');
    });

    await act(async () => {
      await result.current.handleCreate();
    });

    expect(createLoan).toHaveBeenCalledWith(
      expect.objectContaining({
        interest_type: 'open',
        term_value: null,
        payment_amount: 0,
        total_interest: 0,
        total_amount: 50000,
      })
    );
  });

  it('handleCreate no bloquea la creación si falla la subida del comprobante', async () => {
    (uploadTransferProof as jest.Mock).mockRejectedValue(new Error('upload failed'));
    const { result } = await renderHook(() => useCreateLoanForm());
    await fillStep1(result);
    await fillStep2Simple(result);
    await act(() => {
      result.current.setTransferProofUri('file://comprobante.jpg');
    });

    await act(async () => {
      await result.current.handleCreate();
    });

    expect(createLoan).toHaveBeenCalledWith(
      expect.objectContaining({ transfer_proof_url: null })
    );
    expect(showError).not.toHaveBeenCalled();
  });

  it('handleCreate no bloquea la creación si falla agendar las notificaciones', async () => {
    (getPaymentsByLoan as jest.Mock).mockResolvedValue([
      { id: 'p1', due_date: '2026-02-01', total_amount: 18000, payment_number: 1 },
    ]);
    (schedulePaymentReminders as jest.Mock).mockRejectedValue(new Error('notif failed'));
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = await renderHook(() => useCreateLoanForm());
    await fillStep1(result);
    await fillStep2Simple(result);

    await act(async () => {
      await result.current.handleCreate();
    });

    expect(showSuccess).toHaveBeenCalled();
    expect(showError).not.toHaveBeenCalled();
    consoleWarn.mockRestore();
  });

  it('handleCreate muestra el error real si falla createLoan', async () => {
    (createLoan as jest.Mock).mockRejectedValue(new Error('Violación de constraint'));
    const { result } = await renderHook(() => useCreateLoanForm());
    await fillStep1(result);
    await fillStep2Simple(result);

    await act(async () => {
      await result.current.handleCreate();
    });

    expect(showError).toHaveBeenCalledWith('Error', 'Violación de constraint');
    expect(result.current.isLoading).toBe(false);
    expect(showSuccess).not.toHaveBeenCalled();
  });

  it('handleCreate usa el mensaje de "agregado a" cuando el prestatario ya existía', async () => {
    (getOrCreateBorrower as jest.Mock).mockResolvedValue({
      borrower: { id: 'borrower-1' },
      isNew: false,
    });
    const { result } = await renderHook(() => useCreateLoanForm());
    await fillStep1(result);
    await fillStep2Simple(result);

    await act(async () => {
      await result.current.handleCreate();
    });

    expect(showSuccess).toHaveBeenCalledWith(
      'Préstamo creado',
      expect.stringContaining('agregado a Ana Pérez')
    );
  });
});
