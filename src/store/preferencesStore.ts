import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CurrencyType } from '../types';

interface PreferencesState {
  // Preferencias de moneda
  defaultCurrency: CurrencyType;

  // Preferencias de notificaciones
  reminderDaysBefore: number;
  pushEnabled: boolean;

  // Acciones
  setDefaultCurrency: (currency: CurrencyType) => void;
  setReminderDaysBefore: (days: number) => void;
  setPushEnabled: (enabled: boolean) => void;
  resetPreferences: () => void;
}

const initialState = {
  defaultCurrency: 'ARS' as CurrencyType,
  reminderDaysBefore: 3,
  pushEnabled: true,
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      ...initialState,

      setDefaultCurrency: (currency: CurrencyType) => {
        set({ defaultCurrency: currency });
      },

      setReminderDaysBefore: (days: number) => {
        set({ reminderDaysBefore: days });
      },

      setPushEnabled: (enabled: boolean) => {
        set({ pushEnabled: enabled });
      },

      resetPreferences: () => {
        set(initialState);
      },
    }),
    {
      name: 'cuotify-preferences',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
