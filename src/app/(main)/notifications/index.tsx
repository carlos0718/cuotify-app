import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, fontSize, fontWeight, shadow } from '../../../theme';

// Tipos de notificación
type NotificationType =
  | 'payment_reminder'
  | 'payment_overdue'
  | 'payment_received'
  | 'borrower_comment';

// Datos de ejemplo
const notifications = [
  {
    id: '1',
    type: 'payment_reminder' as NotificationType,
    title: 'Recordatorio de pago',
    body: 'El pago de Juan Pérez vence mañana',
    time: 'Hace 5 min',
    isRead: false,
  },
  {
    id: '2',
    type: 'payment_overdue' as NotificationType,
    title: 'Pago vencido',
    body: 'El pago de Ana Martínez está vencido hace 3 días',
    time: 'Hace 1 hora',
    isRead: false,
  },
  {
    id: '3',
    type: 'payment_received' as NotificationType,
    title: 'Pago recibido',
    body: 'Carlos López realizó el pago de $916.67',
    time: 'Hace 2 horas',
    isRead: true,
  },
  {
    id: '4',
    type: 'borrower_comment' as NotificationType,
    title: 'Nuevo comentario',
    body: 'María García comentó en su cuota #3',
    time: 'Ayer',
    isRead: true,
  },
  {
    id: '5',
    type: 'payment_reminder' as NotificationType,
    title: 'Recordatorio de pago',
    body: 'El pago de Pedro Sánchez vence en 5 días',
    time: 'Ayer',
    isRead: true,
  },
];

// Configuración de iconos y colores por tipo
const notificationConfig: Record<
  NotificationType,
  { icon: string; color: string; bgColor: string }
> = {
  payment_reminder: {
    icon: '🔔',
    color: colors.warning,
    bgColor: colors.warning + '20',
  },
  payment_overdue: {
    icon: '⚠️',
    color: colors.error,
    bgColor: colors.error + '20',
  },
  payment_received: {
    icon: '✓',
    color: colors.success,
    bgColor: colors.success + '20',
  },
  borrower_comment: {
    icon: '💬',
    color: colors.info,
    bgColor: colors.info + '20',
  },
};

function NotificationItem({
  type,
  title,
  body,
  time,
  isRead,
}: {
  type: NotificationType;
  title: string;
  body: string;
  time: string;
  isRead: boolean;
}) {
  const config = notificationConfig[type];

  return (
    <TouchableOpacity
      style={[
        styles.notificationItem,
        !isRead && styles.notificationItemUnread,
      ]}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: config.bgColor }]}>
        <Text style={styles.icon}>{config.icon}</Text>
      </View>
      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <Text style={[styles.notificationTitle, !isRead && styles.textBold]}>
            {title}
          </Text>
          <Text style={styles.notificationTime}>{time}</Text>
        </View>
        <Text style={styles.notificationBody} numberOfLines={2}>
          {body}
        </Text>
      </View>
      {!isRead && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkAllRead = () => {
    // Marcar todas como leídas
    console.log('Marcar todas como leídas');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Notificaciones</Text>
          {unreadCount > 0 && (
            <Text style={styles.subtitle}>
              {unreadCount} sin leer
            </Text>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={styles.markAllRead}>Marcar leídas</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hoy */}
        <Text style={styles.sectionTitle}>Hoy</Text>
        {notifications.slice(0, 3).map((notification) => (
          <NotificationItem key={notification.id} {...notification} />
        ))}

        {/* Ayer */}
        <Text style={styles.sectionTitle}>Ayer</Text>
        {notifications.slice(3).map((notification) => (
          <NotificationItem key={notification.id} {...notification} />
        ))}

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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  markAllRead: {
    fontSize: fontSize.sm,
    color: colors.primary.main,
    fontWeight: fontWeight.medium,
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
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadow.sm,
  },
  notificationItemUnread: {
    backgroundColor: colors.primary.main + '05',
    borderLeftWidth: 3,
    borderLeftColor: colors.primary.main,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  icon: {
    fontSize: fontSize.lg,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  notificationTitle: {
    fontSize: fontSize.sm,
    color: colors.text.primary,
  },
  textBold: {
    fontWeight: fontWeight.semiBold,
  },
  notificationTime: {
    fontSize: fontSize.xs,
    color: colors.text.disabled,
  },
  notificationBody: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary.main,
    marginLeft: spacing.sm,
  },
});
