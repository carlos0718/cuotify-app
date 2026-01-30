import { supabase, handleSupabaseError } from './client';
import { Borrower, Loan, BorrowerInsert, LoanInsert, Payment } from '../../types';
import { calculateLatePenalty } from '../calculations';

// =============================================
// PRESTATARIOS (Borrowers)
// =============================================

export async function createBorrower(data: BorrowerInsert): Promise<Borrower> {
  const { data: borrower, error } = await supabase
    .from('borrowers')
    .insert(data as never)
    .select()
    .single();

  if (error) throw new Error(handleSupabaseError(error));
  return borrower as Borrower;
}

export async function getBorrowers(): Promise<Borrower[]> {
  const { data, error } = await supabase
    .from('borrowers')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(handleSupabaseError(error));
  return (data || []) as Borrower[];
}

// =============================================
// PRÉSTAMOS (Loans)
// =============================================

export async function createLoan(data: LoanInsert): Promise<Loan> {
  const { data: loan, error } = await supabase
    .from('loans')
    .insert(data as never)
    .select()
    .single();

  if (error) throw new Error(handleSupabaseError(error));
  return loan as Loan;
}

export async function getLoans() {
  const { data, error } = await supabase
    .from('loans')
    .select(`
      *,
      borrower:borrowers(*)
    `)
    .order('created_at', { ascending: false });

  if (error) throw new Error(handleSupabaseError(error));
  return data || [];
}

export async function getLoanById(id: string) {
  const { data, error } = await supabase
    .from('loans')
    .select(`
      *,
      borrower:borrowers(*),
      payments(*)
    `)
    .eq('id', id)
    .single();

  if (error) throw new Error(handleSupabaseError(error));
  return data;
}

export async function getActiveLoans() {
  const { data, error } = await supabase
    .from('loans')
    .select(`
      *,
      borrower:borrowers(*)
    `)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) throw new Error(handleSupabaseError(error));
  return data || [];
}

export async function updateLoanStatus(id: string, status: Loan['status']) {
  const { data, error } = await supabase
    .from('loans')
    .update({ status } as never)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(handleSupabaseError(error));
  return data;
}

// =============================================
// PAGOS (Payments)
// =============================================

export async function getPaymentsByLoan(loanId: string) {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('loan_id', loanId)
    .order('payment_number', { ascending: true });

  if (error) throw new Error(handleSupabaseError(error));
  return data || [];
}

export async function markPaymentAsPaid(paymentId: string, paidAmount: number) {
  // 1. Obtener el pago para saber el loan_id
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('loan_id')
    .eq('id', paymentId)
    .single();

  if (paymentError) throw new Error(handleSupabaseError(paymentError));

  const loanId = (payment as { loan_id: string }).loan_id;

  // 2. Actualizar el pago
  const { data, error } = await supabase
    .from('payments')
    .update({
      status: 'paid',
      paid_amount: paidAmount,
      paid_date: new Date().toISOString().split('T')[0],
    } as never)
    .eq('id', paymentId)
    .select()
    .single();

  if (error) throw new Error(handleSupabaseError(error));

  // 3. Verificar si todos los pagos del préstamo están pagados
  const { data: allPayments, error: allPaymentsError } = await supabase
    .from('payments')
    .select('status')
    .eq('loan_id', loanId);

  if (allPaymentsError) throw new Error(handleSupabaseError(allPaymentsError));

  const paymentsList = (allPayments || []) as { status: string }[];
  const allPaid = paymentsList.every(p => p.status === 'paid');

  // 4. Si todos están pagados, actualizar el préstamo a 'completed'
  if (allPaid) {
    await supabase
      .from('loans')
      .update({ status: 'completed' } as never)
      .eq('id', loanId);
  }

  return data;
}

export async function revertPaymentToPending(paymentId: string) {
  // 1. Obtener el pago para saber el loan_id
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('loan_id')
    .eq('id', paymentId)
    .single();

  if (paymentError) throw new Error(handleSupabaseError(paymentError));

  const loanId = (payment as { loan_id: string }).loan_id;

  // 2. Actualizar el pago a pendiente
  const { data, error } = await supabase
    .from('payments')
    .update({
      status: 'pending',
      paid_amount: 0,
      paid_date: null,
    } as never)
    .eq('id', paymentId)
    .select()
    .single();

  if (error) throw new Error(handleSupabaseError(error));

  // 3. Si el préstamo estaba completado, volver a estado activo
  await supabase
    .from('loans')
    .update({ status: 'active' } as never)
    .eq('id', loanId)
    .eq('status', 'completed');

  return data;
}

export async function addBorrowerComment(paymentId: string, comment: string) {
  const { data, error } = await supabase
    .from('payments')
    .update({
      borrower_comment: comment,
      borrower_comment_date: new Date().toISOString(),
    } as never)
    .eq('id', paymentId)
    .select()
    .single();

  if (error) throw new Error(handleSupabaseError(error));
  return data;
}

export async function getUpcomingPayments(days: number = 7) {
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + days);

  const { data, error } = await supabase
    .from('payments')
    .select(`
      *,
      loan:loans(
        *,
        borrower:borrowers(*)
      )
    `)
    .eq('status', 'pending')
    .gte('due_date', today.toISOString().split('T')[0])
    .lte('due_date', futureDate.toISOString().split('T')[0])
    .order('due_date', { ascending: true });

  if (error) throw new Error(handleSupabaseError(error));
  return data || [];
}

export async function getOverduePayments() {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('payments')
    .select(`
      *,
      loan:loans(
        *,
        borrower:borrowers(*)
      )
    `)
    .eq('status', 'pending')
    .lt('due_date', today)
    .order('due_date', { ascending: true });

  if (error) throw new Error(handleSupabaseError(error));
  return data || [];
}

