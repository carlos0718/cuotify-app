import { useAuthStore } from '../authStore';
import * as authService from '../../services/supabase/auth';

jest.mock('../../services/supabase/auth');

const mockGetSession = authService.getSession as jest.Mock;
const mockGetCurrentProfile = authService.getCurrentProfile as jest.Mock;
const mockOnAuthStateChange = authService.onAuthStateChange as jest.Mock;
const mockSignIn = authService.signIn as jest.Mock;
const mockSignUp = authService.signUp as jest.Mock;
const mockSignOut = authService.signOut as jest.Mock;
const mockDeleteAccount = authService.deleteAccount as jest.Mock;

const initialState = useAuthStore.getState();

beforeEach(() => {
  useAuthStore.setState(initialState, true);
  jest.clearAllMocks();
  mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
});

describe('initialize', () => {
  it('carga la sesión y el perfil si hay una sesión activa', async () => {
    const session = { user: { id: 'user-1' }, access_token: 't' };
    const profile = { id: 'user-1', role: 'lender' };
    mockGetSession.mockResolvedValue(session);
    mockGetCurrentProfile.mockResolvedValue(profile);

    await useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.session).toEqual(session);
    expect(state.user).toEqual(session.user);
    expect(state.profile).toEqual(profile);
    expect(state.isInitialized).toBe(true);
    expect(state.isLoading).toBe(false);
  });

  it('deja todo en null si no hay sesión', async () => {
    mockGetSession.mockResolvedValue(null);

    await useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.session).toBeNull();
    expect(state.user).toBeNull();
    expect(state.profile).toBeNull();
    expect(state.isInitialized).toBe(true);
    expect(mockGetCurrentProfile).not.toHaveBeenCalled();
  });

  it('guarda el error y marca isInitialized igual si falla la carga', async () => {
    mockGetSession.mockRejectedValue(new Error('Network down'));

    await useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.error).toBe('Network down');
    expect(state.isInitialized).toBe(true);
    expect(state.isLoading).toBe(false);
  });

  it('actualiza el estado cuando cambia la sesión (SIGNED_IN/SIGNED_OUT/TOKEN_REFRESHED)', async () => {
    mockGetSession.mockResolvedValue(null);
    await useAuthStore.getState().initialize();

    const callback = mockOnAuthStateChange.mock.calls[0][0];

    const newSession = { user: { id: 'user-2' }, access_token: 't2' };
    const newProfile = { id: 'user-2', role: 'borrower' };
    mockGetCurrentProfile.mockResolvedValue(newProfile);

    await callback('SIGNED_IN', newSession);
    expect(useAuthStore.getState().user).toEqual(newSession.user);
    expect(useAuthStore.getState().profile).toEqual(newProfile);

    await callback('TOKEN_REFRESHED', { ...newSession, access_token: 't3' });
    expect(useAuthStore.getState().session?.access_token).toBe('t3');
    // TOKEN_REFRESHED no debería tocar el perfil ya cargado
    expect(useAuthStore.getState().profile).toEqual(newProfile);

    await callback('SIGNED_OUT', null);
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().session).toBeNull();
    expect(useAuthStore.getState().profile).toBeNull();
  });
});

describe('signIn', () => {
  it('actualiza user/session/profile en el caso feliz', async () => {
    const user = { id: 'user-1' };
    const session = { user, access_token: 't' };
    mockSignIn.mockResolvedValue({ user, session });
    mockGetCurrentProfile.mockResolvedValue({ id: 'user-1', role: 'lender' });

    await useAuthStore.getState().signIn({ email: 'a@example.com', password: '123456' });

    const state = useAuthStore.getState();
    expect(state.user).toEqual(user);
    expect(state.session).toEqual(session);
    expect(state.isLoading).toBe(false);
  });

  it('guarda el error, corta isLoading y relanza la excepción', async () => {
    mockSignIn.mockRejectedValue(new Error('Credenciales inválidas'));

    await expect(
      useAuthStore.getState().signIn({ email: 'a@example.com', password: 'mala' })
    ).rejects.toThrow('Credenciales inválidas');

    const state = useAuthStore.getState();
    expect(state.error).toBe('Credenciales inválidas');
    expect(state.isLoading).toBe(false);
  });
});

