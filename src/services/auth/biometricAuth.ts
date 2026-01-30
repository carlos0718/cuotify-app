import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const CREDENTIALS_KEY = 'cuotify_biometric_credentials';
const BIOMETRIC_ENABLED_KEY = 'cuotify_biometric_enabled';

export interface StoredCredentials {
  email: string;
  password: string;
}

export interface BiometricAuthResult {
  success: boolean;
  error?: string;
  credentials?: StoredCredentials;
}

/**
 * Verifica si el dispositivo soporta autenticación biométrica
 */
export async function isBiometricSupported(): Promise<boolean> {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  return compatible;
}

/**
 * Verifica si hay datos biométricos registrados en el dispositivo
 */
export async function isBiometricEnrolled(): Promise<boolean> {
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return enrolled;
}

/**
 * Obtiene el tipo de autenticación biométrica disponible
 */
export async function getBiometricType(): Promise<string> {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return 'Face ID';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return 'Huella digital';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return 'Iris';
  }

  return 'Biométrico';
}

/**
 * Verifica si la autenticación biométrica está habilitada para la app
 */
export async function isBiometricEnabled(): Promise<boolean> {
  try {
    const enabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
    return enabled === 'true';
  } catch {
    return false;
  }
}

/**
 * Guarda las credenciales de forma segura y habilita biometría
 */
export async function enableBiometricAuth(
  email: string,
  password: string
): Promise<boolean> {
  try {
    const credentials: StoredCredentials = { email, password };
    await SecureStore.setItemAsync(
      CREDENTIALS_KEY,
      JSON.stringify(credentials)
    );
    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
    return true;
  } catch (error) {
    console.error('Error al guardar credenciales:', error);
    return false;
  }
}

/**
 * Deshabilita la autenticación biométrica y elimina credenciales
 */
export async function disableBiometricAuth(): Promise<boolean> {
  try {
    await SecureStore.deleteItemAsync(CREDENTIALS_KEY);
    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'false');
    return true;
  } catch (error) {
    console.error('Error al eliminar credenciales:', error);
    return false;
  }
}

/**
 * Autentica al usuario usando biometría y retorna las credenciales guardadas
 */
export async function authenticateWithBiometric(): Promise<BiometricAuthResult> {
  try {
    // Verificar si está habilitado
    const enabled = await isBiometricEnabled();
    if (!enabled) {
      return {
        success: false,
        error: 'La autenticación biométrica no está habilitada',
      };
    }

    // Verificar soporte
    const supported = await isBiometricSupported();
    if (!supported) {
      return {
        success: false,
        error: 'Tu dispositivo no soporta autenticación biométrica',
      };
    }

    // Verificar que haya biometría registrada
    const enrolled = await isBiometricEnrolled();
    if (!enrolled) {
      return {
        success: false,
        error: 'No hay datos biométricos registrados en el dispositivo',
      };
    }

    // Obtener tipo de biometría para el mensaje
    const biometricType = await getBiometricType();

    // Solicitar autenticación
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: `Iniciar sesión con ${biometricType}`,
      cancelLabel: 'Cancelar',
      disableDeviceFallback: false,
      fallbackLabel: 'Usar contraseña',
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error === 'user_cancel'
          ? 'Autenticación cancelada'
          : 'No se pudo verificar tu identidad',
      };
    }

    // Obtener credenciales guardadas
    const credentialsJson = await SecureStore.getItemAsync(CREDENTIALS_KEY);
    if (!credentialsJson) {
      return {
        success: false,
        error: 'No hay credenciales guardadas',
      };
    }

    const credentials: StoredCredentials = JSON.parse(credentialsJson);
    return {
      success: true,
      credentials,
    };
  } catch (error) {
    console.error('Error en autenticación biométrica:', error);
    return {
      success: false,
      error: 'Error al autenticar',
    };
  }
}

/**
 * Verifica si se puede mostrar la opción de biometría
 */
export async function canUseBiometric(): Promise<{
  available: boolean;
  enabled: boolean;
  type: string;
}> {
  const supported = await isBiometricSupported();
  const enrolled = await isBiometricEnrolled();
  const enabled = await isBiometricEnabled();
  const type = supported ? await getBiometricType() : '';

  return {
    available: supported && enrolled,
    enabled,
    type,
  };
}
