import { Text, StyleSheet, StyleProp, TextStyle } from 'react-native';
import { CurrencyType, DollarRateType } from '../../types';
import { formatCurrency } from '../../services/calculations';
import { UseExchangeRate } from '../../hooks/useExchangeRate';
import { colors, fontSize, fontWeight } from '../../theme';

const RATE_LABEL: Record<DollarRateType, string> = {
  oficial: 'oficial',
  blue: 'blue',
  mep: 'MEP',
};

function formatRateDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}

export interface CurrencyEquivalentProps {
  amount: number;
  currency: CurrencyType;
  exchange: UseExchangeRate;
  style?: StyleProp<TextStyle>;
}

/**
 * Muestra el equivalente de un monto en la otra moneda (P4), con el tipo de dólar y la
 * fecha de cotización. No suma ni reemplaza el monto real: es una referencia.
 * No renderiza nada mientras no haya cotización disponible.
 */
export function CurrencyEquivalent({ amount, currency, exchange, style }: CurrencyEquivalentProps) {
  const { rate, stale, convert } = exchange;
  if (!rate) return null;

  const target: CurrencyType = currency === 'ARS' ? 'USD' : 'ARS';
  const converted = convert(amount, currency, target);
  if (converted == null) return null;

  const dateLabel = formatRateDate(rate.date);
  const suffix = stale ? ' · sin conexión' : '';

  return (
    <Text
      style={[styles.text, style]}
      accessibilityLabel={`Equivalente aproximado: ${formatCurrency(converted, target)}, dólar ${RATE_LABEL[rate.type]}${dateLabel ? ` al ${dateLabel}` : ''}`}
    >
      ≈ {formatCurrency(converted, target)}{'  '}
      <Text style={styles.meta}>
        {RATE_LABEL[rate.type]}{dateLabel ? ` · ${dateLabel}` : ''}{suffix}
      </Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semiBold,
    color: colors.text.secondary,
  },
  meta: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.regular,
    color: colors.text.disabled,
  },
});
