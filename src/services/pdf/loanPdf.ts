import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { formatCurrency } from '../calculations';

interface LoanForPdf {
  id: string;
  principal_amount: number;
  interest_rate: number;
  interest_type: string;
  term_value: number;
  term_type: string;
  currency: 'ARS' | 'USD';
  installment_amount: number;
  total_amount: number;
  delivery_date: string;
  first_payment_date: string;
  borrower?: { full_name?: string; dni?: string; phone?: string } | null;
}

interface PaymentForPdf {
  payment_number: number;
  due_date: string;
  total_amount: number;
  status: string;
  paid_date?: string | null;
  paid_amount?: number | null;
}

export async function generateLoanPDF(loan: LoanForPdf, payments: PaymentForPdf[]): Promise<void> {
  const currency = loan.currency as 'ARS' | 'USD';
  const fmt = (n: number) => formatCurrency(n, currency);

  const statusLabel = (s: string) => {
    if (s === 'paid') return '<span style="color:#16a34a">✓ Pagado</span>';
    if (s === 'overdue') return '<span style="color:#dc2626">✗ Vencido</span>';
    return '<span style="color:#d97706">⏳ Pendiente</span>';
  };

  const rows = payments
    .map(
      (p) => `
      <tr>
        <td>#${p.payment_number}</td>
        <td>${p.due_date}</td>
        <td>${fmt(p.total_amount)}</td>
        <td>${statusLabel(p.status)}</td>
        <td>${p.paid_date ?? '-'}</td>
        <td>${p.paid_amount != null ? fmt(p.paid_amount) : '-'}</td>
      </tr>`
    )
    .join('');

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <style>
    body { font-family: Arial, sans-serif; color: #111; padding: 32px; font-size: 13px; }
    h1 { color: #6366f1; margin-bottom: 4px; }
    .subtitle { color: #666; margin-bottom: 24px; font-size: 12px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 24px; }
    .item label { font-size: 11px; color: #888; display: block; }
    .item span { font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #6366f1; color: white; padding: 8px; text-align: left; font-size: 12px; }
    td { padding: 7px 8px; border-bottom: 1px solid #e5e7eb; font-size: 12px; }
    tr:nth-child(even) { background: #f9fafb; }
    .footer { margin-top: 32px; font-size: 11px; color: #999; text-align: center; }
  </style>
</head>
<body>
  <h1>Cuotify — Cronograma de Pagos</h1>
  <p class="subtitle">Generado el ${new Date().toLocaleDateString('es-AR')}</p>

  <h3>Prestatario</h3>
  <div class="grid">
    <div class="item"><label>Nombre</label><span>${loan.borrower?.full_name ?? '-'}</span></div>
    <div class="item"><label>DNI</label><span>${loan.borrower?.dni ?? '-'}</span></div>
    <div class="item"><label>Teléfono</label><span>${loan.borrower?.phone ?? '-'}</span></div>
  </div>

  <h3>Condiciones del préstamo</h3>
  <div class="grid">
    <div class="item"><label>Capital</label><span>${fmt(loan.principal_amount)}</span></div>
    <div class="item"><label>Tasa de interés anual</label><span>${loan.interest_rate}%</span></div>
    <div class="item"><label>Sistema</label><span>${loan.interest_type === 'french' ? 'Francés' : 'Simple'}</span></div>
    <div class="item"><label>Plazo</label><span>${loan.term_value} ${loan.term_type === 'months' ? 'meses' : 'semanas'}</span></div>
    <div class="item"><label>Cuota</label><span>${fmt(loan.installment_amount)}</span></div>
    <div class="item"><label>Total a pagar</label><span>${fmt(loan.total_amount)}</span></div>
    <div class="item"><label>Fecha de entrega</label><span>${loan.delivery_date}</span></div>
    <div class="item"><label>Primer pago</label><span>${loan.first_payment_date}</span></div>
  </div>

  <h3>Cronograma de cuotas</h3>
  <table>
    <thead>
      <tr>
        <th>Cuota</th><th>Vencimiento</th><th>Monto</th><th>Estado</th><th>Fecha pago</th><th>Monto pagado</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="footer">Cuotify — Organizá tus finanzas y pagos en un solo lugar</div>
</body>
</html>`;

  const { uri } = await Print.printToFileAsync({ html, base64: false });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Compartir cronograma de pagos',
    });
  }
}
