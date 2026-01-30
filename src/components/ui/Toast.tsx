import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { colors, spacing, borderRadius, fontSize, fontWeight, shadow } from '../../theme';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  visible: boolean;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  onHide: () => void;
}

const toastConfig = {
  success: {
    backgroundColor: colors.success,
    iconBg: 'rgba(255, 255, 255, 0.3)',
    icon: '✓',
    textColor: '#FFFFFF',
  },
  error: {
    backgroundColor: colors.error,
    iconBg: 'rgba(255, 255, 255, 0.3)',
    icon: '✕',
    textColor: '#FFFFFF',
  },
  warning: {
    backgroundColor: colors.warning,
    iconBg: 'rgba(0, 0, 0, 0.15)',
    icon: '⚠',
    textColor: '#1E293B',
  },
  info: {
    backgroundColor: colors.primary.main,
    iconBg: 'rgba(255, 255, 255, 0.3)',
    icon: 'ℹ',
    textColor: '#FFFFFF',
  },
};

export function Toast({
  visible,
  type,
  title,
  message,
  duration = 3000,
  onHide,
}: ToastProps) {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
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
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => onHide());
  };

  if (!visible) return null;

  const config = toastConfig[type];
  const isWarning = type === 'warning';

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: config.backgroundColor },
        { transform: [{ translateY }], opacity },
      ]}
    >
      <TouchableOpacity
        style={styles.content}
        activeOpacity={0.9}
        onPress={hideToast}
      >
        <View style={[styles.iconContainer, { backgroundColor: config.iconBg }]}>
          <Text style={[styles.icon, { color: config.textColor }]}>{config.icon}</Text>
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: config.textColor }]}>{title}</Text>
          {message && (
            <Text
              style={[
                styles.message,
                { color: isWarning ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.95)' }
              ]}
            >
              {message}
            </Text>
          )}
        </View>
        <View style={[styles.closeButton, { backgroundColor: config.iconBg }]}>
          <Text style={[styles.closeIcon, { color: config.textColor }]}>×</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: spacing.md,
    right: spacing.md,
    borderRadius: borderRadius.xl,
    ...shadow.lg,
    zIndex: 9999,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    paddingVertical: spacing.lg,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  icon: {
    fontSize: 22,
    fontWeight: fontWeight.bold,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
  },
  message: {
    fontSize: fontSize.sm,
    marginTop: 4,
    lineHeight: 18,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  closeIcon: {
    fontSize: 22,
    fontWeight: fontWeight.bold,
    marginTop: -2,
  },
});
