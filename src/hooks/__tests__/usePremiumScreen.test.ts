import { act, renderHook } from '@testing-library/react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import RevenueCatUI from 'react-native-purchases-ui';
import { isPremium } from '../../services/subscription';
import { useSubscriptionStore } from '../../store';
import { usePremiumScreen } from '../usePremiumScreen';

jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
}));

jest.mock('expo-constants', () => ({
  executionEnvironment: 'bare',
}));

jest.mock('react-native-purchases-ui', () => ({
  __esModule: true,
  default: { presentPaywallIfNeeded: jest.fn() },
  PAYWALL_RESULT: {
    NOT_PRESENTED: 'NOT_PRESENTED',
    ERROR: 'ERROR',
    CANCELLED: 'CANCELLED',
    PURCHASED: 'PURCHASED',
    RESTORED: 'RESTORED',
  },
}));

jest.mock('../../services/subscription', () => ({
  isPremium: jest.fn(),
}));

jest.mock('../../store', () => ({
  useSubscriptionStore: jest.fn(),
}));

describe('usePremiumScreen', () => {
  const setPremium = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useSubscriptionStore as unknown as jest.Mock).mockReturnValue({ setPremium });
    (Constants as unknown as { executionEnvironment: string }).executionEnvironment = 'bare';
  });

  it('en Expo Go (storeClient) no presenta el paywall nativo', async () => {
    (Constants as unknown as { executionEnvironment: string }).executionEnvironment = 'storeClient';

    const { result } = await renderHook(() => usePremiumScreen());
    await act(async () => {});

    expect(result.current.isExpoGo).toBe(true);
    expect(RevenueCatUI.presentPaywallIfNeeded).not.toHaveBeenCalled();
  });

  it('fuera de Expo Go, presenta el paywall nativo al montar', async () => {
    (RevenueCatUI.presentPaywallIfNeeded as jest.Mock).mockResolvedValue('NOT_PRESENTED');

    const { result } = await renderHook(() => usePremiumScreen());
    await act(async () => {});

    expect(result.current.isExpoGo).toBe(false);
    expect(RevenueCatUI.presentPaywallIfNeeded).toHaveBeenCalledWith({
      requiredEntitlementIdentifier: 'Cuotify Pro',
    });
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('con resultado PURCHASED, actualiza premium con isPremium() real y vuelve atrás', async () => {
    (RevenueCatUI.presentPaywallIfNeeded as jest.Mock).mockResolvedValue('PURCHASED');
    (isPremium as jest.Mock).mockResolvedValue(true);

    await renderHook(() => usePremiumScreen());
    await act(async () => {});

    expect(setPremium).toHaveBeenCalledWith(true);
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('con resultado RESTORED, también actualiza premium', async () => {
    (RevenueCatUI.presentPaywallIfNeeded as jest.Mock).mockResolvedValue('RESTORED');
    (isPremium as jest.Mock).mockResolvedValue(false);

    await renderHook(() => usePremiumScreen());
    await act(async () => {});

    expect(setPremium).toHaveBeenCalledWith(false);
  });

  it('con resultado CANCELLED (default), no actualiza premium pero vuelve atrás', async () => {
    (RevenueCatUI.presentPaywallIfNeeded as jest.Mock).mockResolvedValue('CANCELLED');

    await renderHook(() => usePremiumScreen());
    await act(async () => {});

    expect(setPremium).not.toHaveBeenCalled();
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('si presentPaywallIfNeeded tira una excepción, igual vuelve atrás', async () => {
    (RevenueCatUI.presentPaywallIfNeeded as jest.Mock).mockRejectedValue(new Error('boom'));

    await renderHook(() => usePremiumScreen());
    await act(async () => {});

    expect(router.back).toHaveBeenCalledTimes(1);
  });
});
