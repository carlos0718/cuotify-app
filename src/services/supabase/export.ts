/**
 * Servicio de exportación de datos a CSV (feature Pro).
 *
 * Requiere `expo-file-system` instalado:
 *   npx expo install expo-file-system
 */
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getBorrowers, getLoans, getAllPaymentsForExport } from './loans';
import { getPersonalDebts, getAllDebtPaymentsForExport } from './personalDebts';
import type { Borrower, Loan, Payment } from '../../types';
import type { PersonalDebt, DebtPayment } from './personalDebts';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowsToCsv(headers: string[], rows: unknown[][]): string {
  const header = headers.map(escapeCsv).join(',');
  const body = rows.map((r) => r.map(escapeCsv).join(',')).join('\n');
  return `${header}\n${body}`;
}

async function shareFile(filename: string, content: string): Promise<void> {
  const uri = FileSystem.cacheDirectory + filename;
  await FileSystem.writeAsStringAsync(uri, content, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await Sharing.shareAsync(uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
  });
}

// ─────────────────────────────────────────────
// Exportar préstamos + prestatarios
// ─────────────────────────────────────────────

export async function exportLoansToCSV(): Promise<void> {
  const [borrowers, loans] = await Promise.all([getBorrowers(), getLoans()]);

  const borrowerMap = new Map<string, Borrower>(borrowers.map((b) => [b.id, b]));

  const headers = [
    'ID Préstamo',
    'Prestatario',
    'DNI',
    'Teléfono',
    'Capital',
    'Moneda',
    'Tasa de interés (%)',
    'Tipo de interés',
    'Cuotas',
    'Frecuencia',
    'Monto cuota',
    'Total a pagar',
    'Interés total',
    'Fecha primer pago',
    'Fecha entrega',
    'Estado',
    'Tipo mora',
    'Tasa penalización (%)',
    'Días gracia',
    'Creado en',
  ];

  const rows = (loans as Loan[]).map((l) => {
    const b = borrowerMap.get(l.borrower_id ?? '') ?? null;
    return [
      l.id,
      b?.full_name ?? '',
      b?.dni ?? '',
      b?.phone ?? '',
      l.principal_amount,
      l.currency,
      l.interest_rate,
      l.interest_type,
      l.term_value,
      l.term_type,
      l.payment_amount,
      l.total_amount,
      l.total_interest,
      l.first_payment_date,
      l.delivery_date,
      l.status,
      l.late_penalty_type,
      l.late_penalty_rate,
      l.grace_period_days,
      l.created_at,
    ];
  });

  await shareFile('cuotify_prestamos.csv', rowsToCsv(headers, rows));
}

// ─────────────────────────────────────────────
// Exportar pagos de préstamos
// ─────────────────────────────────────────────

export async function exportPaymentsToCSV(): Promise<void> {
  const payments = await getAllPaymentsForExport();

  const headers = [
    'ID Pago',
    'ID Préstamo',
    'Nro. cuota',
    'Fecha vencimiento',
    'Monto total',
    'Capital',
    'Interés',
    'Penalización',
    'Estado',
    'Fecha pago',
    'Monto pagado',
    'Moneda',
    'Nota del prestamista',
  ];

  const rows = (payments as (Payment & { loan: { currency: string } })[]).map((p) => [
    p.id,
    p.loan_id,
    p.payment_number,
    p.due_date,
    p.total_amount,
    p.principal_portion,
    p.interest_portion,
    p.penalty_amount ?? 0,
    p.status,
    p.paid_date ?? '',
    p.paid_amount ?? '',
    p.loan?.currency ?? '',
    p.lender_note ?? '',
  ]);

  await shareFile('cuotify_pagos_prestamos.csv', rowsToCsv(headers, rows));
}

// ─────────────────────────────────────────────
// Exportar deudas personales
// ─────────────────────────────────────────────

export async function exportDebtsToCSV(): Promise<void> {
  const debts = await getPersonalDebts();

  const headers = [
    'ID Deuda',
    'Acreedor',
    'Teléfono acreedor',
    'Descripción',
    'Capital',
    'Moneda',
    'Tasa de interés (%)',
    'Tipo de interés',
    'Cuotas',
    'Frecuencia',
    'Monto cuota',
    'Total a pagar',
    'Fecha primer pago',
    'Fecha recepción',
    'Estado',
    'Creado en',
  ];

  const rows = (debts as PersonalDebt[]).map((d) => [
    d.id,
    d.creditor_name,
    d.creditor_phone ?? '',
    d.description ?? '',
    d.principal_amount,
    d.currency,
    d.interest_rate,
    d.interest_type,
    d.term_value,
    d.term_type,
    d.installment_amount,
    d.total_amount,
    d.first_payment_date,
    d.delivery_date,
    d.status,
    d.created_at,
  ]);

  await shareFile('cuotify_deudas.csv', rowsToCsv(headers, rows));
}

// ─────────────────────────────────────────────
// Exportar pagos de deudas personales
// ─────────────────────────────────────────────

export async function exportDebtPaymentsToCSV(): Promise<void> {
  const payments = await getAllDebtPaymentsForExport();

  const headers = [
    'ID Pago',
    'ID Deuda',
    'Acreedor',
    'Nro. cuota',
    'Fecha vencimiento',
    'Monto total',
    'Capital',
    'Interés',
    'Penalización',
    'Estado',
    'Fecha pago',
    'Monto pagado',
    'Notas',
  ];

  const rows = (payments as (DebtPayment & { debt: { creditor_name: string } })[]).map((p) => [
    p.id,
    p.debt_id,
    p.debt?.creditor_name ?? '',
    p.payment_number,
    p.due_date,
    p.total_amount,
    p.principal_amount,
    p.interest_amount,
    p.penalty_amount,
    p.status,
    p.paid_date ?? '',
    p.paid_amount ?? '',
    p.notes ?? '',
  ]);

  await shareFile('cuotify_pagos_deudas.csv', rowsToCsv(headers, rows));
}

// ─────────────────────────────────────────────
// Exportar todo (4 CSVs compartidos en secuencia)
// ─────────────────────────────────────────────

export async function exportAllDataToCSV(): Promise<void> {
  await exportLoansToCSV();
  await exportPaymentsToCSV();
  await exportDebtsToCSV();
  await exportDebtPaymentsToCSV();
}
