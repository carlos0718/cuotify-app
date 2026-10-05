import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import {
  getPersonalDebtById,
  getDebtPayments,
  markDebtPaymentAsPaid,
  revertDebtPaymentToPending,
  deletePersonalDebt,
} from '../services/supabase';
import { cancelPaymentNotification, updateBadgeCount } from '../services/notifications';
import { useToast } from '../components';
import { PersonalDebt, DebtPayment } from '../services/supabase/personalDebts';

export type DebtPaymentStatus = 'pending' | 'paid' | 'overdue';

export interface SelectedDebtPayment {
  payment: DebtPayment;
  status: DebtPaymentStatus;
}

export function useDebtDetail(id: string | undefined) {
  const [debt, setDebt] = useState<PersonalDebt | null>(null);
  const [payments, setPayments] = useState<DebtPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<SelectedDebtPayment | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showProofModal, setShowProofModal] = useState(false);
  const { showSuccess, showError } = useToast();

  const loadData = useCallback(async () => {
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

  const handlePaymentPress = (payment: DebtPayment, status: DebtPaymentStatus) => {
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

  const handleDeleteDebt = () => {
    if (!debt) return;
    setShowDeleteModal(true);
  };

  const confirmDeleteDebt = async () => {
    if (!debt) return;
    setIsProcessing(true);
    try {
      await deletePersonalDebt(debt.id);
      showSuccess('Deuda eliminada', 'La deuda ha sido eliminada correctamente');
      router.replace('/(main)/debts');
    } catch (error) {
      showError('Error', error instanceof Error ? error.message : 'No se pudo eliminar la deuda');
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

  return {
    debt,
    payments,
    isLoading,
    isProcessing,
    refreshing,
    selectedPayment,
    showDeleteModal,
    setShowDeleteModal,
    showProofModal,
    setShowProofModal,
    onRefresh,
    handlePaymentPress,
    handleMarkPaid,
    handleRevertPayment,
    handleDeleteDebt,
    confirmDeleteDebt,
    closeModal,
    formatCurrency,
    formatDate,
  };
}
