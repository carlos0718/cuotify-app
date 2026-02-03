import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Modal,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { Link, router } from 'expo-router';
import { useAuthStore } from '../../store';
import { colors, gradients, spacing, borderRadius, fontSize, fontWeight } from '../../theme';
import { useToast, PasswordInput } from '../../components';
import { validateEmail } from '../../utils';
import {
  canUseBiometric,
  authenticateWithBiometric,
  enableBiometricAuth,
} from '../../services/auth';

// Icono de Face ID / Huella
function BiometricIcon({ color, size = 32 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 11.75A2.25 2.25 0 1 1 9 7.25a2.25 2.25 0 0 1 0 4.5zm6 0a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5zM12 20c-2.76 0-5-2.24-5-5h2a3 3 0 0 0 6 0h2c0 2.76-2.24 5-5 5z"
        fill={color}
      />
      <Path
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"
        fill={color}
      />
    </Svg>
  );
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState('');
  const [showEnableBiometricModal, setShowEnableBiometricModal] = useState(false);
  const [pendingCredentials, setPendingCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);

  const { signIn, isLoading, clearError } = useAuthStore();
  const { showError, showSuccess } = useToast();

  useEffect(() => {
    checkBiometricStatus();
  }, []);

  const checkBiometricStatus = async () => {
    const status = await canUseBiometric();
    setBiometricAvailable(status.available);
    setBiometricEnabled(status.enabled);
    setBiometricType(status.type);
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showError('Error', 'Por favor completa todos los campos');
      return;
    }

    // Validar email con detección de typos
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      showError('Correo inválido', emailValidation.error || 'El correo no es válido');
      return;
    }

    try {
      await signIn({ email: email.trim(), password });

      // Si biometría está disponible pero no habilitada, preguntar si quiere activarla
      if (biometricAvailable && !biometricEnabled) {
        setPendingCredentials({ email: email.trim(), password });
        setShowEnableBiometricModal(true);
      } else {
        router.replace('/(main)/dashboard');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'No se pudo iniciar sesión';
      showError('Error', errorMessage);
      clearError();
    }
  };

  const handleBiometricLogin = async () => {
    const result = await authenticateWithBiometric();

    if (!result.success) {
      if (result.error) {
        showError('Error', result.error);
      }
      return;
    }

    if (result.credentials) {
      try {
        await signIn({
          email: result.credentials.email,
          password: result.credentials.password,
        });
        router.replace('/(main)/dashboard');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'No se pudo iniciar sesión';
        showError('Error', errorMessage);
        clearError();
      }
    }
  };

  const handleEnableBiometric = async () => {
    if (pendingCredentials) {
      const success = await enableBiometricAuth(
        pendingCredentials.email,
        pendingCredentials.password
      );

      if (success) {
        showSuccess('Biometría activada', `Ahora puedes usar ${biometricType} para iniciar sesión`);
        setBiometricEnabled(true);
      }
    }

    setShowEnableBiometricModal(false);
    setPendingCredentials(null);
    router.replace('/(main)/dashboard');
  };

  const handleSkipBiometric = () => {
    setShowEnableBiometricModal(false);
    setPendingCredentials(null);
    router.replace('/(main)/dashboard');
  };

  return (
    <LinearGradient colors={gradients.primary} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Image
              source={require('../../../assets/icon.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.logo}>Cuotify</Text>
            <Text style={styles.subtitle}>Gestiona tus préstamos fácilmente</Text>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.title}>Iniciar Sesión</Text>

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

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Contraseña</Text>
              <PasswordInput
                placeholder="Tu contraseña"
                placeholderTextColor={colors.text.disabled}
                value={password}
                onChangeText={setPassword}
              />
            </View>

            <Link href="/(auth)/forgot-password" asChild>
              <TouchableOpacity style={styles.forgotPassword}>
                <Text style={styles.forgotPasswordText}>
                  ¿Olvidaste tu contraseña?
                </Text>
              </TouchableOpacity>
            </Link>

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.text.inverse} />
              ) : (
                <Text style={styles.buttonText}>Ingresar</Text>
              )}
            </TouchableOpacity>

            {/* Botón de biometría */}
            {biometricAvailable && biometricEnabled && (
              <TouchableOpacity
                style={styles.biometricButton}
                onPress={handleBiometricLogin}
                disabled={isLoading}
              >
                <BiometricIcon color={colors.primary.main} />
                <Text style={styles.biometricButtonText}>
                  Ingresar con {biometricType}
                </Text>
              </TouchableOpacity>
            )}

            <View style={styles.registerContainer}>
              <Text style={styles.registerText}>¿No tienes cuenta? </Text>
              <Link href="/(auth)/register" asChild>
                <TouchableOpacity>
                  <Text style={styles.registerLink}>Regístrate</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal para habilitar biometría */}
      <Modal
        visible={showEnableBiometricModal}
        transparent
        animationType="fade"
        onRequestClose={handleSkipBiometric}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <BiometricIcon color={colors.primary.main} size={48} />
            <Text style={styles.modalTitle}>Activar {biometricType}</Text>
            <Text style={styles.modalDescription}>
              ¿Quieres usar {biometricType} para iniciar sesión más rápido la próxima vez?
            </Text>

            <TouchableOpacity
              style={styles.modalButtonPrimary}
              onPress={handleEnableBiometric}
            >
              <Text style={styles.modalButtonPrimaryText}>Sí, activar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalButtonSecondary}
              onPress={handleSkipBiometric}
            >
              <Text style={styles.modalButtonSecondaryText}>Ahora no</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoImage: {
    width: 100,
    height: 100,
    marginBottom: spacing.sm,
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
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.lg,
    textAlign: 'center',
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
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: spacing.lg,
  },
  forgotPasswordText: {
    fontSize: fontSize.sm,
    color: colors.primary.main,
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
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary.main,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  biometricButtonText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.primary.main,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  registerText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  registerLink: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semiBold,
    color: colors.primary.main,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius['2xl'],
    padding: spacing.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  modalButtonPrimary: {
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing.sm,
  },
  modalButtonPrimaryText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semiBold,
    color: colors.text.inverse,
  },
  modalButtonSecondary: {
    padding: spacing.md,
    alignItems: 'center',
    width: '100%',
  },
  modalButtonSecondaryText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.text.secondary,
  },
});
