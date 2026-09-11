import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router } from 'expo-router';
import { resetPassword, verifyRecoveryOtp } from '../../services/supabase/auth';
import { colors, gradients, spacing, borderRadius, fontSize, fontWeight } from '../../theme';
import { useToast } from '../../components';
import { validateEmail } from '../../utils';

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState(1); // 1: email, 2: código
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { showSuccess, showError, showWarning } = useToast();

  const handleSendCode = async () => {
    if (!email.trim()) {
      showError('Error', 'Por favor ingresa tu correo electrónico');
      return;
    }

    // Validar email con detección de typos
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      showError('Correo inválido', emailValidation.error || 'El correo no es válido');
      return;
    }
    if (emailValidation.warning) {
      showWarning('Revisá tu correo', emailValidation.warning);
    }

    setIsLoading(true);

    try {
      await resetPassword(email.trim());
      showSuccess('Código enviado', 'Revisa tu correo e ingresa el código de 8 dígitos');
      setStep(2);
    } catch (error) {
      showError(
        'Error',
        error instanceof Error ? error.message : 'No se pudo enviar el código'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (code.trim().length !== 8) {
      showError('Error', 'Ingresa el código de 8 dígitos');
      return;
    }

    setIsLoading(true);

    try {
      await verifyRecoveryOtp(email.trim(), code.trim());
      // verifyOtp deja una sesión activa; la pantalla de reset-password la usa
      router.replace('/(auth)/reset-password');
    } catch (error) {
      showError(
        'Código inválido',
        error instanceof Error ? error.message : 'El código es incorrecto o expiró'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setIsLoading(true);
    try {
      await resetPassword(email.trim());
      showSuccess('Código reenviado', 'Te enviamos un nuevo código a tu correo');
    } catch (error) {
      showError(
        'Error',
        error instanceof Error ? error.message : 'No se pudo reenviar el código'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LinearGradient colors={gradients.primary} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.logo}>Cuotify</Text>
            <Text style={styles.subtitle}>Recuperar contraseña</Text>
          </View>

          {step === 1 ? (
            <View style={styles.formContainer}>
              <Text style={styles.title}>¿Olvidaste tu contraseña?</Text>
              <Text style={styles.description}>
                Ingresa tu correo electrónico y te enviaremos un código para
                restablecer tu contraseña.
              </Text>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Correo electrónico</Text>
                <TextInput
                  style={styles.input}
                  placeholder="tu@email.com"
                  placeholderTextColor={colors.text.disabled}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <TouchableOpacity
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleSendCode}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.text.inverse} />
                ) : (
                  <Text style={styles.buttonText}>Enviar código</Text>
                )}
              </TouchableOpacity>

              <Link href="/(auth)/login" asChild>
                <TouchableOpacity style={styles.backButton}>
                  <Text style={styles.backButtonText}>Volver al inicio</Text>
                </TouchableOpacity>
              </Link>
            </View>
          ) : (
            <View style={styles.formContainer}>
              <Text style={styles.title}>Ingresa el código</Text>
              <Text style={styles.description}>
                Enviamos un código de 8 dígitos a{'\n'}
                <Text style={styles.emailHighlight}>{email.trim()}</Text>
              </Text>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Código de verificación</Text>
                <TextInput
                  style={[styles.input, styles.codeInput]}
                  placeholder="00000000"
                  placeholderTextColor={colors.text.disabled}
                  value={code}
                  onChangeText={(text) => setCode(text.replace(/[^0-9]/g, '').slice(0, 8))}
                  keyboardType="number-pad"
                  maxLength={8}
                  autoFocus
                />
              </View>

              <TouchableOpacity
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleVerifyCode}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.text.inverse} />
                ) : (
                  <Text style={styles.buttonText}>Verificar código</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backButton}
                onPress={handleResendCode}
                disabled={isLoading}
              >
                <Text style={styles.backButtonText}>Reenviar código</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backButton}
                onPress={() => {
                  setCode('');
                  setStep(1);
                }}
                disabled={isLoading}
              >
                <Text style={styles.secondaryLink}>Cambiar correo</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        </TouchableWithoutFeedback>
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
  emailHighlight: {
    fontWeight: fontWeight.semiBold,
    color: colors.text.primary,
  },
  inputContainer: {
    marginBottom: spacing.lg,
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
  codeInput: {
    textAlign: 'center',
    fontSize: fontSize.xl,
    letterSpacing: 4,
    fontWeight: fontWeight.bold,
  },
  button: {
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semiBold,
    color: colors.text.inverse,
  },
  backButton: {
    alignItems: 'center',
    padding: spacing.sm,
  },
  backButtonText: {
    fontSize: fontSize.sm,
    color: colors.primary.main,
    fontWeight: fontWeight.medium,
  },
  secondaryLink: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    fontWeight: fontWeight.medium,
  },
});
