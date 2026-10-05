import { act, renderHook } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../store';
import { useToast } from '../../components';
import { useRegisterForm } from '../useRegisterForm';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
}));

jest.mock('../../store', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('../../components', () => ({
  useToast: jest.fn(),
}));

describe('useRegisterForm', () => {
  const signUp = jest.fn();
  const clearError = jest.fn();
  const showSuccess = jest.fn();
  const showError = jest.fn();
  const showWarning = jest.fn();

  const fillValidForm = async (result: { current: ReturnType<typeof useRegisterForm> }) => {
    await act(() => {
      result.current.setFullName('Ana Pérez');
      result.current.setEmail('ana@cuotify.com');
      result.current.setDni('30111222');
      result.current.setPhone('91123456789');
      result.current.setPassword('secreto123');
      result.current.setConfirmPassword('secreto123');
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      signUp,
      isLoading: false,
      clearError,
    });
    (useToast as unknown as jest.Mock).mockReturnValue({ showSuccess, showError, showWarning });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('empieza con todos los campos vacíos', async () => {
    const { result } = await renderHook(() => useRegisterForm());

    expect(result.current.fullName).toBe('');
    expect(result.current.email).toBe('');
    expect(result.current.dni).toBe('');
    expect(result.current.phone).toBe('');
    expect(result.current.password).toBe('');
    expect(result.current.confirmPassword).toBe('');
  });

  it('muestra error y no llama a signUp si falta un campo obligatorio', async () => {
    const { result } = await renderHook(() => useRegisterForm());

    await act(() => {
      result.current.setFullName('Ana Pérez');
      result.current.setEmail('ana@cuotify.com');
      // sin password/confirmPassword
    });
    await act(async () => {
      await result.current.handleRegister();
    });

    expect(showError).toHaveBeenCalledWith('Error', 'Por favor completa todos los campos obligatorios');
    expect(signUp).not.toHaveBeenCalled();
  });

  it('rechaza un email inválido antes de llegar a signUp', async () => {
    const { result } = await renderHook(() => useRegisterForm());
    await fillValidForm(result);
    await act(() => {
      result.current.setEmail('no-es-email');
    });

    await act(async () => {
      await result.current.handleRegister();
    });

    expect(showError).toHaveBeenCalledWith('Correo inválido', expect.any(String));
    expect(signUp).not.toHaveBeenCalled();
  });

  it('rechaza un DNI inválido antes de llegar a signUp', async () => {
    const { result } = await renderHook(() => useRegisterForm());
    await fillValidForm(result);
    await act(() => {
      result.current.setDni('123'); // menos de 7 dígitos
    });

    await act(async () => {
      await result.current.handleRegister();
    });

    expect(showError).toHaveBeenCalledWith('DNI inválido', expect.any(String));
    expect(signUp).not.toHaveBeenCalled();
  });

  it('rechaza un teléfono inválido antes de llegar a signUp', async () => {
    const { result } = await renderHook(() => useRegisterForm());
    await fillValidForm(result);
    await act(() => {
      result.current.setPhone('123'); // menos de 8 dígitos
    });

    await act(async () => {
      await result.current.handleRegister();
    });

    expect(showError).toHaveBeenCalledWith('Teléfono inválido', expect.any(String));
    expect(signUp).not.toHaveBeenCalled();
  });

  it('rechaza si las contraseñas no coinciden', async () => {
    const { result } = await renderHook(() => useRegisterForm());
    await fillValidForm(result);
    await act(() => {
      result.current.setConfirmPassword('otraCosa123');
    });

    await act(async () => {
      await result.current.handleRegister();
    });

    expect(showError).toHaveBeenCalledWith('Error', 'Las contraseñas no coinciden');
    expect(signUp).not.toHaveBeenCalled();
  });

  it('rechaza una contraseña de menos de 6 caracteres', async () => {
    const { result } = await renderHook(() => useRegisterForm());
    await fillValidForm(result);
    await act(() => {
      result.current.setPassword('abc');
      result.current.setConfirmPassword('abc');
    });

    await act(async () => {
      await result.current.handleRegister();
    });

    expect(showError).toHaveBeenCalledWith('Error', 'La contraseña debe tener al menos 6 caracteres');
    expect(signUp).not.toHaveBeenCalled();
  });

  it('con datos válidos llama a signUp con role "both", muestra éxito y redirige a login tras 1500ms', async () => {
    signUp.mockResolvedValue(undefined);
    const { result } = await renderHook(() => useRegisterForm());
    await fillValidForm(result);

    await act(async () => {
      await result.current.handleRegister();
    });

    expect(signUp).toHaveBeenCalledWith({
      email: 'ana@cuotify.com',
      password: 'secreto123',
      fullName: 'Ana Pérez',
      dni: '30111222',
      phone: '91123456789',
      role: 'both',
    });
    expect(showSuccess).toHaveBeenCalledWith('Registro exitoso', 'Tu cuenta ha sido creada');
    expect(router.replace).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1500);
    });

    expect(router.replace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('dni y phone vacíos (opcionales) se envían como undefined, no como cadena vacía', async () => {
    signUp.mockResolvedValue(undefined);
    const { result } = await renderHook(() => useRegisterForm());

    await act(() => {
      result.current.setFullName('Ana Pérez');
      result.current.setEmail('ana@cuotify.com');
      result.current.setPassword('secreto123');
      result.current.setConfirmPassword('secreto123');
    });
    await act(async () => {
      await result.current.handleRegister();
    });

    expect(signUp).toHaveBeenCalledWith(
      expect.objectContaining({ dni: undefined, phone: undefined })
    );
  });

  it('si signUp falla, muestra el mensaje de error y limpia el error del store', async () => {
    signUp.mockRejectedValue(new Error('Ese correo ya está registrado'));
    const { result } = await renderHook(() => useRegisterForm());
    await fillValidForm(result);

    await act(async () => {
      await result.current.handleRegister();
    });

    expect(showError).toHaveBeenCalledWith('Error', 'Ese correo ya está registrado');
    expect(clearError).toHaveBeenCalledTimes(1);
    expect(showSuccess).not.toHaveBeenCalled();
  });
});
