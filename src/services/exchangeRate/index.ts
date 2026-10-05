import AsyncStorage from '@react-native-async-storage/async-storage';
import { DollarRateType, ExchangeRate } from '../../types';

/**
 * Cotización ARS/USD desde dolarapi.com (gratis, sin API key).
 *
 * El valor es **solo para mostrar equivalencias** (P4): nunca se persiste un monto
 * convertido ni se mezcla con los montos reales de los préstamos. ARS y USD se siguen
 * guardando y sumando por separado (L2).
 *
 * Se cachea en AsyncStorage por tipo de dólar, con un TTL: mientras la cotización
 * cacheada esté fresca se usa tal cual; si venció se intenta refrescar por red y, si
 * falla (offline), se devuelve la última cacheada marcada como `stale`.
 */

const BASE_URL = 'https://dolarapi.com/v1/dolares';

// dolarapi identifica cada cotización por "casa". El dólar MEP es la casa "bolsa".
const CASA_BY_TYPE: Record<DollarRateType, string> = {
  oficial: 'oficial',
  blue: 'blue',
  mep: 'bolsa',
};

const CACHE_PREFIX = '@cuotify_exchange_rate_';

/** Cuánto vale una cotización cacheada antes de intentar refrescarla (6 horas). */
export const EXCHANGE_RATE_TTL_MS = 1000 * 60 * 60 * 6;

interface DolarApiResponse {
  casa?: string;
  nombre?: string;
  compra: number | null;
  venta: number | null;
  fechaActualizacion: string;
}

function cacheKey(type: DollarRateType): string {
  return `${CACHE_PREFIX}${type}`;
}

/** Última cotización guardada para ese tipo, o null si no hay/falla la lectura. */
export async function getCachedExchangeRate(
  type: DollarRateType,
): Promise<ExchangeRate | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(type));
    return raw ? (JSON.parse(raw) as ExchangeRate) : null;
  } catch {
    return null;
  }
}

async function cacheExchangeRate(rate: ExchangeRate): Promise<void> {
  try {
    await AsyncStorage.setItem(cacheKey(rate.type), JSON.stringify(rate));
  } catch {
    // Si falla el guardado, la cotización igual sirve en memoria para esta sesión.
  }
}

/** Trae la cotización por red y actualiza la caché. Lanza si no hay red o valor. */
export async function fetchExchangeRate(type: DollarRateType): Promise<ExchangeRate> {
  const res = await fetch(`${BASE_URL}/${CASA_BY_TYPE[type]}`);
  if (!res.ok) throw new Error(`dolarapi respondió ${res.status}`);

  const data = (await res.json()) as DolarApiResponse;
  const sell = data.venta;
  if (sell == null || Number.isNaN(sell)) {
    throw new Error('La cotización no trae valor de venta');
  }

  const rate: ExchangeRate = {
    type,
    sell,
    buy: data.compra ?? sell,
    date: data.fechaActualizacion,
    fetchedAt: new Date().toISOString(),
  };

  await cacheExchangeRate(rate);
  return rate;
}

export interface ExchangeRateResult {
  /** La cotización a usar, o null si no hay red ni nada cacheado. */
  rate: ExchangeRate | null;
  /** true cuando `rate` viene de caché vieja porque no se pudo refrescar. */
  stale: boolean;
}

/**
 * Devuelve la cotización lista para usar: cacheada si está fresca, refrescada por red
 * si venció, o la última cacheada (marcada `stale`) si la red falla.
 */
export async function getExchangeRate(
  type: DollarRateType,
  options: { ttlMs?: number } = {},
): Promise<ExchangeRateResult> {
  const { ttlMs = EXCHANGE_RATE_TTL_MS } = options;
  const cached = await getCachedExchangeRate(type);

  const isFresh =
    cached != null && Date.now() - new Date(cached.fetchedAt).getTime() < ttlMs;
  if (isFresh) return { rate: cached, stale: false };

  try {
    const fresh = await fetchExchangeRate(type);
    return { rate: fresh, stale: false };
  } catch {
    // Offline o error del servicio: servir lo último conocido, aunque esté viejo.
    return { rate: cached, stale: cached != null };
  }
}