describe('signUp', () => {
  it('carga el perfil si Supabase devuelve una sesión activa', async () => {
    const user = { id: 'user-1' };
    const session = { user, access_token: 't' };
    mockSignUp.mockResolvedValue({ user, session });
    mockGetCurrentProfile.mockResolvedValue({ id: 'user-1', role: 'lender' });

    await useAuthStore.getState().signUp({
      email: 'a@example.com',
      password: '123456',
      fullName: 'Ana',
      role: 'lender',
    });

    expect(useAuthStore.getState().profile).toEqual({ id: 'user-1', role: 'lender' });
  });

  it('no busca perfil si no hay sesión activa (confirmación de email pendiente)', async () => {
    mockSignUp.mockResolvedValue({ user: { id: 'user-1' }, session: null });

    await useAuthStore.getState().signUp({
      email: 'a@example.com',
      password: '123456',
      fullName: 'Ana',
      role: 'lender',
    });

    expect(mockGetCurrentProfile).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('guarda el error y relanza la excepción', async () => {
    mockSignUp.mockRejectedValue(new Error('Email ya registrado'));

    await expect(
      useAuthStore.getState().signUp({ email: 'a@example.com', password: '123456', fullName: 'Ana', role: 'lender' })
    ).rejects.toThrow('Email ya registrado');
    expect(useAuthStore.getState().error).toBe('Email ya registrado');
  });
});

describe('signOut', () => {
  it('limpia el estado en el caso feliz', async () => {
    useAuthStore.setState({ user: { id: 'user-1' } as never, session: {} as never, profile: {} as never });
    mockSignOut.mockResolvedValue(undefined);

    await useAuthStore.getState().signOut();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.session).toBeNull();
    expect(state.profile).toBeNull();
  });

  it('guarda el error y relanza la excepción sin limpiar el estado', async () => {
    useAuthStore.setState({ user: { id: 'user-1' } as never });
    mockSignOut.mockRejectedValue(new Error('boom'));

    await expect(useAuthStore.getState().signOut()).rejects.toThrow('boom');
    expect(useAuthStore.getState().error).toBe('boom');
    expect(useAuthStore.getState().user).toEqual({ id: 'user-1' });
  });
});

describe('deleteAccount', () => {
  it('limpia el estado en el caso feliz', async () => {
    useAuthStore.setState({ user: { id: 'user-1' } as never, session: {} as never, profile: {} as never });
    mockDeleteAccount.mockResolvedValue(undefined);

    await useAuthStore.getState().deleteAccount();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.session).toBeNull();
    expect(state.profile).toBeNull();
  });

  it('guarda el error y relanza la excepción', async () => {
    mockDeleteAccount.mockRejectedValue(new Error('boom'));
    await expect(useAuthStore.getState().deleteAccount()).rejects.toThrow('boom');
    expect(useAuthStore.getState().error).toBe('boom');
  });
});

describe('refreshProfile', () => {
  it('actualiza el perfil en el caso feliz', async () => {
    mockGetCurrentProfile.mockResolvedValue({ id: 'user-1', role: 'both' });
    await useAuthStore.getState().refreshProfile();
    expect(useAuthStore.getState().profile).toEqual({ id: 'user-1', role: 'both' });
  });

  it('no lanza ni guarda error si falla (solo loguea)', async () => {
    mockGetCurrentProfile.mockRejectedValue(new Error('boom'));
    await expect(useAuthStore.getState().refreshProfile()).resolves.toBeUndefined();
    expect(useAuthStore.getState().error).toBeNull();
  });
});

describe('clearError', () => {
  it('limpia el error', () => {
    useAuthStore.setState({ error: 'algo pasó' });
    useAuthStore.getState().clearError();
    expect(useAuthStore.getState().error).toBeNull();
  });
});

describe('getters computados', () => {
  it('isAuthenticated es true solo con user y session', () => {
    expect(useAuthStore.getState().isAuthenticated()).toBe(false);
    useAuthStore.setState({ user: { id: 'u1' } as never, session: {} as never });
    expect(useAuthStore.getState().isAuthenticated()).toBe(true);
  });

  it.each([
    ['lender', true, false],
    ['borrower', false, true],
    ['both', true, true],
    [null, false, false],
  ])('rol %s → isLender=%s, isBorrower=%s', (role, expectedLender, expectedBorrower) => {
    useAuthStore.setState({ profile: (role ? { role } : null) as never });
    expect(useAuthStore.getState().isLender()).toBe(expectedLender);
    expect(useAuthStore.getState().isBorrower()).toBe(expectedBorrower);
  });

  it('getRole devuelve el rol del perfil o null si no hay perfil', () => {
    expect(useAuthStore.getState().getRole()).toBeNull();
    useAuthStore.setState({ profile: { role: 'lender' } as never });
    expect(useAuthStore.getState().getRole()).toBe('lender');
  });
});
