import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { colors, spacing, borderRadius, fontSize, fontWeight, lineHeight } from '../../theme';

export interface ErrorFallbackProps {
  error: Error;
  retry: () => void;
}

function WarningIcon() {
  return (
    <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={colors.error} strokeWidth="2" />
      <Line x1="12" y1="8" x2="12" y2="13" stroke={colors.error} strokeWidth="2" strokeLinecap="round" />
      <Path d="M12 16.5H12.01" stroke={colors.error} strokeWidth="2.5" strokeLinecap="round" />
    </Svg>
  );
}

export function ErrorFallback({ error, retry }: ErrorFallbackProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}>
      <View style={styles.iconWrap}>
        <WarningIcon />
      </View>
      <Text style={styles.title}>Algo salió mal</Text>
      <Text style={styles.message}>
        Ocurrió un error inesperado. Podés intentar de nuevo; si el problema
        persiste, cerrá y volvé a abrir la aplicación.
      </Text>
      {__DEV__ ? <Text style={styles.devDetail}>{error.message}</Text> : null}
      <TouchableOpacity style={styles.button} onPress={retry} activeOpacity={0.85}>
        <Text style={styles.buttonText}>Reintentar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: borderRadius.full,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  message: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.regular,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: fontSize.base * lineHeight.normal,
    marginBottom: spacing.lg,
  },
  devDetail: {
    fontSize: fontSize.xs,
    color: colors.text.disabled,
    textAlign: 'center',
    marginBottom: spacing.lg,
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: colors.primary.main,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
  },
  buttonText: {
    color: colors.text.inverse,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semiBold,
  },
});
