import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { PurchasesPackage } from 'react-native-purchases';
import { colors, spacing, borderRadius, fontSize, fontWeight, shadow } from '../../../theme';
import {
  getAvailablePackages,
  purchasePackage,
  restorePurchases,
  isPremium,
} from '../../../services/subscription';
import { useSubscriptionStore } from '../../../store';
import { useToast } from '../../../components';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// En Expo Go el Paywall nativo no funciona — usamos el custom
const isExpoGo = Constants.executionEnvironment === 'storeClient';

const SLIDES = [
  {
    emoji: '∞',
    emojiBackground: '#1A2744',
    title: 'Sin Límites',
    subtitle: 'Creá préstamos y deudas personales sin restricciones',
  },
  {
    emoji: '📄',
    emojiBackground: '#1A2744',
    title: 'Exportar a PDF',
    subtitle: 'Compartí el cronograma de pagos como recibo formal',
  },
  {
    emoji: '💬',
    emojiBackground: '#1A2744',
    title: 'Recordatorio WhatsApp',
    subtitle: 'Avisá al prestatario con un mensaje pre-armado',
  },
  {
    emoji: '📊',
    emojiBackground: '#1A2744',
    title: 'Dashboard Pro',
    subtitle: 'Visualizá tus intereses y ganancias por mes',
  },
];

export default function PremiumScreen() {
  const { setPremium } = useSubscriptionStore();

  useEffect(() => {
    if (!isExpoGo) {
      presentNativePaywall();
    }
  }, []);

  const presentNativePaywall = async () => {
    try {
      const result = await RevenueCatUI.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: 'Cuotify Pro',
      });
      switch (result) {
        case PAYWALL_RESULT.PURCHASED:
        case PAYWALL_RESULT.RESTORED:
          const active = await isPremium();
          setPremium(active);
          router.back();
          break;
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

  if (!isExpoGo) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary.main} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return <CustomPaywall setPremium={setPremium} />;
}

