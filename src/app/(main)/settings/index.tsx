import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '../../../store';
import { colors, spacing, borderRadius, fontSize, fontWeight, shadow } from '../../../theme';

function SettingsItem({
  icon,
  title,
  subtitle,
  onPress,
  showArrow = true,
  danger = false,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  showArrow?: boolean;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.settingsItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, danger && styles.iconContainerDanger]}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <View style={styles.itemContent}>
        <Text style={[styles.itemTitle, danger && styles.itemTitleDanger]}>
          {title}
        </Text>
        {subtitle && <Text style={styles.itemSubtitle}>{subtitle}</Text>}
      </View>
      {showArrow && <Text style={styles.arrow}>→</Text>}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const { profile, signOut } = useAuthStore();

  const handleLogout = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro que deseas cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const roleLabel = {
    lender: 'Prestamista',
    borrower: 'Prestatario',
    both: 'Prestamista y Prestatario',
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Ajustes</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Perfil */}
        <TouchableOpacity
          style={styles.profileCard}
          onPress={() => router.push('/(main)/settings/profile')}
          activeOpacity={0.7}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile?.full_name || 'Usuario'}</Text>
            <Text style={styles.profileEmail}>{profile?.email}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>
                {roleLabel[profile?.role || 'borrower']}
              </Text>
            </View>
          </View>
          <Text style={styles.profileArrow}>→</Text>
        </TouchableOpacity>

        {/* Sección de cuenta */}
        <Text style={styles.sectionTitle}>Cuenta</Text>
        <View style={styles.section}>
          <SettingsItem
            icon="👤"
            title="Editar perfil"
            subtitle="Nombre, teléfono, DNI"
            onPress={() => router.push('/(main)/settings/profile')}
          />
          <SettingsItem
            icon="🔔"
            title="Notificaciones"
            subtitle="Alertas y recordatorios"
            onPress={() => router.push('/(main)/settings/notifications')}
          />
          <SettingsItem
            icon="🔒"
            title="Seguridad"
            subtitle="Contraseña, Face ID / Huella"
            onPress={() => router.push('/(main)/settings/security')}
          />
        </View>

        {/* Sección de preferencias */}
        <Text style={styles.sectionTitle}>Preferencias</Text>
        <View style={styles.section}>
          <SettingsItem
            icon="🌐"
            title="Idioma"
            subtitle="Español"
            onPress={() => Alert.alert('Idioma', 'Actualmente solo disponible en español')}
          />
          <SettingsItem
            icon="💱"
            title="Moneda"
            subtitle="USD ($)"
            onPress={() => Alert.alert('Próximamente', 'Esta función estará disponible pronto')}
          />
        </View>

        {/* Sección de soporte */}
        <Text style={styles.sectionTitle}>Soporte</Text>
        <View style={styles.section}>
          <SettingsItem
            icon="❓"
            title="Ayuda"
            subtitle="Preguntas frecuentes"
            onPress={() => Alert.alert('Ayuda', 'Contacta soporte@cuotify.app')}
          />
          <SettingsItem
            icon="📄"
            title="Términos y condiciones"
            onPress={() => Alert.alert('Términos', 'Próximamente')}
          />
          <SettingsItem
            icon="🔐"
            title="Política de privacidad"
            onPress={() => Alert.alert('Privacidad', 'Próximamente')}
          />
        </View>

        {/* Cerrar sesión */}
        <View style={styles.section}>
          <SettingsItem
            icon="🚪"
            title="Cerrar sesión"
            onPress={handleLogout}
            showArrow={false}
            danger
          />
        </View>

        {/* Versión */}
        <Text style={styles.version}>Cuotify v1.0.0</Text>

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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    ...shadow.md,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text.inverse,
  },
  profileInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  profileName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  profileEmail: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  roleBadge: {
    backgroundColor: colors.primary.main + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
  },
  roleText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.primary.main,
  },
  profileArrow: {
    fontSize: fontSize.lg,
    color: colors.text.secondary,
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
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  iconContainerDanger: {
    backgroundColor: colors.error + '15',
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
  itemTitleDanger: {
    color: colors.error,
  },
  itemSubtitle: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  arrow: {
    fontSize: fontSize.lg,
    color: colors.text.disabled,
  },
  version: {
    fontSize: fontSize.sm,
    color: colors.text.disabled,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
