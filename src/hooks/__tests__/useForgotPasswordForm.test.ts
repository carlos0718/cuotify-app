import { act, renderHook } from '@testing-library/react-native';
import { router } from 'expo-router';
import { resetPassword, verifyRecoveryOtp } from '../../services/supabase/auth';
import { useToast } from '../../components';
import { useForgotPasswordForm } from '../useForgotPasswordForm';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
}));

jest.mock('../../services/supabase/auth', () => ({
  resetPassword: jest.fn(),
  verifyRecoveryOtp: jest.fn(),
}));

jest.mock('../../components', () => ({
  useToast: jest.fn(),
}));

describe('useForgotPasswordForm', () => {
  const showSuccess = jest.fn();
  const showError = jest.fn();
  const showWarning = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useToast as unknown as jest.Mock).mockReturnValue({ showSuccess, showError, showWarning });
  });

  it('empieza en el paso 1, sin email ni código', async () => {
    const { result } = await renderHook(() => useForgotPasswordForm());

    expect(result.current.step).toBe(1);
    expect(result.current.email).toBe('');
    expect(result.current.code).toBe('');
  });

  it('handleSendCode muestra error si el email está vacío', async () => {
    const { result } = await renderHook(() => useForgotPasswordForm());

    await act(async () => {
      await result.current.handleSendCode();
    });

    expect(showError).toHaveBeenCalledWith('Error', 'Por favor ingresa tu correo electrónico');
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('handleSendCode rechaza un email inválido', async () => {
    const { result } = await renderHook(() => useForgotPasswordForm());
    await act(() => {
      result.current.setEmail('no-es-email');
    });

    await act(async () => {
      await result.current.handleSendCode();
    });

    expect(showError).toHaveBeenCalledWith('Correo inválido', expect.any(String));
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('handleSendCode con email válido llama a resetPassword y avanza al paso 2', async () => {
    (resetPassword as jest.Mock).mockResolvedValue(undefined);
    const { result } = await renderHook(() => useForgotPasswordForm());
    await act(() => {
      result.current.setEmail('  usuario@cuotify.com  ');
    });

    await act(async () => {
      await result.current.handleSendCode();
    });

    expect(resetPassword).toHaveBeenCalledWith('usuario@cuotify.com');
    expect(showSuccess).toHaveBeenCalledWith('Código enviado', expect.any(String));
    expect(result.current.step).toBe(2);
  });

  it('handleSendCode muestra el error si resetPassword falla', async () => {
    (resetPassword as jest.Mock).mockRejectedValue(new Error('rate limit'));
    const { result } = await renderHook(() => useForgotPasswordForm());
    await act(() => {
      result.current.setEmail('usuario@cuotify.com');
    });

    await act(async () => {
      await result.current.handleSendCode();
    });

    expect(showError).toHaveBeenCalledWith('Error', 'rate limit');
    expect(result.current.step).toBe(1);
  });

  it('handleVerifyCode exige un código de 8 dígitos', async () => {
    const { result } = await renderHook(() => useForgotPasswordForm());
    await act(() => {
      result.current.setCode('123');
    });

    await act(async () => {
      await result.current.handleVerifyCode();
    });

    expect(showError).toHaveBeenCalledWith('Error', 'Ingresa el código de 8 dígitos');
    expect(verifyRecoveryOtp).not.toHaveBeenCalled();
  });

  it('handleVerifyCode con código válido llama a verifyRecoveryOtp y redirige a reset-password', async () => {
    (verifyRecoveryOtp as jest.Mock).mockResolvedValue(undefined);
    const { result } = await renderHook(() => useForgotPasswordForm());
    await act(() => {
      result.current.setEmail('usuario@cuotify.com');
      result.current.setCode('12345678');
    });

    await act(async () => {
      await result.current.handleVerifyCode();
    });

    expect(verifyRecoveryOtp).toHaveBeenCalledWith('usuario@cuotify.com', '12345678');
    expect(router.replace).toHaveBeenCalledWith('/(auth)/reset-password');
  });

  it('handleVerifyCode muestra "Código inválido" si verifyRecoveryOtp falla', async () => {
    (verifyRecoveryOtp as jest.Mock).mockRejectedValue(new Error('expired'));
    const { result } = await renderHook(() => useForgotPasswordForm());
    await act(() => {
      result.current.setCode('12345678');
    });

    await act(async () => {
      await result.current.handleVerifyCode();
    });

    expect(showError).toHaveBeenCalledWith('Código inválido', 'expired');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('handleResendCode reenvía el código al mismo email', async () => {
    (resetPassword as jest.Mock).mockResolvedValue(undefined);
    const { result } = await renderHook(() => useForgotPasswordForm());
    await act(() => {
      result.current.setEmail('usuario@cuotify.com');
    });

    await act(async () => {
      await result.current.handleResendCode();
    });

    expect(resetPassword).toHaveBeenCalledWith('usuario@cuotify.com');
    expect(showSuccess).toHaveBeenCalledWith('Código reenviado', expect.any(String));
  });

  it('handleChangeEmail limpia el código y vuelve al paso 1', async () => {
    (resetPassword as jest.Mock).mockResolvedValue(undefined);
    const { result } = await renderHook(() => useForgotPasswordForm());
    await act(() => {
      result.current.setEmail('usuario@cuotify.com');
    });
    await act(async () => {
      await result.current.handleSendCode();
    });
    await act(() => {
      result.current.setCode('12345678');
    });
    expect(result.current.step).toBe(2);

    await act(() => {
      result.current.handleChangeEmail();
    });

    expect(result.current.step).toBe(1);
    expect(result.current.code).toBe('');
  });
});