// ─────────────────────────────────────────────────────────
// Paywall custom (solo para Expo Go / testing)
// ─────────────────────────────────────────────────────────
function CustomPaywall({ setPremium }: { setPremium: (v: boolean) => void }) {
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selected, setSelected] = useState<PurchasesPackage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const slideRef = useRef<ScrollView>(null);
  const { showSuccess, showError } = useToast();

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
    const slide = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.logoText}>Cuotify</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton} hitSlop={12}>
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* ── Feature carousel ── */}
      <ScrollView
        ref={slideRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        style={styles.carousel}
      >
        {SLIDES.map((slide, i) => (
          <View key={i} style={styles.slide}>
            {/* Dot indicators */}
            <View style={styles.dots}>
              {SLIDES.map((_, di) => (
                <View key={di} style={[styles.dot, di === currentSlide && styles.dotActive]} />
              ))}
            </View>

            <Text style={styles.slideTitle}>{slide.title}</Text>
            <Text style={styles.slideSubtitle}>{slide.subtitle}</Text>

            {/* Illustration */}
            <View style={[styles.illustrationContainer, { backgroundColor: slide.emojiBackground }]}>
              <Text style={styles.illustrationEmoji}>{slide.emoji}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* ── Price options ── */}
      <View style={styles.priceSection}>
        {isLoading ? (
          <ActivityIndicator color={colors.primary.main} style={{ marginVertical: spacing.lg }} />
        ) : (
          <>
            {/* Annual */}
            {annualPkg && (
              <TouchableOpacity
                style={[styles.priceCard, selected?.identifier === annualPkg.identifier && styles.priceCardSelected]}
                onPress={() => setSelected(annualPkg)}
                activeOpacity={0.8}
              >
                <View style={styles.savingsBadge}>
                  <Text style={styles.savingsBadgeText}>19% OFF</Text>
                </View>
                <View style={styles.radioOuter}>
                  {selected?.identifier === annualPkg.identifier && <View style={styles.radioInner} />}
                </View>
                <View style={styles.priceCardBody}>
                  <Text style={[styles.planLabel, selected?.identifier === annualPkg.identifier && styles.planLabelSelected]}>
                    Anual
                  </Text>
                  {annualPkg.product.introPrice?.priceString ? (
                    <Text style={styles.planSubLabel}>
                      Solo {annualPkg.product.introPrice.priceString}/mes
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.planPrice, selected?.identifier === annualPkg.identifier && styles.planPriceSelected]}>
                  {annualPkg.product.priceString}/año
                </Text>
              </TouchableOpacity>
            )}

            {/* Monthly */}
            {monthlyPkg && (
              <TouchableOpacity
                style={[styles.priceCard, selected?.identifier === monthlyPkg.identifier && styles.priceCardSelected]}
                onPress={() => setSelected(monthlyPkg)}
                activeOpacity={0.8}
              >
                <View style={styles.radioOuter}>
                  {selected?.identifier === monthlyPkg.identifier && <View style={styles.radioInner} />}
                </View>
                <View style={styles.priceCardBody}>
                  <Text style={[styles.planLabel, selected?.identifier === monthlyPkg.identifier && styles.planLabelSelected]}>
                    Mensual
                  </Text>
                </View>
                <Text style={[styles.planPrice, selected?.identifier === monthlyPkg.identifier && styles.planPriceSelected]}>
                  {monthlyPkg.product.priceString}/mes
                </Text>
              </TouchableOpacity>
            )}

            {packages.length === 0 && (
              <Text style={styles.noPackages}>Productos no disponibles en este momento.</Text>
            )}
          </>
        )}

        {/* Continue button */}
        <TouchableOpacity
          style={[styles.continueButton, (!selected || isPurchasing) && styles.continueButtonDisabled]}
          onPress={handlePurchase}
          disabled={!selected || isPurchasing}
          activeOpacity={0.85}
        >
          {isPurchasing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.continueButtonText}>Continuar</Text>
          )}
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity onPress={handleRestore} disabled={isRestoring}>
            {isRestoring ? (
              <ActivityIndicator color={colors.text.disabled} size="small" />
            ) : (
              <Text style={styles.footerLink}>Restaurar Compras</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.footerSeparator}>|</Text>
          <TouchableOpacity onPress={() => Linking.openURL('https://cuotify.app/terms')}>
            <Text style={styles.footerLink}>Términos</Text>
          </TouchableOpacity>
          <Text style={styles.footerSeparator}>|</Text>
          <TouchableOpacity onPress={() => Linking.openURL('https://cuotify.app/privacy')}>
            <Text style={styles.footerLink}>Privacidad</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    position: 'relative',
  },
  logoText: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.primary.main,
    letterSpacing: 0.5,
  },
  closeButton: {
    position: 'absolute',
    right: spacing.lg,
    top: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  closeIcon: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    fontWeight: fontWeight.bold,
  },

  // ── Carousel ──
  carousel: {
    flex: 1,
  },
  slide: {
    width: SCREEN_WIDTH,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.primary.main,
  },
  slideTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  slideSubtitle: {
    fontSize: fontSize.base,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  illustrationContainer: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.md,
  },
  illustrationEmoji: {
    fontSize: 80,
  },

  // ── Price section ──
  priceSection: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  priceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.xl,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    position: 'relative',
    overflow: 'visible',
    ...shadow.sm,
  },
  priceCardSelected: {
    borderColor: colors.primary.main,
    backgroundColor: colors.primary.main + '0D',
  },
  savingsBadge: {
    position: 'absolute',
    top: -10,
    right: spacing.md,
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  savingsBadgeText: {
    fontSize: fontSize.xs,
    color: '#fff',
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary.main,
  },
  priceCardBody: {
    flex: 1,
  },
  planLabel: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semiBold,
    color: colors.text.primary,
  },
  planLabelSelected: {
    color: colors.primary.main,
  },
  planSubLabel: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  planPrice: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.text.secondary,
  },
  planPriceSelected: {
    color: colors.primary.main,
  },
  noPackages: {
    textAlign: 'center',
    color: colors.text.secondary,
    marginVertical: spacing.md,
  },

  // ── Continue button ──
  continueButton: {
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    marginTop: spacing.sm,
    ...shadow.md,
  },
  continueButtonDisabled: {
    opacity: 0.55,
  },
  continueButtonText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: '#fff',
    letterSpacing: 0.3,
  },

  // ── Footer ──
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  footerLink: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    fontWeight: fontWeight.medium,
  },
  footerSeparator: {
    fontSize: fontSize.xs,
    color: colors.text.disabled,
  },
});
