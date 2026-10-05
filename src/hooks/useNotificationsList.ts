import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { getUpcomingPayments, getOverduePayments } from '../services/supabase';
import { getUpcomingDebtPayments, getOverdueDebtPayments, PersonalDebt } from '../services/supabase/personalDebts';
import { setBadgeCount } from '../services/notifications/pushNotifications';
import { getReadIds, markAsRead, markAllAsRead } from '../services/notifications/readNotifications';
import { Borrower } from '../types';
import { useAuthStore } from '../store/authStore';

export type NotificationType = 'payment_reminder' | 'payment_overdue' | 'payment_today' | 'debt_reminder' | 'debt_overdue' | 'debt_today';

export interface PaymentWithLoan {
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

export interface AppNotification {
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
  isRead?: boolean;
}

export interface DebtPaymentWithDebt {
  id: string;
  debt_id: string;
  due_date: string;
  total_amount: number;
  payment_number: number;
  status: string;
  debt?: Pick<PersonalDebt, 'id' | 'creditor_name' | 'currency'>;
}

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

export function useNotificationsList() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
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

  const transformToNotifications = useCallback((
    upcomingPayments: PaymentWithLoan[],
    overduePayments: PaymentWithLoan[],
    upcomingDebtPayments: DebtPaymentWithDebt[],
    overdueDebtPayments: DebtPaymentWithDebt[]
  ): AppNotification[] => {
    const notifs: AppNotification[] = [];

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  const loadData = useCallback(async () => {
    try {
      const [upcomingData, overdueData, upcomingDebtData, overdueDebtData, storedReadIds] = await Promise.all([
        getUpcomingPayments(14),
        getOverduePayments(),
        getUpcomingDebtPayments(14),
        getOverdueDebtPayments(),
        getReadIds(),
      ]);

      const notifs = transformToNotifications(
        upcomingData as PaymentWithLoan[],
        overdueData as PaymentWithLoan[],
        upcomingDebtData as unknown as DebtPaymentWithDebt[],
        overdueDebtData as unknown as DebtPaymentWithDebt[]
      );
      setNotifications(notifs);
      setReadIds(storedReadIds);

      // Limpiar badge del sistema (iOS)
      setBadgeCount(0).catch(() => {});
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [transformToNotifications]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleNotificationPress = async (notification: AppNotification) => {
    if (!readIds.has(notification.id)) {
      await markAsRead(notification.id);
      setReadIds(prev => new Set([...prev, notification.id]));
    }
    if (notification.debtId) {
      router.push(`/(main)/debts/${notification.debtId}?readonly=true` as never);
    } else if (notification.loanId) {
      const path = notification.isBorrowerLoan
        ? `/(main)/loans/${notification.loanId}?readonly=true`
        : `/(main)/loans/${notification.loanId}`;
      router.push(path as never);
    }
  };

  const handleMarkAllAsRead = async () => {
    const allIds = notifications.map(n => n.id);
    await markAllAsRead(allIds);
    setReadIds(new Set(allIds));
  };

  // Agrupar notificaciones con estado leído
  const notificationsWithRead = notifications.map(n => ({ ...n, isRead: readIds.has(n.id) }));
  const overdueNotifs = notificationsWithRead.filter(n => n.type === 'payment_overdue' || n.type === 'debt_overdue');
  const todayNotifs = notificationsWithRead.filter(n => n.type === 'payment_today' || n.type === 'debt_today');
  const upcomingNotifs = notificationsWithRead.filter(n => n.type === 'payment_reminder' || n.type === 'debt_reminder');

  const unreadCount = notificationsWithRead.filter(n => !n.isRead).length;
  const urgentCount = overdueNotifs.filter(n => !n.isRead).length + todayNotifs.filter(n => !n.isRead).length;

  return {
    notifications,
    isLoading,
    refreshing,
    onRefresh,
    handleNotificationPress,
    handleMarkAllAsRead,
    notificationsWithRead,
    overdueNotifs,
    todayNotifs,
    upcomingNotifs,
    unreadCount,
    urgentCount,
  };
}
