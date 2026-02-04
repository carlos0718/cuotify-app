import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useAuthStore } from '../../../store';
import { getLoans, getLoanStats, getUpcomingPayments, getActivePersonalDebts, getDebtStats } from '../../../services/supabase';
import { colors, gradients, spacing, borderRadius, fontSize, fontWeight, shadow } from '../../../theme';
import { Borrower } from '../../../types';
import { PersonalDebt, DebtStats } from '../../../services/supabase/personalDebts';

// Icono de campana para notificaciones
function BellIcon({ color = '#FFFFFF', size = 22 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

interface LoanWithBorrower {
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

interface PaymentWithLoan {
  id: string;
  due_date: string;
  total_amount: number;
  status: string;
  loan: {
    id: string;
    borrower: Borrower | null;
  } | null;
}

// Componente de progreso circular simplificado
function CircularProgress({
  percentage,
  totalAmount,
  size = 180,
  strokeWidth = 12,
}: {
  percentage: number;
  totalAmount: number;
  size?: number;
  strokeWidth?: number;
}) {
  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`;
    }
    return `$${amount.toFixed(0)}`;
  };

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Círculo de fondo */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: 'rgba(255, 255, 255, 0.2)',
        }}
      />
      {/* Círculo de progreso - solo si hay porcentaje > 0 */}
      {percentage > 0 && (
        <View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: colors.text.inverse,
            borderTopColor: 'transparent',
            borderRightColor: 'transparent',
            transform: [{ rotate: `${(percentage / 100) * 360 - 90}deg` }],
          }}
        />
      )}
      {/* Texto central */}
      <View style={{ alignItems: 'center' }}>
        <Text style={styles.progressLabel}>TOTAL</Text>
        <Text style={styles.progressValue}>{percentage}% COBRADO</Text>
        <Text style={styles.progressSubtext}>
          {totalAmount > 0 ? `DE ${formatCurrency(totalAmount)}` : 'SIN PRÉSTAMOS'}
        </Text>
      </View>
    </View>
  );
}

// Tarjeta de préstamo
function LoanCard({
  title,
  amount,
  subtitle,
  color,
  onPress,
}: {
  title: string;
  amount: string;
  subtitle: string;
  color: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.loanCard, { backgroundColor: color }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={styles.loanCardTitle} numberOfLines={1}>{title}</Text>
      <Text style={styles.loanCardAmount}>{amount}</Text>
      <Text style={styles.loanCardSubtitle}>{subtitle}</Text>
    </TouchableOpacity>
  );
}

// Tarjeta de estadística
function StatCard({
  title,
  value,
  subtitle,
  icon,
  variant = 'default',
  fullWidth = false,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon?: string;
  variant?: 'default' | 'primary' | 'success' | 'warning';
  fullWidth?: boolean;
}) {
  const variantStyles = {
    default: {
      bg: colors.surface,
      iconBg: colors.primary.main + '15',
      iconColor: colors.primary.main,
      titleColor: colors.text.secondary,
      valueColor: colors.text.primary,
    },
    primary: {
      bg: colors.primary.main,
      iconBg: 'rgba(255, 255, 255, 0.2)',
      iconColor: colors.text.inverse,
      titleColor: 'rgba(255, 255, 255, 0.8)',
      valueColor: colors.text.inverse,
    },
    success: {
      bg: colors.success + '15',
      iconBg: colors.success + '25',
      iconColor: colors.success,
      titleColor: colors.text.secondary,
      valueColor: colors.success,
    },
    warning: {
      bg: colors.warning + '15',
      iconBg: colors.warning + '25',
      iconColor: colors.warning,
      titleColor: colors.text.secondary,
      valueColor: colors.warning,
    },
  };

  const style = variantStyles[variant];

  return (
    <View style={[
      styles.statCard,
      { backgroundColor: style.bg },
      fullWidth && styles.statCardFullWidth,
    ]}>
      {icon && (
        <View style={[styles.statIcon, { backgroundColor: style.iconBg }]}>
          <Text style={[styles.statIconText, { color: style.iconColor }]}>{icon}</Text>
        </View>
      )}
      <View style={fullWidth ? styles.statContentRow : styles.statContentColumn}>
        <Text style={[styles.statTitle, { color: style.titleColor }]}>{title}</Text>
        <Text style={[styles.statValue, { color: style.valueColor }, fullWidth && styles.statValueLarge]} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        {subtitle && <Text style={[styles.statSubtitle, { color: style.titleColor }]}>{subtitle}</Text>}
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const { profile, isLender, isBorrower } = useAuthStore();
  const [loans, setLoans] = useState<LoanWithBorrower[]>([]);
  const [stats, setStats] = useState({ totalLoans: 0, totalLent: 0, totalExpected: 0, activeLoans: 0, completedLoans: 0 });
  const [upcomingPayments, setUpcomingPayments] = useState<PaymentWithLoan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Estados para deudas personales
  const [debts, setDebts] = useState<PersonalDebt[]>([]);
  const [debtStats, setDebtStats] = useState<DebtStats | null>(null);

  const loadData = async () => {
    try {
      const [loansData, statsData, paymentsData, debtsData, debtStatsData] = await Promise.all([
        getLoans(),
        getLoanStats(),
        getUpcomingPayments(7),
        getActivePersonalDebts(),
        getDebtStats(),
      ]);
      setLoans(loansData as LoanWithBorrower[]);
      setStats(statsData);
      setUpcomingPayments(paymentsData as PaymentWithLoan[]);
      setDebts(debtsData);
      setDebtStats(debtStatsData);
    } catch (error) {
      console.error('Error loading dashboard:', error);
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

  const handleNewLoan = () => {
    router.push('/(main)/loans/create');
  };

  const handleViewLoans = () => {
    router.push('/(main)/loans');
  };

  const handleViewLoan = (id: string) => {
    router.push(`/(main)/loans/${id}`);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getDueInfo = (loan: LoanWithBorrower): string => {
    if (loan.status === 'completed') return 'Completado';
    const nextPayment = new Date(loan.first_payment_date);
    const today = new Date();
    const diffDays = Math.ceil((nextPayment.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return `Vencido hace ${Math.abs(diffDays)} días`;
    if (diffDays === 0) return 'Vence hoy';
    return `Vence en ${diffDays} días`;
  };

  // Calcular porcentaje cobrado (basado en préstamos completados)
  const calculatePercentage = () => {
    if (stats.totalLoans === 0) return 0;
    return Math.round((stats.completedLoans / stats.totalLoans) * 100);
  };

  // Obtener los préstamos activos más recientes (máximo 2)
  const activeLoans = loans.filter(l => l.status === 'active').slice(0, 2);

  // Nombres de días abreviados en español
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

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
        dayName: dayNames[date.getDay()],
        hasPayment: dayPayments.length > 0,
        isToday: i === 0,
      });
    }
    return days;
  };

  // Obtener mes actual
  const getCurrentMonth = () => {
    const today = new Date();
    return `${monthNames[today.getMonth()]} ${today.getFullYear()}`;
  };

  const loanColors = [colors.primary.main, colors.secondary.main, '#14B8A6', '#F59E0B'];

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary.main} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={gradients.header} style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.greeting}>
                Hola, {profile?.full_name?.split(' ')[0] || 'Usuario'}
              </Text>
              <Text style={styles.subtitle}>
                {isLender() ? 'Tu resumen de préstamos' : 'Tu resumen de deudas'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.notificationButton}
              onPress={() => router.push('/(main)/notifications')}
            >
              <BellIcon />
              {upcomingPayments.length > 0 && <View style={styles.notificationBadge} />}
            </TouchableOpacity>
          </View>

          <View style={styles.progressContainer}>
            <CircularProgress
              percentage={calculatePercentage()}
              totalAmount={stats.totalExpected}
            />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Tarjetas de préstamos activos */}
        {activeLoans.length > 0 ? (
          <View style={styles.loanCardsContainer}>
            {activeLoans.map((loan, index) => (
              <LoanCard
                key={loan.id}
                title={loan.borrower?.full_name?.toUpperCase() || 'SIN NOMBRE'}
                amount={formatCurrency(loan.total_amount)}
                subtitle={getDueInfo(loan)}
                color={loan.color_code || loanColors[index % loanColors.length]}
                onPress={() => handleViewLoan(loan.id)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyLoansContainer}>
            <Text style={styles.emptyLoansText}>No hay préstamos activos</Text>
            {isLender() && (
              <TouchableOpacity style={styles.emptyLoansButton} onPress={handleNewLoan}>
                <Text style={styles.emptyLoansButtonText}>Crear primer préstamo</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Tercer préstamo si existe */}
        {loans.filter(l => l.status === 'active').length > 2 && (
          <TouchableOpacity
            style={styles.emergencyCard}
            onPress={handleViewLoans}
            activeOpacity={0.8}
          >
            <View style={styles.emergencyIcon}>
              <Text style={styles.emergencyIconText}>+{loans.filter(l => l.status === 'active').length - 2}</Text>
            </View>
            <View style={styles.emergencyContent}>
              <Text style={styles.emergencyTitle}>MÁS PRÉSTAMOS</Text>
              <Text style={styles.emergencyAmount}>Ver todos</Text>
              <Text style={styles.emergencyStatus}>{loans.filter(l => l.status === 'active').length} activos en total</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Estadísticas de préstamos - Solo si es prestamista */}
        {isLender() && (
          <View style={styles.statsSection}>
            {/* Por cobrar - Full width */}
            <StatCard
              title="Por cobrar"
              value={formatCurrency(stats.totalExpected - (stats.totalExpected * (calculatePercentage() / 100)))}
              icon="$"
              variant="primary"
              fullWidth
            />
            {/* Préstamos activos y Completados - Side by side */}
            <View style={styles.statsRow}>
              <StatCard
                title="Préstamos activos"
                value={stats.activeLoans.toString()}
                icon="📋"
                variant="warning"
              />
              <StatCard
                title="Completados"
                value={stats.completedLoans.toString()}
                icon="✓"
                variant="success"
              />
            </View>
          </View>
        )}

        {/* Resumen de deudas personales */}
        {debtStats && (debtStats.activeDebts > 0 || isBorrower()) && (
          <View style={styles.debtsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>MIS DEUDAS</Text>
              <TouchableOpacity onPress={() => router.push('/(main)/debts' as any)}>
                <Text style={styles.sectionLink}>Ver todas</Text>
              </TouchableOpacity>
            </View>

            {debtStats.activeDebts > 0 ? (
              <View style={styles.debtsSummaryCard}>
                <View style={styles.debtsSummaryRow}>
                  <View style={styles.debtsSummaryItem}>
                    <Text style={styles.debtsSummaryLabel}>Deudas activas</Text>
                    <Text style={styles.debtsSummaryValue}>{debtStats.activeDebts}</Text>
                  </View>
                  <View style={styles.debtsSummaryItem}>
                    <Text style={styles.debtsSummaryLabel}>Total a pagar</Text>
                    <Text style={[styles.debtsSummaryValue, { color: colors.error }]}>
                      {formatCurrency(debtStats.remainingToPay)}
                    </Text>
                  </View>
                </View>
                <View style={styles.debtsProgressContainer}>
                  <View style={styles.debtsProgressBg}>
                    <View
                      style={[
                        styles.debtsProgressFill,
                        { width: `${debtStats.totalToPay > 0 ? (debtStats.totalPaid / debtStats.totalToPay) * 100 : 0}%` }
                      ]}
                    />
                  </View>
                  <Text style={styles.debtsProgressText}>
                    {formatCurrency(debtStats.totalPaid)} pagado de {formatCurrency(debtStats.totalToPay)}
                  </Text>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.debtsEmptyCard}
                onPress={() => router.push('/(main)/debts/create' as any)}
              >
                <Text style={styles.debtsEmptyText}>No tienes deudas registradas</Text>
                <Text style={styles.debtsEmptyAction}>+ Registrar una deuda</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Próximos pagos */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>PRÓXIMOS PAGOS</Text>
            <Text style={styles.sectionMonth}>{getCurrentMonth()}</Text>
          </View>
          <View style={styles.calendarPreview}>
            {getUpcomingDays().map((item, index) => (
              <View
                key={index}
                style={[
                  styles.calendarDay,
                  item.isToday && styles.calendarDayActive,
                ]}
              >
                <Text
                  style={[
                    styles.calendarDayName,
                    item.isToday && styles.calendarDayNameActive,
                  ]}
                >
                  {item.dayName}
                </Text>
                <Text
                  style={[
                    styles.calendarDayText,
                    item.isToday && styles.calendarDayTextActive,
                  ]}
                >
                  {item.day}
                </Text>
                {item.hasPayment && (
                  <View style={styles.calendarDot} />
                )}
              </View>
            ))}
          </View>
          {upcomingPayments.length > 0 ? (
            <Text style={styles.upcomingInfo}>
              {upcomingPayments.length} {isLender() ? 'cobro' : 'pago'}{upcomingPayments.length > 1 ? 's' : ''} pendiente{upcomingPayments.length > 1 ? 's' : ''} esta semana
            </Text>
          ) : (
            <Text style={styles.upcomingInfoEmpty}>
              {isLender()
                ? 'No tienes cobros pendientes esta semana'
                : 'No tienes pagos pendientes esta semana'}
            </Text>
          )}
        </View>

        {/* Botón de acción */}
        {isLender() && (
          <TouchableOpacity style={styles.actionButton} onPress={handleNewLoan}>
            <Text style={styles.actionButtonText}>+ Nuevo Préstamo</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: borderRadius['2xl'],
    borderBottomRightRadius: borderRadius['2xl'],
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  greeting: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text.inverse,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: spacing.xs,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.error,
  },
  progressContainer: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  progressLabel: {
    fontSize: fontSize.sm,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: spacing.xs,
  },
  progressValue: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text.inverse,
  },
  progressSubtext: {
    fontSize: fontSize.sm,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: spacing.xs,
  },
  content: {
    flex: 1,
    marginTop: -spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  loanCardsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl * 2,
  },
  loanCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    ...shadow.md,
  },
  loanCardTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semiBold,
    color: colors.text.inverse,
    opacity: 0.9,
  },
  loanCardAmount: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.inverse,
    marginVertical: spacing.xs,
  },
  loanCardSubtitle: {
    fontSize: fontSize.xs,
    color: colors.text.inverse,
    opacity: 0.8,
  },
  emptyLoansContainer: {
    marginTop: spacing.xl * 2,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    ...shadow.sm,
  },
  emptyLoansText: {
    fontSize: fontSize.base,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  emptyLoansButton: {
    backgroundColor: colors.primary.main,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  emptyLoansButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semiBold,
    color: colors.text.inverse,
  },
  emergencyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#14B8A6',
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    marginTop: spacing.md,
    ...shadow.md,
  },
  emergencyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  emergencyIconText: {
    fontSize: fontSize.base,
    color: colors.text.inverse,
    fontWeight: fontWeight.bold,
  },
  emergencyContent: {
    flex: 1,
  },
  emergencyTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semiBold,
    color: colors.text.inverse,
    opacity: 0.9,
  },
  emergencyAmount: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.inverse,
  },
  emergencyStatus: {
    fontSize: fontSize.xs,
    color: colors.text.inverse,
    opacity: 0.8,
  },
  statsSection: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    ...shadow.sm,
  },
  statCardFullWidth: {
    paddingVertical: spacing.lg,
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  statIconText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  statContentRow: {
    flex: 1,
  },
  statContentColumn: {
    flex: 1,
  },
  statTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    marginBottom: 2,
  },
  statValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  statValueLarge: {
    fontSize: fontSize['2xl'],
  },
  statSubtitle: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semiBold,
    color: colors.text.secondary,
  },
  sectionMonth: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.primary.main,
  },
  calendarPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadow.sm,
  },
  calendarDay: {
    width: 40,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xs,
  },
  calendarDayActive: {
    backgroundColor: colors.primary.main,
  },
  calendarDayName: {
    fontSize: fontSize.xs,
    color: colors.text.disabled,
    fontWeight: fontWeight.medium,
    marginBottom: 2,
  },
  calendarDayNameActive: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  calendarDayText: {
    fontSize: fontSize.base,
    color: colors.text.primary,
    fontWeight: fontWeight.semiBold,
  },
  calendarDayTextActive: {
    color: colors.text.inverse,
  },
  calendarDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary.main,
    marginTop: 2,
  },
  upcomingInfo: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  upcomingInfoEmpty: {
    fontSize: fontSize.sm,
    color: colors.success,
    textAlign: 'center',
    marginTop: spacing.sm,
    fontWeight: fontWeight.medium,
  },
  actionButton: {
    backgroundColor: colors.primary.main,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    marginTop: spacing.lg,
    ...shadow.md,
  },
  actionButtonText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semiBold,
    color: colors.text.inverse,
  },
  // Estilos para sección de deudas
  debtsSection: {
    marginTop: spacing.lg,
  },
  sectionLink: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.primary.main,
  },
  debtsSummaryCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadow.sm,
  },
  debtsSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  debtsSummaryItem: {
    flex: 1,
  },
  debtsSummaryLabel: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    marginBottom: spacing.xs / 2,
  },
  debtsSummaryValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  debtsProgressContainer: {
    marginTop: spacing.xs,
  },
  debtsProgressBg: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  debtsProgressFill: {
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: borderRadius.full,
  },
  debtsProgressText: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  debtsEmptyCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  debtsEmptyText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  debtsEmptyAction: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semiBold,
    color: colors.primary.main,
  },
});
