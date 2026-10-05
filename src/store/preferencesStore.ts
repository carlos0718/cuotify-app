import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CurrencyType, DollarRateType } from '../types';

interface PreferencesState {
  // Preferencias de moneda
  defaultCurrency: CurrencyType;
  // Tipo de cotización del dólar para mostrar equivalencias ARS/USD (P4)
  dollarRateType: DollarRateType;

  // Preferencias de notificaciones
  reminderDaysBefore: number;
  pushEnabled: boolean;

  // Acciones
  setDefaultCurrency: (currency: CurrencyType) => void;
  setDollarRateType: (type: DollarRateType) => void;
  setReminderDaysBefore: (days: number) => void;
  setPushEnabled: (enabled: boolean) => void;
  resetPreferences: () => void;
}

const initialState = {
  defaultCurrency: 'ARS' as CurrencyType,
  dollarRateType: 'blue' as DollarRateType,
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

      setDollarRateType: (type: DollarRateType) => {
        set({ dollarRateType: type });
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
