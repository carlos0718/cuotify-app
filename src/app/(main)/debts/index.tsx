import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { getPersonalDebts, getDebtStats } from '../../../services/supabase';
import { colors, spacing, borderRadius, fontSize, fontWeight, shadow } from '../../../theme';
import { PersonalDebt } from '../../../services/supabase/personalDebts';

function DebtListCard({
  id,
  creditorName,
  amount,
  dueInfo,
  status,
  color,
}: {
  id: string;
  creditorName: string;
  amount: string;
  dueInfo: string;
  status: 'active' | 'completed' | 'cancelled';
  color: string;
}) {
  const statusColors = {
    active: colors.primary.main,
    completed: colors.success,
    cancelled: colors.text.disabled,
  };

  const statusLabels = {
    active: 'Activa',
    completed: 'Completada',
    cancelled: 'Cancelada',
  };

  return (
    <TouchableOpacity
      style={[styles.debtCard, { backgroundColor: color + '15' }]}
      onPress={() => router.push(`/(main)/debts/${id}` as any)}
      activeOpacity={0.7}
    >
      <View style={[styles.debtCardBorder, { backgroundColor: color }]} />
      <View style={styles.debtCardContent}>
        <View style={styles.debtCardHeader}>
          <View style={styles.debtCardHeaderLeft}>
            <View style={[styles.avatarCircle, { backgroundColor: color }]}>
              <Text style={styles.avatarText}>
                {creditorName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={styles.debtCardName}>{creditorName}</Text>
              <Text style={styles.debtCardDue}>{dueInfo}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColors[status] + '20' }]}>
            <Text style={[styles.statusText, { color: statusColors[status] }]}>
              {statusLabels[status]}
            </Text>
          </View>
        </View>
        <View style={styles.debtCardFooter}>
          <Text style={styles.debtCardAmount}>{amount}</Text>
          <Text style={[styles.debtCardArrow, { color: color }]}>→</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function DebtsScreen() {
  const [debts, setDebts] = useState<PersonalDebt[]>([]);
  const [stats, setStats] = useState({ totalDebts: 0, activeDebts: 0, totalToPay: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  const loadData = async () => {
    try {
      const [debtsData, statsData] = await Promise.all([
        getPersonalDebts(),
        getDebtStats(),
      ]);
      setDebts(debtsData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading debts:', error);
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

  const filteredDebts = debts.filter(debt => {
    if (filter === 'all') return true;
    if (filter === 'active') return debt.status === 'active';
    if (filter === 'completed') return debt.status === 'completed';
    return true;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getDueInfo = (debt: PersonalDebt): string => {
    if (debt.status === 'completed') return 'Completada';
    if (debt.status === 'cancelled') return 'Cancelada';
    const nextPayment = new Date(debt.first_payment_date + 'T12:00:00');
    const today = new Date();
    const diffDays = Math.ceil((nextPayment.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return `Vencido hace ${Math.abs(diffDays)} días`;
    if (diffDays === 0) return 'Vence hoy';
    return `Próximo pago en ${diffDays} días`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Mis Deudas</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => router.push('/(main)/debts/create' as any)}>
          <Text style={styles.addButtonText}>+ Nuevo</Text>
        </TouchableOpacity>
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
          <Text style={[styles.filterText, filter === 'active' && styles.filterTextActive]}>Activas</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'completed' && styles.filterButtonActive]}
          onPress={() => setFilter('completed')}
        >
          <Text style={[styles.filterText, filter === 'completed' && styles.filterTextActive]}>Completadas</Text>
        </TouchableOpacity>
      </View>

      {/* Resumen */}
      <View style={styles.summarySection}>
        {/* Total a pagar - Full width */}
        <View style={[styles.summaryCard, styles.summaryCardPrimary]}>
          <View style={[styles.summaryIcon, styles.summaryIconLight]}>
            <Text style={styles.summaryIconText}>$</Text>
          </View>
          <View style={styles.summaryContent}>
            <Text style={styles.summaryLabelLight}>Total a pagar</Text>
            <Text style={styles.summaryValueLarge} numberOfLines={1} adjustsFontSizeToFit>
              {formatCurrency(stats.totalToPay)}
            </Text>
          </View>
        </View>
        {/* Deudas y Activas - Side by side */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, styles.summaryCardSmall, styles.summaryCardInfo]}>
            <View style={[styles.summaryIconSmall, styles.summaryIconInfo]}>
              <Text style={styles.summaryIconTextSmall}>📋</Text>
            </View>
            <View>
              <Text style={styles.summaryLabelDark}>Deudas</Text>
              <Text style={[styles.summaryValueSmall, { color: colors.primary.main }]}>
                {stats.totalDebts}
              </Text>
            </View>
          </View>
          <View style={[styles.summaryCard, styles.summaryCardSmall, styles.summaryCardSuccess]}>
            <View style={[styles.summaryIconSmall, styles.summaryIconSuccess]}>
              <Text style={styles.summaryIconTextSmall}>✓</Text>
            </View>
            <View>
              <Text style={styles.summaryLabelDark}>Activas</Text>
              <Text style={[styles.summaryValueSmall, { color: colors.success }]}>
                {stats.activeDebts}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Lista de deudas */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
        </View>
      ) : filteredDebts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No hay deudas</Text>
          <Text style={styles.emptySubtext}>Registra tu primera deuda personal</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {filteredDebts.map((debt) => (
            <DebtListCard
              key={debt.id}
              id={debt.id}
              creditorName={debt.creditor_name}
              amount={formatCurrency(debt.total_amount)}
              dueInfo={getDueInfo(debt)}
              status={debt.status}
              color={debt.color_code || colors.primary.main}
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
  debtCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...shadow.sm,
  },
  debtCardBorder: {
    width: 4,
  },
  debtCardContent: {
    flex: 1,
    padding: spacing.md,
  },
  debtCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  debtCardHeaderLeft: {
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
  debtCardName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semiBold,
    color: colors.text.primary,
  },
  debtCardDue: {
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
  debtCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  debtCardAmount: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  debtCardArrow: {
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
