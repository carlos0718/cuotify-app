import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, DateData } from 'react-native-calendars';
import { router, useFocusEffect } from 'expo-router';
import { getUpcomingPayments, getOverduePayments } from '../../../services/supabase';
import { colors, spacing, borderRadius, fontSize, fontWeight, shadow } from '../../../theme';
import { Borrower } from '../../../types';

interface PaymentWithLoan {
  id: string;
  due_date: string;
  total_amount: number;
  status: 'pending' | 'paid' | 'partial' | 'overdue';
  payment_number: number;
  loan: {
    id: string;
    principal_amount: number;
    borrower: Borrower | null;
  } | null;
}

export default function CalendarScreen() {
  const [selectedDate, setSelectedDate] = useState('');
  const [payments, setPayments] = useState<PaymentWithLoan[]>([]);
  const [overduePayments, setOverduePayments] = useState<PaymentWithLoan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [upcomingData, overdueData] = await Promise.all([
        getUpcomingPayments(60), // Próximos 60 días
        getOverduePayments(),
      ]);
      setPayments(upcomingData as PaymentWithLoan[]);
      setOverduePayments(overdueData as PaymentWithLoan[]);
    } catch (error) {
      console.error('Error loading calendar:', error);
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

  const handleDayPress = (day: DateData) => {
    setSelectedDate(day.dateString);
  };

  const handlePaymentPress = (loanId: string) => {
    router.push(`/(main)/loans/${loanId}`);
  };

  // Crear marcadores para el calendario
  const getMarkedDates = () => {
    const marks: Record<string, { marked: boolean; dotColor: string; selected?: boolean; selectedColor?: string }> = {};

    // Pagos pendientes
    payments.forEach(payment => {
      marks[payment.due_date] = {
        marked: true,
        dotColor: colors.warning,
      };
    });

    // Pagos vencidos
    overduePayments.forEach(payment => {
      marks[payment.due_date] = {
        marked: true,
        dotColor: colors.error,
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

  // Obtener próximos pagos (combinando pendientes y vencidos)
  const getUpcomingPaymentsList = () => {
    const allPayments = [...overduePayments, ...payments];
    return allPayments.slice(0, 5); // Máximo 5
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getPaymentStatus = (payment: PaymentWithLoan): 'overdue' | 'pending' | 'paid' => {
    if (payment.status === 'paid') return 'paid';
    const today = new Date().toISOString().split('T')[0];
    if (payment.due_date < today) return 'overdue';
    return 'pending';
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]} edges={['top']}>
        <ActivityIndicator size="large" color={colors.primary.main} />
      </SafeAreaView>
    );
  }

  const selectedPayments = getSelectedDatePayments();
  const upcomingList = getUpcomingPaymentsList();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Calendario de Pagos</Text>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Calendario */}
        <View style={styles.calendarContainer}>
          <Calendar
            onDayPress={handleDayPress}
            markedDates={getMarkedDates()}
            theme={{
              backgroundColor: colors.surface,
              calendarBackground: colors.surface,
              textSectionTitleColor: colors.text.secondary,
              selectedDayBackgroundColor: colors.primary.main,
              selectedDayTextColor: colors.text.inverse,
              todayTextColor: colors.primary.main,
              dayTextColor: colors.text.primary,
              textDisabledColor: colors.text.disabled,
              dotColor: colors.primary.main,
              selectedDotColor: colors.text.inverse,
              arrowColor: colors.primary.main,
              monthTextColor: colors.text.primary,
              textMonthFontWeight: fontWeight.bold,
              textDayFontSize: fontSize.sm,
              textMonthFontSize: fontSize.lg,
              textDayHeaderFontSize: fontSize.xs,
            }}
            style={styles.calendar}
          />
        </View>

        {/* Leyenda */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
            <Text style={styles.legendText}>Pagado</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
            <Text style={styles.legendText}>Pendiente</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.error }]} />
            <Text style={styles.legendText}>Vencido</Text>
          </View>
        </View>

        {/* Pagos del día seleccionado */}
        {selectedDate && (
          <View style={styles.selectedDateSection}>
            <Text style={styles.selectedDateTitle}>
              Pagos del {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-AR', {
                day: 'numeric',
                month: 'long',
              })}
            </Text>

            {selectedPayments.length > 0 ? (
              selectedPayments.map((payment) => {
                const status = getPaymentStatus(payment);
                return (
                  <TouchableOpacity
                    key={payment.id}
                    style={styles.paymentCard}
                    onPress={() => payment.loan && handlePaymentPress(payment.loan.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.paymentHeader}>
                      <Text style={styles.paymentName}>
                        {payment.loan?.borrower?.full_name || 'Sin nombre'}
                      </Text>
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor:
                              status === 'overdue'
                                ? colors.error + '20'
                                : status === 'paid'
                                ? colors.success + '20'
                                : colors.warning + '20',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            {
                              color:
                                status === 'overdue'
                                  ? colors.error
                                  : status === 'paid'
                                  ? colors.success
                                  : colors.warning,
                            },
                          ]}
                        >
                          {status === 'overdue' ? 'Vencido' : status === 'paid' ? 'Pagado' : 'Pendiente'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.paymentType}>Cuota #{payment.payment_number}</Text>
                    <Text style={styles.paymentAmount}>{formatCurrency(payment.total_amount)}</Text>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.noPayments}>
                <Text style={styles.noPaymentsText}>
                  No hay pagos programados para esta fecha
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Próximos pagos */}
        <View style={styles.upcomingSection}>
          <Text style={styles.sectionTitle}>
            {overduePayments.length > 0 ? 'Pagos Pendientes' : 'Próximos Pagos'}
          </Text>
          {upcomingList.length > 0 ? (
            upcomingList.map((payment) => {
              const status = getPaymentStatus(payment);
              return (
                <TouchableOpacity
                  key={payment.id}
                  style={styles.upcomingCard}
                  onPress={() => payment.loan && handlePaymentPress(payment.loan.id)}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.upcomingDate,
                    status === 'overdue' && { backgroundColor: colors.error + '15' }
                  ]}>
                    <Text style={[
                      styles.upcomingDay,
                      status === 'overdue' && { color: colors.error }
                    ]}>
                      {new Date(payment.due_date + 'T12:00:00').getDate()}
                    </Text>
                    <Text style={[
                      styles.upcomingMonth,
                      status === 'overdue' && { color: colors.error }
                    ]}>
                      {new Date(payment.due_date + 'T12:00:00').toLocaleDateString('es-AR', {
                        month: 'short',
                      })}
                    </Text>
                  </View>
                  <View style={styles.upcomingInfo}>
                    <Text style={styles.upcomingName}>
                      {payment.loan?.borrower?.full_name || 'Sin nombre'}
                    </Text>
                    <Text style={styles.upcomingType}>
                      Cuota #{payment.payment_number}
                      {status === 'overdue' && ' • Vencido'}
                    </Text>
                  </View>
                  <Text style={[
                    styles.upcomingAmount,
                    status === 'overdue' && { color: colors.error }
                  ]}>
                    {formatCurrency(payment.total_amount)}
                  </Text>
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.noPayments}>
              <Text style={styles.noPaymentsText}>
                No hay pagos próximos
              </Text>
            </View>
          )}
        </View>

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  calendarContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadow.md,
  },
  calendar: {
    borderRadius: borderRadius.xl,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
  },
  selectedDateSection: {
    marginTop: spacing.lg,
  },
  selectedDateTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  paymentCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadow.sm,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  paymentName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semiBold,
    color: colors.text.primary,
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
  paymentType: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  paymentAmount: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  noPayments: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  noPaymentsText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  upcomingSection: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  upcomingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadow.sm,
  },
  upcomingDate: {
    width: 50,
    height: 50,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary.main + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  upcomingDay: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.primary.main,
  },
  upcomingMonth: {
    fontSize: fontSize.xs,
    color: colors.primary.main,
    textTransform: 'uppercase',
  },
  upcomingInfo: {
    flex: 1,
  },
  upcomingName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semiBold,
    color: colors.text.primary,
  },
  upcomingType: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  upcomingAmount: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
});
