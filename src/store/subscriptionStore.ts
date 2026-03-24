import { create } from 'zustand';
import { CustomerInfo } from 'react-native-purchases';
import { isPremium, isPremiumFromInfo, addCustomerInfoListener } from '../services/subscription';

// Límites del plan gratuito
export const FREE_LIMITS = {
  activeLoans: 3,
  personalDebts: 2,
  borrowers: 5,
} as const;

interface SubscriptionStore {
  premium: boolean;
  customerInfo: CustomerInfo | null;
  isLoading: boolean;
  // Inicia la suscripción al listener de RevenueCat (llamar al autenticar)
  startListening: () => () => void;
  // Refresca manualmente el estado (útil tras una compra)
  refresh: () => Promise<void>;
  setPremium: (value: boolean) => void;
  setCustomerInfo: (info: CustomerInfo) => void;
}

export const useSubscriptionStore = create<SubscriptionStore>((set) => ({
  premium: false,
  customerInfo: null,
  isLoading: false,

  startListening: () => {
    // Consulta inicial
    isPremium().then((active) => set({ premium: active }));

    // Listener en tiempo real: se dispara cada vez que RevenueCat detecta
    // un cambio (compra, renovación, cancelación, restauración)
    const removeListener = addCustomerInfoListener((info: CustomerInfo) => {
      set({
        customerInfo: info,
        premium: isPremiumFromInfo(info),
      });
    });

    return removeListener;
  },

  refresh: async () => {
    set({ isLoading: true });
    try {
      const active = await isPremium();
      set({ premium: active });
    } catch {
      set({ premium: false });
    } finally {
      set({ isLoading: false });
    }
  },

  setPremium: (value) => set({ premium: value }),
  setCustomerInfo: (info) => set({ customerInfo: info, premium: isPremiumFromInfo(info) }),
}));
