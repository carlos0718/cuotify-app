import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { getLoans, getLoanStats, getNextPendingPaymentDatesByLoan } from '../services/supabase';
import { LoanStats, emptyLoanStats } from '../services/supabase/loans';
import { Borrower } from '../types';

export interface LoanListItem {
  id: string;
  principal_amount: number;
  total_amount: number;
  status: 'active' | 'completed' | 'defaulted' | 'cancelled';
  color_code: string;
  currency: 'ARS' | 'USD';
  first_payment_date: string;
  borrower: Borrower | null;
}

export type LoansListFilter = 'all' | 'active' | 'completed';

export function useLoansList() {
  const [loans, setLoans] = useState<LoanListItem[]>([]);
  const [stats, setStats] = useState<LoanStats>(emptyLoanStats());
  const [nextPaymentDates, setNextPaymentDates] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<LoansListFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [loansData, statsData] = await Promise.all([
        getLoans(),
        getLoanStats(),
      ]);
      setLoans(loansData as LoanListItem[]);
      setStats(statsData);
      const activeIds = (loansData as LoanListItem[]).filter(l => l.status === 'active').map(l => l.id);
      const nextDates = await getNextPendingPaymentDatesByLoan(activeIds);
      setNextPaymentDates(nextDates);
    } catch (error) {
      console.error('Error loading loans:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Cargar datos cuando la pantalla recibe foco
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

  const handleLinkLoan = () => {
    router.push('/(main)/loans/link');
  };

  const filteredLoans = loans.filter(loan => {
    const matchesFilter = filter === 'all' || loan.status === filter;
    const matchesSearch = searchQuery.trim() === '' ||
      loan.borrower?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && (matchesSearch ?? true);
  });

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

  const getLoanStatus = (loan: LoanListItem): 'active' | 'completed' | 'overdue' => {
    if (loan.status === 'completed') return 'completed';
    // Aquí podrías verificar si hay pagos vencidos
    return 'active';
  };

  const getDueInfo = (loan: LoanListItem): string => {
    if (loan.status === 'completed') return 'Completado';
    const nextDueDateStr = nextPaymentDates[loan.id];
    if (!nextDueDateStr) return 'Al día';
    const nextPayment = new Date(nextDueDateStr + 'T12:00:00');
    const today = new Date();
    const diffDays = Math.ceil((nextPayment.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return `Vencido hace ${Math.abs(diffDays)} días`;
    if (diffDays === 0) return 'Vence hoy';
    return `Próximo pago en ${diffDays} días`;
  };

  return {
    loans,
    stats,
    isLoading,
    refreshing,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    filteredLoans,
    onRefresh,
    handleNewLoan,
    handleLinkLoan,
    formatCurrency,
    getLoanStatus,
    getDueInfo,
  };
}
