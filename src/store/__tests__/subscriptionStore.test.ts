import { useSubscriptionStore } from '../subscriptionStore';
import * as subscriptionService from '../../services/subscription';

// Factory explícita: un jest.mock() automático igual requiere el módulo real
// para inspeccionar su forma, y eso carga react-native-purchases (módulo
// nativo) que rompe fuera de un runtime de React Native.
jest.mock('../../services/subscription', () => ({
  isPremium: jest.fn(),
  isPremiumFromInfo: jest.fn(),
  addCustomerInfoListener: jest.fn(),
}));

const mockIsPremium = subscriptionService.isPremium as jest.Mock;
const mockIsPremiumFromInfo = subscriptionService.isPremiumFromInfo as jest.Mock;
const mockAddCustomerInfoListener = subscriptionService.addCustomerInfoListener as jest.Mock;

const initialState = useSubscriptionStore.getState();

beforeEach(() => {
  useSubscriptionStore.setState(initialState, true);
  jest.clearAllMocks();
});

describe('startListening', () => {
  it('consulta isPremium al arrancar y actualiza el estado', async () => {
    mockIsPremium.mockResolvedValue(true);
    mockAddCustomerInfoListener.mockReturnValue(jest.fn());

    useSubscriptionStore.getState().startListening();
    await Promise.resolve(); // deja resolver el .then() de isPremium()

    expect(useSubscriptionStore.getState().premium).toBe(true);
  });

  it('actualiza customerInfo y premium cuando el listener de RevenueCat dispara un cambio', async () => {
    mockIsPremium.mockResolvedValue(false);
    let capturedCallback: ((info: unknown) => void) | null = null;
    mockAddCustomerInfoListener.mockImplementation((cb) => {
      capturedCallback = cb;
      return jest.fn();
    });

    useSubscriptionStore.getState().startListening();
    await Promise.resolve();

    const newInfo = { entitlements: { active: { 'Cuotify Pro': {} } } };
    mockIsPremiumFromInfo.mockReturnValue(true);
    capturedCallback!(newInfo);

    const state = useSubscriptionStore.getState();
    expect(state.customerInfo).toEqual(newInfo);
    expect(state.premium).toBe(true);
  });

  it('devuelve la función de remover el listener', () => {
    const removeListener = jest.fn();
    mockIsPremium.mockResolvedValue(false);
    mockAddCustomerInfoListener.mockReturnValue(removeListener);

    const result = useSubscriptionStore.getState().startListening();
    expect(result).toBe(removeListener);
  });
});

describe('refresh', () => {
  it('actualiza premium en el caso feliz', async () => {
    mockIsPremium.mockResolvedValue(true);
    await useSubscriptionStore.getState().refresh();

    const state = useSubscriptionStore.getState();
    expect(state.premium).toBe(true);
    expect(state.isLoading).toBe(false);
  });

  it('deja premium en false si falla la consulta', async () => {
    mockIsPremium.mockRejectedValue(new Error('boom'));
    await useSubscriptionStore.getState().refresh();

    const state = useSubscriptionStore.getState();
    expect(state.premium).toBe(false);
    expect(state.isLoading).toBe(false);
  });
});

describe('setPremium / setCustomerInfo', () => {
  it('setPremium actualiza el valor directo', () => {
    useSubscriptionStore.getState().setPremium(true);
    expect(useSubscriptionStore.getState().premium).toBe(true);
  });

  it('setCustomerInfo actualiza customerInfo y deriva premium', () => {
    mockIsPremiumFromInfo.mockReturnValue(true);
    const info = { entitlements: { active: { 'Cuotify Pro': {} } } } as never;

    useSubscriptionStore.getState().setCustomerInfo(info);

    const state = useSubscriptionStore.getState();
    expect(state.customerInfo).toEqual(info);
    expect(state.premium).toBe(true);
  });
});
