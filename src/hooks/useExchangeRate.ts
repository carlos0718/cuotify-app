import { useCallback, useEffect, useState } from 'react';
import { CurrencyType, ExchangeRate } from '../types';
import { usePreferencesStore } from '../store';
import { getExchangeRate } from '../services/exchangeRate';
import { convertCurrency } from '../services/calculations';

export interface UseExchangeRate {
  /** Cotización activa, o null si no hay red ni nada cacheado. */
  rate: ExchangeRate | null;
  /** true si `rate` viene de caché vieja porque no se pudo refrescar. */
  stale: boolean;
  loading: boolean;
  error: string | null;
  /** Convierte un monto entre monedas, o null si todavía no hay cotización. */
  convert: (amount: number, from: CurrencyType, to: CurrencyType) => number | null;
}

/**
 * Expone la cotización ARS/USD (P4) según el tipo de dólar elegido por el usuario
 * (`dollarRateType` en preferencias). Trae el valor al montar y cada vez que cambia
 * el tipo; sirve el cacheado mientras refresca y no bloquea el render.
 */
export function useExchangeRate(): UseExchangeRate {
  const type = usePreferencesStore((s) => s.dollarRateType);

  const [rate, setRate] = useState<ExchangeRate | null>(null);
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);

    getExchangeRate(type)
      .then((res) => {
        if (!active) return;
        setRate(res.rate);
        setStale(res.stale);
        setError(res.rate ? null : 'No se pudo obtener la cotización');
      })
      .catch(() => {
        if (active) setError('No se pudo obtener la cotización');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [type]);

  const convert = useCallback(
    (amount: number, from: CurrencyType, to: CurrencyType): number | null =>
      rate ? convertCurrency(amount, from, to, rate) : null,
    [rate],
  );

  return { rate, stale, loading, error, convert };
}
