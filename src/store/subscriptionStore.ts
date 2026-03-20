import { create } from 'zustand';
import { isPremium } from '../services/subscription';

// Límites del plan gratuito
export const FREE_LIMITS = {
  activeLoans: 3,
  personalDebts: 2,
  borrowers: 5,
} as const;

interface SubscriptionStore {
  premium: boolean;
  isLoading: boolean;
  // Inicializa/refresca el estado de suscripción desde RevenueCat
  refresh: () => Promise<void>;
  // Setter manual (para actualizar después de una compra exitosa)
  setPremium: (value: boolean) => void;
}

export const useSubscriptionStore = create<SubscriptionStore>((set) => ({
  premium: false,
  isLoading: false,

  refresh: async () => {
    set({ isLoading: true });
    try {
      const active = await isPremium();
      set({ premium: active });
    } catch {
      // Ante cualquier error de red/SDK, no bloquear la app
      set({ premium: false });
    } finally {
      set({ isLoading: false });
    }
  },

  setPremium: (value) => set({ premium: value }),
}));
