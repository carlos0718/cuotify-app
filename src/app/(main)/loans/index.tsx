import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../../store';
import { getLoans, getLoanStats } from '../../../services/supabase';
import { colors, spacing, borderRadius, fontSize, fontWeight, shadow } from '../../../theme';
import { Borrower } from '../../../types';

// Componente de tarjeta de préstamo
function LoanListCard({
  id,
  borrowerName,
  amount,
  dueInfo,
  status,
  color,
}: {
  id: string;
  borrowerName: string;
  amount: string;
  dueInfo: string;
  status: 'active' | 'completed' | 'overdue';
  color: string;
}) {
  const statusColors = {
    active: colors.primary.main,
    completed: colors.success,
    overdue: colors.error,
  };

  const statusLabels = {
    active: 'Activo',
    completed: 'Completado',
    overdue: 'Vencido',
  };

  return (
    <TouchableOpacity
      style={[styles.loanCard, { backgroundColor: color + '15' }]}
      onPress={() => router.push(`/(main)/loans/${id}`)}
      activeOpacity={0.7}
    >
      <View style={[styles.loanCardBorder, { backgroundColor: color }]} />
      <View style={styles.loanCardContent}>
        <View style={styles.loanCardHeader}>
          <View style={styles.loanCardHeaderLeft}>
            <View style={[styles.avatarCircle, { backgroundColor: color }]}>
              <Text style={styles.avatarText}>
                {borrowerName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={styles.loanCardName}>{borrowerName}</Text>
              <Text style={styles.loanCardDue}>{dueInfo}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColors[status] + '20' }]}>
            <Text style={[styles.statusText, { color: statusColors[status] }]}>
              {statusLabels[status]}
            </Text>
          </View>
        </View>
        <View style={styles.loanCardFooter}>
          <Text style={styles.loanCardAmount}>{amount}</Text>
          <Text style={[styles.loanCardArrow, { color: color }]}>→</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

interface LoanWithBorrower {
  id: string;
  principal_amount: number;
  total_amount: number;
  status: 'active' | 'completed' | 'defaulted' | 'cancelled';
  color_code: string;
  currency: 'ARS' | 'USD';
  first_payment_date: string;
  borrower: Borrower | null;
}

