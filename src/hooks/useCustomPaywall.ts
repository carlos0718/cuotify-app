import { useEffect, useState } from 'react';
import { Alert, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { PurchasesPackage } from 'react-native-purchases';
import { getAvailablePackages, purchasePackage, restorePurchases } from '../services/subscription';
import { useSubscriptionStore } from '../store';
import { useToast } from '../components';

/**
 * Paywall custom, usado en Expo Go (donde el nativo de RevenueCat no
 * funciona). Ver también usePremiumScreen, que decide cuál mostrar.
 */
export function useCustomPaywall() {
  const { setPremium } = useSubscriptionStore();
  const { showSuccess, showError } = useToast();

  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selected, setSelected] = useState<PurchasesPackage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    getAvailablePackages().then((pkgs) => {
      setPackages(pkgs);
      const annual = pkgs.find((p) => p.packageType === 'ANNUAL') ?? pkgs[0] ?? null;
      setSelected(annual);
      setIsLoading(false);
    });
  }, []);

  const annualPkg = packages.find((p) => p.packageType === 'ANNUAL') ?? null;
  const monthlyPkg = packages.find((p) => p.packageType === 'MONTHLY') ?? null;

  const handleScroll = (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const screenWidth = Dimensions.get('window').width;
    const slide = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
    setCurrentSlide(slide);
  };

  const handlePurchase = async () => {
    if (!selected) return;
    setIsPurchasing(true);
    try {
      const result = await purchasePackage(selected);
      if (result.success) {
        setPremium(true);
        showSuccess('¡Bienvenido a Cuotify Pro!', 'Ya tenés acceso a todas las funciones.');
        router.back();
      } else if (!result.userCancelled && result.error) {
        showError('Error', result.error);
      }
    } catch {
      showError('Error', 'No se pudo completar la compra.');
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      const result = await restorePurchases();
      if (result.success) {
        setPremium(true);
        showSuccess('Compra restaurada', 'Tu plan Pro fue reactivado.');
        router.back();
      } else {
        Alert.alert('Sin compras previas', 'No encontramos una compra anterior para restaurar.');
      }
    } catch {
      showError('Error', 'No se pudo restaurar la compra.');
    } finally {
      setIsRestoring(false);
    }
  };

  return {
    packages,
    selected,
    setSelected,
    isLoading,
    isPurchasing,
    isRestoring,
    currentSlide,
    annualPkg,
    monthlyPkg,
    handleScroll,
    handlePurchase,
    handleRestore,
  };
}
