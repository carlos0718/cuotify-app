import { act, renderHook } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { analyzeCreditCardReceipt } from '../../services/gemini/creditCardAnalyzer';
import { createPersonalDebt } from '../../services/supabase';
import { usePreferencesStore } from '../../store';
import { useToast } from '../../components';
import { useDebtAnalyze } from '../useDebtAnalyze';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
}));

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('../../services/gemini/creditCardAnalyzer', () => ({
  analyzeCreditCardReceipt: jest.fn(),
}));

jest.mock('../../services/supabase', () => ({
  createPersonalDebt: jest.fn(),
}));

jest.mock('../../store', () => ({
  usePreferencesStore: jest.fn(),
}));

jest.mock('../../components', () => ({
  useToast: jest.fn(),
}));

const makeCreditCardItem = (overrides: Record<string, unknown> = {}) => ({
  creditor_name: 'Tienda X',
  description: 'Notebook',
  installment_amount: 5000,
  installments_remaining: 6,
  total_installments: 12,
  currency: 'ARS',
  type: 'installment',
  ...overrides,
});

const setFileViaCamera = async (result: { current: ReturnType<typeof useDebtAnalyze> }) => {
  (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
  (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file://foto.jpg' }],
  });
  result.current.handleShowOptions();
  const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
  const cameraButton = buttons.find((b: { text: string }) => b.text === 'Cámara');
  await act(async () => {
    await cameraButton.onPress();
  });
};

describe('useDebtAnalyze', () => {
  const showSuccess = jest.fn();
  const showError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (usePreferencesStore as unknown as jest.Mock).mockReturnValue({ defaultCurrency: 'ARS' });
    (useToast as unknown as jest.Mock).mockReturnValue({ showSuccess, showError });
    (createPersonalDebt as jest.Mock).mockResolvedValue({ id: 'debt-1' });
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('empieza en "select" sin archivo', async () => {
    const { result } = await renderHook(() => useDebtAnalyze());

    expect(result.current.phase).toBe('select');
    expect(result.current.items).toEqual([]);
  });

  it('handleAnalyze mapea los items extraídos, con installments vacío para suscripciones', async () => {
    (analyzeCreditCardReceipt as jest.Mock).mockResolvedValue({
      bankName: 'Banco X',
      cardBrand: 'Visa',
      items: [
        makeCreditCardItem(),
        makeCreditCardItem({ creditor_name: 'Netflix', type: 'subscription', installments_remaining: 0 }),
      ],
    });
    const { result } = await renderHook(() => useDebtAnalyze());
    await setFileViaCamera(result);

    await act(async () => {
      await result.current.handleAnalyze();
    });

    expect(result.current.phase).toBe('review');
    expect(result.current.bankName).toBe('Banco X');
    expect(result.current.items[0].editedInstallments).toBe('6');
    expect(result.current.items[1].editedInstallments).toBe('');
  });

  it('handleAnalyze sin resultados muestra error y vuelve a "select"', async () => {
    (analyzeCreditCardReceipt as jest.Mock).mockResolvedValue({ bankName: '', cardBrand: '', items: [] });
    const { result } = await renderHook(() => useDebtAnalyze());
    await setFileViaCamera(result);

    await act(async () => {
      await result.current.handleAnalyze();
    });

    expect(showError).toHaveBeenCalledWith('Sin resultados', expect.any(String));
    expect(result.current.phase).toBe('select');
  });

  it('handleBackToSelect limpia items, banco y marca', async () => {
    (analyzeCreditCardReceipt as jest.Mock).mockResolvedValue({
      bankName: 'Banco X',
      cardBrand: 'Visa',
      items: [makeCreditCardItem()],
    });
    const { result } = await renderHook(() => useDebtAnalyze());
    await setFileViaCamera(result);
    await act(async () => {
      await result.current.handleAnalyze();
    });

    await act(() => {
      result.current.handleBackToSelect();
    });

    expect(result.current.phase).toBe('select');
    expect(result.current.items).toEqual([]);
    expect(result.current.bankName).toBe('');
  });

  const analyzeOneItem = async (result: { current: ReturnType<typeof useDebtAnalyze> }, overrides = {}) => {
    (analyzeCreditCardReceipt as jest.Mock).mockResolvedValue({
      bankName: 'Banco X',
      cardBrand: 'Visa',
      items: [makeCreditCardItem(overrides)],
    });
    await setFileViaCamera(result);
    await act(async () => {
      await result.current.handleAnalyze();
    });
  };

  it('handleCreateDebts: camino feliz -- crea la deuda con la descripción + banco/marca, y redirige tras 1200ms', async () => {
    jest.useFakeTimers();
    const { result } = await renderHook(() => useDebtAnalyze());
    await analyzeOneItem(result);

    await act(async () => {
      await result.current.handleCreateDebts();
    });

    expect(createPersonalDebt).toHaveBeenCalledWith(
      expect.objectContaining({
        creditor_name: 'Tienda X',
        description: 'Notebook · Banco X Visa',
        principal_amount: 30000, // 5000 * 6
        term_value: 6,
        currency: 'ARS',
      })
    );
    expect(showSuccess).toHaveBeenCalledWith('Deudas creadas', expect.stringContaining('1 deuda'));
    expect(router.replace).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1200);
    });
    expect(router.replace).toHaveBeenCalledWith('/(main)/debts');
    jest.useRealTimers();
  });

  it('una suscripción usa 12 cuotas fijas para calcular el principal', async () => {
    const { result } = await renderHook(() => useDebtAnalyze());
    await analyzeOneItem(result, { type: 'subscription', installment_amount: 1000, installments_remaining: 0 });

    await act(async () => {
      await result.current.handleCreateDebts();
    });

    expect(createPersonalDebt).toHaveBeenCalledWith(
      expect.objectContaining({ principal_amount: 12000, term_value: 12 })
    );
  });

  it('handleCreateDebts salta items sin cuotas restantes válidas', async () => {
    const { result } = await renderHook(() => useDebtAnalyze());
    await analyzeOneItem(result, { installments_remaining: 0 });
    await act(() => {
      result.current.handleEdit(0, 'editedInstallments', '0');
    });

    await act(async () => {
      await result.current.handleCreateDebts();
    });

    expect(createPersonalDebt).not.toHaveBeenCalled();
    expect(showError).toHaveBeenCalledWith('Error', 'No se pudo crear ninguna deuda');
  });

  it('handleToggle y handleEdit actualizan el item correspondiente', async () => {
    const { result } = await renderHook(() => useDebtAnalyze());
    await analyzeOneItem(result);

    await act(() => {
      result.current.handleToggle(0);
    });
    expect(result.current.items[0].selected).toBe(false);
    expect(result.current.selectedCount).toBe(0);

    await act(() => {
      result.current.handleEdit(0, 'editedCreditor', 'Nuevo nombre');
    });
    expect(result.current.items[0].editedCreditor).toBe('Nuevo nombre');
  });
});
