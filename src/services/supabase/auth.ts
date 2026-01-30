import { supabase, handleSupabaseError } from './client';
import { UserRole } from '../../types';

export interface SignUpData {
  email: string;
  password: string;
  fullName: string;
  dni?: string;
  phone?: string;
  role: UserRole;
}

export interface SignInData {
  email: string;
  password: string;
}

// Registrar nuevo usuario
export async function signUp(data: SignUpData) {
  try {
    // Crear usuario en Supabase Auth con metadatos
    // El trigger handle_new_user() creará el perfil automáticamente
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.fullName,
          role: data.role,
          dni: data.dni || null,
          phone: data.phone || null,
        },
      },
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('No se pudo crear el usuario');

    return { user: authData.user, session: authData.session };
  } catch (error) {
    throw new Error(handleSupabaseError(error));
  }
}

// Iniciar sesión
export async function signIn(data: SignInData) {
  try {
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) throw error;

    return { user: authData.user, session: authData.session };
  } catch (error) {
    throw new Error(handleSupabaseError(error));
  }
}

// Cerrar sesión
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error) {
    throw new Error(handleSupabaseError(error));
  }
}

// Obtener sesión actual
export async function getSession() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  } catch (error) {
    throw new Error(handleSupabaseError(error));
  }
}

// Obtener usuario actual
export async function getCurrentUser() {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user;
  } catch (error) {
    throw new Error(handleSupabaseError(error));
  }
}

// Obtener perfil del usuario actual
export async function getCurrentProfile() {
  try {
    const user = await getCurrentUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw new Error(handleSupabaseError(error));
  }
}

// Recuperar contraseña
export async function resetPassword(email: string) {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'cuotify://reset-password',
    });
    if (error) throw error;
  } catch (error) {
    throw new Error(handleSupabaseError(error));
  }
}

// Actualizar contraseña
export async function updatePassword(newPassword: string) {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
  } catch (error) {
    throw new Error(handleSupabaseError(error));
  }
}

// Escuchar cambios en la sesión
export function onAuthStateChange(
  callback: (event: string, session: unknown) => void
) {
  return supabase.auth.onAuthStateChange(callback);
}
