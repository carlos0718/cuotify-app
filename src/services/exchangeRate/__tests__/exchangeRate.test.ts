import { http, HttpResponse } from 'msw';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { server } from '../../../test/msw/server';
import {
  fetchExchangeRate,
  getExchangeRate,
  getCachedExchangeRate,
  EXCHANGE_RATE_TTL_MS,
} from '../index';
import { ExchangeRate } from '../../../types';

const BASE = 'https://dolarapi.com/v1/dolares';

const dolarApiPayload = (overrides: Record<string, unknown> = {}) => ({
  casa: 'blue',
  nombre: 'Blue',
  compra: 1000,
  venta: 1050,
  fechaActualizacion: '2026-10-05T12:00:00.000Z',
  ...overrides,
});

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('fetchExchangeRate', () => {
  it('parsea la respuesta de dolarapi y arma el ExchangeRate', async () => {
    server.use(http.get(`${BASE}/blue`, () => HttpResponse.json(dolarApiPayload())));

    const rate = await fetchExchangeRate('blue');

    expect(rate.type).toBe('blue');
    expect(rate.sell).toBe(1050);
    expect(rate.buy).toBe(1000);
    expect(rate.date).toBe('2026-10-05T12:00:00.000Z');
    expect(typeof rate.fetchedAt).toBe('string');
  });

  it('mapea el tipo "mep" al endpoint "bolsa" de dolarapi', async () => {
    let hit = false;
    server.use(
      http.get(`${BASE}/bolsa`, () => {
        hit = true;
        return HttpResponse.json(dolarApiPayload({ casa: 'bolsa', venta: 1200, compra: 1150 }));
      }),
    );

    const rate = await fetchExchangeRate('mep');

    expect(hit).toBe(true);
    expect(rate.type).toBe('mep');
    expect(rate.sell).toBe(1200);
  });

  it('cachea la cotización tras un fetch exitoso', async () => {
    server.use(http.get(`${BASE}/oficial`, () => HttpResponse.json(dolarApiPayload({ casa: 'oficial' }))));

    await fetchExchangeRate('oficial');
    const cached = await getCachedExchangeRate('oficial');

    expect(cached?.type).toBe('oficial');
    expect(cached?.sell).toBe(1050);
  });

  it('usa venta como buy si compra viene null', async () => {
    server.use(http.get(`${BASE}/blue`, () => HttpResponse.json(dolarApiPayload({ compra: null }))));

    const rate = await fetchExchangeRate('blue');

    expect(rate.buy).toBe(1050);
  });

  it('lanza si la respuesta no trae valor de venta', async () => {
    server.use(http.get(`${BASE}/blue`, () => HttpResponse.json(dolarApiPayload({ venta: null }))));

    await expect(fetchExchangeRate('blue')).rejects.toThrow();
  });

  it('lanza si el servidor responde con error HTTP', async () => {
    server.use(http.get(`${BASE}/blue`, () => new HttpResponse(null, { status: 500 })));

    await expect(fetchExchangeRate('blue')).rejects.toThrow();
  });
});

describe('getExchangeRate', () => {
  async function seedCache(rate: ExchangeRate) {
    await AsyncStorage.setItem(`@cuotify_exchange_rate_${rate.type}`, JSON.stringify(rate));
  }

  const freshCached: ExchangeRate = {
    type: 'blue',
    sell: 999,
    buy: 950,
    date: '2026-10-05T10:00:00.000Z',
    fetchedAt: new Date().toISOString(),
  };

  it('devuelve el caché sin pegarle a la red cuando está fresco', async () => {
    await seedCache(freshCached);
    // Sin handler: si intentara la red, msw fallaría (onUnhandledRequest: 'error').

    const result = await getExchangeRate('blue');

    expect(result.stale).toBe(false);
    expect(result.rate?.sell).toBe(999);
  });

  it('refresca por red cuando el caché venció', async () => {
    await seedCache({
      ...freshCached,
      sell: 999,
      fetchedAt: new Date(Date.now() - EXCHANGE_RATE_TTL_MS - 1000).toISOString(),
    });
    server.use(http.get(`${BASE}/blue`, () => HttpResponse.json(dolarApiPayload({ venta: 1111 }))));

    const result = await getExchangeRate('blue');

    expect(result.stale).toBe(false);
    expect(result.rate?.sell).toBe(1111);
  });

  it('cae al caché viejo (stale) si la red falla', async () => {
    await seedCache({
      ...freshCached,
      sell: 999,
      fetchedAt: new Date(Date.now() - EXCHANGE_RATE_TTL_MS - 1000).toISOString(),
    });
    server.use(http.get(`${BASE}/blue`, () => HttpResponse.error()));

    const result = await getExchangeRate('blue');

    expect(result.stale).toBe(true);
    expect(result.rate?.sell).toBe(999);
  });

  it('devuelve rate null y stale false si no hay red ni caché', async () => {
    server.use(http.get(`${BASE}/blue`, () => HttpResponse.error()));

    const result = await getExchangeRate('blue');

    expect(result.rate).toBeNull();
    expect(result.stale).toBe(false);
  });
});
