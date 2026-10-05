import { useCallback, useState } from 'react';
import { DateData } from 'react-native-calendars';
import { router, useFocusEffect } from 'expo-router';
import { getUpcomingPayments, getOverduePayments, getUpcomingDebtPayments, getOverdueDebtPayments } from '../services/supabase';
import { colors } from '../theme';

// Tipo unificado para préstamos y deudas en el calendario
export interface CalendarPaymentItem {
  id: string;
  due_date: string;
  total_amount: number;
  status: 'pending' | 'paid' | 'partial' | 'overdue';
  payment_number: number;
  type: 'loan' | 'debt';
  name: string;
  parentId: string;
  currency: 'ARS' | 'USD';
}

interface RawLoanPayment {
  id: string;
  due_date: string;
  total_amount: number;
  status: CalendarPaymentItem['status'];
  payment_number: number;
  loan?: { id?: string; borrower?: { full_name?: string }; currency?: 'ARS' | 'USD' } | null;
}

interface RawDebtPayment {
  id: string;
  due_date: string;
  total_amount: number;
  status: CalendarPaymentItem['status'];
  payment_number: number;
  debt?: { id?: string; creditor_name?: string; currency?: 'ARS' | 'USD' } | null;
}

const mapLoanPayments = (data: RawLoanPayment[]): CalendarPaymentItem[] =>
  data.map((p) => ({
    id: p.id,
    due_date: p.due_date,
    total_amount: p.total_amount,
    status: p.status,
    payment_number: p.payment_number,
    type: 'loan' as const,
    name: p.loan?.borrower?.full_name || 'Sin nombre',
    parentId: p.loan?.id || '',
    currency: p.loan?.currency || 'ARS',
  }));

const mapDebtPayments = (data: RawDebtPayment[]): CalendarPaymentItem[] =>
  data.map((p) => ({
    id: p.id,
    due_date: p.due_date,
    total_amount: p.total_amount,
    status: p.status,
    payment_number: p.payment_number,
    type: 'debt' as const,
    name: p.debt?.creditor_name || 'Sin nombre',
    parentId: p.debt?.id || '',
    currency: p.debt?.currency || 'ARS',
  }));

export function useCalendarData() {
  const [selectedDate, setSelectedDate] = useState('');
  const [payments, setPayments] = useState<CalendarPaymentItem[]>([]);
  const [overduePayments, setOverduePayments] = useState<CalendarPaymentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [upcomingLoans, overdueLoans, upcomingDebts, overdueDebts] = await Promise.all([
        getUpcomingPayments(60),
        getOverduePayments(),
        getUpcomingDebtPayments(60),
        getOverdueDebtPayments(),
      ]);

      const allUpcoming = [
        ...mapLoanPayments(upcomingLoans as RawLoanPayment[]),
        ...mapDebtPayments(upcomingDebts as RawDebtPayment[]),
      ].sort((a, b) => a.due_date.localeCompare(b.due_date));

      const allOverdue = [
        ...mapLoanPayments(overdueLoans as RawLoanPayment[]),
        ...mapDebtPayments(overdueDebts as RawDebtPayment[]),
      ].sort((a, b) => a.due_date.localeCompare(b.due_date));

      setPayments(allUpcoming);
      setOverduePayments(allOverdue);
    } catch (error) {
      console.error('Error loading calendar:', error);
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

  const handleDayPress = (day: DateData) => {
    setSelectedDate(day.dateString);
  };

  const handlePaymentPress = (item: CalendarPaymentItem) => {
    if (!item.parentId) return;
    if (item.type === 'loan') {
      router.push(`/(main)/loans/${item.parentId}`);
    } else {
      router.push(`/(main)/debts/${item.parentId}`);
    }
  };

  // Crear marcadores para el calendario
  const getMarkedDates = () => {
    const marks: Record<string, { marked: boolean; dotColor: string; selected?: boolean; selectedColor?: string; dots?: { key: string; color: string }[] }> = {};
    const dotsMap: Record<string, { key: string; color: string }[]> = {};

    // Agregar dots por fecha
    const addDot = (date: string, key: string, color: string) => {
      if (!dotsMap[date]) dotsMap[date] = [];
      // Evitar duplicar dots del mismo color
      if (!dotsMap[date].find(d => d.color === color)) {
        dotsMap[date].push({ key, color });
      }
    };

    payments.forEach(payment => {
      addDot(payment.due_date, `pending-${payment.type}`, colors.warning);
    });

    overduePayments.forEach(payment => {
      addDot(payment.due_date, `overdue-${payment.type}`, colors.error);
    });

    // Construir marks con dots
    const allDates = new Set([
      ...Object.keys(dotsMap),
    ]);

    allDates.forEach(date => {
      marks[date] = {
        marked: true,
        dotColor: dotsMap[date]?.[0]?.color || colors.warning,
        dots: dotsMap[date],
      };
    });

    // Fecha seleccionada
    if (selectedDate) {
      marks[selectedDate] = {
        ...marks[selectedDate],
        marked: marks[selectedDate]?.marked || false,
        dotColor: marks[selectedDate]?.dotColor || colors.primary.main,
        selected: true,
        selectedColor: colors.primary.main,
      };
    }

    return marks;
  };

  // Obtener pagos del día seleccionado
  const getSelectedDatePayments = () => {
    const allPayments = [...payments, ...overduePayments];
    return allPayments.filter(p => p.due_date === selectedDate);
  };

  // Obtener próximos pagos (combinando pendientes y vencidos, máximo 5)
  const getUpcomingPaymentsList = () => {
    const allPayments = [...overduePayments, ...payments];
    return allPayments.slice(0, 5);
  };

  const formatCurrency = (amount: number, currency: 'ARS' | 'USD' = 'ARS') => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getPaymentStatus = (payment: CalendarPaymentItem): 'overdue' | 'pending' | 'paid' => {
    if (payment.status === 'paid') return 'paid';
    const today = new Date().toISOString().split('T')[0];
    if (payment.due_date < today) return 'overdue';
    return 'pending';
  };

  return {
    selectedDate,
    payments,
    overduePayments,
    isLoading,
    refreshing,
    onRefresh,
    handleDayPress,
    handlePaymentPress,
    getMarkedDates,
    getSelectedDatePayments,
    getUpcomingPaymentsList,
    formatCurrency,
    getPaymentStatus,
  };
}
