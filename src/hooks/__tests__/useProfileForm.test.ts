import { act, renderHook } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../store';
import { supabase } from '../../services/supabase';
import { useProfileForm } from '../useProfileForm';

jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
}));

jest.mock('../../store', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('../../services/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

function mockUpdateResult(result: { error: unknown }) {
  const eq = jest.fn().mockResolvedValue(result);
  const update = jest.fn().mockReturnValue({ eq });
  (supabase.from as jest.Mock).mockReturnValue({ update });
  return { update, eq };
}

describe('useProfileForm', () => {
  const refreshProfile = jest.fn();
  const baseProfile = { id: 'user-1', full_name: 'Ana Pérez', phone: '54911223344', dni: '30111222', email: 'ana@cuotify.com' };

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuthStore as unknown as jest.Mock).mockReturnValue({ profile: baseProfile, refreshProfile });
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('inicializa los campos con los datos del perfil', async () => {
    const { result } = await renderHook(() => useProfileForm());

    expect(result.current.fullName).toBe('Ana Pérez');
    expect(result.current.phone).toBe('54911223344');
    expect(result.current.dni).toBe('30111222');
  });

  it('inicializa los campos vacíos si el perfil no tiene esos datos', async () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      profile: { id: 'user-1', full_name: '', phone: null, dni: null, email: 'a@a.com' },
      refreshProfile,
    });

    const { result } = await renderHook(() => useProfileForm());

    expect(result.current.fullName).toBe('');
    expect(result.current.phone).toBe('');
    expect(result.current.dni).toBe('');
  });

  it('handleSave no guarda si el nombre está vacío', async () => {
    const { result } = await renderHook(() => useProfileForm());
    await act(() => {
      result.current.setFullName('   ');
    });

    await act(async () => {
      await result.current.handleSave();
    });

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'El nombre es obligatorio');
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('handleSave: camino feliz -- actualiza el perfil, refresca y vuelve atrás', async () => {
    const { update, eq } = mockUpdateResult({ error: null });
    const { result } = await renderHook(() => useProfileForm());
    await act(() => {
      result.current.setFullName('  Ana Pérez  ');
      result.current.setPhone('  54911223344  ');
      result.current.setDni('');
    });

    await act(async () => {
      await result.current.handleSave();
    });

    expect(supabase.from).toHaveBeenCalledWith('profiles');
    expect(update).toHaveBeenCalledWith({
      full_name: 'Ana Pérez',
      phone: '54911223344',
      dni: null,
    });
    expect(eq).toHaveBeenCalledWith('id', 'user-1');
    expect(refreshProfile).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith('Guardado', 'Tu perfil ha sido actualizado');
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(false);
  });

  it('handleSave muestra un error genérico si falla la actualización', async () => {
    mockUpdateResult({ error: { message: 'constraint violation' } });
    const { result } = await renderHook(() => useProfileForm());

    await act(async () => {
      await result.current.handleSave();
    });

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'No se pudo actualizar el perfil');
    expect(refreshProfile).not.toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });
});
