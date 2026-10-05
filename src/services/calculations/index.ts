export {
  calculateLoanPayment,
  generateAmortizationSchedule,
  calculateEndDate,
  formatCurrency,
  convertCurrency,
  calculatePaymentProgress,
  calculateLatePenalty,
  formatPenaltyStatus,
} from './loanCalculator';

export type {
  PenaltyCalculationInput,
  PenaltyCalculationResult,
} from './loanCalculator';
