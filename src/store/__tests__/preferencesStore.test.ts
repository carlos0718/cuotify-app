import { usePreferencesStore } from '../preferencesStore';

const defaults = {
  defaultCurrency: 'ARS' as const,
  reminderDaysBefore: 3,
  pushEnabled: true,
};

beforeEach(() => {
  usePreferencesStore.setState(defaults);
});

describe('usePreferencesStore', () => {
  it('arranca con los valores por defecto', () => {
    const state = usePreferencesStore.getState();
    expect(state.defaultCurrency).toBe('ARS');
    expect(state.reminderDaysBefore).toBe(3);
    expect(state.pushEnabled).toBe(true);
  });

  it('setDefaultCurrency actualiza la moneda', () => {
    usePreferencesStore.getState().setDefaultCurrency('USD');
    expect(usePreferencesStore.getState().defaultCurrency).toBe('USD');
  });

  it('setReminderDaysBefore actualiza los días de recordatorio', () => {
    usePreferencesStore.getState().setReminderDaysBefore(7);
    expect(usePreferencesStore.getState().reminderDaysBefore).toBe(7);
  });

  it('setPushEnabled activa/desactiva las notificaciones push', () => {
    usePreferencesStore.getState().setPushEnabled(false);
    expect(usePreferencesStore.getState().pushEnabled).toBe(false);
  });

  it('resetPreferences vuelve a los valores por defecto', () => {
    usePreferencesStore.getState().setDefaultCurrency('USD');
    usePreferencesStore.getState().setReminderDaysBefore(10);
    usePreferencesStore.getState().setPushEnabled(false);

    usePreferencesStore.getState().resetPreferences();

    const state = usePreferencesStore.getState();
    expect(state.defaultCurrency).toBe('ARS');
    expect(state.reminderDaysBefore).toBe(3);
    expect(state.pushEnabled).toBe(true);
  });
});
