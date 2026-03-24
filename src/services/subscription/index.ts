import Purchases, {
  LOG_LEVEL,
  PurchasesPackage,
  CustomerInfo,
  PurchasesError,
  PURCHASES_ERROR_CODE,
} from 'react-native-purchases';
import { Platform } from 'react-native';

// API key de RevenueCat (test key — reemplazar con producción al publicar)
const REVENUECAT_API_KEY = Platform.select({
  ios: 'test_JchOkvEzlhSdWAJnCRZjXxRBAkU',
  android: 'test_JchOkvEzlhSdWAJnCRZjXxRBAkU',
}) ?? 'test_JchOkvEzlhSdWAJnCRZjXxRBAkU';

// El entitlement configurado en el dashboard de RevenueCat
export const ENTITLEMENT_ID = 'Cuotify Pro';

// IDs de los productos tal como están configurados en RevenueCat
export const PRODUCT_IDS = {
  monthly: 'monthly',
  yearly: 'yearly',
  lifetime: 'lifetime',
} as const;

// ─────────────────────────────────────────────
// Inicialización
// ─────────────────────────────────────────────

export async function initializePurchases(userId: string): Promise<void> {
  try {
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }

    Purchases.configure({
      apiKey: REVENUECAT_API_KEY,
      appUserID: userId, // Usar el ID de Supabase como appUserID para consistencia
    });

    console.log('[RevenueCat] Inicializado para usuario:', userId);
  } catch (error) {
    console.error('[RevenueCat] Error al inicializar:', error);
  }
}

// ─────────────────────────────────────────────
// Customer Info
// ─────────────────────────────────────────────

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  try {
    return await Purchases.getCustomerInfo();
  } catch (error) {
    console.error('[RevenueCat] Error al obtener CustomerInfo:', error);
    return null;
  }
}

// ─────────────────────────────────────────────
// Chequeo de entitlement "Cuotify Pro"
// ─────────────────────────────────────────────

export async function isPremium(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
  } catch {
    return false;
  }
}

export function isPremiumFromInfo(customerInfo: CustomerInfo): boolean {
  return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
}

// ─────────────────────────────────────────────
// Offerings y paquetes
// ─────────────────────────────────────────────

export async function getAvailablePackages(): Promise<PurchasesPackage[]> {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current?.availablePackages ?? [];
  } catch (error) {
    console.error('[RevenueCat] Error al obtener offerings:', error);
    return [];
  }
}

// ─────────────────────────────────────────────
// Compra
// ─────────────────────────────────────────────

export type PurchaseResult =
  | { success: true; customerInfo: CustomerInfo }
  | { success: false; userCancelled: boolean; error?: string };

export async function purchasePackage(pkg: PurchasesPackage): Promise<PurchaseResult> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { success: true, customerInfo };
  } catch (error) {
    const purchasesError = error as PurchasesError;

    if (purchasesError.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
      return { success: false, userCancelled: true };
    }

    console.error('[RevenueCat] Error en compra:', purchasesError.message);
    return {
      success: false,
      userCancelled: false,
      error: purchasesError.message ?? 'Error desconocido',
    };
  }
}

// ─────────────────────────────────────────────
// Restaurar compras
// ─────────────────────────────────────────────

export async function restorePurchases(): Promise<PurchaseResult> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return { success: true, customerInfo };
  } catch (error) {
    const purchasesError = error as PurchasesError;
    console.error('[RevenueCat] Error al restaurar:', purchasesError.message);
    return {
      success: false,
      userCancelled: false,
      error: purchasesError.message ?? 'Error al restaurar',
    };
  }
}

// ─────────────────────────────────────────────
// Listener de cambios en CustomerInfo (tiempo real)
// ─────────────────────────────────────────────

export function addCustomerInfoListener(
  callback: (customerInfo: CustomerInfo) => void
): () => void {
  Purchases.addCustomerInfoUpdateListener(callback);
  // Retorna función para remover el listener (llamar en cleanup)
  return () => Purchases.removeCustomerInfoUpdateListener(callback);
}
