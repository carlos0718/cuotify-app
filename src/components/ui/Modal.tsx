import { Modal as RNModal, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, borderRadius, fontSize, fontWeight, shadow } from '../../theme';

interface ModalButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive' | 'primary';
}

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  buttons?: ModalButton[];
  children?: React.ReactNode;
  icon?: string;
  accentColor?: string;
}

export function Modal({
  visible,
  onClose,
  title,
  message,
  buttons = [{ text: 'Cerrar', style: 'cancel' }],
  children,
  icon,
  accentColor = colors.primary.main,
}: ModalProps) {
  const getButtonStyle = (style?: ModalButton['style']) => {
    switch (style) {
      case 'destructive':
        return { backgroundColor: colors.error, color: colors.text.inverse };
      case 'primary':
        return { backgroundColor: accentColor, color: colors.text.inverse };
      case 'cancel':
        return { backgroundColor: colors.background, color: colors.text.secondary };
      default:
        return { backgroundColor: colors.surface, color: colors.text.primary };
    }
  };

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Barra de acento superior */}
          <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

          {/* Contenido */}
          <View style={styles.content}>
            {/* Icono */}
            {icon && (
              <View style={[styles.iconContainer, { backgroundColor: accentColor + '20' }]}>
                <Text style={styles.icon}>{icon}</Text>
              </View>
            )}

            {/* Título */}
            <Text style={styles.title}>{title}</Text>

            {/* Mensaje o contenido personalizado */}
            {message && (
              <ScrollView style={styles.messageContainer} showsVerticalScrollIndicator={false}>
                <Text style={styles.message}>{message}</Text>
              </ScrollView>
            )}
            {children}
          </View>

          {/* Botones */}
          <View style={styles.buttonContainer}>
            {buttons.map((button, index) => {
              const buttonStyle = getButtonStyle(button.style);
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.button,
                    { backgroundColor: buttonStyle.backgroundColor },
                    buttons.length > 1 && index < buttons.length - 1 && styles.buttonMargin,
                  ]}
                  onPress={() => {
                    button.onPress?.();
                    if (button.style === 'cancel' || !button.onPress) {
                      onClose();
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.buttonText, { color: buttonStyle.color }]}>
                    {button.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  container: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadow.lg,
  },
  accentBar: {
    height: 4,
  },
  content: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  icon: {
    fontSize: 32,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  messageContainer: {
    maxHeight: 300,
  },
  message: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'left',
    lineHeight: 22,
  },
  buttonContainer: {
    padding: spacing.md,
    paddingTop: 0,
    gap: spacing.sm,
  },
  button: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  buttonMargin: {
    marginBottom: 0,
  },
  buttonText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semiBold,
  },
});
