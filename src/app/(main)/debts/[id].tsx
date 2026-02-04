import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import {
  getPersonalDebtById,
  getDebtPayments,
  markDebtPaymentAsPaid,
  revertDebtPaymentToPending,
  deletePersonalDebt,
} from '../../../services/supabase';
import { useToast } from '../../../components';
import { colors, spacing, borderRadius, fontSize, fontWeight, shadow } from '../../../theme';
import { PersonalDebt, DebtPayment } from '../../../services/supabase/personalDebts';

type PaymentStatus = 'pending' | 'paid' | 'overdue';

function PaymentItem({
  payment,
  currency,
  onPress,
}: {
  payment: DebtPayment;
  currency: string;
  onPress: (payment: DebtPayment, status: PaymentStatus) => void;
}) {
  const today = new Date().toISOString().split('T')[0];
  const isOverdue = payment.status === 'pending' && payment.due_date < today;
  const status: PaymentStatus = payment.status === 'paid' ? 'paid' : isOverdue ? 'overdue' : 'pending';

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
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const penaltyAmount = payment.penalty_amount || 0;

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
        {payment.paid_date && (
          <Text style={styles.paidDateText}>Pagado el {formatDate(payment.paid_date)}</Text>
        )}
      </View>
      <TouchableOpacity
        style={[styles.paymentStatus, { backgroundColor: config.bg }]}
        onPress={() => onPress(payment, status)}
      >
        <Text style={[styles.paymentStatusText, { color: config.color }]}>
          {config.label}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default function DebtDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [debt, setDebt] = useState<PersonalDebt | null>(null);
  const [payments, setPayments] = useState<DebtPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<{ payment: DebtPayment; status: PaymentStatus } | null>(null);
  const { showSuccess, showError } = useToast();

  const loadData = async () => {
    if (!id) return;

    try {
      const [debtData, paymentsData] = await Promise.all([
        getPersonalDebtById(id),
        getDebtPayments(id),
      ]);
      setDebt(debtData);
      setPayments(paymentsData);
    } catch (error) {
      console.error('Error loading debt:', error);
      showError('Error', 'No se pudo cargar la deuda');
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

  const handlePaymentPress = (payment: DebtPayment, status: PaymentStatus) => {
    setSelectedPayment({ payment, status });
  };

  const handleMarkPaid = async () => {
    if (!selectedPayment) return;

    setIsProcessing(true);
    try {
      await markDebtPaymentAsPaid(
        selectedPayment.payment.id,
        selectedPayment.payment.total_amount + (selectedPayment.payment.penalty_amount || 0)
      );
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
      await revertDebtPaymentToPending(selectedPayment.payment.id);
      showSuccess('Pago revertido', 'El pago ha sido marcado como pendiente');
      setSelectedPayment(null);
      loadData();
    } catch (error) {
      showError('Error', 'No se pudo revertir el pago');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteDebt = async () => {
    if (!debt) return;

    Alert.alert(
      'Eliminar Deuda',
      '¿Estás seguro de eliminar esta deuda completada?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setIsProcessing(true);
            try {
              await deletePersonalDebt(debt.id);
              showSuccess('Deuda eliminada', 'La deuda ha sido eliminada correctamente');
              router.back();
            } catch (error) {
              showError('Error', error instanceof Error ? error.message : 'No se pudo eliminar la deuda');
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ]
    );
  };

  const closeModal = () => {
    if (!isProcessing) {
      setSelectedPayment(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: debt?.currency || 'ARS',
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

  if (!debt) {
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
          <Text style={styles.errorText}>No se encontró la deuda</Text>
        </View>
      </SafeAreaView>
    );
  }

  const paidCount = payments.filter(p => p.status === 'paid').length;
  const progress = payments.length > 0 ? (paidCount / payments.length) * 100 : 0;
  const termTypeLabel = debt.term_type === 'months' ? 'meses' : 'semanas';
  const paymentPeriodLabel = debt.term_type === 'months' ? 'mes' : 'semana';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Detalle de Deuda</Text>
        {debt.status === 'completed' ? (
          <TouchableOpacity onPress={handleDeleteDebt} style={styles.deleteButton} disabled={isProcessing}>
            <Text style={styles.deleteButtonText}>{isProcessing ? '...' : 'Eliminar'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 70 }} />
        )}
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
            <View style={styles.creditorInfo}>
              <Text style={styles.creditorName}>
                {debt.creditor_name}
              </Text>
              {debt.description && (
                <Text style={styles.creditorDescription}>{debt.description}</Text>
              )}
              {debt.creditor_phone && (
                <Text style={styles.creditorPhone}>{debt.creditor_phone}</Text>
              )}
            </View>
            <View style={styles.progressCircle}>
              <Text style={styles.progressText}>{Math.round(progress)}%</Text>
            </View>
          </View>

          <View style={styles.summaryDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Capital:</Text>
              <Text style={styles.detailValue}>{formatCurrency(debt.principal_amount)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Interés:</Text>
              <Text style={styles.detailValue}>{debt.interest_rate}% anual</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Tipo:</Text>
              <Text style={styles.detailValue}>
                {debt.interest_type === 'french' ? 'Francés' : 'Simple'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Plazo:</Text>
              <Text style={styles.detailValue}>{debt.term_value} {termTypeLabel}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Cuota:</Text>
              <Text style={[styles.detailValue, styles.detailValueHighlight]}>
                {formatCurrency(debt.installment_amount)}/{paymentPeriodLabel}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Total a pagar:</Text>
              <Text style={[styles.detailValue, styles.detailValueHighlight]}>
                {formatCurrency(debt.total_amount)}
              </Text>
            </View>
          </View>

          <View style={styles.datesSection}>
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>Entrega</Text>
              <Text style={styles.dateValue}>{formatDate(debt.delivery_date)}</Text>
            </View>
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>Primer pago</Text>
              <Text style={styles.dateValue}>{formatDate(debt.first_payment_date)}</Text>
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
                currency={debt.currency}
                onPress={handlePaymentPress}
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
            {selectedPayment && (selectedPayment.payment.penalty_amount || 0) > 0 && (
              <View style={styles.modalPenaltySection}>
                <Text style={styles.modalPenaltyLabel}>Penalización acumulada:</Text>
                <Text style={styles.modalPenaltyAmount}>
                  +{formatCurrency(selectedPayment.payment.penalty_amount || 0)}
                </Text>
                <Text style={styles.modalPenaltyTotal}>
                  Total: {formatCurrency(selectedPayment.payment.total_amount + (selectedPayment.payment.penalty_amount || 0))}
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
  deleteButton: {
    width: 70,
    alignItems: 'flex-end',
  },
  deleteButtonText: {
    fontSize: fontSize.sm,
    color: colors.error,
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
  creditorInfo: {
    flex: 1,
  },
  creditorName: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  creditorDescription: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  creditorPhone: {
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
  paidDateText: {
    fontSize: fontSize.xs,
    color: colors.success,
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
