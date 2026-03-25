import { createClient, SupabaseClient } from '@supabase/supabase-js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default';
  channelId?: string;
}

interface PaymentRow {
  id: string;
  due_date: string;
  total_amount: number;
  payment_number: number;
  currency?: string;
  loan: {
    id: string;
    user_id: string;
    borrower: { full_name: string } | null;
  } | null;
}

interface DebtPaymentRow {
  id: string;
  due_date: string;
  total_amount: number;
  payment_number: number;
  debt: {
    id: string;
    user_id: string;
    creditor_name: string;
  } | null;
}

const DEFAULT_REMINDER_DAYS = 3;

async function getTokensForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<string[]> {
  const { data } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', userId)
    .eq('is_active', true);
  return (data ?? []).map((r: { token: string }) => r.token);
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // ── 1. Cargar preferencias de notificación de todos los usuarios ──
  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('user_id, reminder_days_before, push_enabled');

  const prefMap = new Map<string, { days: number; pushEnabled: boolean }>();
  for (const p of (prefs ?? [])) {
    prefMap.set(p.user_id, {
      days: p.reminder_days_before ?? DEFAULT_REMINDER_DAYS,
      pushEnabled: p.push_enabled ?? true,
    });
  }

  const uniqueDays = new Set<number>([DEFAULT_REMINDER_DAYS]);
  for (const p of (prefs ?? [])) {
    if (p.push_enabled !== false) uniqueDays.add(p.reminder_days_before);
  }

  const messages: ExpoPushMessage[] = [];

  // ── 2. Recordatorios préstamos: pagos que vencen en N días ──
  for (const days of uniqueDays) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + days);
    const targetDateStr = targetDate.toISOString().split('T')[0];

    const { data: payments } = await supabase
      .from('payments')
      .select(`
        id, due_date, total_amount, payment_number, currency,
        loan:loans(
          id,
          user_id,
          borrower:borrowers(full_name)
        )
      `)
      .eq('status', 'pending')
      .eq('due_date', targetDateStr);

    for (const payment of (payments ?? []) as unknown as PaymentRow[]) {
      const lenderId = payment.loan?.user_id;
      if (!lenderId) continue;

      const pref = prefMap.get(lenderId);
      if (pref?.pushEnabled === false || (pref?.days ?? DEFAULT_REMINDER_DAYS) !== days) continue;

      const borrowerName = payment.loan?.borrower?.full_name ?? 'tu prestatario';
      const loanId = payment.loan?.id;
      const tokens = await getTokensForUser(supabase, lenderId);

      for (const token of tokens) {
        messages.push({
          to: token,
          title: days === 1 ? '⚡ Pago vence mañana' : `🔔 Pago en ${days} días`,
          body: `Cuota #${payment.payment_number} de ${borrowerName} vence el ${targetDateStr}`,
          data: { type: 'payment_reminder', loanId, paymentId: payment.id },
          sound: 'default',
          channelId: 'payment_reminders',
        });
      }
    }

    // ── 3. Recordatorios deudas personales: cuotas que vencen en N días ──
    const { data: debtPayments } = await supabase
      .from('debt_payments')
      .select(`
        id, due_date, total_amount, payment_number,
        debt:personal_debts(
          id,
          user_id,
          creditor_name
        )
      `)
      .eq('status', 'pending')
      .eq('due_date', targetDateStr);

    for (const dp of (debtPayments ?? []) as unknown as DebtPaymentRow[]) {
      const borrowerId = dp.debt?.user_id;
      if (!borrowerId) continue;

      const pref = prefMap.get(borrowerId);
      if (pref?.pushEnabled === false || (pref?.days ?? DEFAULT_REMINDER_DAYS) !== days) continue;

      const creditorName = dp.debt?.creditor_name ?? 'tu acreedor';
      const debtId = dp.debt?.id;
      const tokens = await getTokensForUser(supabase, borrowerId);

      for (const token of tokens) {
        messages.push({
          to: token,
          title: days === 1 ? '⚡ Cuota vence mañana' : `🔔 Cuota en ${days} días`,
          body: `Cuota #${dp.payment_number} para ${creditorName} vence el ${targetDateStr}`,
          data: { type: 'debt_reminder', debtId, paymentId: dp.id },
          sound: 'default',
          channelId: 'payment_reminders',
        });
      }
    }
  }

  // ── 4. Pagos de préstamos que vencen HOY ──
  const { data: todayPayments } = await supabase
    .from('payments')
    .select(`
      id, due_date, total_amount, payment_number,
      loan:loans(
        id,
        user_id,
        borrower:borrowers(full_name)
      )
    `)
    .eq('status', 'pending')
    .eq('due_date', todayStr);

  for (const payment of (todayPayments ?? []) as unknown as PaymentRow[]) {
    const lenderId = payment.loan?.user_id;
    if (!lenderId) continue;

    const pref = prefMap.get(lenderId);
    if (pref?.pushEnabled === false) continue;

    const borrowerName = payment.loan?.borrower?.full_name ?? 'tu prestatario';
    const loanId = payment.loan?.id;
    const tokens = await getTokensForUser(supabase, lenderId);

    for (const token of tokens) {
      messages.push({
        to: token,
        title: '📅 Pago vence HOY',
        body: `Cuota #${payment.payment_number} de ${borrowerName} vence hoy`,
        data: { type: 'payment_today', loanId, paymentId: payment.id },
        sound: 'default',
        channelId: 'payment_reminders',
      });
    }
  }

  // ── 5. Cuotas de deudas personales que vencen HOY ──
  const { data: todayDebtPayments } = await supabase
    .from('debt_payments')
    .select(`
      id, due_date, total_amount, payment_number,
      debt:personal_debts(
        id,
        user_id,
        creditor_name
      )
    `)
    .eq('status', 'pending')
    .eq('due_date', todayStr);

  for (const dp of (todayDebtPayments ?? []) as unknown as DebtPaymentRow[]) {
    const borrowerId = dp.debt?.user_id;
    if (!borrowerId) continue;

    const pref = prefMap.get(borrowerId);
    if (pref?.pushEnabled === false) continue;

    const creditorName = dp.debt?.creditor_name ?? 'tu acreedor';
    const debtId = dp.debt?.id;
    const tokens = await getTokensForUser(supabase, borrowerId);

    for (const token of tokens) {
      messages.push({
        to: token,
        title: '📅 Cuota vence HOY',
        body: `Cuota #${dp.payment_number} para ${creditorName} vence hoy`,
        data: { type: 'debt_today', debtId, paymentId: dp.id },
        sound: 'default',
        channelId: 'payment_reminders',
      });
    }
  }

  // ── 6. Pagos vencidos (préstamos) → alerta diaria ──
  const { data: overduePayments } = await supabase
    .from('payments')
    .select(`
      id, due_date, total_amount, payment_number,
      loan:loans(
        id,
        user_id,
        borrower:borrowers(full_name)
      )
    `)
    .in('status', ['pending', 'overdue'])
    .lt('due_date', todayStr);

  for (const payment of (overduePayments ?? []) as unknown as PaymentRow[]) {
    const lenderId = payment.loan?.user_id;
    if (!lenderId) continue;

    const pref = prefMap.get(lenderId);
    if (pref?.pushEnabled === false) continue;

    const borrowerName = payment.loan?.borrower?.full_name ?? 'tu prestatario';
    const loanId = payment.loan?.id;
    const daysOverdue = Math.floor((today.getTime() - new Date(payment.due_date).getTime()) / 86400000);
    const tokens = await getTokensForUser(supabase, lenderId);

    for (const token of tokens) {
      messages.push({
        to: token,
        title: '🚨 Pago vencido',
        body: `Cuota #${payment.payment_number} de ${borrowerName} lleva ${daysOverdue} día${daysOverdue !== 1 ? 's' : ''} vencida`,
        data: { type: 'payment_overdue', loanId, paymentId: payment.id },
        sound: 'default',
        channelId: 'payment_overdue',
      });
    }
  }

  // ── 7. Cuotas vencidas de deudas personales → alerta diaria ──
  const { data: overdueDebtPayments } = await supabase
    .from('debt_payments')
    .select(`
      id, due_date, total_amount, payment_number,
      debt:personal_debts(
        id,
        user_id,
        creditor_name
      )
    `)
    .in('status', ['pending', 'overdue'])
    .lt('due_date', todayStr);

  for (const dp of (overdueDebtPayments ?? []) as unknown as DebtPaymentRow[]) {
    const borrowerId = dp.debt?.user_id;
    if (!borrowerId) continue;

    const pref = prefMap.get(borrowerId);
    if (pref?.pushEnabled === false) continue;

    const creditorName = dp.debt?.creditor_name ?? 'tu acreedor';
    const debtId = dp.debt?.id;
    const daysOverdue = Math.floor((today.getTime() - new Date(dp.due_date).getTime()) / 86400000);
    const tokens = await getTokensForUser(supabase, borrowerId);

    for (const token of tokens) {
      messages.push({
        to: token,
        title: '🚨 Cuota vencida',
        body: `Cuota #${dp.payment_number} para ${creditorName} lleva ${daysOverdue} día${daysOverdue !== 1 ? 's' : ''} vencida`,
        data: { type: 'debt_overdue', debtId, paymentId: dp.id },
        sound: 'default',
        channelId: 'payment_overdue',
      });
    }
  }

  // ── 8. Enviar todos los mensajes a la Expo Push API (en lotes de 100) ──
  let sent = 0;
  const BATCH_SIZE = 100;

  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(batch),
    });

    if (response.ok) {
      sent += batch.length;
    } else {
      console.error('Expo push error:', await response.text());
    }
  }

  return new Response(
    JSON.stringify({ success: true, sent, total: messages.length }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
