import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { supabase } from '../../services/supabase/client';
import { updatePassword } from '../../services/supabase/auth';
import { colors, gradients, spacing, borderRadius, fontSize, fontWeight } from '../../theme';
import { useToast, PasswordInput } from '../../components';

export default function ResetPasswordScreen() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isValidSession, setIsValidSession] = useState(false);
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    validateSession();
  }, []);

  const validateSession = async () => {
    try {
      // Verificar si hay una sesión válida del enlace de recuperación
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        throw error;
      }

      if (session) {
        setIsValidSession(true);
      } else {
        showError('Enlace inválido', 'El enlace ha expirado o es inválido. Solicita uno nuevo.');
        setTimeout(() => {
          router.replace('/(auth)/forgot-password');
        }, 2000);
      }
    } catch (error) {
      showError('Error', 'No se pudo validar la sesión');
      setTimeout(() => {
        router.replace('/(auth)/login');
      }, 2000);
    } finally {
      setIsValidating(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword.trim()) {
      showError('Error', 'Por favor ingresa una nueva contraseña');
      return;
    }

    if (newPassword.length < 6) {
      showError('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      showError('Error', 'Las contraseñas no coinciden');
      return;
    }

    setIsLoading(true);

    try {
      await updatePassword(newPassword);
      showSuccess('Contraseña actualizada', 'Tu contraseña ha sido cambiada exitosamente');

      // Cerrar sesión para que el usuario inicie con su nueva contraseña
      await supabase.auth.signOut();

      setTimeout(() => {
        router.replace('/(auth)/login');
      }, 2000);
    } catch (error) {
      showError(
        'Error',
        error instanceof Error ? error.message : 'No se pudo actualizar la contraseña'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidating) {
    return (
      <LinearGradient colors={gradients.primary} style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.text.inverse} />
          <Text style={styles.loadingText}>Validando enlace...</Text>
        </View>
      </LinearGradient>
    );
  }

  if (!isValidSession) {
    return (
      <LinearGradient colors={gradients.primary} style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Redirigiendo...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={gradients.primary} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.logo}>Cuotify</Text>
            <Text style={styles.subtitle}>Nueva contraseña</Text>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.title}>Crear nueva contraseña</Text>
            <Text style={styles.description}>
              Ingresa tu nueva contraseña. Asegúrate de que sea segura y fácil de recordar.
            </Text>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Nueva contraseña</Text>
              <PasswordInput
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor={colors.text.disabled}
                value={newPassword}
                onChangeText={setNewPassword}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirmar contraseña</Text>
              <PasswordInput
                placeholder="Repite tu contraseña"
                placeholderTextColor={colors.text.disabled}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
            </View>

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleResetPassword}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.text.inverse} />
              ) : (
                <Text style={styles.buttonText}>Cambiar contraseña</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: fontSize.base,
    color: colors.text.inverse,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logo: {
    fontSize: fontSize['4xl'],
    fontWeight: fontWeight.bold,
    color: colors.text.inverse,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.base,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  formContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius['2xl'],
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  description: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  inputContainer: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    fontSize: fontSize.base,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semiBold,
    color: colors.text.inverse,
  },
});
