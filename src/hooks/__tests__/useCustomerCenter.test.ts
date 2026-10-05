import { act, renderHook } from '@testing-library/react-native';
import { router } from 'expo-router';
import RevenueCatUI from 'react-native-purchases-ui';
import { useCustomerCenter } from '../useCustomerCenter';

jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
}));

jest.mock('react-native-purchases-ui', () => ({
  __esModule: true,
  default: { presentCustomerCenter: jest.fn() },
}));

describe('useCustomerCenter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('presenta el Customer Center al montar y vuelve atrás al cerrarse', async () => {
    (RevenueCatUI.presentCustomerCenter as jest.Mock).mockResolvedValue(undefined);

    await renderHook(() => useCustomerCenter());
    await act(async () => {});

    expect(RevenueCatUI.presentCustomerCenter).toHaveBeenCalledTimes(1);
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('vuelve atrás igual si presentCustomerCenter falla', async () => {
    (RevenueCatUI.presentCustomerCenter as jest.Mock).mockRejectedValue(new Error('boom'));

    await renderHook(() => useCustomerCenter());
    await act(async () => {});

    expect(router.back).toHaveBeenCalledTimes(1);
  });
});
