import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { colors, spacing, borderRadius, fontSize, fontWeight, shadow } from '../../../theme';
import { useToast } from '../../../components';
import {
  canUseBiometric,
  isBiometricEnabled,
  enableBiometricAuth,
  disableBiometricAuth,
  authenticateWithBiometric,
} from '../../../services/auth';
import { useAuthStore } from '../../../store';

// Icono de flecha atrás
function BackIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 12H5M5 12L12 19M5 12L12 5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Icono de Face ID / Huella
function BiometricIcon({ color, size = 24 }: { color: string; size?: number }) {
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

export default function SecuritySettingsScreen() {
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const { showSuccess, showError } = useToast();
  const { profile } = useAuthStore();

  useEffect(() => {
    loadBiometricStatus();
  }, []);

  const loadBiometricStatus = async () => {
    try {
      const status = await canUseBiometric();
      setBiometricAvailable(status.available);
      setBiometricEnabled(status.enabled);
      setBiometricType(status.type);
    } catch (error) {
      console.error('Error loading biometric status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleBiometric = async (value: boolean) => {
    if (value) {
      // Habilitar biometría - primero autenticar
      Alert.alert(
        `Activar ${biometricType}`,
        `Para activar ${biometricType}, necesitamos verificar tu identidad y guardar tus credenciales de forma segura.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Continuar',
            onPress: async () => {
              // Pedir contraseña para guardar credenciales
              Alert.prompt(
                'Ingresa tu contraseña',
                'Necesitamos tu contraseña para guardarla de forma segura',
                async (password) => {
                  if (password && profile?.email) {
                    const success = await enableBiometricAuth(profile.email, password);
                    if (success) {
                      setBiometricEnabled(true);
                      showSuccess('Activado', `${biometricType} ha sido activado`);
                    } else {
                      showError('Error', 'No se pudo activar la biometría');
                    }
                  }
                },
                'secure-text'
              );
            },
          },
        ]
      );
    } else {
      // Deshabilitar biometría
      Alert.alert(
        `Desactivar ${biometricType}`,
        'Tus credenciales guardadas serán eliminadas. ¿Continuar?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Desactivar',
            style: 'destructive',
            onPress: async () => {
              const success = await disableBiometricAuth();
              if (success) {
                setBiometricEnabled(false);
                showSuccess('Desactivado', `${biometricType} ha sido desactivado`);
              } else {
                showError('Error', 'No se pudo desactivar la biometría');
              }
            },
          },
        ]
      );
    }
  };

  const handleChangePassword = () => {
    Alert.alert(
      'Cambiar contraseña',
      '¿Quieres recibir un enlace para cambiar tu contraseña?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar enlace',
          onPress: () => {
            router.push('/(auth)/forgot-password');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <BackIcon color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Seguridad</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Sección de biometría */}
        <Text style={styles.sectionTitle}>Inicio de sesión rápido</Text>
        <View style={styles.section}>
          {biometricAvailable ? (
            <View style={styles.settingsItem}>
              <View style={styles.iconContainer}>
                <BiometricIcon color={colors.primary.main} />
              </View>
              <View style={styles.itemContent}>
                <Text style={styles.itemTitle}>Usar {biometricType}</Text>
                <Text style={styles.itemSubtitle}>
                  Inicia sesión con {biometricType} de forma rápida y segura
                </Text>
              </View>
              <Switch
                value={biometricEnabled}
                onValueChange={handleToggleBiometric}
                trackColor={{
                  false: colors.border,
                  true: colors.primary.main + '50',
                }}
                thumbColor={biometricEnabled ? colors.primary.main : colors.text.disabled}
                disabled={isLoading}
              />
            </View>
          ) : (
            <View style={styles.settingsItem}>
              <View style={[styles.iconContainer, styles.iconContainerDisabled]}>
                <BiometricIcon color={colors.text.disabled} />
              </View>
              <View style={styles.itemContent}>
                <Text style={[styles.itemTitle, styles.itemTitleDisabled]}>
                  Biometría no disponible
                </Text>
                <Text style={styles.itemSubtitle}>
                  Tu dispositivo no soporta autenticación biométrica o no está configurada
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Sección de contraseña */}
        <Text style={styles.sectionTitle}>Contraseña</Text>
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.settingsItem}
            onPress={handleChangePassword}
            activeOpacity={0.7}
          >
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>🔑</Text>
            </View>
            <View style={styles.itemContent}>
              <Text style={styles.itemTitle}>Cambiar contraseña</Text>
              <Text style={styles.itemSubtitle}>
                Recibe un enlace para actualizar tu contraseña
              </Text>
            </View>
            <Text style={styles.arrow}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Información */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>🛡️ Seguridad de tus datos</Text>
          <Text style={styles.infoText}>
            Tus credenciales se guardan de forma encriptada en el almacenamiento seguro de tu dispositivo.
            Nunca compartimos tu información con terceros.
          </Text>
        </View>

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: {
    padding: spacing.xs,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semiBold,
    color: colors.text.secondary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadow.sm,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary.main + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  iconContainerDisabled: {
    backgroundColor: colors.background,
  },
  icon: {
    fontSize: fontSize.lg,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
  },
  itemTitleDisabled: {
    color: colors.text.disabled,
  },
  itemSubtitle: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  arrow: {
    fontSize: fontSize.lg,
    color: colors.text.disabled,
  },
  infoCard: {
    backgroundColor: colors.primary.main + '10',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginTop: spacing.xl,
  },
  infoTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semiBold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  infoText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
});
