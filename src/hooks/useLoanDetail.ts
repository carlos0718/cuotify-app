import { useCallback, useState } from 'react';
import { Linking } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { getLoanById, getPaymentsByLoan, markPaymentAsPaid, revertPaymentToPending, deleteLoan } from '../services/supabase';
import { cancelPaymentNotification, updateBadgeCount } from '../services/notifications';
import { generateLoanPDF } from '../services/pdf/loanPdf';
import { useSubscriptionStore } from '../store';
import { useToast } from '../components';
import { Borrower, Payment, LatePenaltyType } from '../types';

export interface LoanDetail {
  id: string;
  principal_amount: number;
  interest_rate: number;
  term_value: number | null;
  term_type: 'weeks' | 'months';
  interest_type?: 'simple' | 'french' | 'open';
  currency: 'ARS' | 'USD';
  payment_amount: number;
  total_amount: number;
  total_interest: number;
  delivery_date: string;
  first_payment_date: string;
  end_date: string | null;
  status: 'active' | 'completed' | 'defaulted' | 'cancelled';
  borrower: Borrower | null;
  lender: { id: string; full_name: string } | null;
  notes?: string | null;
  transfer_proof_url?: string | null;
  grace_period_days: number;
  late_penalty_type: LatePenaltyType;
  late_penalty_rate: number;
}

export type PaymentStatus = 'pending' | 'paid' | 'overdue';

export interface SelectedPayment {
  payment: Payment;
  status: PaymentStatus;
  penaltyAmount: number;
}

export function useLoanDetail(id: string | undefined, isReadOnly: boolean) {
  const [loan, setLoan] = useState<LoanDetail | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<SelectedPayment | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showProofModal, setShowProofModal] = useState(false);
  const { showSuccess, showError } = useToast();
  const { premium } = useSubscriptionStore();

  const loadData = useCallback(async () => {
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
  }, [id, showError]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
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
      await cancelPaymentNotification(selectedPayment.payment.id);
      updateBadgeCount();
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

  const handleExportPDF = async () => {
    if (!loan) return;
    if (!premium) {
      router.push('/(main)/settings/premium');
      return;
    }
    setIsExporting(true);
    try {
      await generateLoanPDF(loan as unknown as Parameters<typeof generateLoanPDF>[0], payments as Parameters<typeof generateLoanPDF>[1]);
    } catch {
      showError('Error', 'No se pudo generar el PDF');
    } finally {
      setIsExporting(false);
    }
  };

  const handleWhatsApp = () => {
    if (!loan) return;
    if (!premium) {
      router.push('/(main)/settings/premium');
      return;
    }
    const phone = loan.borrower?.phone?.replace(/\D/g, '');
    if (!phone) {
      showError('Sin teléfono', 'El prestatario no tiene un número registrado');
      return;
    }
    const nextPending = payments.find((p) => p.status !== 'paid');
    const msg = nextPending
      ? `Hola ${loan.borrower?.full_name ?? ''}, te recuerdo que tu cuota #${nextPending.payment_number} vence el ${nextPending.due_date}. — Cuotify`
      : `Hola ${loan.borrower?.full_name ?? ''}, tu préstamo está al día. ¡Gracias! — Cuotify`;
    Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`);
  };

  const handleDeleteLoan = () => {
    if (!loan) return;
    setShowDeleteModal(true);
  };

  const confirmDeleteLoan = async () => {
    if (!loan) return;
    setIsProcessing(true);
    try {
      await deleteLoan(loan.id);
      showSuccess('Préstamo eliminado', 'El préstamo ha sido eliminado correctamente');
      router.back();
    } catch (error) {
      showError('Error', error instanceof Error ? error.message : 'No se pudo eliminar el préstamo');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: loan?.currency || 'ARS',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return {
    loan,
    payments,
    isLoading,
    isProcessing,
    isExporting,
    refreshing,
    selectedPayment,
    showDeleteModal,
    setShowDeleteModal,
    showProofModal,
    setShowProofModal,
    isReadOnly,
    premium,
    onRefresh,
    handlePaymentPress,
    handleMarkPaid,
    handleRevertPayment,
    closeModal,
    handleExportPDF,
    handleWhatsApp,
    handleDeleteLoan,
    confirmDeleteLoan,
    formatCurrency,
    formatDate,
  };
}
