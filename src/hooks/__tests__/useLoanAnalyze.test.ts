import { act, renderHook } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { analyzeLoanDocument } from '../../services/gemini/loansAnalyzer';
import { getOrCreateBorrower, createLoan } from '../../services/supabase';
import { useAuthStore, usePreferencesStore } from '../../store';
import { useToast } from '../../components';
import { useLoanAnalyze } from '../useLoanAnalyze';

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

jest.mock('../../services/gemini/loansAnalyzer', () => ({
  analyzeLoanDocument: jest.fn(),
}));

jest.mock('../../services/supabase', () => ({
  getOrCreateBorrower: jest.fn(),
  createLoan: jest.fn(),
}));

jest.mock('../../store', () => ({
  useAuthStore: jest.fn(),
  usePreferencesStore: jest.fn(),
}));

jest.mock('../../components', () => ({
  useToast: jest.fn(),
}));

const makeExtractedItem = (overrides: Record<string, unknown> = {}) => ({
  borrower_name: 'Juan Pérez',
  borrower_dni: '30111222',
  borrower_phone: '5491112345678',
  principal_amount: 100000,
  interest_rate: 24,
  term_value: 6,
  term_type: 'months',
  interest_type: 'simple',
  currency: 'ARS',
  delivery_date: '2026-01-01',
  notes: null,
  ...overrides,
});

