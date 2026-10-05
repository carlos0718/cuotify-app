import { act, renderHook } from '@testing-library/react-native';
import { Alert, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { getAvailablePackages, purchasePackage, restorePurchases } from '../../services/subscription';
import { useSubscriptionStore } from '../../store';
import { useToast } from '../../components';
import { useCustomPaywall } from '../useCustomPaywall';

jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
}));

jest.mock('../../services/subscription', () => ({
  getAvailablePackages: jest.fn(),
  purchasePackage: jest.fn(),
  restorePurchases: jest.fn(),
}));

jest.mock('../../store', () => ({
  useSubscriptionStore: jest.fn(),
}));

jest.mock('../../components', () => ({
  useToast: jest.fn(),
}));

const makePackage = (identifier: string, packageType: string) => ({
  identifier,
  packageType,
  product: { priceString: '$1000', introPrice: null },
}) as never;

describe('useCustomPaywall', () => {
  const setPremium = jest.fn();
  const showSuccess = jest.fn();
  const showError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useSubscriptionStore as unknown as jest.Mock).mockReturnValue({ setPremium });
    (useToast as unknown as jest.Mock).mockReturnValue({ showSuccess, showError });
    (getAvailablePackages as jest.Mock).mockResolvedValue([]);
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('carga los paquetes disponibles al montar y preselecciona el anual', async () => {
    const annual = makePackage('annual', 'ANNUAL');
    const monthly = makePackage('monthly', 'MONTHLY');
    (getAvailablePackages as jest.Mock).mockResolvedValue([monthly, annual]);

    const { result } = await renderHook(() => useCustomPaywall());
    await act(async () => {});

    expect(result.current.isLoading).toBe(false);
    expect(result.current.selected).toEqual(annual);
    expect(result.current.annualPkg).toEqual(annual);
    expect(result.current.monthlyPkg).toEqual(monthly);
  });

  it('si no hay paquete anual, preselecciona el primero disponible', async () => {
    const monthly = makePackage('monthly', 'MONTHLY');
    (getAvailablePackages as jest.Mock).mockResolvedValue([monthly]);

    const { result } = await renderHook(() => useCustomPaywall());
    await act(async () => {});

    expect(result.current.selected).toEqual(monthly);
    expect(result.current.annualPkg).toBeNull();
  });

  it('handlePurchase no hace nada sin un paquete seleccionado', async () => {
    const { result } = await renderHook(() => useCustomPaywall());
    await act(async () => {});

    await act(async () => {
      await result.current.handlePurchase();
    });

    expect(purchasePackage).not.toHaveBeenCalled();
  });

  it('handlePurchase: camino feliz -- marca premium, avisa y vuelve atrás', async () => {
    const annual = makePackage('annual', 'ANNUAL');
    (getAvailablePackages as jest.Mock).mockResolvedValue([annual]);
    (purchasePackage as jest.Mock).mockResolvedValue({ success: true });
    const { result } = await renderHook(() => useCustomPaywall());
    await act(async () => {});

    await act(async () => {
      await result.current.handlePurchase();
    });

    expect(purchasePackage).toHaveBeenCalledWith(annual);
    expect(setPremium).toHaveBeenCalledWith(true);
    expect(showSuccess).toHaveBeenCalledWith('¡Bienvenido a Cuotify Pro!', expect.any(String));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('handlePurchase cancelado por el usuario no muestra error ni marca premium', async () => {
    const annual = makePackage('annual', 'ANNUAL');
    (getAvailablePackages as jest.Mock).mockResolvedValue([annual]);
    (purchasePackage as jest.Mock).mockResolvedValue({ success: false, userCancelled: true });
    const { result } = await renderHook(() => useCustomPaywall());
    await act(async () => {});

    await act(async () => {
      await result.current.handlePurchase();
    });

    expect(setPremium).not.toHaveBeenCalled();
    expect(showError).not.toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
  });

  it('handlePurchase con error real (no cancelado) muestra el mensaje', async () => {
    const annual = makePackage('annual', 'ANNUAL');
    (getAvailablePackages as jest.Mock).mockResolvedValue([annual]);
    (purchasePackage as jest.Mock).mockResolvedValue({ success: false, userCancelled: false, error: 'Tarjeta rechazada' });
    const { result } = await renderHook(() => useCustomPaywall());
    await act(async () => {});

    await act(async () => {
      await result.current.handlePurchase();
    });

    expect(showError).toHaveBeenCalledWith('Error', 'Tarjeta rechazada');
  });

  it('handlePurchase muestra un error genérico si purchasePackage tira una excepción', async () => {
    const annual = makePackage('annual', 'ANNUAL');
    (getAvailablePackages as jest.Mock).mockResolvedValue([annual]);
    (purchasePackage as jest.Mock).mockRejectedValue(new Error('boom'));
    const { result } = await renderHook(() => useCustomPaywall());
    await act(async () => {});

    await act(async () => {
      await result.current.handlePurchase();
    });

    expect(showError).toHaveBeenCalledWith('Error', 'No se pudo completar la compra.');
    expect(result.current.isPurchasing).toBe(false);
  });

  it('handleRestore: camino feliz -- marca premium, avisa y vuelve atrás', async () => {
    (restorePurchases as jest.Mock).mockResolvedValue({ success: true });
    const { result } = await renderHook(() => useCustomPaywall());
    await act(async () => {});

    await act(async () => {
      await result.current.handleRestore();
    });

    expect(setPremium).toHaveBeenCalledWith(true);
    expect(showSuccess).toHaveBeenCalledWith('Compra restaurada', expect.any(String));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('handleRestore sin compras previas muestra un Alert nativo (no el toast)', async () => {
    (restorePurchases as jest.Mock).mockResolvedValue({ success: false });
    const { result } = await renderHook(() => useCustomPaywall());
    await act(async () => {});

    await act(async () => {
      await result.current.handleRestore();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Sin compras previas',
      'No encontramos una compra anterior para restaurar.'
    );
    expect(showError).not.toHaveBeenCalled();
    expect(setPremium).not.toHaveBeenCalled();
  });

  it('handleRestore muestra el toast de error si restorePurchases tira una excepción', async () => {
    (restorePurchases as jest.Mock).mockRejectedValue(new Error('boom'));
    const { result } = await renderHook(() => useCustomPaywall());
    await act(async () => {});

    await act(async () => {
      await result.current.handleRestore();
    });

    expect(showError).toHaveBeenCalledWith('Error', 'No se pudo restaurar la compra.');
    expect(result.current.isRestoring).toBe(false);
  });

  it('handleScroll calcula el slide actual a partir del contentOffset', async () => {
    const { result } = await renderHook(() => useCustomPaywall());
    await act(async () => {});
    const screenWidth = Dimensions.get('window').width;

    await act(() => {
      result.current.handleScroll({ nativeEvent: { contentOffset: { x: screenWidth * 2 } } });
    });

    expect(result.current.currentSlide).toBe(2);
  });
});
