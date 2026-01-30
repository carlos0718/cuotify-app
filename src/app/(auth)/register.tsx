import { useState } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router } from 'expo-router';
import { useAuthStore } from '../../store';
import { UserRole } from '../../types';
import { colors, gradients, spacing, borderRadius, fontSize, fontWeight } from '../../theme';
import { useToast, PasswordInput } from '../../components';
import { validateEmail, validateDNI, validatePhone } from '../../utils';

const ROLES: { value: UserRole; label: string; description: string }[] = [
  {
    value: 'lender',
    label: 'Prestamista',
    description: 'Quiero prestar dinero y hacer seguimiento',
  },
  {
    value: 'borrower',
    label: 'Prestatario',
    description: 'Quiero ver mis deudas y hacer pagos',
  },
  {
    value: 'both',
    label: 'Ambos',
    description: 'Presto y también tengo deudas',
  },
];

export default function RegisterScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [dni, setDni] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('lender');

  const { signUp, isLoading, clearError } = useAuthStore();
  const { showSuccess, showError } = useToast();

  const handleRegister = async () => {
    // Validaciones básicas
    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      showError('Error', 'Por favor completa todos los campos obligatorios');
      return;
    }

    // Validar email con detección de typos
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      showError('Correo inválido', emailValidation.error || 'El correo no es válido');
      return;
    }

    // Validar DNI si se proporcionó
    const dniValidation = validateDNI(dni);
    if (!dniValidation.isValid) {
      showError('DNI inválido', dniValidation.error || 'El DNI no es válido');
      return;
    }

    // Validar teléfono si se proporcionó
    const phoneValidation = validatePhone(phone);
    if (!phoneValidation.isValid) {
      showError('Teléfono inválido', phoneValidation.error || 'El teléfono no es válido');
      return;
    }

    if (password !== confirmPassword) {
      showError('Error', 'Las contraseñas no coinciden');
      return;
    }

    if (password.length < 6) {
      showError('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }

    try {
      await signUp({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        dni: dni.trim() || undefined,
        phone: phone.trim() || undefined,
        role,
      });

      showSuccess('Registro exitoso', 'Tu cuenta ha sido creada');
      setTimeout(() => {
        router.replace('/(auth)/login');
      }, 1500);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'No se pudo crear la cuenta';
      showError('Error', errorMessage);
      clearError();
    }
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
            <Text style={styles.logo}>Cuotify</Text>
            <Text style={styles.subtitle}>Crea tu cuenta</Text>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.title}>Registro</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Nombre completo *</Text>
              <TextInput
                style={styles.input}
                placeholder="Tu nombre"
                placeholderTextColor={colors.text.disabled}
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Correo electrónico *</Text>
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

            <View style={styles.row}>
              <View style={[styles.inputContainer, styles.halfWidth]}>
                <Text style={styles.label}>DNI</Text>
                <TextInput
                  style={styles.input}
                  placeholder="12345678"
                  placeholderTextColor={colors.text.disabled}
                  value={dni}
                  onChangeText={setDni}
                  keyboardType="numeric"
                />
              </View>

              <View style={[styles.inputContainer, styles.halfWidth]}>
                <Text style={styles.label}>Teléfono</Text>
                <TextInput
                  style={styles.input}
                  placeholder="+54 9 11..."
                  placeholderTextColor={colors.text.disabled}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Contraseña *</Text>
              <PasswordInput
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor={colors.text.disabled}
                value={password}
                onChangeText={setPassword}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirmar contraseña *</Text>
              <PasswordInput
                placeholder="Repite tu contraseña"
                placeholderTextColor={colors.text.disabled}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>¿Qué tipo de usuario eres? *</Text>
              <View style={styles.roleContainer}>
                {ROLES.map((r) => (
                  <TouchableOpacity
                    key={r.value}
                    style={[
                      styles.roleOption,
                      role === r.value && styles.roleOptionSelected,
                    ]}
                    onPress={() => setRole(r.value)}
                  >
                    <Text
                      style={[
                        styles.roleLabel,
                        role === r.value && styles.roleLabelSelected,
                      ]}
                    >
                      {r.label}
                    </Text>
                    <Text
                      style={[
                        styles.roleDescription,
                        role === r.value && styles.roleDescriptionSelected,
                      ]}
                    >
                      {r.description}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.text.inverse} />
              ) : (
                <Text style={styles.buttonText}>Crear cuenta</Text>
              )}
            </TouchableOpacity>

            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>¿Ya tienes cuenta? </Text>
              <Link href="/(auth)/login" asChild>
                <TouchableOpacity>
                  <Text style={styles.loginLink}>Inicia sesión</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  logo: {
    fontSize: fontSize['3xl'],
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
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfWidth: {
    flex: 1,
  },
  roleContainer: {
    gap: spacing.sm,
  },
  roleOption: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
  },
  roleOptionSelected: {
    borderColor: colors.primary.main,
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
  },
  roleLabel: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semiBold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  roleLabelSelected: {
    color: colors.primary.main,
  },
  roleDescription: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  roleDescriptionSelected: {
    color: colors.primary.dark,
  },
  button: {
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
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
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  loginText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  loginLink: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semiBold,
    color: colors.primary.main,
  },
});
