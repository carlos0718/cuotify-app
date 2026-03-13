import { createClient } from '@supabase/supabase-js';

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

const DEFAULT_REMINDER_DAYS = 3;

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

  // Mapa: userId → preferencias
  const prefMap = new Map<string, { days: number; pushEnabled: boolean }>();
  for (const p of (prefs ?? [])) {
    prefMap.set(p.user_id, {
      days: p.reminder_days_before ?? DEFAULT_REMINDER_DAYS,
      pushEnabled: p.push_enabled ?? true,
    });
  }

  // Conjunto de días únicos a consultar (preferencias de usuarios + default)
  const uniqueDays = new Set<number>([DEFAULT_REMINDER_DAYS]);
  for (const p of (prefs ?? [])) {
    if (p.push_enabled !== false) uniqueDays.add(p.reminder_days_before);
  }

  const messages: ExpoPushMessage[] = [];

  // ── 2. Recordatorios: pagos que vencen en N días según preferencia de cada usuario ──
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

      // Solo notificar si este lender quiere exactamente N días de anticipación
      const pref = prefMap.get(lenderId);
      const lenderDays = pref?.days ?? DEFAULT_REMINDER_DAYS;
      const pushEnabled = pref?.pushEnabled ?? true;

      if (!pushEnabled || lenderDays !== days) continue;

      const borrowerName = payment.loan?.borrower?.full_name ?? 'tu prestatario';
      const loanId = payment.loan?.id;

      const { data: tokens } = await supabase
        .from('push_tokens')
        .select('token')
        .eq('user_id', lenderId)
        .eq('is_active', true);

      for (const { token } of (tokens ?? [])) {
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
  }

  // ── 3. Pagos que vencen HOY → notificación urgente (aplica a todos con push activo) ──
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

    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', lenderId)
      .eq('is_active', true);

    for (const { token } of (tokens ?? [])) {
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

  // ── 4. Enviar todos los mensajes a la Expo Push API (en lotes de 100) ──
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
