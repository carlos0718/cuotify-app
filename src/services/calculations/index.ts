export {
  calculateLoanPayment,
  generateAmortizationSchedule,
  calculateEndDate,
  formatCurrency,
  calculatePaymentProgress,
  calculateLatePenalty,
  formatPenaltyStatus,
} from './loanCalculator';

export type {
  PenaltyCalculationInput,
  PenaltyCalculationResult,
} from './loanCalculator';
