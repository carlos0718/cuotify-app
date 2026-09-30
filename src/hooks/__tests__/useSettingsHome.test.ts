import { act, renderHook } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore, usePreferencesStore, useSubscriptionStore } from '../../store';
import { useToast } from '../../components';
import { updateAllLoanColors } from '../../services/supabase';
import { useSettingsHome, SUPPORT_EMAIL } from '../useSettingsHome';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
}));

jest.mock('../../store', () => ({
  useAuthStore: jest.fn(),
  usePreferencesStore: jest.fn(),
  useSubscriptionStore: jest.fn(),
}));

jest.mock('../../components', () => ({
  useToast: jest.fn(),
}));

jest.mock('../../services/supabase', () => ({
  updateAllLoanColors: jest.fn(),
}));

describe('useSettingsHome', () => {
  const signOut = jest.fn();
  const setDefaultCurrency = jest.fn();
  const showSuccess = jest.fn();
  const showError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      profile: { full_name: 'Ana Pérez', email: 'ana@cuotify.com' },
      signOut,
    });
    (usePreferencesStore as unknown as jest.Mock).mockReturnValue({
      defaultCurrency: 'ARS',
      setDefaultCurrency,
    });
    (useSubscriptionStore as unknown as jest.Mock).mockReturnValue({ premium: false });
    (useToast as unknown as jest.Mock).mockReturnValue({ showSuccess, showError });
    jest.spyOn(Linking, 'openURL').mockImplementation(() => Promise.resolve());
  });

  it('todos los modales empiezan cerrados', async () => {
    const { result } = await renderHook(() => useSettingsHome());

    expect(result.current.showCurrencyModal).toBe(false);
    expect(result.current.showLogoutModal).toBe(false);
    expect(result.current.showContactModal).toBe(false);
    expect(result.current.showThanksModal).toBe(false);
  });

  it('handleUpdateLoanColors muestra éxito con la cantidad actualizada', async () => {
    (updateAllLoanColors as jest.Mock).mockResolvedValue(5);
    const { result } = await renderHook(() => useSettingsHome());

    await act(async () => {
      await result.current.handleUpdateLoanColors();
    });

    expect(showSuccess).toHaveBeenCalledWith('Colores actualizados', 'Se actualizaron 5 préstamos con nuevos colores');
    expect(result.current.isUpdatingColors).toBe(false);
  });

  it('handleUpdateLoanColors muestra error si falla', async () => {
    (updateAllLoanColors as jest.Mock).mockRejectedValue(new Error('boom'));
    const { result } = await renderHook(() => useSettingsHome());

    await act(async () => {
      await result.current.handleUpdateLoanColors();
    });

    expect(showError).toHaveBeenCalledWith('Error', 'No se pudieron actualizar los colores');
  });

  it('handleLogout cierra el modal, cierra sesión y redirige a login', async () => {
    signOut.mockResolvedValue(undefined);
    const { result } = await renderHook(() => useSettingsHome());
    await act(() => {
      result.current.setShowLogoutModal(true);
    });

    await act(async () => {
      await result.current.handleLogout();
    });

    expect(result.current.showLogoutModal).toBe(false);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('handleContactEmail cierra el modal de contacto y abre un mailto: con el email de soporte', async () => {
    const { result } = await renderHook(() => useSettingsHome());
    await act(() => {
      result.current.setShowContactModal(true);
    });

    await act(() => {
      result.current.handleContactEmail();
    });

    expect(result.current.showContactModal).toBe(false);
    expect(Linking.openURL).toHaveBeenCalledWith(expect.stringContaining(`mailto:${SUPPORT_EMAIL}`));
  });

  it('handleContactWhatsApp cierra el modal de contacto y abre wa.me', async () => {
    const { result } = await renderHook(() => useSettingsHome());

    await act(() => {
      result.current.handleContactWhatsApp();
    });

    expect(Linking.openURL).toHaveBeenCalledWith(expect.stringContaining('https://wa.me/'));
  });

  it('handleRateApp cierra el modal de calificar y abre el de "gracias"', async () => {
    const { result } = await renderHook(() => useSettingsHome());
    await act(() => {
      result.current.setShowRateModal(true);
    });

    await act(() => {
      result.current.handleRateApp();
    });

    expect(result.current.showRateModal).toBe(false);
    expect(result.current.showThanksModal).toBe(true);
  });

  it('handleSelectCurrency actualiza la moneda por defecto y cierra el modal', async () => {
    const { result } = await renderHook(() => useSettingsHome());
    await act(() => {
      result.current.setShowCurrencyModal(true);
    });

    await act(() => {
      result.current.handleSelectCurrency('USD');
    });

    expect(setDefaultCurrency).toHaveBeenCalledWith('USD');
    expect(result.current.showCurrencyModal).toBe(false);
  });
});
