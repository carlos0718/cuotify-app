import { useEffect } from 'react';
import { router } from 'expo-router';
import RevenueCatUI from 'react-native-purchases-ui';

/**
 * Presenta el Customer Center gestionado por RevenueCat al montar, y vuelve
 * atrás cuando se cierra (o si falla al presentarlo).
 */
export function useCustomerCenter() {
  useEffect(() => {
    const openCustomerCenter = async () => {
      try {
        await RevenueCatUI.presentCustomerCenter();
      } finally {
        router.back();
      }
    };

    // El `finally` ya garantiza el router.back() pase lo que pase -- este
    // catch solo evita una unhandled promise rejection si presentCustomerCenter falla.
    openCustomerCenter().catch(() => {});
  }, []);
}
