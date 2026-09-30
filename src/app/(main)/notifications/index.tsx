import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, borderRadius, fontSize, fontWeight, shadow } from '../../../theme';
import { useNotificationsList, AppNotification, NotificationType } from '../../../hooks';

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
  payment_today: {
    icon: '📅',
    color: colors.primary.main,
    bgColor: colors.primary.main + '20',
  },
  payment_overdue: {
    icon: '⚠️',
    color: colors.error,
    bgColor: colors.error + '20',
  },
  debt_reminder: {
    icon: '💳',
    color: '#8B5CF6',
    bgColor: '#8B5CF620',
  },
  debt_today: {
    icon: '💳',
    color: '#6366F1',
    bgColor: '#6366F120',
  },
  debt_overdue: {
    icon: '🔴',
    color: colors.error,
    bgColor: colors.error + '20',
  },
};

function NotificationItem({
  notification,
  onPress,
}: {
  notification: AppNotification;
  onPress: () => void;
}) {
  const config = notificationConfig[notification.type];
  const isUrgent = notification.type === 'payment_overdue' || notification.type === 'payment_today'
    || notification.type === 'debt_overdue' || notification.type === 'debt_today';
  const isRead = notification.isRead === true;

  return (
    <TouchableOpacity
      style={[
        styles.notificationItem,
        isUrgent && !isRead && styles.notificationItemUrgent,
        isRead && styles.notificationItemRead,
      ]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={[styles.iconContainer, { backgroundColor: isRead ? config.bgColor + '80' : config.bgColor }]}>
        <Text style={[styles.icon, isRead && styles.iconRead]}>{config.icon}</Text>
      </View>
      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <Text style={[styles.notificationTitle, isUrgent && !isRead && styles.textBold, isRead && styles.textRead]}>
            {notification.title}
          </Text>
          <View style={styles.notificationTimeRow}>
            {!isRead && <View style={styles.unreadDot} />}
            <Text style={styles.notificationTime}>{notification.time}</Text>
          </View>
        </View>
        <Text style={[styles.notificationBody, isRead && styles.textRead]} numberOfLines={2}>
          {notification.body}
        </Text>
      </View>
      {isUrgent && !isRead && <View style={[styles.urgentDot, { backgroundColor: config.color }]} />}
    </TouchableOpacity>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🎉</Text>
      <Text style={styles.emptyTitle}>Sin alertas pendientes</Text>
      <Text style={styles.emptyText}>
        No tienes pagos vencidos ni próximos a vencer. ¡Todo está en orden!
      </Text>
    </View>
  );
}

export default function NotificationsScreen() {
  const {
    notifications,
    isLoading,
    refreshing,
    onRefresh,
    handleNotificationPress,
    handleMarkAllAsRead,
    overdueNotifs,
    todayNotifs,
    upcomingNotifs,
    unreadCount,
  } = useNotificationsList();

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Alertas</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Alertas</Text>
          {unreadCount > 0 && (
            <Text style={styles.subtitle}>
              {unreadCount} sin leer
            </Text>
          )}
        </View>
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={handleMarkAllAsRead} style={styles.markAllButton}>
              <Text style={styles.markAllText}>Marcar todas</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      {notifications.length === 0 ? (
        <EmptyState />
      ) : (
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Pagos vencidos */}
          {overdueNotifs.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, styles.sectionTitleDanger]}>
                Vencidos ({overdueNotifs.length})
              </Text>
              {overdueNotifs.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onPress={() => handleNotificationPress(notification)}
                />
              ))}
            </>
          )}

          {/* Pagos de hoy */}
          {todayNotifs.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, styles.sectionTitleToday]}>
                Hoy ({todayNotifs.length})
              </Text>
              {todayNotifs.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onPress={() => handleNotificationPress(notification)}
                />
              ))}
            </>
          )}

          {/* Próximos pagos */}
          {upcomingNotifs.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>
                Próximos ({upcomingNotifs.length})
              </Text>
              {upcomingNotifs.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onPress={() => handleNotificationPress(notification)}
                />
              ))}
            </>
          )}

          <View style={{ height: spacing.xl }} />
        </ScrollView>
      )}
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
    color: colors.error,
    marginTop: spacing.xs,
    fontWeight: fontWeight.medium,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: fontSize.lg,
    color: colors.text.secondary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semiBold,
    color: colors.text.secondary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionTitleDanger: {
    color: colors.error,
  },
  sectionTitleToday: {
    color: colors.primary.main,
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
  notificationItemUrgent: {
    backgroundColor: colors.error + '08',
    borderLeftWidth: 3,
    borderLeftColor: colors.error,
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
  urgentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: fontSize.base,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  markAllButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary.main + '15',
  },
  markAllText: {
    fontSize: fontSize.xs,
    color: colors.primary.main,
    fontWeight: fontWeight.medium,
  },
  notificationItemRead: {
    opacity: 0.6,
  },
  notificationTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary.main,
  },
  iconRead: {
    opacity: 0.5,
  },
  textRead: {
    color: colors.text.disabled,
  },
});
