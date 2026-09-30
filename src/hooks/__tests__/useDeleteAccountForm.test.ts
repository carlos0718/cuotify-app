import { act, renderHook } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useAuthStore, useSubscriptionStore } from '../../store';
import { useToast } from '../../components';
import { useDeleteAccountForm } from '../useDeleteAccountForm';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
}));

jest.mock('../../store', () => ({
  useAuthStore: jest.fn(),
  useSubscriptionStore: jest.fn(),
}));

jest.mock('../../components', () => ({
  useToast: jest.fn(),
}));

describe('useDeleteAccountForm', () => {
  const signIn = jest.fn();
  const deleteAccount = jest.fn();
  const showError = jest.fn();
  const showSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      profile: { email: 'usuario@cuotify.com' },
      signIn,
      deleteAccount,
    });
    (useSubscriptionStore as unknown as jest.Mock).mockReturnValue({ premium: false });
    (useToast as unknown as jest.Mock).mockReturnValue({ showError, showSuccess });
  });

  it('handleRequestDelete exige la contraseña', async () => {
    const { result } = await renderHook(() => useDeleteAccountForm());

    await act(async () => {
      await result.current.handleRequestDelete();
    });

    expect(showError).toHaveBeenCalledWith('Falta la contraseña', 'Ingresá tu contraseña para continuar');
    expect(signIn).not.toHaveBeenCalled();
  });

  it('handleRequestDelete reautentica con el email del perfil y abre el modal de confirmación', async () => {
    signIn.mockResolvedValue(undefined);
    const { result } = await renderHook(() => useDeleteAccountForm());
    await act(() => {
      result.current.setPassword('secreto123');
    });

    await act(async () => {
      await result.current.handleRequestDelete();
    });

    expect(signIn).toHaveBeenCalledWith({ email: 'usuario@cuotify.com', password: 'secreto123' });
    expect(result.current.showConfirmModal).toBe(true);
  });

  it('handleRequestDelete traduce "Invalid login credentials" a un mensaje en español', async () => {
    signIn.mockRejectedValue(new Error('Invalid login credentials'));
    const { result } = await renderHook(() => useDeleteAccountForm());
    await act(() => {
      result.current.setPassword('mal');
    });

    await act(async () => {
      await result.current.handleRequestDelete();
    });

    expect(showError).toHaveBeenCalledWith('No se pudo verificar', 'La contraseña no es correcta');
    expect(result.current.showConfirmModal).toBe(false);
  });

  it('handleRequestDelete muestra el mensaje real para otros errores de signIn', async () => {
    signIn.mockRejectedValue(new Error('Too many requests'));
    const { result } = await renderHook(() => useDeleteAccountForm());
    await act(() => {
      result.current.setPassword('secreto123');
    });

    await act(async () => {
      await result.current.handleRequestDelete();
    });

    expect(showError).toHaveBeenCalledWith('No se pudo verificar', 'Too many requests');
  });

  it('handleConfirmDelete elimina la cuenta, muestra éxito y redirige a login', async () => {
    deleteAccount.mockResolvedValue(undefined);
    const { result } = await renderHook(() => useDeleteAccountForm());
    await act(() => {
      result.current.setShowConfirmModal(true);
    });

    await act(async () => {
      await result.current.handleConfirmDelete();
    });

    expect(deleteAccount).toHaveBeenCalledTimes(1);
    expect(showSuccess).toHaveBeenCalledWith('Cuenta eliminada', expect.any(String));
    expect(router.replace).toHaveBeenCalledWith('/(auth)/login');
    expect(result.current.showConfirmModal).toBe(false);
  });

  it('handleConfirmDelete muestra el error real si falla y deja isDeleting en false para reintentar', async () => {
    deleteAccount.mockRejectedValue(new Error('No se pudo conectar'));
    const { result } = await renderHook(() => useDeleteAccountForm());

    await act(async () => {
      await result.current.handleConfirmDelete();
    });

    expect(showError).toHaveBeenCalledWith('Error', 'No se pudo conectar');
    expect(result.current.isDeleting).toBe(false);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('isBusy es true mientras isVerifying o isDeleting están activos', async () => {
    signIn.mockImplementation(() => new Promise(() => {})); // nunca resuelve
    const { result } = await renderHook(() => useDeleteAccountForm());
    await act(() => {
      result.current.setPassword('secreto123');
    });

    await act(() => {
      result.current.handleRequestDelete();
    });

    expect(result.current.isBusy).toBe(true);
  });
});
