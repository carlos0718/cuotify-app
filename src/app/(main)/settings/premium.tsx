import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { PurchasesPackage } from 'react-native-purchases';
import { colors, spacing, borderRadius, fontSize, fontWeight, shadow } from '../../../theme';
import { getAvailablePackages, purchasePackage, restorePurchases } from '../../../services/subscription';
import { useSubscriptionStore } from '../../../store';
import { useToast } from '../../../components';

const BENEFITS = [
  { icon: '∞', label: 'Préstamos y deudas ilimitadas' },
  { icon: '📄', label: 'Exportar cronograma a PDF' },
  { icon: '💬', label: 'Enviar recordatorio por WhatsApp' },
  { icon: '🔓', label: 'Sin restricciones, para siempre' },
];

export default function PremiumScreen() {
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selected, setSelected] = useState<PurchasesPackage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const { setPremium } = useSubscriptionStore();
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    getAvailablePackages().then((pkgs) => {
      setPackages(pkgs);
      // Pre-seleccionar el anual si existe
      const annual = pkgs.find((p) => p.packageType === 'ANNUAL') ?? pkgs[0] ?? null;
      setSelected(annual);
      setIsLoading(false);
    });
  }, []);

  const handlePurchase = async () => {
    if (!selected) return;
    setIsPurchasing(true);
    try {
      const success = await purchasePackage(selected);
      if (success) {
        setPremium(true);
        showSuccess('¡Bienvenido a Premium!', 'Ya tenés acceso a todas las funciones.');
        router.back();
      }
    } catch {
      showError('Error', 'No se pudo completar la compra. Intentá de nuevo.');
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      const success = await restorePurchases();
      if (success) {
        setPremium(true);
        showSuccess('Compra restaurada', 'Tu plan Premium fue reactivado.');
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
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cuotify Premium</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>⭐</Text>
          <Text style={styles.heroTitle}>Desbloqueá todo el potencial</Text>
          <Text style={styles.heroSubtitle}>
            Sin límites. Sin restricciones. Con herramientas profesionales.
          </Text>
        </View>

        {/* Beneficios */}
        <View style={styles.benefitsCard}>
          {BENEFITS.map((b) => (
            <View key={b.label} style={styles.benefitRow}>
              <Text style={styles.benefitIcon}>{b.icon}</Text>
              <Text style={styles.benefitLabel}>{b.label}</Text>
            </View>
          ))}
        </View>

        {/* Selector de plan */}
        {isLoading ? (
          <ActivityIndicator color={colors.primary.main} style={{ marginVertical: spacing.xl }} />
        ) : packages.length === 0 ? (
          <Text style={styles.noPackages}>
            Productos no disponibles en este momento.{'\n'}Intentá más tarde.
          </Text>
        ) : (
          <View style={styles.packagesContainer}>
            {packages.map((pkg) => {
              const isSelected = selected?.identifier === pkg.identifier;
              const isAnnual = pkg.packageType === 'ANNUAL';
              return (
                <TouchableOpacity
                  key={pkg.identifier}
                  style={[styles.packageCard, isSelected && styles.packageCardSelected]}
                  onPress={() => setSelected(pkg)}
                >
                  {isAnnual && (
                    <View style={styles.savingBadge}>
                      <Text style={styles.savingBadgeText}>Mejor valor</Text>
                    </View>
                  )}
                  <Text style={[styles.packageTitle, isSelected && styles.packageTitleSelected]}>
                    {isAnnual ? 'Anual' : 'Mensual'}
                  </Text>
                  <Text style={[styles.packagePrice, isSelected && styles.packagePriceSelected]}>
                    {pkg.product.priceString}
                  </Text>
                  <Text style={styles.packagePeriod}>
                    {isAnnual ? 'por año' : 'por mes'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Botón de compra */}
        <TouchableOpacity
          style={[styles.purchaseButton, (!selected || isPurchasing) && styles.purchaseButtonDisabled]}
          onPress={handlePurchase}
          disabled={!selected || isPurchasing}
        >
          {isPurchasing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.purchaseButtonText}>
              {selected ? `Activar Premium` : 'Seleccioná un plan'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Restaurar */}
        <TouchableOpacity style={styles.restoreButton} onPress={handleRestore} disabled={isRestoring}>
          {isRestoring ? (
            <ActivityIndicator color={colors.text.disabled} size="small" />
          ) : (
            <Text style={styles.restoreText}>Restaurar compra anterior</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.legalText}>
          El pago se cargará a tu cuenta de la tienda al confirmar la compra. La suscripción se
          renueva automáticamente salvo que se cancele 24 hs antes del fin del período.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: { width: 70 },
  backButtonText: { fontSize: fontSize.sm, color: colors.primary.main, fontWeight: fontWeight.medium },
  headerTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text.primary },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  hero: { alignItems: 'center', marginBottom: spacing.xl },
  heroEmoji: { fontSize: 48, marginBottom: spacing.md },
  heroTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  heroSubtitle: {
    fontSize: fontSize.base,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  benefitsCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow.sm,
  },
  benefitRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  benefitIcon: { fontSize: 20, width: 32 },
  benefitLabel: { fontSize: fontSize.base, color: colors.text.primary, flex: 1 },
  packagesContainer: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  packageCard: {
    flex: 1,
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    alignItems: 'center',
    position: 'relative',
  },
  packageCardSelected: { borderColor: colors.primary.main, backgroundColor: 'rgba(99,102,241,0.08)' },
  savingBadge: {
    position: 'absolute',
    top: -10,
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  savingBadgeText: { fontSize: fontSize.xs, color: '#fff', fontWeight: fontWeight.semiBold },
  packageTitle: { fontSize: fontSize.sm, color: colors.text.secondary, marginBottom: spacing.xs, marginTop: spacing.sm },
  packageTitleSelected: { color: colors.primary.main, fontWeight: fontWeight.semiBold },
  packagePrice: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text.primary },
  packagePriceSelected: { color: colors.primary.main },
  packagePeriod: { fontSize: fontSize.xs, color: colors.text.disabled },
  noPackages: { textAlign: 'center', color: colors.text.secondary, marginVertical: spacing.xl, lineHeight: 22 },
  purchaseButton: {
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadow.md,
  },
  purchaseButtonDisabled: { opacity: 0.6 },
  purchaseButtonText: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: '#fff' },
  restoreButton: { alignItems: 'center', paddingVertical: spacing.sm, marginBottom: spacing.lg },
  restoreText: { fontSize: fontSize.sm, color: colors.text.secondary },
  legalText: { fontSize: fontSize.xs, color: colors.text.disabled, textAlign: 'center', lineHeight: 18 },
});
