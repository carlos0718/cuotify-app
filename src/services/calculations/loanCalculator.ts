import {
  LoanCalculationInput,
  LoanCalculationResult,
  AmortizationEntry,
  TermType,
  InterestType,
  LatePenaltyType,
} from '../../types';

/**
 * Redondea un número a 2 decimales
 */
function roundToTwo(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Calcula el pago periódico de un préstamo
 *
 * Soporta dos sistemas:
 * - SIMPLE: Interés = Capital × Tasa × Plazo (interés fijo cada cuota)
 * - FRANCÉS: PMT = P × [r(1+r)^n] / [(1+r)^n - 1] (cuota fija, interés sobre saldo)
 *
 * @param input - Datos del préstamo
 * @returns Resultado del cálculo con pago, interés total y monto total
 */
export function calculateLoanPayment(
  input: LoanCalculationInput
): LoanCalculationResult {
  const { principalAmount, annualInterestRate, termValue, termType, interestType = 'simple' } = input;

  // Períodos por año según tipo
  const periodsPerYear = termType === 'weeks' ? 52 : 12;

  // Convertir tasa anual a tasa periódica
  const periodicRate = annualInterestRate / 100 / periodsPerYear;

  let paymentAmount: number;
  let totalInterest: number;
  let totalAmount: number;

  if (periodicRate === 0) {
    // Préstamo sin interés
    paymentAmount = principalAmount / termValue;
    totalInterest = 0;
    totalAmount = principalAmount;
  } else if (interestType === 'simple') {
    // SISTEMA SIMPLE: Interés = Capital × Tasa × Plazo
    // El interés se calcula sobre el capital inicial y es fijo cada cuota
    totalInterest = principalAmount * periodicRate * termValue;
    totalAmount = principalAmount + totalInterest;
    paymentAmount = totalAmount / termValue;
  } else {
    // SISTEMA FRANCÉS (amortización): Cuota fija, interés sobre saldo
    const factor = Math.pow(1 + periodicRate, termValue);
    paymentAmount = (principalAmount * (periodicRate * factor)) / (factor - 1);
    totalAmount = paymentAmount * termValue;
    totalInterest = totalAmount - principalAmount;
  }

  return {
    paymentAmount: roundToTwo(paymentAmount),
    totalInterest: roundToTwo(totalInterest),
    totalAmount: roundToTwo(totalAmount),
    periodicRate,
  };
}

/**
 * Calcula con sistema simple (para compatibilidad)
 */
export function calculateSimpleInterest(
  input: Omit<LoanCalculationInput, 'interestType'>
): LoanCalculationResult {
  return calculateLoanPayment({ ...input, interestType: 'simple' });
}

/**
 * Calcula con sistema francés (para compatibilidad)
 */
export function calculateFrenchSystem(
  input: Omit<LoanCalculationInput, 'interestType'>
): LoanCalculationResult {
  return calculateLoanPayment({ ...input, interestType: 'french' });
}

/**
 * Genera el cronograma completo de amortización
 */
export function generateAmortizationSchedule(
  principalAmount: number,
  periodicRate: number,
  paymentAmount: number,
  termValue: number,
  termType: TermType,
  firstPaymentDate: Date
): AmortizationEntry[] {
  const schedule: AmortizationEntry[] = [];
  let balance = principalAmount;
  let currentDate = new Date(firstPaymentDate);

  for (let i = 1; i <= termValue; i++) {
    // Calcular porción de interés para este período
    let interestPortion = roundToTwo(balance * periodicRate);
    let principalPortion = roundToTwo(paymentAmount - interestPortion);

    // Manejar redondeo del último pago
    if (i === termValue) {
      principalPortion = roundToTwo(balance);
      interestPortion = roundToTwo(paymentAmount - principalPortion);
    }

    balance = Math.max(0, roundToTwo(balance - principalPortion));

    schedule.push({
      paymentNumber: i,
      dueDate: new Date(currentDate),
      principalPortion,
      interestPortion,
      totalPayment: paymentAmount,
      remainingBalance: balance,
    });

    // Avanzar al siguiente período
    currentDate = addPeriod(currentDate, termType);
  }

  return schedule;
}

/**
 * Agrega un período a una fecha
 */
function addPeriod(date: Date, termType: TermType): Date {
  const newDate = new Date(date);
  if (termType === 'weeks') {
    newDate.setDate(newDate.getDate() + 7);
  } else {
    newDate.setMonth(newDate.getMonth() + 1);
  }
  return newDate;
}

/**
 * Calcula la fecha de finalización del préstamo
 */
export function calculateEndDate(
  firstPaymentDate: Date,
  termValue: number,
  termType: TermType
): Date {
  const endDate = new Date(firstPaymentDate);

  if (termType === 'weeks') {
    endDate.setDate(endDate.getDate() + (termValue - 1) * 7);
  } else {
    endDate.setMonth(endDate.getMonth() + (termValue - 1));
  }

  return endDate;
}

/**
 * Formatea un monto como moneda
 */
export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Calcula el porcentaje pagado de un préstamo
 */
export function calculatePaymentProgress(
  paidAmount: number,
  totalAmount: number
): number {
  if (totalAmount === 0) return 0;
  return roundToTwo((paidAmount / totalAmount) * 100);
}

/**
 * Input para calcular penalización por mora
 */
export interface PenaltyCalculationInput {
  dueDate: Date;
  paymentAmount: number;
  gracePeriodDays: number;
  latePenaltyType: LatePenaltyType;
  latePenaltyRate: number;
  currentDate?: Date;
}

/**
 * Resultado del cálculo de penalización
 */
export interface PenaltyCalculationResult {
  isOverdue: boolean;
  daysOverdue: number;
  daysAfterGrace: number;
  penaltyAmount: number;
  totalWithPenalty: number;
}

/**
 * Calcula la penalización por mora de un pago atrasado
 *
 * @param input - Datos del pago y configuración de penalización
 * @returns Resultado con días de atraso y monto de penalización
 */
export function calculateLatePenalty(
  input: PenaltyCalculationInput
): PenaltyCalculationResult {
  const {
    dueDate,
    paymentAmount,
    gracePeriodDays,
    latePenaltyType,
    latePenaltyRate,
    currentDate = new Date(),
  } = input;

  // Calcular días de atraso
  const dueDateNormalized = new Date(dueDate);
  dueDateNormalized.setHours(0, 0, 0, 0);

  const currentDateNormalized = new Date(currentDate);
  currentDateNormalized.setHours(0, 0, 0, 0);

  const diffTime = currentDateNormalized.getTime() - dueDateNormalized.getTime();
  const daysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  // Si no está vencido, no hay penalización
  if (daysOverdue <= 0) {
    return {
      isOverdue: false,
      daysOverdue: 0,
      daysAfterGrace: 0,
      penaltyAmount: 0,
      totalWithPenalty: paymentAmount,
    };
  }

  // Calcular días después del período de gracia
  const daysAfterGrace = Math.max(0, daysOverdue - gracePeriodDays);

  // Si aún está dentro del período de gracia, no hay penalización
  if (daysAfterGrace <= 0 || latePenaltyType === 'none') {
    return {
      isOverdue: true,
      daysOverdue,
      daysAfterGrace: 0,
      penaltyAmount: 0,
      totalWithPenalty: paymentAmount,
    };
  }

  // Calcular penalización según el tipo
  let penaltyAmount = 0;
  const penaltyPercentage = latePenaltyRate / 100;

  switch (latePenaltyType) {
    case 'fixed':
      // Penalización fija única
      penaltyAmount = paymentAmount * penaltyPercentage;
      break;

    case 'daily':
      // Penalización diaria acumulativa
      penaltyAmount = paymentAmount * penaltyPercentage * daysAfterGrace;
      break;

    case 'weekly':
      // Penalización semanal acumulativa
      const weeksAfterGrace = Math.ceil(daysAfterGrace / 7);
      penaltyAmount = paymentAmount * penaltyPercentage * weeksAfterGrace;
      break;
  }

  return {
    isOverdue: true,
    daysOverdue,
    daysAfterGrace,
    penaltyAmount: roundToTwo(penaltyAmount),
    totalWithPenalty: roundToTwo(paymentAmount + penaltyAmount),
  };
}

/**
 * Formatea el mensaje de estado de mora
 */
export function formatPenaltyStatus(result: PenaltyCalculationResult): string {
  if (!result.isOverdue) {
    return 'Al día';
  }

  if (result.daysAfterGrace === 0) {
    return `Vencido hace ${result.daysOverdue} día${result.daysOverdue !== 1 ? 's' : ''} (en período de gracia)`;
  }

  return `Vencido hace ${result.daysOverdue} día${result.daysOverdue !== 1 ? 's' : ''} - Mora: $${result.penaltyAmount.toFixed(2)}`;
}
