import { http, HttpResponse } from 'msw';
import { server } from '../../../test/msw/server';
import { supabase } from '../client';
import {
  signUp,
  signIn,
  signOut,
  getSession,
  getCurrentUser,
  getCurrentProfile,
  resetPassword,
  verifyRecoveryOtp,
  updatePassword,
  deleteAccount,
  onAuthStateChange,
} from '../auth';

const SUPABASE_URL = 'https://test.supabase.co';

function spy(method: string): jest.SpyInstance {
  return jest.spyOn(supabase.auth as any, method);
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('signUp', () => {
  it('devuelve el usuario y la sesión creados', async () => {
    const user = { id: 'user-1' };
    const session = { access_token: 'token' };
    spy('signUp').mockResolvedValue({ data: { user, session }, error: null } as never);

    const result = await signUp({
      email: 'a@example.com',
      password: '123456',
      fullName: 'Ana',
      role: 'lender',
    });

    expect(result).toEqual({ user, session });
  });

  it('propaga el error de Supabase Auth (ej. email ya registrado)', async () => {
    spy('signUp').mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Email ya registrado' },
    } as never);

    await expect(
      signUp({ email: 'a@example.com', password: '123456', fullName: 'Ana', role: 'lender' })
    ).rejects.toThrow('Email ya registrado');
  });

  it('lanza error si Supabase no devuelve error pero tampoco usuario', async () => {
    spy('signUp').mockResolvedValue({ data: { user: null, session: null }, error: null } as never);

    await expect(
      signUp({ email: 'a@example.com', password: '123456', fullName: 'Ana', role: 'lender' })
    ).rejects.toThrow('No se pudo crear el usuario');
  });
});

describe('signIn', () => {
  it('devuelve el usuario y la sesión al iniciar sesión', async () => {
    const user = { id: 'user-1' };
    const session = { access_token: 'token' };
    spy('signInWithPassword').mockResolvedValue({ data: { user, session }, error: null } as never);

    expect(await signIn({ email: 'a@example.com', password: '123456' })).toEqual({ user, session });
  });

  it('propaga el error de credenciales inválidas', async () => {
    spy('signInWithPassword').mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Credenciales inválidas' },
    } as never);

    await expect(signIn({ email: 'a@example.com', password: 'mala' })).rejects.toThrow('Credenciales inválidas');
  });
});

describe('signOut', () => {
  it('resuelve sin error en el caso feliz', async () => {
    spy('signOut').mockResolvedValue({ error: null } as never);
    await expect(signOut()).resolves.toBeUndefined();
  });

  it('propaga el error si falla el signOut', async () => {
    spy('signOut').mockResolvedValue({ error: { message: 'Network error' } } as never);
    await expect(signOut()).rejects.toThrow('Network error');
  });
});

describe('getSession', () => {
  it('devuelve la sesión actual', async () => {
    const session = { access_token: 'token' };
    spy('getSession').mockResolvedValue({ data: { session }, error: null } as never);
    expect(await getSession()).toEqual(session);
  });

  it('propaga el error si falla la consulta de sesión', async () => {
    spy('getSession').mockResolvedValue({ data: { session: null }, error: { message: 'boom' } } as never);
    await expect(getSession()).rejects.toThrow('boom');
  });
});

describe('getCurrentUser', () => {
  it('devuelve el usuario actual', async () => {
    const user = { id: 'user-1' };
    spy('getUser').mockResolvedValue({ data: { user }, error: null } as never);
    expect(await getCurrentUser()).toEqual(user);
  });

  it('propaga el error si falla la consulta del usuario', async () => {
    spy('getUser').mockResolvedValue({ data: { user: null }, error: { message: 'boom' } } as never);
    await expect(getCurrentUser()).rejects.toThrow('boom');
  });
});

