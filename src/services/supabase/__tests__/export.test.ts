import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getBorrowers, getLoans, getAllPaymentsForExport } from '../loans';
import { getPersonalDebts, getAllDebtPaymentsForExport } from '../personalDebts';
import {
  exportLoansToCSV,
  exportPaymentsToCSV,
  exportDebtsToCSV,
  exportDebtPaymentsToCSV,
  exportAllDataToCSV,
} from '../export';

// export.ts solo orquesta: trae datos ya probados en loans.test.ts/personalDebts.test.ts,
// arma el CSV y lo comparte. Acá se mockean esas dos capas para poder poner el foco en
// la construcción del CSV (escaping de comas/comillas, columnas, defaults de null).
jest.mock('../loans');
jest.mock('../personalDebts');
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file://cache/',
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  EncodingType: { UTF8: 'utf8' },
}));
jest.mock('expo-sharing', () => ({
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

const mockGetBorrowers = getBorrowers as jest.Mock;
const mockGetLoans = getLoans as jest.Mock;
const mockGetAllPaymentsForExport = getAllPaymentsForExport as jest.Mock;
const mockGetPersonalDebts = getPersonalDebts as jest.Mock;
const mockGetAllDebtPaymentsForExport = getAllDebtPaymentsForExport as jest.Mock;
const mockWriteAsStringAsync = FileSystem.writeAsStringAsync as jest.Mock;
const mockShareAsync = Sharing.shareAsync as jest.Mock;

afterEach(() => jest.clearAllMocks());

function writtenCsv(): string {
  return mockWriteAsStringAsync.mock.calls[0][1] as string;
}

describe('exportLoansToCSV', () => {
  it('arma el CSV con los datos del préstamo y el prestatario vinculado', async () => {
    mockGetBorrowers.mockResolvedValue([{ id: 'b1', full_name: 'Juan Pérez', dni: '111', phone: '222' }]);
    mockGetLoans.mockResolvedValue([
      {
        id: 'loan-1',
        borrower_id: 'b1',
        principal_amount: 1000,
        currency: 'ARS',
        interest_rate: 12,
        interest_type: 'simple',
        term_value: 12,
        term_type: 'months',
        payment_amount: 93.33,
        total_amount: 1120,
        total_interest: 120,
        first_payment_date: '2026-02-01',
        delivery_date: '2026-01-01',
        status: 'active',
        late_penalty_type: 'fixed',
        late_penalty_rate: 5,
        grace_period_days: 3,
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ]);

    await exportLoansToCSV();

    const csv = writtenCsv();
    expect(csv.split('\n')[0]).toBe(
      'ID Préstamo,Prestatario,DNI,Teléfono,Capital,Moneda,Tasa de interés (%),Tipo de interés,Cuotas,Frecuencia,Monto cuota,Total a pagar,Interés total,Fecha primer pago,Fecha entrega,Estado,Tipo mora,Tasa penalización (%),Días gracia,Creado en'
    );
    expect(csv.split('\n')[1]).toBe(
      'loan-1,Juan Pérez,111,222,1000,ARS,12,simple,12,months,93.33,1120,120,2026-02-01,2026-01-01,active,fixed,5,3,2026-01-01T00:00:00.000Z'
    );

    expect(mockWriteAsStringAsync).toHaveBeenCalledWith(
      'file://cache/cuotify_prestamos.csv',
      expect.any(String),
      { encoding: 'utf8' }
    );
    expect(mockShareAsync).toHaveBeenCalledWith('file://cache/cuotify_prestamos.csv', {
      mimeType: 'text/csv',
      UTI: 'public.comma-separated-values-text',
    });
  });

  it('deja las columnas del prestatario vacías si no lo encuentra en el mapa', async () => {
    mockGetBorrowers.mockResolvedValue([]);
    mockGetLoans.mockResolvedValue([
      { id: 'loan-1', borrower_id: 'b-inexistente', principal_amount: 1000, currency: 'ARS' },
    ]);

    await exportLoansToCSV();

    const row = writtenCsv().split('\n')[1].split(',');
    expect(row[1]).toBe(''); // Prestatario
    expect(row[2]).toBe(''); // DNI
    expect(row[3]).toBe(''); // Teléfono
  });

  it('escapa correctamente valores con comas y comillas (CSV injection de datos, no de código)', async () => {
    mockGetBorrowers.mockResolvedValue([
      { id: 'b1', full_name: 'Pérez, Juan "el rápido"', dni: null, phone: null },
    ]);
    mockGetLoans.mockResolvedValue([{ id: 'loan-1', borrower_id: 'b1', principal_amount: 1000, currency: 'ARS' }]);

    await exportLoansToCSV();

    const csv = writtenCsv();
    expect(csv).toContain('"Pérez, Juan ""el rápido"""');
  });
});

describe('exportPaymentsToCSV', () => {
  it('arma el CSV de pagos, incluida la moneda anidada del préstamo y los defaults de null', async () => {
    mockGetAllPaymentsForExport.mockResolvedValue([
      {
        id: 'p1',
        loan_id: 'loan-1',
        payment_number: 1,
        due_date: '2026-02-01',
        total_amount: 100,
        principal_portion: 80,
        interest_portion: 20,
        penalty_amount: null,
        status: 'pending',
        paid_date: null,
        paid_amount: null,
        lender_note: null,
        loan: { currency: 'USD' },
      },
    ]);

    await exportPaymentsToCSV();

    const row = writtenCsv().split('\n')[1];
    expect(row).toBe('p1,loan-1,1,2026-02-01,100,80,20,0,pending,,,USD,');
  });
});

describe('exportDebtsToCSV', () => {
  it('arma el CSV de deudas personales', async () => {
    mockGetPersonalDebts.mockResolvedValue([
      {
        id: 'debt-1',
        creditor_name: 'Banco X',
        creditor_phone: '123',
        description: 'Préstamo personal',
        principal_amount: 1000,
        currency: 'ARS',
        interest_rate: 20,
        interest_type: 'simple',
        term_value: 5,
        term_type: 'months',
        installment_amount: 240,
        total_amount: 1200,
        first_payment_date: '2026-02-01',
        delivery_date: '2026-01-01',
        status: 'active',
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ]);

    await exportDebtsToCSV();

    expect(mockWriteAsStringAsync).toHaveBeenCalledWith(
      'file://cache/cuotify_deudas.csv',
      expect.stringContaining('Banco X,123,Préstamo personal,1000,ARS'),
      { encoding: 'utf8' }
    );
  });
});

describe('exportDebtPaymentsToCSV', () => {
  it('arma el CSV de pagos de deudas, incluido el nombre del acreedor anidado', async () => {
    mockGetAllDebtPaymentsForExport.mockResolvedValue([
      {
        id: 'dp1',
        debt_id: 'debt-1',
        payment_number: 1,
        due_date: '2026-02-01',
        total_amount: 240,
        principal_amount: 200,
        interest_amount: 40,
        penalty_amount: 0,
        status: 'pending',
        paid_date: null,
        paid_amount: null,
        notes: null,
        debt: { creditor_name: 'Banco X' },
      },
    ]);

    await exportDebtPaymentsToCSV();

    const row = writtenCsv().split('\n')[1];
    expect(row).toBe('dp1,debt-1,Banco X,1,2026-02-01,240,200,40,0,pending,,,');
  });
});

describe('exportAllDataToCSV', () => {
  it('exporta y comparte los 4 CSV en orden', async () => {
    mockGetBorrowers.mockResolvedValue([]);
    mockGetLoans.mockResolvedValue([]);
    mockGetAllPaymentsForExport.mockResolvedValue([]);
    mockGetPersonalDebts.mockResolvedValue([]);
    mockGetAllDebtPaymentsForExport.mockResolvedValue([]);

    await exportAllDataToCSV();

    const writtenFiles = mockWriteAsStringAsync.mock.calls.map((call) => call[0]);
    expect(writtenFiles).toEqual([
      'file://cache/cuotify_prestamos.csv',
      'file://cache/cuotify_pagos_prestamos.csv',
      'file://cache/cuotify_deudas.csv',
      'file://cache/cuotify_pagos_deudas.csv',
    ]);
    expect(mockShareAsync).toHaveBeenCalledTimes(4);
  });
});