// =============================================
// ESTADÍSTICAS
// =============================================

interface LoanStatsRow {
  status: string;
  total_amount: number;
  principal_amount: number;
}

export async function getLoanStats() {
  const { data: loans, error } = await supabase
    .from('loans')
    .select('status, total_amount, principal_amount');

  if (error) throw new Error(handleSupabaseError(error));

  const loansList = (loans || []) as LoanStatsRow[];

  return {
    totalLoans: loansList.length,
    activeLoans: loansList.filter(l => l.status === 'active').length,
    completedLoans: loansList.filter(l => l.status === 'completed').length,
    totalLent: loansList.reduce((sum, l) => sum + Number(l.principal_amount), 0),
    totalExpected: loansList.reduce((sum, l) => sum + Number(l.total_amount), 0),
  };
}

// =============================================
// PENALIZACIONES POR MORA
// =============================================

interface PaymentWithLoan {
  id: string;
  due_date: string;
  total_amount: number;
  status: string;
  penalty_amount: number;
  loan: {
    grace_period_days: number;
    late_penalty_type: 'none' | 'fixed' | 'daily' | 'weekly';
    late_penalty_rate: number;
  };
}

/**
 * Calcula y actualiza la penalización de un pago específico
 */
export async function updatePaymentPenalty(paymentId: string): Promise<Payment> {
  // 1. Obtener el pago con los datos del préstamo
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select(`
      id,
      due_date,
      total_amount,
      status,
      penalty_amount,
      loan:loans(
        grace_period_days,
        late_penalty_type,
        late_penalty_rate
      )
    `)
    .eq('id', paymentId)
    .single();

  if (paymentError) throw new Error(handleSupabaseError(paymentError));

  const paymentData = payment as unknown as PaymentWithLoan;

  // Si ya está pagado o el préstamo no tiene penalización configurada, no hacer nada
  if (paymentData.status === 'paid' || paymentData.loan.late_penalty_type === 'none') {
    const { data: currentPayment, error } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (error) throw new Error(handleSupabaseError(error));
    return currentPayment as Payment;
  }

  // 2. Calcular la penalización
  const penaltyResult = calculateLatePenalty({
    dueDate: new Date(paymentData.due_date),
    paymentAmount: paymentData.total_amount,
    gracePeriodDays: paymentData.loan.grace_period_days,
    latePenaltyType: paymentData.loan.late_penalty_type,
    latePenaltyRate: paymentData.loan.late_penalty_rate,
  });

  // 3. Actualizar el pago con la penalización
  const { data: updatedPayment, error: updateError } = await supabase
    .from('payments')
    .update({
      penalty_amount: penaltyResult.penaltyAmount,
      penalty_calculated_at: new Date().toISOString(),
      status: penaltyResult.isOverdue && paymentData.status === 'pending' ? 'overdue' : paymentData.status,
    } as never)
    .eq('id', paymentId)
    .select()
    .single();

  if (updateError) throw new Error(handleSupabaseError(updateError));
  return updatedPayment as Payment;
}

/**
 * Actualiza las penalizaciones de todos los pagos pendientes de un préstamo
 */
export async function updateLoanPenalties(loanId: string): Promise<Payment[]> {
  // 1. Obtener datos del préstamo
  const { data: loan, error: loanError } = await supabase
    .from('loans')
    .select('grace_period_days, late_penalty_type, late_penalty_rate')
    .eq('id', loanId)
    .single();

  if (loanError) throw new Error(handleSupabaseError(loanError));

  const loanData = loan as {
    grace_period_days: number;
    late_penalty_type: 'none' | 'fixed' | 'daily' | 'weekly';
    late_penalty_rate: number;
  };

  // Si no hay penalización configurada, retornar los pagos sin cambios
  if (loanData.late_penalty_type === 'none') {
    const { data: payments, error } = await supabase
      .from('payments')
      .select('*')
      .eq('loan_id', loanId)
      .order('payment_number', { ascending: true });

    if (error) throw new Error(handleSupabaseError(error));
    return (payments || []) as Payment[];
  }

  // 2. Obtener pagos pendientes o vencidos
  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('*')
    .eq('loan_id', loanId)
    .in('status', ['pending', 'overdue'])
    .order('payment_number', { ascending: true });

  if (paymentsError) throw new Error(handleSupabaseError(paymentsError));

  const updatedPayments: Payment[] = [];

  // 3. Calcular y actualizar cada pago
  for (const payment of (payments || []) as Payment[]) {
    const penaltyResult = calculateLatePenalty({
      dueDate: new Date(payment.due_date),
      paymentAmount: payment.total_amount,
      gracePeriodDays: loanData.grace_period_days,
      latePenaltyType: loanData.late_penalty_type,
      latePenaltyRate: loanData.late_penalty_rate,
    });

    const newStatus = penaltyResult.isOverdue && payment.status === 'pending' ? 'overdue' : payment.status;

    const { data: updatedPayment, error: updateError } = await supabase
      .from('payments')
      .update({
        penalty_amount: penaltyResult.penaltyAmount,
        penalty_calculated_at: new Date().toISOString(),
        status: newStatus,
      } as never)
      .eq('id', payment.id)
      .select()
      .single();

    if (updateError) throw new Error(handleSupabaseError(updateError));
    updatedPayments.push(updatedPayment as Payment);
  }

  // 4. Retornar todos los pagos del préstamo actualizados
  const { data: allPayments, error: allError } = await supabase
    .from('payments')
    .select('*')
    .eq('loan_id', loanId)
    .order('payment_number', { ascending: true });

  if (allError) throw new Error(handleSupabaseError(allError));
  return (allPayments || []) as Payment[];
}
