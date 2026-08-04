import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, borderRadius, fontSize, fontWeight, shadow } from '../../../theme';

export default function SecuritySettingsScreen() {
  const handleChangePassword = () => {
    // La sesión ya está activa, se actualiza directo sin enlace por correo
    router.push('/(auth)/reset-password');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Seguridad</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
                Actualiza tu contraseña
              </Text>
            </View>
            <Text style={styles.arrow}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Información */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>🛡️ Seguridad de tus datos</Text>
          <Text style={styles.infoText}>
            Tu información se protege con cifrado en tránsito y en reposo.
            Nunca compartimos tus datos con terceros.
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
