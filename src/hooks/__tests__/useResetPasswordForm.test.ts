import { act, renderHook } from '@testing-library/react-native';
import { router } from 'expo-router';
import { supabase } from '../../services/supabase/client';
import { updatePassword } from '../../services/supabase/auth';
import { useToast } from '../../components';
import { useResetPasswordForm } from '../useResetPasswordForm';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
}));

jest.mock('../../services/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));

jest.mock('../../services/supabase/auth', () => ({
  updatePassword: jest.fn(),
}));

jest.mock('../../components', () => ({
  useToast: jest.fn(),
}));

describe('useResetPasswordForm', () => {
  const showSuccess = jest.fn();
  const showError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (useToast as unknown as jest.Mock).mockReturnValue({ showSuccess, showError });
    (supabase.auth.signOut as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('valida la sesión al montar: si hay sesión, isValidSession queda en true', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: { id: 's1' } } });

    const { result } = await renderHook(() => useResetPasswordForm());
    await act(async () => {});

    expect(result.current.isValidating).toBe(false);
    expect(result.current.isValidSession).toBe(true);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('sin sesión, muestra error y redirige a forgot-password tras 2000ms', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null } });

    const { result } = await renderHook(() => useResetPasswordForm());
    await act(async () => {});

    expect(result.current.isValidSession).toBe(false);
    expect(showError).toHaveBeenCalledWith(
      'Sesión inválida',
      'No se pudo validar tu sesión. Solicita un nuevo código.'
    );
    expect(router.replace).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(router.replace).toHaveBeenCalledWith('/(auth)/forgot-password');
  });

  it('si falla la validación de la sesión, redirige a login tras 2000ms', async () => {
    (supabase.auth.getSession as jest.Mock).mockRejectedValue(new Error('network error'));

    await renderHook(() => useResetPasswordForm());
    await act(async () => {});

    expect(showError).toHaveBeenCalledWith('Error', 'No se pudo validar la sesión');

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(router.replace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('handleResetPassword exige contraseña, largo mínimo y coincidencia antes de llamar a updatePassword', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: { id: 's1' } } });
    const { result } = await renderHook(() => useResetPasswordForm());
    await act(async () => {});

    await act(async () => {
      await result.current.handleResetPassword();
    });
    expect(showError).toHaveBeenCalledWith('Error', 'Por favor ingresa una nueva contraseña');

    await act(() => {
      result.current.setNewPassword('abc');
    });
    await act(async () => {
      await result.current.handleResetPassword();
    });
    expect(showError).toHaveBeenCalledWith('Error', 'La contraseña debe tener al menos 6 caracteres');

    await act(() => {
      result.current.setNewPassword('secreto1');
      result.current.setConfirmPassword('otraCosa1');
    });
    await act(async () => {
      await result.current.handleResetPassword();
    });
    expect(showError).toHaveBeenCalledWith('Error', 'Las contraseñas no coinciden');

    expect(updatePassword).not.toHaveBeenCalled();
  });

  it('handleResetPassword: camino feliz -- actualiza, cierra sesión y redirige a login tras 2000ms', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: { id: 's1' } } });
    (updatePassword as jest.Mock).mockResolvedValue(undefined);
    const { result } = await renderHook(() => useResetPasswordForm());
    await act(async () => {});
    await act(() => {
      result.current.setNewPassword('secreto123');
      result.current.setConfirmPassword('secreto123');
    });

    await act(async () => {
      await result.current.handleResetPassword();
    });

    expect(updatePassword).toHaveBeenCalledWith('secreto123');
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
    expect(showSuccess).toHaveBeenCalledWith('Contraseña actualizada', expect.any(String));
    expect(router.replace).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(router.replace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('handleResetPassword muestra el error real si falla updatePassword', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: { id: 's1' } } });
    (updatePassword as jest.Mock).mockRejectedValue(new Error('Sesión expirada'));
    const { result } = await renderHook(() => useResetPasswordForm());
    await act(async () => {});
    await act(() => {
      result.current.setNewPassword('secreto123');
      result.current.setConfirmPassword('secreto123');
    });

    await act(async () => {
      await result.current.handleResetPassword();
    });

    expect(showError).toHaveBeenCalledWith('Error', 'Sesión expirada');
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });
});
