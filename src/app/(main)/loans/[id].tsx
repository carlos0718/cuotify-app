import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { getLoanById, getPaymentsByLoan, markPaymentAsPaid, revertPaymentToPending, updateLoanPenalties } from '../../../services/supabase';
import { calculateLatePenalty } from '../../../services/calculations';
import { useToast } from '../../../components';
import { colors, spacing, borderRadius, fontSize, fontWeight, shadow } from '../../../theme';
import { Borrower, Payment, LatePenaltyType } from '../../../types';

interface LoanDetail {
  id: string;
  principal_amount: number;
  interest_rate: number;
  term_value: number;
  term_type: 'weeks' | 'months';
  interest_type?: 'simple' | 'french';
  payment_amount: number;
  total_amount: number;
  total_interest: number;
  delivery_date: string;
  first_payment_date: string;
  end_date: string;
  status: 'active' | 'completed' | 'defaulted' | 'cancelled';
  borrower: Borrower | null;
  grace_period_days: number;
  late_penalty_type: LatePenaltyType;
  late_penalty_rate: number;
}

type PaymentStatus = 'pending' | 'paid' | 'overdue';

// Componente de item de pago
function PaymentItem({
  payment,
  onPress,
  penaltyConfig,
}: {
  payment: Payment;
  onPress: (payment: Payment, status: PaymentStatus, penaltyAmount: number) => void;
  penaltyConfig: {
    gracePeriodDays: number;
    latePenaltyType: LatePenaltyType;
    latePenaltyRate: number;
  };
}) {
  const today = new Date().toISOString().split('T')[0];
  const isOverdue = payment.status === 'pending' && payment.due_date < today;

  const status: PaymentStatus = payment.status === 'paid' ? 'paid' : isOverdue ? 'overdue' : 'pending';

  // Calcular penalización si está vencido
  const penaltyResult = isOverdue && penaltyConfig.latePenaltyType !== 'none'
    ? calculateLatePenalty({
        dueDate: new Date(payment.due_date),
        paymentAmount: payment.total_amount,
        gracePeriodDays: penaltyConfig.gracePeriodDays,
        latePenaltyType: penaltyConfig.latePenaltyType,
        latePenaltyRate: penaltyConfig.latePenaltyRate,
      })
    : null;

  const statusConfig = {
    pending: { color: colors.warning, label: 'Pendiente', bg: colors.warning + '20' },
    paid: { color: colors.success, label: 'Pagado', bg: colors.success + '20' },
    overdue: { color: colors.error, label: 'Vencido', bg: colors.error + '20' },
  };

  const config = statusConfig[status];

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const penaltyAmount = penaltyResult?.penaltyAmount || payment.penalty_amount || 0;

  return (
    <View style={styles.paymentItem}>
      <View style={styles.paymentNumber}>
        <Text style={styles.paymentNumberText}>{payment.payment_number}</Text>
      </View>
      <View style={styles.paymentInfo}>
        <Text style={styles.paymentDate}>{formatDate(payment.due_date)}</Text>
        <View style={styles.paymentAmountRow}>
          <Text style={styles.paymentAmount}>{formatCurrency(payment.total_amount)}</Text>
          {penaltyAmount > 0 && (
            <Text style={styles.penaltyAmount}>+{formatCurrency(penaltyAmount)}</Text>
          )}
        </View>
        {penaltyResult && penaltyResult.daysAfterGrace > 0 && (
          <Text style={styles.penaltyInfo}>
            Mora: {penaltyResult.daysOverdue} días de atraso
          </Text>
        )}
        {penaltyResult && penaltyResult.isOverdue && penaltyResult.daysAfterGrace === 0 && (
          <Text style={styles.graceInfo}>
            En período de gracia ({penaltyConfig.gracePeriodDays - penaltyResult.daysOverdue} días restantes)
          </Text>
        )}
      </View>
      <TouchableOpacity
        style={[styles.paymentStatus, { backgroundColor: config.bg }]}
        onPress={() => onPress(payment, status, penaltyAmount)}
      >
        <Text style={[styles.paymentStatusText, { color: config.color }]}>
          {config.label}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default function LoanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loan, setLoan] = useState<LoanDetail | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<{ payment: Payment; status: PaymentStatus; penaltyAmount: number } | null>(null);
  const { showSuccess, showError } = useToast();

  const loadData = async () => {
    if (!id) return;

    try {
      const [loanData, paymentsData] = await Promise.all([
        getLoanById(id),
        getPaymentsByLoan(id),
      ]);
      setLoan(loanData as LoanDetail);
      setPayments(paymentsData as Payment[]);
    } catch (error) {
      console.error('Error loading loan:', error);
      showError('Error', 'No se pudo cargar el préstamo');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [id])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handlePaymentPress = (payment: Payment, status: PaymentStatus, penaltyAmount: number) => {
    setSelectedPayment({ payment, status, penaltyAmount });
  };

  const handleMarkPaid = async () => {
    if (!selectedPayment) return;

    setIsProcessing(true);
    try {
      await markPaymentAsPaid(selectedPayment.payment.id, selectedPayment.payment.total_amount);
      showSuccess('Pago registrado', 'El pago ha sido marcado como pagado');
      setSelectedPayment(null);
      loadData();
    } catch (error) {
      showError('Error', 'No se pudo registrar el pago');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRevertPayment = async () => {
    if (!selectedPayment) return;

    setIsProcessing(true);
    try {
      await revertPaymentToPending(selectedPayment.payment.id);
      showSuccess('Pago revertido', 'El pago ha sido marcado como pendiente');
      setSelectedPayment(null);
      loadData();
    } catch (error) {
      showError('Error', 'No se pudo revertir el pago');
    } finally {
      setIsProcessing(false);
    }
  };

  const closeModal = () => {
    if (!isProcessing) {
      setSelectedPayment(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]} edges={['top']}>
        <ActivityIndicator size="large" color={colors.primary.main} />
      </SafeAreaView>
    );
  }

  if (!loan) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Volver</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Error</Text>
          <View style={{ width: 70 }} />
        </View>
        <View style={[styles.content, { justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={styles.errorText}>No se encontró el préstamo</Text>
        </View>
      </SafeAreaView>
    );
  }

  const paidCount = payments.filter(p => p.status === 'paid').length;
  const progress = payments.length > 0 ? (paidCount / payments.length) * 100 : 0;
  const termTypeLabel = loan.term_type === 'months' ? 'meses' : 'semanas';
  const paymentPeriodLabel = loan.term_type === 'months' ? 'mes' : 'semana';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Detalle del Préstamo</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Tarjeta de resumen */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View style={styles.borrowerInfo}>
              <Text style={styles.borrowerName}>
                {loan.borrower?.full_name || 'Sin nombre'}
              </Text>
              {loan.borrower?.phone && (
                <Text style={styles.borrowerPhone}>{loan.borrower.phone}</Text>
              )}
              {loan.borrower?.dni && (
                <Text style={styles.borrowerDni}>DNI: {loan.borrower.dni}</Text>
              )}
            </View>
            <View style={styles.progressCircle}>
              <Text style={styles.progressText}>{Math.round(progress)}%</Text>
            </View>
          </View>

          <View style={styles.summaryDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Capital:</Text>
              <Text style={styles.detailValue}>{formatCurrency(loan.principal_amount)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Interés:</Text>
              <Text style={styles.detailValue}>{loan.interest_rate}% anual</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Tipo:</Text>
              <Text style={styles.detailValue}>
                {loan.interest_type === 'french' ? 'Francés' : 'Simple'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Plazo:</Text>
              <Text style={styles.detailValue}>{loan.term_value} {termTypeLabel}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Cuota:</Text>
              <Text style={[styles.detailValue, styles.detailValueHighlight]}>
                {formatCurrency(loan.payment_amount)}/{paymentPeriodLabel}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Total intereses:</Text>
              <Text style={styles.detailValue}>{formatCurrency(loan.total_interest)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Total a pagar:</Text>
              <Text style={[styles.detailValue, styles.detailValueHighlight]}>
                {formatCurrency(loan.total_amount)}
              </Text>
            </View>
          </View>

          <View style={styles.datesSection}>
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>Entrega</Text>
              <Text style={styles.dateValue}>{formatDate(loan.delivery_date)}</Text>
            </View>
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>Primer pago</Text>
              <Text style={styles.dateValue}>{formatDate(loan.first_payment_date)}</Text>
            </View>
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>Fin</Text>
              <Text style={styles.dateValue}>{formatDate(loan.end_date)}</Text>
            </View>
          </View>

          <View style={styles.progressBar}>
            <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressLabel}>
            {paidCount} de {payments.length} cuotas pagadas
          </Text>
        </View>

        {/* Lista de pagos */}
        <View style={styles.paymentsSection}>
          <Text style={styles.sectionTitle}>Cronograma de Pagos</Text>
          {payments.length > 0 ? (
            payments.map((payment) => (
              <PaymentItem
                key={payment.id}
                payment={payment}
                onPress={handlePaymentPress}
                penaltyConfig={{
                  gracePeriodDays: loan.grace_period_days || 7,
                  latePenaltyType: loan.late_penalty_type || 'none',
                  latePenaltyRate: loan.late_penalty_rate || 0,
                }}
              />
            ))
          ) : (
            <View style={styles.noPayments}>
              <Text style={styles.noPaymentsText}>No hay pagos programados</Text>
            </View>
          )}
        </View>

        <View style={{ height: spacing.xl }} />
      </ScrollView>

      {/* Modal de acciones de pago */}
      <Modal
        visible={selectedPayment !== null}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeModal}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cuota #{selectedPayment?.payment.payment_number}</Text>
            <Text style={styles.modalAmount}>
              {selectedPayment && formatCurrency(selectedPayment.payment.total_amount)}
            </Text>
            {selectedPayment && selectedPayment.penaltyAmount > 0 && (
              <View style={styles.modalPenaltySection}>
                <Text style={styles.modalPenaltyLabel}>Mora acumulada:</Text>
                <Text style={styles.modalPenaltyAmount}>
                  +{formatCurrency(selectedPayment.penaltyAmount)}
                </Text>
                <Text style={styles.modalPenaltyTotal}>
                  Total: {formatCurrency(selectedPayment.payment.total_amount + selectedPayment.penaltyAmount)}
                </Text>
              </View>
            )}
            <Text style={styles.modalDate}>
              Vencimiento: {selectedPayment && formatDate(selectedPayment.payment.due_date)}
            </Text>

            <View style={styles.modalActions}>
              {selectedPayment?.status === 'paid' ? (
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonWarning]}
                  onPress={handleRevertPayment}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <ActivityIndicator color={colors.warning} size="small" />
                  ) : (
                    <Text style={[styles.modalButtonText, { color: colors.warning }]}>
                      Revertir a Pendiente
                    </Text>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSuccess]}
                  onPress={handleMarkPaid}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <ActivityIndicator color={colors.success} size="small" />
                  ) : (
                    <Text style={[styles.modalButtonText, { color: colors.success }]}>
                      Marcar como Pagado
                    </Text>
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={closeModal}
                disabled={isProcessing}
              >
                <Text style={styles.modalButtonCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
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
  backButton: {
    width: 70,
  },
  backButtonText: {
    fontSize: fontSize.sm,
    color: colors.primary.main,
    fontWeight: fontWeight.medium,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  errorText: {
    fontSize: fontSize.base,
    color: colors.text.secondary,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadow.md,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  borrowerInfo: {
    flex: 1,
  },
  borrowerName: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  borrowerPhone: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  borrowerDni: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  progressCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.text.inverse,
  },
  summaryDetails: {
    gap: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  detailValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
  },
  detailValueHighlight: {
    color: colors.primary.main,
    fontWeight: fontWeight.bold,
  },
  datesSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dateItem: {
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
  },
  dateValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    marginTop: spacing.lg,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary.main,
    borderRadius: 4,
  },
  progressLabel: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  paymentsSection: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  paymentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    ...shadow.sm,
  },
  paymentNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary.light + '30',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  paymentNumberText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.primary.main,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentDate: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  paymentAmount: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semiBold,
    color: colors.text.primary,
  },
  paymentAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  penaltyAmount: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semiBold,
    color: colors.error,
  },
  penaltyInfo: {
    fontSize: fontSize.xs,
    color: colors.error,
    marginTop: spacing.xs,
  },
  graceInfo: {
    fontSize: fontSize.xs,
    color: colors.warning,
    marginTop: spacing.xs,
  },
  paymentStatus: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  paymentStatusText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    ...shadow.lg,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  modalAmount: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.primary.main,
    marginBottom: spacing.xs,
  },
  modalDate: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  modalActions: {
    width: '100%',
    gap: spacing.sm,
  },
  modalButton: {
    width: '100%',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  modalButtonSuccess: {
    backgroundColor: colors.success + '15',
    borderWidth: 1,
    borderColor: colors.success + '30',
  },
  modalButtonWarning: {
    backgroundColor: colors.warning + '15',
    borderWidth: 1,
    borderColor: colors.warning + '30',
  },
  modalButtonCancel: {
    backgroundColor: colors.border,
  },
  modalButtonText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semiBold,
  },
  modalButtonCancelText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.text.secondary,
  },
  modalPenaltySection: {
    backgroundColor: colors.error + '10',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    alignItems: 'center',
    width: '100%',
  },
  modalPenaltyLabel: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  modalPenaltyAmount: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.error,
  },
  modalPenaltyTotal: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semiBold,
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
});
