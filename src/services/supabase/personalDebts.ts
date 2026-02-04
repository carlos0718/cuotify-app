import { supabase } from './client';
import { handleSupabaseError } from './client';

// =============================================
// TIPOS
// =============================================

export interface PersonalDebt {
  id: string;
  user_id: string;
  creditor_name: string;
  creditor_phone?: string;
  description?: string;
  principal_amount: number;
  interest_rate: number;
  interest_type: 'simple' | 'french';
  term_value: number;
  term_type: 'weeks' | 'months';
  currency: 'ARS' | 'USD';
  first_payment_date: string;
  delivery_date: string;
  late_penalty_type: 'none' | 'fixed' | 'daily' | 'weekly';
  late_penalty_rate: number;
  grace_period_days: number;
  total_amount: number;
  installment_amount: number;
  status: 'active' | 'completed' | 'cancelled';
  color_code?: string;
  created_at: string;
  updated_at: string;
}

export interface DebtPayment {
  id: string;
  debt_id: string;
  payment_number: number;
  due_date: string;
  total_amount: number;
  principal_amount: number;
  interest_amount: number;
  penalty_amount: number;
  status: 'pending' | 'paid' | 'overdue';
  paid_date?: string;
  paid_amount?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreatePersonalDebtInput {
  creditor_name: string;
  creditor_phone?: string;
  description?: string;
  principal_amount: number;
  interest_rate: number;
  interest_type: 'simple' | 'french';
  term_value: number;
  term_type: 'weeks' | 'months';
  currency: 'ARS' | 'USD';
  first_payment_date: string;
  delivery_date?: string;
  late_penalty_type?: 'none' | 'fixed' | 'daily' | 'weekly';
  late_penalty_rate?: number;
  grace_period_days?: number;
  color_code?: string;
}

// =============================================
// CRUD DE DEUDAS PERSONALES
// =============================================

/**
 * Crear una nueva deuda personal
 */
export async function createPersonalDebt(input: CreatePersonalDebtInput): Promise<PersonalDebt> {
  // 1. Calcular totales
  const { principal_amount, interest_rate, interest_type, term_value } = input;

  let total_amount: number;
  let installment_amount: number;

  if (interest_type === 'simple') {
    total_amount = principal_amount * (1 + interest_rate / 100);
    installment_amount = total_amount / term_value;
  } else {
    // Sistema Francés
    const rate = interest_rate / 100;
    installment_amount = (principal_amount * rate) / (1 - Math.pow(1 + rate, -term_value));
    total_amount = installment_amount * term_value;
  }

  // 2. Crear la deuda
  const { data: debt, error: debtError } = await supabase
    .from('personal_debts')
    .insert({
      ...input,
      total_amount,
      installment_amount,
      delivery_date: input.delivery_date || new Date().toISOString().split('T')[0],
    } as never)
    .select()
    .single();

  if (debtError) throw new Error(handleSupabaseError(debtError));

  // 3. Generar cronograma de pagos
  const { error: scheduleError } = await supabase.rpc('generate_debt_payment_schedule', {
    p_debt_id: debt.id,
    p_principal: principal_amount,
    p_interest_rate: interest_rate,
    p_interest_type: interest_type,
    p_term_value: term_value,
    p_term_type: input.term_type,
    p_first_payment_date: input.first_payment_date,
  });

  if (scheduleError) {
    // Si falla el cronograma, eliminar la deuda
    await supabase.from('personal_debts').delete().eq('id', debt.id);
    throw new Error(handleSupabaseError(scheduleError));
  }

  return debt as PersonalDebt;
}

/**
 * Obtener todas las deudas personales del usuario
 */
export async function getPersonalDebts(): Promise<PersonalDebt[]> {
  const { data, error } = await supabase
    .from('personal_debts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(handleSupabaseError(error));
  return data || [];
}

/**
 * Obtener deudas activas
 */
export async function getActivePersonalDebts(): Promise<PersonalDebt[]> {
  const { data, error } = await supabase
    .from('personal_debts')
    .select('*')
    .eq('status', 'active')
    .order('first_payment_date', { ascending: true });

  if (error) throw new Error(handleSupabaseError(error));
  return data || [];
}

/**
 * Obtener una deuda por ID
 */
export async function getPersonalDebtById(id: string): Promise<PersonalDebt> {
  const { data, error } = await supabase
    .from('personal_debts')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw new Error(handleSupabaseError(error));
  return data as PersonalDebt;
}

/**
 * Actualizar estado de una deuda
 */
export async function updateDebtStatus(
  id: string,
  status: 'active' | 'completed' | 'cancelled'
): Promise<PersonalDebt> {
  const { data, error } = await supabase
    .from('personal_debts')
    .update({ status } as never)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(handleSupabaseError(error));
  return data as PersonalDebt;
}

/**
 * Eliminar una deuda (solo si está cancelada o completada)
 */
export async function deletePersonalDebt(id: string): Promise<void> {
  // Verificar que la deuda esté completada o cancelada
  const debt = await getPersonalDebtById(id);

  if (debt.status === 'active') {
    throw new Error('No se puede eliminar una deuda activa. Primero cancélala.');
  }

  const { error } = await supabase.from('personal_debts').delete().eq('id', id);

  if (error) throw new Error(handleSupabaseError(error));
}

/**
 * Actualizar color de una deuda
 */
export async function updateDebtColor(id: string, color_code: string): Promise<void> {
  const { error } = await supabase
    .from('personal_debts')
    .update({ color_code } as never)
    .eq('id', id);

  if (error) throw new Error(handleSupabaseError(error));
}

// =============================================
// PAGOS DE DEUDAS
// =============================================

/**
 * Obtener pagos de una deuda
 */
export async function getDebtPayments(debtId: string): Promise<DebtPayment[]> {
  const { data, error } = await supabase
    .from('debt_payments')
    .select('*')
    .eq('debt_id', debtId)
    .order('payment_number', { ascending: true });

  if (error) throw new Error(handleSupabaseError(error));
  return data || [];
}

/**
 * Marcar un pago como pagado
 */
export async function markDebtPaymentAsPaid(
  paymentId: string,
  paidAmount: number,
  notes?: string
): Promise<DebtPayment> {
  const { data, error } = await supabase
    .from('debt_payments')
    .update({
      status: 'paid',
      paid_date: new Date().toISOString().split('T')[0],
      paid_amount: paidAmount,
      notes,
    } as never)
    .eq('id', paymentId)
    .select()
    .single();

  if (error) throw new Error(handleSupabaseError(error));
  return data as DebtPayment;
}

/**
 * Revertir un pago a pendiente
 */
export async function revertDebtPaymentToPending(paymentId: string): Promise<DebtPayment> {
  const { data, error } = await supabase
    .from('debt_payments')
    .update({
      status: 'pending',
      paid_date: null,
      paid_amount: null,
      notes: null,
    } as never)
    .eq('id', paymentId)
    .select()
    .single();

  if (error) throw new Error(handleSupabaseError(error));
  return data as DebtPayment;
}

/**
 * Obtener próximos pagos de deudas (N días)
 */
export async function getUpcomingDebtPayments(days: number = 7): Promise<DebtPayment[]> {
  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setDate(today.getDate() + days);

  const { data, error } = await supabase
    .from('debt_payments')
    .select(`
      *,
      debt:personal_debts(*)
    `)
    .in('status', ['pending', 'overdue'])
    .gte('due_date', today.toISOString().split('T')[0])
    .lte('due_date', futureDate.toISOString().split('T')[0])
    .order('due_date', { ascending: true });

  if (error) throw new Error(handleSupabaseError(error));
  return data || [];
}

/**
 * Obtener pagos vencidos de deudas
 */
export async function getOverdueDebtPayments(): Promise<DebtPayment[]> {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('debt_payments')
    .select(`
      *,
      debt:personal_debts(*)
    `)
    .eq('status', 'pending')
    .lt('due_date', today)
    .order('due_date', { ascending: true });

  if (error) throw new Error(handleSupabaseError(error));

  // Actualizar estado a 'overdue'
  if (data && data.length > 0) {
    const overdueIds = data.map((p: DebtPayment) => p.id);
    await supabase
      .from('debt_payments')
      .update({ status: 'overdue' } as never)
      .in('id', overdueIds);
  }

  return data || [];
}

// =============================================
// ESTADÍSTICAS
// =============================================

export interface DebtStats {
  totalDebts: number;
  activeDebts: number;
  completedDebts: number;
  totalOwed: number; // Total que debe (principal)
  totalToPay: number; // Total a pagar (con interés)
  totalPaid: number; // Total ya pagado
  remainingToPay: number; // Falta por pagar
}

/**
 * Obtener estadísticas de deudas personales
 */
export async function getDebtStats(): Promise<DebtStats> {
  const { data: debts, error } = await supabase
    .from('personal_debts')
    .select('status, principal_amount, total_amount');

  if (error) throw new Error(handleSupabaseError(error));

  const debtsList = (debts || []) as {
    status: string;
    principal_amount: number;
    total_amount: number;
  }[];

  // Obtener total pagado
  const { data: payments, error: paymentsError } = await supabase
    .from('debt_payments')
    .select('paid_amount, status')
    .eq('status', 'paid');

  if (paymentsError) throw new Error(handleSupabaseError(paymentsError));

  const totalPaid = (payments || []).reduce(
    (sum: number, p: { paid_amount: number }) => sum + (p.paid_amount || 0),
    0
  );

  const totalToPay = debtsList
    .filter(d => d.status === 'active')
    .reduce((sum, d) => sum + d.total_amount, 0);

  return {
    totalDebts: debtsList.length,
    activeDebts: debtsList.filter(d => d.status === 'active').length,
    completedDebts: debtsList.filter(d => d.status === 'completed').length,
    totalOwed: debtsList
      .filter(d => d.status === 'active')
      .reduce((sum, d) => sum + d.principal_amount, 0),
    totalToPay,
    totalPaid,
    remainingToPay: totalToPay - totalPaid,
  };
}
