export * from './database.types';

// Tipos de usuario y rol
export type UserRole = 'lender' | 'borrower' | 'both';

// Tipos para el período de préstamo
export type TermType = 'weeks' | 'months';

// Estados de préstamo
export type LoanStatus = 'active' | 'completed' | 'defaulted' | 'cancelled';

// Estados de pago
export type PaymentStatus = 'pending' | 'paid' | 'partial' | 'overdue';

// Tipo de cálculo de interés
export type InterestType = 'simple' | 'french';

// Tipo de penalización por mora
export type LatePenaltyType = 'none' | 'fixed' | 'daily' | 'weekly';

// Tipo de moneda
export type CurrencyType = 'ARS' | 'USD';

// Tipo para cálculo de préstamo
export interface LoanCalculationInput {
  principalAmount: number;
  annualInterestRate: number;
  termValue: number;
  termType: TermType;
  interestType: InterestType;
}

export interface LoanCalculationResult {
  paymentAmount: number;
  totalInterest: number;
  totalAmount: number;
  periodicRate: number;
}

// Tipo para entrada de amortización
export interface AmortizationEntry {
  paymentNumber: number;
  dueDate: Date;
  principalPortion: number;
  interestPortion: number;
  totalPayment: number;
  remainingBalance: number;
}

// Tipo para estadísticas del dashboard (Prestamista)
export interface LenderDashboardStats {
  totalLent: number;
  totalRecovered: number;
  percentageCollected: number;
  activeLoansCount: number;
  pendingPaymentsThisPeriod: number;
  overduePayments: number;
  totalBorrowers: number;
}

// Tipo para estadísticas del dashboard (Prestatario)
export interface BorrowerDashboardStats {
  totalDebt: number;
  totalPaid: number;
  percentagePaid: number;
  nextPaymentAmount: number;
  nextPaymentDate: Date | null;
  activeLoansCount: number;
}

// Tipo para formulario de creación de préstamo
export interface CreateLoanFormData {
  borrowerId: string;
  principalAmount: number;
  interestRate: number;
  termValue: number;
  termType: TermType;
  deliveryDate: Date;
  firstPaymentDate: Date;
  reminderDaysBefore: number;
  notes?: string;
}

// Tipo para formulario de creación de prestatario
export interface CreateBorrowerFormData {
  fullName: string;
  dni?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

// Tipo para configuración de notificaciones
export interface NotificationSettings {
  pushEnabled: boolean;
  emailEnabled: boolean;
  reminderDays: number;
}
