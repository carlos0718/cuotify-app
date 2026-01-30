import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CurrencyType } from '../types';

interface PreferencesState {
  // Preferencias de moneda
  defaultCurrency: CurrencyType;

  // Acciones
  setDefaultCurrency: (currency: CurrencyType) => void;
  resetPreferences: () => void;
}

const initialState = {
  defaultCurrency: 'ARS' as CurrencyType,
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      ...initialState,

      setDefaultCurrency: (currency: CurrencyType) => {
        set({ defaultCurrency: currency });
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
