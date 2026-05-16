import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { getUpcomingPayments, getOverduePayments } from '../../../services/supabase';
import { getUpcomingDebtPayments, getOverdueDebtPayments } from '../../../services/supabase/personalDebts';
import { setBadgeCount } from '../../../services/notifications/pushNotifications';
import { colors, spacing, borderRadius, fontSize, fontWeight, shadow } from '../../../theme';
import { Borrower } from '../../../types';
import { PersonalDebt } from '../../../services/supabase/personalDebts';
import { useAuthStore } from '../../../store/authStore';

// Tipos
type NotificationType = 'payment_reminder' | 'payment_overdue' | 'payment_today' | 'debt_reminder' | 'debt_overdue' | 'debt_today';

interface PaymentWithLoan {
  id: string;
  due_date: string;
  total_amount: number;
  status: 'pending' | 'paid' | 'partial' | 'overdue';
  payment_number: number;
  loan: {
    id: string;
    principal_amount: number;
    currency?: 'ARS' | 'USD';
    borrower: Borrower | null;
  } | null;
}

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  time: string;
  daysUntil: number;
  paymentId: string;
  loanId: string;
  debtId?: string;
  isBorrowerLoan?: boolean;
}

interface DebtPaymentWithDebt {
  id: string;
  debt_id: string;
  due_date: string;
  total_amount: number;
  payment_number: number;
  status: string;
  debt?: Pick<PersonalDebt, 'id' | 'creditor_name' | 'currency'>;
}

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
  notification: Notification;
  onPress: () => void;
}) {
  const config = notificationConfig[notification.type];
  const isUrgent = notification.type === 'payment_overdue' || notification.type === 'payment_today'
    || notification.type === 'debt_overdue' || notification.type === 'debt_today';

  return (
    <TouchableOpacity
      style={[
        styles.notificationItem,
        isUrgent && styles.notificationItemUrgent,
      ]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={[styles.iconContainer, { backgroundColor: config.bgColor }]}>
        <Text style={styles.icon}>{config.icon}</Text>
      </View>
      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <Text style={[styles.notificationTitle, isUrgent && styles.textBold]}>
            {notification.title}
          </Text>
          <Text style={styles.notificationTime}>{notification.time}</Text>
        </View>
        <Text style={styles.notificationBody} numberOfLines={2}>
          {notification.body}
        </Text>
      </View>
      {isUrgent && <View style={[styles.urgentDot, { backgroundColor: config.color }]} />}
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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { session } = useAuthStore();
  const currentUserId = session?.user?.id;

  const formatCurrency = (amount: number, currency: 'ARS' | 'USD' = 'ARS') => {
    if (currency === 'USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
      }).format(amount);
    }
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getDaysUntil = (dateStr: string): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = new Date(dateStr + 'T00:00:00');
    const diffTime = date.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getTimeLabel = (daysUntil: number): string => {
    if (daysUntil < -1) return `Hace ${Math.abs(daysUntil)} días`;
    if (daysUntil === -1) return 'Ayer';
    if (daysUntil === 0) return 'Hoy';
    if (daysUntil === 1) return 'Mañana';
    if (daysUntil <= 7) return `En ${daysUntil} días`;
    return `En ${daysUntil} días`;
  };

  const transformToNotifications = (
    upcomingPayments: PaymentWithLoan[],
    overduePayments: PaymentWithLoan[],
    upcomingDebtPayments: DebtPaymentWithDebt[],
    overdueDebtPayments: DebtPaymentWithDebt[]
  ): Notification[] => {
    const notifs: Notification[] = [];

    // Pagos de préstamos vencidos
    overduePayments.forEach((payment) => {
      const daysUntil = getDaysUntil(payment.due_date);
      const borrowerName = payment.loan?.borrower?.full_name || 'Sin nombre';
      const currency = (payment.loan?.currency || 'ARS') as 'ARS' | 'USD';
      const isBorrowerLoan = !!(currentUserId && payment.loan?.borrower?.linked_profile_id === currentUserId);
      notifs.push({
        id: `overdue-${payment.id}`,
        type: 'payment_overdue',
        title: 'Pago vencido',
        body: `Cuota #${payment.payment_number} de ${borrowerName} por ${formatCurrency(payment.total_amount, currency)} está vencida`,
        time: getTimeLabel(daysUntil),
        daysUntil,
        paymentId: payment.id,
        loanId: payment.loan?.id || '',
        isBorrowerLoan,
      });
    });

    // Pagos de préstamos próximos
    upcomingPayments.forEach((payment) => {
      const daysUntil = getDaysUntil(payment.due_date);
      const borrowerName = payment.loan?.borrower?.full_name || 'Sin nombre';
      const currency = (payment.loan?.currency || 'ARS') as 'ARS' | 'USD';
      const isBorrowerLoan = !!(currentUserId && payment.loan?.borrower?.linked_profile_id === currentUserId);
      let type: NotificationType = 'payment_reminder';
      let title = 'Recordatorio de pago';
      if (daysUntil === 0) { type = 'payment_today'; title = 'Pago vence hoy'; }
      else if (daysUntil === 1) { title = 'Pago vence mañana'; }
      notifs.push({
        id: `upcoming-${payment.id}`,
        type,
        title,
        body: `Cuota #${payment.payment_number} de ${borrowerName} por ${formatCurrency(payment.total_amount, currency)}`,
        time: getTimeLabel(daysUntil),
        daysUntil,
        paymentId: payment.id,
        loanId: payment.loan?.id || '',
        isBorrowerLoan,
      });
    });

    // Cuotas de deudas personales vencidas
    overdueDebtPayments.forEach((payment) => {
      const daysUntil = getDaysUntil(payment.due_date);
      const creditor = payment.debt?.creditor_name || 'Sin nombre';
      const currency = (payment.debt?.currency || 'ARS') as 'ARS' | 'USD';
      notifs.push({
        id: `debt-overdue-${payment.id}`,
        type: 'debt_overdue',
        title: 'Cuota de deuda vencida',
        body: `Cuota #${payment.payment_number} a ${creditor} por ${formatCurrency(payment.total_amount, currency)} está vencida`,
        time: getTimeLabel(daysUntil),
        daysUntil,
        paymentId: payment.id,
        loanId: '',
        debtId: payment.debt_id,
      });
    });

    // Cuotas de deudas personales próximas
    upcomingDebtPayments.forEach((payment) => {
      const daysUntil = getDaysUntil(payment.due_date);
      const creditor = payment.debt?.creditor_name || 'Sin nombre';
      const currency = (payment.debt?.currency || 'ARS') as 'ARS' | 'USD';
      let type: NotificationType = 'debt_reminder';
      let title = 'Cuota de deuda próxima';
      if (daysUntil === 0) { type = 'debt_today'; title = 'Cuota de deuda vence hoy'; }
      else if (daysUntil === 1) { title = 'Cuota de deuda vence mañana'; }
      notifs.push({
        id: `debt-upcoming-${payment.id}`,
        type,
        title,
        body: `Cuota #${payment.payment_number} a ${creditor} por ${formatCurrency(payment.total_amount, currency)}`,
        time: getTimeLabel(daysUntil),
        daysUntil,
        paymentId: payment.id,
        loanId: '',
        debtId: payment.debt_id,
      });
    });

    return notifs.sort((a, b) => a.daysUntil - b.daysUntil);
  };

  const loadData = async () => {
    try {
      const [upcomingData, overdueData, upcomingDebtData, overdueDebtData] = await Promise.all([
        getUpcomingPayments(14),
        getOverduePayments(),
        getUpcomingDebtPayments(14),
        getOverdueDebtPayments(),
      ]);

      const notifs = transformToNotifications(
        upcomingData as PaymentWithLoan[],
        overdueData as PaymentWithLoan[],
        upcomingDebtData as unknown as DebtPaymentWithDebt[],
        overdueDebtData as unknown as DebtPaymentWithDebt[]
      );
      setNotifications(notifs);

      // Limpiar badge del sistema (iOS)
      setBadgeCount(0).catch(() => {});
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleNotificationPress = (notification: Notification) => {
    if (notification.debtId) {
      router.push(`/(main)/debts/${notification.debtId}?readonly=true` as never);
    } else if (notification.loanId) {
      const path = notification.isBorrowerLoan
        ? `/(main)/loans/${notification.loanId}?readonly=true`
        : `/(main)/loans/${notification.loanId}`;
      router.push(path as never);
    }
  };

  // Agrupar notificaciones
  const overdueNotifs = notifications.filter(n => n.type === 'payment_overdue' || n.type === 'debt_overdue');
  const todayNotifs = notifications.filter(n => n.type === 'payment_today' || n.type === 'debt_today');
  const upcomingNotifs = notifications.filter(n => n.type === 'payment_reminder' || n.type === 'debt_reminder');

  const urgentCount = overdueNotifs.length + todayNotifs.length;

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
          {urgentCount > 0 && (
            <Text style={styles.subtitle}>
              {urgentCount} {urgentCount === 1 ? 'urgente' : 'urgentes'}
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
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
});
