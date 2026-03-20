import Purchases, { LOG_LEVEL, PurchasesPackage } from 'react-native-purchases';
import { Platform } from 'react-native';

// Configurá estos IDs en RevenueCat dashboard y en App Store / Play Store
const REVENUECAT_API_KEY = Platform.select({
  ios: 'appl_REPLACE_WITH_YOUR_IOS_KEY',
  android: 'goog_REPLACE_WITH_YOUR_ANDROID_KEY',
}) ?? '';

export const ENTITLEMENT_PREMIUM = 'premium';

export async function initializePurchases(userId: string): Promise<void> {
  try {
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    Purchases.configure({ apiKey: REVENUECAT_API_KEY, appUserID: userId });
  } catch (error) {
    console.error('Error inicializando RevenueCat:', error);
  }
}

export async function isPremium(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo.entitlements.active[ENTITLEMENT_PREMIUM] !== undefined;
  } catch {
    return false;
  }
}

export async function getAvailablePackages(): Promise<PurchasesPackage[]> {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current?.availablePackages ?? [];
  } catch {
    return [];
  }
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<boolean> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo.entitlements.active[ENTITLEMENT_PREMIUM] !== undefined;
  } catch (error: unknown) {
    // El usuario canceló la compra — no es un error real
    if ((error as { userCancelled?: boolean })?.userCancelled) return false;
    throw error;
  }
}

export async function restorePurchases(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return customerInfo.entitlements.active[ENTITLEMENT_PREMIUM] !== undefined;
  } catch {
    return false;
  }
}
