import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import {
  getLoans,
  getLoanStats,
  getUpcomingPayments,
  getOverduePayments,
  getDebtStats,
  getNextPendingPaymentDatesByLoan,
} from '../services/supabase';
import { getReadIds } from '../services/notifications';
import { usePreferencesStore } from '../store';
import { Borrower, CurrencyType } from '../types';
import { DebtStats } from '../services/supabase/personalDebts';
import { LoanStats, emptyLoanStats } from '../services/supabase/loans';

export interface LoanWithBorrower {
  id: string;
  principal_amount: number;
  total_amount: number;
  payment_amount: number;
  status: 'active' | 'completed' | 'defaulted' | 'cancelled';
  color_code: string;
  first_payment_date: string;
  end_date: string;
  borrower: Borrower | null;
}

export interface PaymentWithLoan {
  id: string;
  due_date: string;
  total_amount: number;
  status: string;
  loan: {
    id: string;
    borrower: Borrower | null;
  } | null;
}

export function formatShortCurrency(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export function useDashboardData() {
  const defaultCurrency = usePreferencesStore((s) => s.defaultCurrency);
  const [loans, setLoans] = useState<LoanWithBorrower[]>([]);
  const [stats, setStats] = useState<LoanStats>(emptyLoanStats());
  const [upcomingPayments, setUpcomingPayments] = useState<PaymentWithLoan[]>([]);
  const [overdueCount, setOverdueCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [debtStats, setDebtStats] = useState<DebtStats | null>(null);
  const [nextPaymentDates, setNextPaymentDates] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    try {
      const [loansData, statsData, paymentsData, overdueData, debtStatsData, readIds] = await Promise.all([
        getLoans(),
        getLoanStats(),
        getUpcomingPayments(7),
        getOverduePayments(),
        getDebtStats(),
        getReadIds(),
      ]);
      setLoans(loansData as LoanWithBorrower[]);
      setStats(statsData);
      setUpcomingPayments(paymentsData as PaymentWithLoan[]);
      const overduePayments = overdueData as PaymentWithLoan[];
      setOverdueCount(overduePayments.length);
      setDebtStats(debtStatsData);

      // Calcular notificaciones no leídas
      const upcomingIds = (paymentsData as PaymentWithLoan[]).map(p => `upcoming-${p.id}`);
      const overdueIds = overduePayments.map(p => `overdue-${p.id}`);
      const allNotifIds = [...upcomingIds, ...overdueIds];
      const unread = allNotifIds.filter(id => !readIds.has(id)).length;
      setUnreadNotifCount(unread);

      const activeIds = (loansData as LoanWithBorrower[]).filter(l => l.status === 'active').map(l => l.id);
      const nextDates = await getNextPendingPaymentDatesByLoan(activeIds);
      setNextPaymentDates(nextDates);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleNewLoan = () => {
    router.push('/(main)/loans/create');
  };

  const handleViewLoans = () => {
    router.push('/(main)/loans');
  };

  const handleViewLoan = (id: string) => {
    router.push(`/(main)/loans/${id}`);
  };

  const formatCurrency = (amount: number, currency: CurrencyType = 'ARS') => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getDueInfo = (loan: LoanWithBorrower): string => {
    if (loan.status === 'completed') return 'Completado';
    const nextDueDateStr = nextPaymentDates[loan.id];
    if (!nextDueDateStr) return 'Al día';
    const nextPayment = new Date(nextDueDateStr + 'T12:00:00');
    const today = new Date();
    const diffDays = Math.ceil((nextPayment.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return `Vencido hace ${Math.abs(diffDays)} días`;
    if (diffDays === 0) return 'Vence hoy';
    return `Vence en ${diffDays} días`;
  };

  // El hero muestra una sola moneda —dos anillos de progreso apilados no se leen—:
  // la preferida del usuario si tiene movimiento, si no la primera con datos.
  // Las tarjetas de abajo sí se apilan por moneda (L2).
  const primaryCurrency: CurrencyType = stats.currencies.includes(defaultCurrency)
    ? defaultCurrency
    : (stats.currencies[0] ?? defaultCurrency);

  const lenderMoney = stats.byCurrency[primaryCurrency];
  const debtMoney = debtStats?.byCurrency[primaryCurrency];

  /** Monedas a mostrar en las tarjetas; nunca vacío, para no dejar la sección en blanco. */
  const lenderCurrencies: readonly CurrencyType[] = stats.currencies.length
    ? stats.currencies
    : [primaryCurrency];
  const debtCurrencies: readonly CurrencyType[] = debtStats?.currencies.length
    ? debtStats.currencies
    : [primaryCurrency];

  // % cobrado: pagos realmente cobrados vs total esperado, en la moneda principal
  const lenderPercentage = lenderMoney.totalExpected > 0
    ? Math.min(100, Math.round((lenderMoney.totalRecovered / lenderMoney.totalExpected) * 100))
    : 0;

  const debtPercentage = debtMoney && debtMoney.totalToPay > 0
    ? Math.min(100, Math.round((debtMoney.totalPaid / debtMoney.totalToPay) * 100))
    : 0;

  const hasDebtData = debtStats !== null && debtStats.activeDebts > 0;

  // Obtener los préstamos activos más recientes (máximo 2)
  const activeLoans = loans.filter(l => l.status === 'active').slice(0, 2);

  // Obtener próximos días con pagos
  const getUpcomingDays = () => {
    const today = new Date();
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dayPayments = upcomingPayments.filter(p => {
        const paymentDate = new Date(p.due_date);
        return paymentDate.toDateString() === date.toDateString();
      });
      days.push({
        day: date.getDate(),
        dayName: DAY_NAMES[date.getDay()],
        hasPayment: dayPayments.length > 0,
        isToday: i === 0,
      });
    }
    return days;
  };

  // Obtener mes actual
  const getCurrentMonth = () => {
    const today = new Date();
    return `${MONTH_NAMES[today.getMonth()]} ${today.getFullYear()}`;
  };

  return {
    loans,
    stats,
    upcomingPayments,
    overdueCount,
    unreadNotifCount,
    isLoading,
    refreshing,
    debtStats,
    onRefresh,
    handleNewLoan,
    handleViewLoans,
    handleViewLoan,
    formatCurrency,
    getDueInfo,
    primaryCurrency,
    lenderMoney,
    debtMoney,
    lenderCurrencies,
    debtCurrencies,
    lenderPercentage,
    debtPercentage,
    hasDebtData,
    activeLoans,
    getUpcomingDays,
    getCurrentMonth,
  };
}
