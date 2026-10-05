import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  getPersonalDebts,
  getDebtStats,
  getNextPendingPaymentDates,
  getLinkedLoans,
  getNextPendingPaymentDatesByLoan,
  getLinkedLoanPaymentStats,
} from '../services/supabase';
import { PersonalDebt, DebtStats, emptyDebtStats } from '../services/supabase/personalDebts';
import { CurrencyType } from '../types';

export interface LinkedLoan {
  id: string;
  status: 'active' | 'completed' | 'defaulted' | 'cancelled';
  [key: string]: unknown;
}

export type DebtsListFilter = 'all' | 'active' | 'completed';

export function useDebtsList() {
  const [debts, setDebts] = useState<PersonalDebt[]>([]);
  const [linkedLoans, setLinkedLoans] = useState<LinkedLoan[]>([]);
  const [stats, setStats] = useState<DebtStats>(emptyDebtStats());
  const [nextPaymentDates, setNextPaymentDates] = useState<Record<string, string>>({});
  const [nextLoanPaymentDates, setNextLoanPaymentDates] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<DebtsListFilter>('all');

  const loadData = useCallback(async () => {
    try {
      const [debtsData, statsData, linkedLoansData] = await Promise.all([
        getPersonalDebts(),
        getDebtStats(),
        getLinkedLoans(),
      ]);
      setDebts(debtsData);
      setLinkedLoans(linkedLoansData as LinkedLoan[]);

      const activeDebtIds = debtsData.filter(d => d.status === 'active').map(d => d.id);
      const activeLoanIds = (linkedLoansData as LinkedLoan[]).filter(l => l.status === 'active').map(l => l.id);
      const allLoanIds = (linkedLoansData as LinkedLoan[]).map(l => l.id);

      const linkedStats = await getLinkedLoanPaymentStats(allLoanIds);

      // Fusionar deudas propias + préstamos vinculados, respetando la moneda (L2)
      const byCurrency = emptyDebtStats().byCurrency;
      for (const currency of ['ARS', 'USD'] as CurrencyType[]) {
        byCurrency[currency] = {
          totalOwed: statsData.byCurrency[currency].totalOwed,
          totalToPay: statsData.byCurrency[currency].totalToPay + linkedStats[currency].totalToPay,
          totalPaid: statsData.byCurrency[currency].totalPaid + linkedStats[currency].totalPaid,
          remainingToPay:
            statsData.byCurrency[currency].remainingToPay + linkedStats[currency].remainingToPay,
        };
      }
      const currencies = (['ARS', 'USD'] as CurrencyType[]).filter(
        c => byCurrency[c].totalToPay > 0 || byCurrency[c].totalPaid > 0
      );

      setStats({
        totalDebts: statsData.totalDebts,
        activeDebts: statsData.activeDebts,
        completedDebts: statsData.completedDebts,
        currencies,
        byCurrency,
      });

      const [nextDates, nextLoanDates] = await Promise.all([
        getNextPendingPaymentDates(activeDebtIds),
        getNextPendingPaymentDatesByLoan(activeLoanIds),
      ]);
      setNextPaymentDates(nextDates);
      setNextLoanPaymentDates(nextLoanDates);
    } catch (error) {
      console.error('Error loading debts:', error);
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

  const filteredDebts = debts.filter(debt => {
    if (filter === 'all') return true;
    if (filter === 'active') return debt.status === 'active';
    if (filter === 'completed') return debt.status === 'completed';
    return true;
  });

  const formatCurrency = (amount: number, currency: CurrencyType = 'ARS') => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getDueLoanInfo = (loan: LinkedLoan): string => {
    if (loan.status === 'completed') return 'Completado';
    const nextDueDateStr = nextLoanPaymentDates[loan.id];
    if (!nextDueDateStr) return 'Al día';
    const nextPayment = new Date(nextDueDateStr + 'T12:00:00');
    const today = new Date();
    const diffDays = Math.ceil((nextPayment.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return `Vencido hace ${Math.abs(diffDays)} días`;
    if (diffDays === 0) return 'Vence hoy';
    return `Próximo pago en ${diffDays} días`;
  };

  const getDueInfo = (debt: PersonalDebt): string => {
    if (debt.status === 'completed') return 'Completada';
    if (debt.status === 'cancelled') return 'Cancelada';
    // Usar la próxima cuota pendiente real en lugar del first_payment_date
    const nextDueDateStr = nextPaymentDates[debt.id];
    if (!nextDueDateStr) return 'Al día';
    const nextPayment = new Date(nextDueDateStr + 'T12:00:00');
    const today = new Date();
    const diffDays = Math.ceil((nextPayment.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return `Vencido hace ${Math.abs(diffDays)} días`;
    if (diffDays === 0) return 'Vence hoy';
    return `Próximo pago en ${diffDays} días`;
  };

  return {
    stats,
    linkedLoans,
    isLoading,
    refreshing,
    filter,
    setFilter,
    filteredDebts,
    onRefresh,
    formatCurrency,
    getDueLoanInfo,
    getDueInfo,
  };
}
