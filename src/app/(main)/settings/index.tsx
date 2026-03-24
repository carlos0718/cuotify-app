import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore, usePreferencesStore, useSubscriptionStore } from '../../../store';
import { Modal, useToast } from '../../../components';
import { updateAllLoanColors } from '../../../services/supabase';
import { colors, spacing, borderRadius, fontSize, fontWeight, shadow } from '../../../theme';
import { CurrencyType } from '../../../types';

// Información de contacto de soporte
const SUPPORT_EMAIL = 'soporte@cuotify.app';
const SUPPORT_WHATSAPP = '+5491112345678'; // Cambiar por el número real
const APP_VERSION = '1.0.0';

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
  const { defaultCurrency, setDefaultCurrency } = usePreferencesStore();
  const { premium } = useSubscriptionStore();
  const { showSuccess, showError } = useToast();

  // Estados de modales
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showFAQModal, setShowFAQModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showThanksModal, setShowThanksModal] = useState(false);
  const [isUpdatingColors, setIsUpdatingColors] = useState(false);

  const handleUpdateLoanColors = async () => {
    setIsUpdatingColors(true);
    try {
      const count = await updateAllLoanColors([...colors.loanColors]);
      showSuccess('Colores actualizados', `Se actualizaron ${count} préstamos con nuevos colores`);
    } catch (error) {
      showError('Error', 'No se pudieron actualizar los colores');
    } finally {
      setIsUpdatingColors(false);
    }
  };

  const handleLogout = async () => {
    setShowLogoutModal(false);
    await signOut();
    router.replace('/(auth)/login');
  };

  const handleContactEmail = () => {
    setShowContactModal(false);
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Soporte Cuotify&body=Hola, necesito ayuda con...`);
  };

  const handleContactWhatsApp = () => {
    setShowContactModal(false);
    Linking.openURL(`https://wa.me/${SUPPORT_WHATSAPP}?text=Hola, necesito ayuda con la app Cuotify`);
  };

  const handleRateApp = () => {
    setShowRateModal(false);
    setShowThanksModal(true);
    // TODO: Reemplazar con links reales cuando se publique
    // Para Android: Linking.openURL('market://details?id=com.cuotify.app')
    // Para iOS: Linking.openURL('itms-apps://itunes.apple.com/app/idXXXXXXXXX?action=write-review')
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
            onPress={() => setShowLanguageModal(true)}
          />
          <SettingsItem
            icon="💱"
            title="Moneda por defecto"
            subtitle={defaultCurrency === 'ARS' ? '🇦🇷 Pesos (ARS)' : '🇺🇸 Dólares (USD)'}
            onPress={() => setShowCurrencyModal(true)}
          />
          <SettingsItem
            icon="🎨"
            title="Actualizar colores"
            subtitle={isUpdatingColors ? 'Actualizando...' : 'Renovar colores de préstamos'}
            onPress={handleUpdateLoanColors}
            showArrow={!isUpdatingColors}
          />
        </View>

        {/* Sección de soporte */}
        <Text style={styles.sectionTitle}>Soporte</Text>
        <View style={styles.section}>
          <SettingsItem
            icon="❓"
            title="Preguntas frecuentes"
            subtitle="Ayuda y respuestas rápidas"
            onPress={() => setShowFAQModal(true)}
          />
          <SettingsItem
            icon="💬"
            title="Contactar soporte"
            subtitle="Email o WhatsApp"
            onPress={() => setShowContactModal(true)}
          />
          <SettingsItem
            icon="⭐"
            title="Calificar la app"
            subtitle="¡Tu opinión nos ayuda!"
            onPress={() => setShowRateModal(true)}
          />
          <SettingsItem
            icon="📄"
            title="Términos y condiciones"
            onPress={() => setShowTermsModal(true)}
          />
          <SettingsItem
            icon="🔐"
            title="Política de privacidad"
            onPress={() => setShowPrivacyModal(true)}
          />
        </View>

        {/* Mi Plan */}
        <Text style={styles.sectionTitle}>Mi Plan</Text>
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.planCard}
            onPress={() =>
              router.push(premium ? '/(main)/settings/customer-center' : '/(main)/settings/premium')
            }
          >
            <View style={styles.planCardLeft}>
              <Text style={styles.planCardIcon}>{premium ? '⭐' : '🔓'}</Text>
              <View>
                <Text style={styles.planCardTitle}>{premium ? 'Cuotify Pro' : 'Plan Gratuito'}</Text>
                <Text style={styles.planCardSub}>
                  {premium ? 'Gestionar suscripción' : 'Tocá para desbloquear Premium'}
                </Text>
              </View>
            </View>
            {!premium && (
              <View style={styles.upgradeBadge}>
                <Text style={styles.upgradeBadgeText}>Mejorar</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Cerrar sesión */}
        <View style={styles.section}>
          <SettingsItem
            icon="🚪"
            title="Cerrar sesión"
            onPress={() => setShowLogoutModal(true)}
            showArrow={false}
            danger
          />
        </View>

        {/* Versión */}
        <Text style={styles.version}>Cuotify v{APP_VERSION}</Text>

        <View style={{ height: spacing.xl }} />
      </ScrollView>

      {/* Modal de Moneda */}
      <Modal
        visible={showCurrencyModal}
        onClose={() => setShowCurrencyModal(false)}
        title="Moneda por defecto"
        message="Selecciona la moneda que se usará por defecto al crear nuevos registros"
        icon="💱"
        accentColor={colors.primary.main}
        buttons={[
          {
            text: '🇦🇷  Pesos (ARS)',
            style: defaultCurrency === 'ARS' ? 'primary' : 'default',
            onPress: () => {
              setDefaultCurrency('ARS' as CurrencyType);
              setShowCurrencyModal(false);
            },
          },
          {
            text: '🇺🇸  Dólares (USD)',
            style: defaultCurrency === 'USD' ? 'primary' : 'default',
            onPress: () => {
              setDefaultCurrency('USD' as CurrencyType);
              setShowCurrencyModal(false);
            },
          },
          { text: 'Cancelar', style: 'cancel' },
        ]}
      />

      {/* Modal de Idioma */}
      <Modal
        visible={showLanguageModal}
        onClose={() => setShowLanguageModal(false)}
        title="Idioma"
        message="Actualmente Cuotify solo está disponible en español. Próximamente agregaremos más idiomas."
        icon="🌐"
        accentColor={colors.secondary.main}
        buttons={[{ text: 'Entendido', style: 'primary' }]}
      />

      {/* Modal de Cerrar Sesión */}
      <Modal
        visible={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        title="Cerrar sesión"
        message="¿Estás seguro que deseas cerrar sesión? Tendrás que volver a iniciar sesión para acceder a tu cuenta."
        icon="🚪"
        accentColor={colors.error}
        buttons={[
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Cerrar sesión', style: 'destructive', onPress: handleLogout },
        ]}
      />

      {/* Modal de Contacto */}
      <Modal
        visible={showContactModal}
        onClose={() => setShowContactModal(false)}
        title="Contactar Soporte"
        message="¿Cómo prefieres contactarnos? Estamos aquí para ayudarte."
        icon="💬"
        accentColor={colors.success}
        buttons={[
          { text: '📧  Enviar Email', style: 'default', onPress: handleContactEmail },
          { text: '💚  WhatsApp', style: 'primary', onPress: handleContactWhatsApp },
          { text: 'Cancelar', style: 'cancel' },
        ]}
      />

      {/* Modal de FAQ */}
      <Modal
        visible={showFAQModal}
        onClose={() => setShowFAQModal(false)}
        title="Preguntas Frecuentes"
        icon="❓"
        accentColor={colors.warning}
        message={`📌 ¿Cómo creo un nuevo registro?
Ve a Préstamos → + Nuevo y completá los datos del contacto y las condiciones del acuerdo.

📌 ¿Cómo registro un pago?
Entra al préstamo, selecciona la cuota y toca "Marcar como pagado".

📌 ¿Puedo registrar en dólares?
Sí, al crear el registro podés elegir entre Pesos (ARS) o Dólares (USD).

📌 ¿Cómo funcionan las notificaciones?
Recibirás recordatorios automáticos antes del vencimiento de cada cuota.

📌 ¿Es segura mi información?
Sí, usamos encriptación y tus datos están protegidos en servidores seguros.

¿Necesitas más ayuda? Contáctanos.`}
        buttons={[
          { text: 'Contactar Soporte', style: 'primary', onPress: () => {
            setShowFAQModal(false);
            setShowContactModal(true);
          }},
          { text: 'Cerrar', style: 'cancel' },
        ]}
      />

      {/* Modal de Términos */}
      <Modal
        visible={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        title="Términos y Condiciones"
        icon="📄"
        accentColor={colors.primary.main}
        message={`TÉRMINOS DE USO DE CUOTIFY

1. ACEPTACIÓN
Al usar Cuotify, aceptas estos términos de uso.

2. USO DE LA APLICACIÓN
Cuotify es una herramienta para gestionar pagos y acuerdos financieros personales. El usuario es responsable de cumplir con las leyes locales aplicables.

3. PRIVACIDAD
Protegemos tu información personal. No compartimos tus datos con terceros sin tu consentimiento.

4. RESPONSABILIDAD
Cuotify es una herramienta de gestión. No somos responsables de los acuerdos entre prestamistas y prestatarios.

5. MODIFICACIONES
Podemos actualizar estos términos. Te notificaremos de cambios importantes.

Última actualización: Enero 2025`}
        buttons={[{ text: 'Entendido', style: 'primary' }]}
      />

      {/* Modal de Privacidad */}
      <Modal
        visible={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        title="Política de Privacidad"
        icon="🔐"
        accentColor={colors.secondary.main}
        message={`POLÍTICA DE PRIVACIDAD DE CUOTIFY

📱 DATOS QUE RECOPILAMOS
• Información de cuenta (email, nombre)
• Datos de préstamos que creas
• Información de dispositivo para notificaciones

🔒 CÓMO PROTEGEMOS TUS DATOS
• Encriptación de extremo a extremo
• Servidores seguros con certificación
• Acceso restringido a tu información

🚫 LO QUE NO HACEMOS
• No vendemos tus datos
• No compartimos información con terceros
• No accedemos a tus contactos sin permiso

📧 CONTACTO
Para consultas sobre privacidad: ${SUPPORT_EMAIL}

Última actualización: Enero 2025`}
        buttons={[{ text: 'Entendido', style: 'primary' }]}
      />

      {/* Modal de Calificar */}
      <Modal
        visible={showRateModal}
        onClose={() => setShowRateModal(false)}
        title="¿Te gusta Cuotify?"
        message="Tu opinión nos ayuda a mejorar. ¿Te gustaría calificarnos en la tienda de apps?"
        icon="⭐"
        accentColor={colors.warning}
        buttons={[
          { text: 'Ahora no', style: 'cancel' },
          { text: '⭐ Calificar', style: 'primary', onPress: handleRateApp },
        ]}
      />

      {/* Modal de Gracias */}
      <Modal
        visible={showThanksModal}
        onClose={() => setShowThanksModal(false)}
        title="¡Gracias!"
        message="¡Pronto podrás calificarnos en las tiendas de apps! Tu apoyo significa mucho para nosotros."
        icon="💜"
        accentColor={colors.primary.main}
        buttons={[{ text: 'De nada', style: 'primary' }]}
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
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  planCardLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  planCardIcon: { fontSize: 28 },
  planCardTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semiBold, color: colors.text.primary },
  planCardSub: { fontSize: fontSize.xs, color: colors.text.secondary, marginTop: 2 },
  upgradeBadge: {
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  upgradeBadgeText: { fontSize: fontSize.xs, color: '#fff', fontWeight: fontWeight.semiBold },
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
