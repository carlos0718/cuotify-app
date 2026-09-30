import { useEffect } from 'react';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { isPremium } from '../services/subscription';
import { useSubscriptionStore } from '../store';

/**
 * Decide si mostrar el paywall nativo de RevenueCat (producción) o el
 * paywall custom (Expo Go, donde el nativo no funciona). En Expo Go, el
 * caller debe renderizar el paywall custom (ver useCustomPaywall).
 */
export function usePremiumScreen() {
  const { setPremium } = useSubscriptionStore();

  // En Expo Go el Paywall nativo no funciona — se usa el custom
  const isExpoGo = Constants.executionEnvironment === 'storeClient';

  useEffect(() => {
    if (isExpoGo) return;

    const presentNativePaywall = async () => {
      try {
        const result = await RevenueCatUI.presentPaywallIfNeeded({
          requiredEntitlementIdentifier: 'Cuotify Pro',
        });
        switch (result) {
          case PAYWALL_RESULT.PURCHASED:
          case PAYWALL_RESULT.RESTORED: {
            const active = await isPremium();
            setPremium(active);
            router.back();
            break;
          }
          case PAYWALL_RESULT.NOT_PRESENTED:
            router.back();
            break;
          default:
            router.back();
            break;
        }
      } catch {
        router.back();
      }
    };

    presentNativePaywall();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpoGo]);

  return { isExpoGo, setPremium };
}
