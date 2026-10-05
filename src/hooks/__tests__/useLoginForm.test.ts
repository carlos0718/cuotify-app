import { act, renderHook } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../store';
import { useToast } from '../../components';
import { useLoginForm } from '../useLoginForm';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
}));

jest.mock('../../store', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('../../components', () => ({
  useToast: jest.fn(),
}));

describe('useLoginForm', () => {
  const signIn = jest.fn();
  const clearError = jest.fn();
  const showError = jest.fn();
  const showWarning = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      signIn,
      isLoading: false,
      clearError,
    });
    (useToast as unknown as jest.Mock).mockReturnValue({ showError, showWarning });
  });

  it('empieza con email y password vacíos', async () => {
    const { result } = await renderHook(() => useLoginForm());

    expect(result.current.email).toBe('');
    expect(result.current.password).toBe('');
    expect(result.current.isLoading).toBe(false);
  });

  it('muestra error y no llama a signIn si falta el email o la contraseña', async () => {
    const { result } = await renderHook(() => useLoginForm());

    await act(() => {
      result.current.setPassword('secreto123');
    });
    await act(async () => {
      await result.current.handleLogin();
    });

    expect(showError).toHaveBeenCalledWith('Error', 'Por favor completa todos los campos');
    expect(signIn).not.toHaveBeenCalled();
  });

  it('muestra error de validación y no llama a signIn con un email inválido', async () => {
    const { result } = await renderHook(() => useLoginForm());

    await act(() => {
      result.current.setEmail('no-es-un-email');
      result.current.setPassword('secreto123');
    });
    await act(async () => {
      await result.current.handleLogin();
    });

    expect(showError).toHaveBeenCalledWith('Correo inválido', expect.any(String));
    expect(signIn).not.toHaveBeenCalled();
  });

  it('con datos válidos, llama a signIn (trimeando el email) y redirige al dashboard', async () => {
    signIn.mockResolvedValue(undefined);
    const { result } = await renderHook(() => useLoginForm());

    await act(() => {
      result.current.setEmail('  usuario@cuotify.com  ');
      result.current.setPassword('secreto123');
    });
    await act(async () => {
      await result.current.handleLogin();
    });

    expect(signIn).toHaveBeenCalledWith({ email: 'usuario@cuotify.com', password: 'secreto123' });
    expect(router.replace).toHaveBeenCalledWith('/(main)/dashboard');
  });

  it('si signIn falla, muestra el mensaje de error y limpia el error del store (sin redirigir)', async () => {
    signIn.mockRejectedValue(new Error('Credenciales inválidas'));
    const { result } = await renderHook(() => useLoginForm());

    await act(() => {
      result.current.setEmail('usuario@cuotify.com');
      result.current.setPassword('secreto123');
    });
    await act(async () => {
      await result.current.handleLogin();
    });

    expect(showError).toHaveBeenCalledWith('Error', 'Credenciales inválidas');
    expect(clearError).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('si signIn falla con algo que no es un Error, usa el mensaje genérico', async () => {
    signIn.mockRejectedValue('algo raro');
    const { result } = await renderHook(() => useLoginForm());

    await act(() => {
      result.current.setEmail('usuario@cuotify.com');
      result.current.setPassword('secreto123');
    });
    await act(async () => {
      await result.current.handleLogin();
    });

    expect(showError).toHaveBeenCalledWith('Error', 'No se pudo iniciar sesión');
  });
});