describe('useLoanAnalyze', () => {
  const showSuccess = jest.fn();
  const showError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuthStore as unknown as jest.Mock).mockReturnValue({ session: { user: { id: 'user-1' } } });
    (usePreferencesStore as unknown as jest.Mock).mockReturnValue({ defaultCurrency: 'ARS' });
    (useToast as unknown as jest.Mock).mockReturnValue({ showSuccess, showError });
    (getOrCreateBorrower as jest.Mock).mockResolvedValue({ borrower: { id: 'borrower-1' }, isNew: true });
    (createLoan as jest.Mock).mockResolvedValue({ id: 'loan-1' });
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('empieza en la fase "select" sin archivo', async () => {
    const { result } = await renderHook(() => useLoanAnalyze());

    expect(result.current.phase).toBe('select');
    expect(result.current.fileUri).toBeNull();
    expect(result.current.items).toEqual([]);
  });

  it('handleShowOptions abre un Alert con las 4 opciones', async () => {
    const { result } = await renderHook(() => useLoanAnalyze());

    await act(() => {
      result.current.handleShowOptions();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Adjuntar documento',
      'Seleccioná el origen del archivo',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cámara' }),
        expect.objectContaining({ text: 'Galería de fotos' }),
        expect.objectContaining({ text: 'PDF / CSV / XLSX' }),
        expect.objectContaining({ text: 'Cancelar', style: 'cancel' }),
      ])
    );
  });

  it('la opción de cámara, con permiso concedido, guarda la foto como imagen', async () => {
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://foto.jpg' }],
    });
    const { result } = await renderHook(() => useLoanAnalyze());
    result.current.handleShowOptions();
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
    const cameraButton = buttons.find((b: { text: string }) => b.text === 'Cámara');

    await act(async () => {
      await cameraButton.onPress();
    });

    expect(result.current.fileUri).toBe('file://foto.jpg');
    expect(result.current.isImage).toBe(true);
  });

  it('la opción de documento guarda el nombre del archivo y marca isImage en false', async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://planilla.xlsx', name: 'planilla.xlsx' }],
    });
    const { result } = await renderHook(() => useLoanAnalyze());
    result.current.handleShowOptions();
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
    const docButton = buttons.find((b: { text: string }) => b.text === 'PDF / CSV / XLSX');

    await act(async () => {
      await docButton.onPress();
    });

    expect(result.current.fileUri).toBe('file://planilla.xlsx');
    expect(result.current.fileName).toBe('planilla.xlsx');
    expect(result.current.isImage).toBe(false);
  });

  it('handleAnalyze sin archivo no hace nada', async () => {
    const { result } = await renderHook(() => useLoanAnalyze());

    await act(async () => {
      await result.current.handleAnalyze();
    });

    expect(analyzeLoanDocument).not.toHaveBeenCalled();
    expect(result.current.phase).toBe('select');
  });

  const setFileViaCamera = async (result: { current: ReturnType<typeof useLoanAnalyze> }) => {
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

  it('handleAnalyze: camino feliz -- pasa a "review" con los items editables mapeados', async () => {
    (analyzeLoanDocument as jest.Mock).mockResolvedValue([makeExtractedItem()]);
    const { result } = await renderHook(() => useLoanAnalyze());
    await setFileViaCamera(result);

    await act(async () => {
      await result.current.handleAnalyze();
    });

    expect(result.current.phase).toBe('review');
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toMatchObject({
      selected: true,
      editedName: 'Juan Pérez',
      editedDni: '30111222',
      editedPrincipal: '100000',
      editedInterestRate: '24',
      editedTermValue: '6',
    });
  });

  it('handleAnalyze usa la moneda por defecto y la fecha de hoy cuando el item no las trae', async () => {
    (analyzeLoanDocument as jest.Mock).mockResolvedValue([
      makeExtractedItem({ currency: null, delivery_date: '' }),
    ]);
    (usePreferencesStore as unknown as jest.Mock).mockReturnValue({ defaultCurrency: 'USD' });
    const { result } = await renderHook(() => useLoanAnalyze());
    await setFileViaCamera(result);

    await act(async () => {
      await result.current.handleAnalyze();
    });

    expect(result.current.items[0].currency).toBe('USD');
    expect(result.current.items[0].delivery_date).toBe(new Date().toISOString().split('T')[0]);
  });

  it('handleAnalyze sin resultados muestra error y vuelve a "select"', async () => {
    (analyzeLoanDocument as jest.Mock).mockResolvedValue([]);
    const { result } = await renderHook(() => useLoanAnalyze());
    await setFileViaCamera(result);

    await act(async () => {
      await result.current.handleAnalyze();
    });

    expect(showError).toHaveBeenCalledWith('Sin resultados', expect.any(String));
    expect(result.current.phase).toBe('select');
  });

  it('handleAnalyze con excepción muestra el mensaje real y vuelve a "select"', async () => {
    (analyzeLoanDocument as jest.Mock).mockRejectedValue(new Error('Documento no soportado'));
    const { result } = await renderHook(() => useLoanAnalyze());
    await setFileViaCamera(result);

    await act(async () => {
      await result.current.handleAnalyze();
    });

    expect(showError).toHaveBeenCalledWith('Error al analizar', 'Documento no soportado');
    expect(result.current.phase).toBe('select');
  });

  const analyzeOneItem = async (result: { current: ReturnType<typeof useLoanAnalyze> }, overrides = {}) => {
    (analyzeLoanDocument as jest.Mock).mockResolvedValue([makeExtractedItem(overrides)]);
    await setFileViaCamera(result);
    await act(async () => {
      await result.current.handleAnalyze();
    });
  };

  it('handleToggle invierte la selección del item', async () => {
    const { result } = await renderHook(() => useLoanAnalyze());
    await analyzeOneItem(result);
    expect(result.current.items[0].selected).toBe(true);

    await act(() => {
      result.current.handleToggle(0);
    });

    expect(result.current.items[0].selected).toBe(false);
    expect(result.current.selectedCount).toBe(0);
  });

  it('handleEdit actualiza el campo editado del item', async () => {
    const { result } = await renderHook(() => useLoanAnalyze());
    await analyzeOneItem(result);

    await act(() => {
      result.current.handleEdit(0, 'editedName', 'Nombre corregido');
    });

    expect(result.current.items[0].editedName).toBe('Nombre corregido');
  });

  it('handleBackToSelect vuelve a "select" y vacía los items', async () => {
    const { result } = await renderHook(() => useLoanAnalyze());
    await analyzeOneItem(result);

    await act(() => {
      result.current.handleBackToSelect();
    });

    expect(result.current.phase).toBe('select');
    expect(result.current.items).toEqual([]);
  });

  it('handleCreateLoans sin items seleccionados no hace nada', async () => {
    const { result } = await renderHook(() => useLoanAnalyze());
    await analyzeOneItem(result);
    await act(() => {
      result.current.handleToggle(0); // deselecciona el único item
    });

    await act(async () => {
      await result.current.handleCreateLoans();
    });

    expect(createLoan).not.toHaveBeenCalled();
  });

  it('handleCreateLoans: camino feliz -- crea el préstamo, muestra éxito y redirige tras 1200ms', async () => {
    jest.useFakeTimers();
    const { result } = await renderHook(() => useLoanAnalyze());
    await analyzeOneItem(result);

    await act(async () => {
      await result.current.handleCreateLoans();
    });

    expect(getOrCreateBorrower).toHaveBeenCalledWith(
      expect.objectContaining({ lender_id: 'user-1', full_name: 'Juan Pérez' })
    );
    expect(createLoan).toHaveBeenCalledWith(
      expect.objectContaining({ borrower_id: 'borrower-1', principal_amount: 100000 })
    );
    expect(showSuccess).toHaveBeenCalledWith('Préstamos creados', expect.stringContaining('1 préstamo'));
    expect(router.replace).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1200);
    });
    expect(router.replace).toHaveBeenCalledWith('/(main)/loans');
    jest.useRealTimers();
  });

  it('handleCreateLoans salta los items con monto inválido y sigue con el resto', async () => {
    (analyzeLoanDocument as jest.Mock).mockResolvedValue([
      makeExtractedItem({ borrower_name: 'Sin Monto', principal_amount: 0 }),
      makeExtractedItem({ borrower_name: 'Con Monto', principal_amount: 5000 }),
    ]);
    const { result } = await renderHook(() => useLoanAnalyze());
    await setFileViaCamera(result);
    await act(async () => {
      await result.current.handleAnalyze();
    });
    await act(() => {
      result.current.handleEdit(0, 'editedPrincipal', '0');
    });

    await act(async () => {
      await result.current.handleCreateLoans();
    });

    expect(createLoan).toHaveBeenCalledTimes(1);
    expect(showSuccess).toHaveBeenCalledWith('Préstamos creados', expect.stringContaining('1 préstamo'));
  });

  it('handleCreateLoans muestra error genérico si ningún préstamo se pudo crear', async () => {
    (createLoan as jest.Mock).mockRejectedValue(new Error('boom'));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = await renderHook(() => useLoanAnalyze());
    await analyzeOneItem(result);

    await act(async () => {
      await result.current.handleCreateLoans();
    });

    expect(showError).toHaveBeenCalledWith('Error', 'No se pudo crear ningún préstamo');
    consoleError.mockRestore();
  });
});