export default function LoansScreen() {
  const { isLender } = useAuthStore();
  const [loans, setLoans] = useState<LoanWithBorrower[]>([]);
  const [stats, setStats] = useState({ totalLoans: 0, totalLent: 0, activeLoans: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  const loadData = async () => {
    try {
      const [loansData, statsData] = await Promise.all([
        getLoans(),
        getLoanStats(),
      ]);
      setLoans(loansData as LoanWithBorrower[]);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading loans:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  // Cargar datos cuando la pantalla recibe foco
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
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
    if (filter === 'all') return true;
    if (filter === 'active') return loan.status === 'active';
    if (filter === 'completed') return loan.status === 'completed';
    return true;
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

  const getLoanStatus = (loan: LoanWithBorrower): 'active' | 'completed' | 'overdue' => {
    if (loan.status === 'completed') return 'completed';
    // Aquí podrías verificar si hay pagos vencidos
    return 'active';
  };

  const getDueInfo = (loan: LoanWithBorrower): string => {
    if (loan.status === 'completed') return 'Completado';
    const nextPayment = new Date(loan.first_payment_date);
    const today = new Date();
    const diffDays = Math.ceil((nextPayment.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return `Vencido hace ${Math.abs(diffDays)} días`;
    if (diffDays === 0) return 'Vence hoy';
    return `Próximo pago en ${diffDays} días`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Préstamos</Text>
        {isLender() ? (
          <TouchableOpacity style={styles.addButton} onPress={handleNewLoan}>
            <Text style={styles.addButtonText}>+ Nuevo</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.addButton} onPress={handleLinkLoan}>
            <Text style={styles.addButtonText}>Vincular</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filtros */}
      <View style={styles.filters}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>Todos</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'active' && styles.filterButtonActive]}
          onPress={() => setFilter('active')}
        >
          <Text style={[styles.filterText, filter === 'active' && styles.filterTextActive]}>Activos</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'completed' && styles.filterButtonActive]}
          onPress={() => setFilter('completed')}
        >
          <Text style={[styles.filterText, filter === 'completed' && styles.filterTextActive]}>Completados</Text>
        </TouchableOpacity>
      </View>

      {/* Resumen */}
      <View style={styles.summarySection}>
        {/* Total prestado - Full width */}
        <View style={[styles.summaryCard, styles.summaryCardPrimary]}>
          <View style={[styles.summaryIcon, styles.summaryIconLight]}>
            <Text style={styles.summaryIconText}>$</Text>
          </View>
          <View style={styles.summaryContent}>
            <Text style={styles.summaryLabelLight}>Total prestado</Text>
            <Text style={styles.summaryValueLarge} numberOfLines={1} adjustsFontSizeToFit>
              {formatCurrency(stats.totalLent)}
            </Text>
          </View>
        </View>
        {/* Préstamos y Activos - Side by side */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, styles.summaryCardSmall, styles.summaryCardInfo]}>
            <View style={[styles.summaryIconSmall, styles.summaryIconInfo]}>
              <Text style={styles.summaryIconTextSmall}>📋</Text>
            </View>
            <View>
              <Text style={styles.summaryLabelDark}>Préstamos</Text>
              <Text style={[styles.summaryValueSmall, { color: colors.primary.main }]}>
                {stats.totalLoans}
              </Text>
            </View>
          </View>
          <View style={[styles.summaryCard, styles.summaryCardSmall, styles.summaryCardSuccess]}>
            <View style={[styles.summaryIconSmall, styles.summaryIconSuccess]}>
              <Text style={styles.summaryIconTextSmall}>✓</Text>
            </View>
            <View>
              <Text style={styles.summaryLabelDark}>Activos</Text>
              <Text style={[styles.summaryValueSmall, { color: colors.success }]}>
                {stats.activeLoans}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Lista de préstamos */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
        </View>
      ) : filteredLoans.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No hay préstamos</Text>
          <Text style={styles.emptySubtext}>
            {isLender() ? 'Crea tu primer préstamo' : 'Vincula un préstamo para comenzar'}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {filteredLoans.map((loan) => (
            <LoanListCard
              key={loan.id}
              id={loan.id}
              borrowerName={loan.borrower?.full_name || 'Sin nombre'}
              amount={formatCurrency(loan.total_amount, loan.currency || 'ARS')}
              dueInfo={getDueInfo(loan)}
              status={getLoanStatus(loan)}
              color={loan.color_code || colors.primary.main}
            />
          ))}
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
  addButton: {
    backgroundColor: colors.primary.main,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  addButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semiBold,
    color: colors.text.inverse,
  },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
  },
  filterButtonActive: {
    backgroundColor: colors.primary.main,
  },
  filterText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text.secondary,
  },
  filterTextActive: {
    color: colors.text.inverse,
  },
  summarySection: {
    marginHorizontal: spacing.lg,
    gap: spacing.md,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    ...shadow.sm,
  },
  summaryCardPrimary: {
    backgroundColor: colors.primary.main,
    paddingVertical: spacing.lg,
  },
  summaryCardSmall: {
    flex: 1,
  },
  summaryCardInfo: {
    backgroundColor: colors.primary.main + '15',
  },
  summaryCardSuccess: {
    backgroundColor: colors.success + '15',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  summaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  summaryIconLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  summaryIconSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  summaryIconInfo: {
    backgroundColor: colors.primary.main + '25',
  },
  summaryIconSuccess: {
    backgroundColor: colors.success + '25',
  },
  summaryIconText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.inverse,
  },
  summaryIconTextSmall: {
    fontSize: fontSize.base,
  },
  summaryContent: {
    flex: 1,
  },
  summaryLabelLight: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 2,
  },
  summaryLabelDark: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  summaryValueLarge: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text.inverse,
  },
  summaryValueSmall: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  list: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  loanCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...shadow.sm,
  },
  loanCardBorder: {
    width: 4,
  },
  loanCardContent: {
    flex: 1,
    padding: spacing.md,
  },
  loanCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  loanCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.inverse,
  },
  loanCardName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semiBold,
    color: colors.text.primary,
  },
  loanCardDue: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  loanCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  loanCardAmount: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  loanCardArrow: {
    fontSize: fontSize.xl,
    color: colors.text.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semiBold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  emptySubtext: {
    fontSize: fontSize.base,
    color: colors.text.secondary,
    textAlign: 'center',
  },
});
