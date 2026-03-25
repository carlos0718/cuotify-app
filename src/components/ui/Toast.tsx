import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, borderRadius, shadow, fontSize, fontWeight } from '../../theme';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  visible: boolean;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  onHide: () => void;
}

const DOT_COLORS: Record<ToastType, string> = {
  success: '#22C55E',
  error:   '#EF4444',
  warning: '#F59E0B',
  info:    '#60A5FA',
};

const TYPE_ICONS: Record<ToastType, string> = {
  success: '✓',
  error:   '✕',
  warning: '⚠',
  info:    'ℹ',
};

const TOAST_BG = 'rgba(15, 23, 42, 0.92)';
const TEXT_COLOR = '#FFFFFF';
const SUBTEXT_COLOR = 'rgba(255, 255, 255, 0.65)';

export function Toast({
  visible,
  type,
  title,
  message,
  duration = 3000,
  onHide,
}: ToastProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 18,
          stiffness: 220,
          mass: 0.8,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        hideToast();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 120,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onHide());
  };

  if (!visible) return null;

  const dotColor = DOT_COLORS[type];
  const icon = TYPE_ICONS[type];
  const bottomOffset = (insets.bottom || 0) + spacing.xl;

  return (
    <Animated.View
      style={[
        styles.container,
        { bottom: bottomOffset },
        { transform: [{ translateY }], opacity },
      ]}
    >
      <TouchableOpacity
        style={styles.pill}
        activeOpacity={0.85}
        onPress={hideToast}
      >
        {/* dot indicador de tipo */}
        <View style={[styles.dot, { backgroundColor: dotColor }]} />

        {/* ícono pequeño */}
        <Text style={[styles.icon, { color: dotColor }]}>{icon}</Text>

        {/* textos */}
        <View style={styles.textWrap}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {message ? (
            <Text style={styles.message} numberOfLines={1}>{message}</Text>
          ) : null}
        </View>

        {/* botón cerrar */}
        <Text style={styles.closeIcon}>×</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    alignItems: 'center',
    zIndex: 9999,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TOAST_BG,
    borderRadius: borderRadius.full,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    // sombra pronunciada
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 20,
    elevation: 12,
    alignSelf: 'center',
    maxWidth: '100%',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    flexShrink: 0,
  },
  icon: {
    fontSize: 14,
    fontWeight: fontWeight.bold,
    flexShrink: 0,
  },
  textWrap: {
    flexShrink: 1,
    flexDirection: 'column',
  },
  title: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semiBold,
    color: TEXT_COLOR,
    lineHeight: 18,
  },
  message: {
    fontSize: 11,
    fontWeight: fontWeight.regular,
    color: SUBTEXT_COLOR,
    lineHeight: 15,
    marginTop: 1,
  },
  closeIcon: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.45)',
    fontWeight: fontWeight.bold,
    marginLeft: spacing.xs,
    flexShrink: 0,
    lineHeight: 20,
  },
});
