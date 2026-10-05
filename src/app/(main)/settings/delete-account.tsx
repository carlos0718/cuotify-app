import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Modal, PasswordInput } from '../../../components';
import { colors, spacing, borderRadius, fontSize, fontWeight, shadow } from '../../../theme';
import { useDeleteAccountForm } from '../../../hooks';

const DELETED_ITEMS = [
  'Todos tus préstamos y su cronograma de cuotas',
  'Tus deudas personales y sus pagos',
  'Los prestatarios que registraste',
  'Tus notificaciones y comprobantes subidos',
  'Tu perfil y toda tu información personal',
];

export default function DeleteAccountScreen() {
  const {
    premium,
    password,
    setPassword,
    isVerifying,
    isDeleting,
    isBusy,
    showConfirmModal,
    setShowConfirmModal,
    handleRequestDelete,
    handleConfirmDelete,
  } = useDeleteAccountForm();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Eliminar cuenta</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.warningCard}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <Text style={styles.warningTitle}>Esta acción no se puede deshacer</Text>
          <Text style={styles.warningText}>
            Al eliminar tu cuenta se borra permanentemente:
          </Text>
          {DELETED_ITEMS.map((item) => (
            <View key={item} style={styles.bulletRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.bulletText}>{item}</Text>
            </View>
          ))}
        </View>

        {premium && (
          <View style={styles.premiumCard}>
            <Text style={styles.premiumTitle}>⭐ Tenés Cuotify Pro activo</Text>
            <Text style={styles.premiumText}>
              Eliminar tu cuenta no cancela tu suscripción. Para evitar que se te siga
              cobrando, cancelala primero desde la tienda de apps (App Store o Google
              Play) antes de continuar.
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Confirmá tu contraseña</Text>
        <View style={styles.section}>
          <PasswordInput
            placeholder="Tu contraseña"
            placeholderTextColor={colors.text.disabled}
            value={password}
            onChangeText={setPassword}
            editable={!isBusy}
          />
        </View>

        <TouchableOpacity
          style={[styles.deleteButton, isBusy && styles.deleteButtonDisabled]}
          onPress={handleRequestDelete}
          disabled={isBusy}
          activeOpacity={0.8}
        >
          {isVerifying || isDeleting ? (
            <ActivityIndicator color={colors.text.inverse} />
          ) : (
            <Text style={styles.deleteButtonText}>Eliminar mi cuenta</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: spacing.xl }} />
      </ScrollView>

      <Modal
        visible={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="¿Eliminar tu cuenta?"
        message="Esta es tu última oportunidad para cancelar. Una vez que confirmes, tu cuenta y todos tus datos se borran de forma permanente e irreversible."
        icon="🗑️"
        accentColor={colors.error}
        buttons={[
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Sí, eliminar cuenta', style: 'destructive', onPress: handleConfirmDelete },
        ]}
      />
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
  backArrow: {
    fontSize: fontSize.xl,
    color: colors.text.primary,
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
  warningCard: {
    backgroundColor: colors.error + '10',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginTop: spacing.md,
    alignItems: 'center',
  },
  warningIcon: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  warningTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  warningText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
  },
  bulletRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    marginBottom: spacing.xs,
  },
  bullet: {
    fontSize: fontSize.sm,
    color: colors.error,
    marginRight: spacing.sm,
  },
  bulletText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.text.primary,
    lineHeight: 20,
  },
  premiumCard: {
    backgroundColor: colors.warning + '15',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  premiumTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semiBold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  premiumText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
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
    padding: spacing.md,
    ...shadow.sm,
  },
  deleteButton: {
    backgroundColor: colors.error,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  deleteButtonDisabled: {
    opacity: 0.7,
  },
  deleteButtonText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semiBold,
    color: colors.text.inverse,
  },
});