describe('getCurrentProfile', () => {
  it('devuelve null sin hacer ninguna request si no hay usuario', async () => {
    spy('getUser').mockResolvedValue({ data: { user: null }, error: null } as never);
    expect(await getCurrentProfile()).toBeNull();
  });

  it('devuelve el perfil del usuario actual', async () => {
    spy('getUser').mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null } as never);
    const profile = { id: 'user-1', full_name: 'Ana', role: 'lender' };
    server.use(http.get(`${SUPABASE_URL}/rest/v1/profiles`, () => HttpResponse.json(profile)));

    expect(await getCurrentProfile()).toEqual(profile);
  });

  it('propaga el error si falla la consulta del perfil', async () => {
    spy('getUser').mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null } as never);
    server.use(
      http.get(`${SUPABASE_URL}/rest/v1/profiles`, () =>
        HttpResponse.json({ message: 'No se encontró el perfil' }, { status: 406 })
      )
    );

    await expect(getCurrentProfile()).rejects.toThrow();
  });
});

describe('resetPassword', () => {
  it('resuelve sin error en el caso feliz', async () => {
    spy('resetPasswordForEmail').mockResolvedValue({ data: {}, error: null } as never);
    await expect(resetPassword('a@example.com')).resolves.toBeUndefined();
  });

  it('propaga el error de Supabase', async () => {
    spy('resetPasswordForEmail').mockResolvedValue({ data: {}, error: { message: 'boom' } } as never);
    await expect(resetPassword('a@example.com')).rejects.toThrow('boom');
  });
});

describe('verifyRecoveryOtp', () => {
  it('resuelve sin error si el código es válido', async () => {
    spy('verifyOtp').mockResolvedValue({ data: {}, error: null } as never);
    await expect(verifyRecoveryOtp('a@example.com', '123456')).resolves.toBeUndefined();
  });

  it('propaga el error si el código es inválido', async () => {
    spy('verifyOtp').mockResolvedValue({ data: {}, error: { message: 'Código inválido' } } as never);
    await expect(verifyRecoveryOtp('a@example.com', '000000')).rejects.toThrow('Código inválido');
  });
});

describe('updatePassword', () => {
  it('resuelve sin error en el caso feliz', async () => {
    spy('updateUser').mockResolvedValue({ data: {}, error: null } as never);
    await expect(updatePassword('nueva123')).resolves.toBeUndefined();
  });

  it('propaga el error de Supabase', async () => {
    spy('updateUser').mockResolvedValue({ data: {}, error: { message: 'boom' } } as never);
    await expect(updatePassword('nueva123')).rejects.toThrow('boom');
  });
});

describe('deleteAccount', () => {
  // `supabase.functions` es un getter que crea un FunctionsClient nuevo en cada
  // acceso (ver @supabase/supabase-js SupabaseClient.ts) — no se puede mockear
  // `.invoke` sobre una instancia ya obtenida, hay que mockear el getter mismo.
  function mockInvoke(response: unknown) {
    return jest.spyOn(supabase, 'functions', 'get').mockReturnValue({
      invoke: jest.fn().mockResolvedValue(response),
    } as never);
  }

  it('resuelve sin error en el caso feliz', async () => {
    mockInvoke({ data: { success: true }, error: null });
    await expect(deleteAccount()).resolves.toBeUndefined();
  });

  it('propaga el error si falla la invocación de la Edge Function', async () => {
    mockInvoke({ data: null, error: { message: 'Edge Function no disponible' } });
    await expect(deleteAccount()).rejects.toThrow('Edge Function no disponible');
  });

  it('propaga el error si la Edge Function respondió 200 pero con un error en el body', async () => {
    mockInvoke({ data: { error: 'No se pudo borrar el storage' }, error: null });
    await expect(deleteAccount()).rejects.toThrow('No se pudo borrar el storage');
  });
});

describe('onAuthStateChange', () => {
  it('delega en supabase.auth.onAuthStateChange y devuelve la suscripción', () => {
    const fakeSubscription = { data: { subscription: { unsubscribe: jest.fn() } } };
    const onAuthStateChangeSpy = spy('onAuthStateChange').mockReturnValue(fakeSubscription as never);
    const callback = jest.fn();

    const result = onAuthStateChange(callback);

    expect(onAuthStateChangeSpy).toHaveBeenCalledWith(callback);
    expect(result).toBe(fakeSubscription);
  });
});
