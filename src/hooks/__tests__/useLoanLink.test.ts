import { act, renderHook } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useLoanLink } from '../useLoanLink';

jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
}));

describe('useLoanLink', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('empieza buscando por DNI, sin valor y sin buscar', async () => {
    const { result } = await renderHook(() => useLoanLink());

    expect(result.current.searchType).toBe('dni');
    expect(result.current.searchValue).toBe('');
    expect(result.current.isSearching).toBe(false);
  });

  it('handleSearch exige un valor de búsqueda, con el mensaje correcto según el tipo', async () => {
    const { result } = await renderHook(() => useLoanLink());

    await act(() => {
      result.current.handleSearch();
    });
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Ingresa el DNI del prestamista');

    await act(() => {
      result.current.setSearchType('email');
    });
    await act(() => {
      result.current.handleSearch();
    });
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Ingresa el email del prestamista');
  });

  it('handleSearch con un valor válido queda "buscando" y muestra el resultado tras 1500ms', async () => {
    const { result } = await renderHook(() => useLoanLink());
    await act(() => {
      result.current.setSearchValue('30111222');
    });

    await act(() => {
      result.current.handleSearch();
    });
    expect(result.current.isSearching).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(1500);
    });

    expect(result.current.isSearching).toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Préstamo encontrado',
      expect.stringContaining('Juan Pérez'),
      expect.anything()
    );
  });

  it('al confirmar "Vincular" en el resultado, avisa y vuelve atrás', async () => {
    const { result } = await renderHook(() => useLoanLink());
    await act(() => {
      result.current.setSearchValue('30111222');
    });
    await act(() => {
      result.current.handleSearch();
    });
    await act(async () => {
      jest.advanceTimersByTime(1500);
    });

    const [, , buttons] = (Alert.alert as jest.Mock).mock.calls.find(
      (call) => call[0] === 'Préstamo encontrado'
    )!;
    const vincularButton = buttons.find((b: { text: string }) => b.text === 'Vincular');

    await act(() => {
      vincularButton.onPress();
    });

    expect(Alert.alert).toHaveBeenCalledWith('Vinculado', 'El préstamo ha sido vinculado a tu cuenta');
    expect(router.back).toHaveBeenCalledTimes(1);
  });
});
