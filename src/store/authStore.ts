import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { Profile, UserRole } from '../types';
import {
  signIn as authSignIn,
  signUp as authSignUp,
  signOut as authSignOut,
  getSession,
  getCurrentProfile,
  onAuthStateChange,
  SignUpData,
  SignInData,
} from '../services/supabase/auth';

interface AuthState {
  // Estado
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Acciones
  initialize: () => Promise<void>;
  signIn: (data: SignInData) => Promise<void>;
  signUp: (data: SignUpData) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearError: () => void;

  // Getters computados
  isAuthenticated: () => boolean;
  isLender: () => boolean;
  isBorrower: () => boolean;
  getRole: () => UserRole | null;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  // Estado inicial
  user: null,
  session: null,
  profile: null,
  isLoading: false,
  isInitialized: false,
  error: null,

  // Inicializar la sesión al arrancar la app
  initialize: async () => {
    try {
      set({ isLoading: true, error: null });

      const session = await getSession();

      if (session) {
        const profile = await getCurrentProfile();
        set({
          user: session.user,
          session,
          profile,
          isInitialized: true,
          isLoading: false,
        });
      } else {
        set({
          user: null,
          session: null,
          profile: null,
          isInitialized: true,
          isLoading: false,
        });
      }

      // Escuchar cambios en la sesión
      onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          const profile = await getCurrentProfile();
          set({
            user: session.user,
            session: session as Session,
            profile,
          });
        } else if (event === 'SIGNED_OUT') {
          set({
            user: null,
            session: null,
            profile: null,
          });
        } else if (event === 'TOKEN_REFRESHED' && session) {
          set({ session: session as Session });
        }
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Error al inicializar',
        isInitialized: true,
        isLoading: false,
      });
    }
  },

  // Iniciar sesión
  signIn: async (data: SignInData) => {
    try {
      set({ isLoading: true, error: null });

      const { user, session } = await authSignIn(data);
      const profile = await getCurrentProfile();

      set({
        user,
        session,
        profile,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Error al iniciar sesión',
        isLoading: false,
      });
      throw error;
    }
  },

  // Registrarse
  signUp: async (data: SignUpData) => {
    try {
      set({ isLoading: true, error: null });

      const { user, session } = await authSignUp(data);

      // El perfil se crea en signUp, pero puede que la sesión no esté activa
      // dependiendo de la configuración de Supabase (confirmación por email)
      if (session) {
        const profile = await getCurrentProfile();
        set({
          user,
          session,
          profile,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Error al registrarse',
        isLoading: false,
      });
      throw error;
    }
  },

  // Cerrar sesión
  signOut: async () => {
    try {
      set({ isLoading: true, error: null });

      await authSignOut();

      set({
        user: null,
        session: null,
        profile: null,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Error al cerrar sesión',
        isLoading: false,
      });
      throw error;
    }
  },

  // Refrescar perfil
  refreshProfile: async () => {
    try {
      const profile = await getCurrentProfile();
      set({ profile });
    } catch (error) {
      console.error('Error refreshing profile:', error);
    }
  },

  // Limpiar error
  clearError: () => set({ error: null }),

  // Getters
  isAuthenticated: () => {
    const state = get();
    return !!state.session && !!state.user;
  },

  isLender: () => {
    const state = get();
    return state.profile?.role === 'lender' || state.profile?.role === 'both';
  },

  isBorrower: () => {
    const state = get();
    return state.profile?.role === 'borrower' || state.profile?.role === 'both';
  },

  getRole: () => {
    const state = get();
    return state.profile?.role || null;
  },
}));
