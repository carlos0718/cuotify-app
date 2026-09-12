import { calculateLoanPayment } from '../loanCalculator';

describe('calculateLoanPayment — smoke test (Jest configurado)', () => {
  it('calcula el sistema simple con capital 1000, 12% anual, 12 cuotas mensuales', () => {
    const result = calculateLoanPayment({
      principalAmount: 1000,
      annualInterestRate: 12,
      termValue: 12,
      termType: 'months',
      interestType: 'simple',
    });

    expect(result.totalInterest).toBe(120);
    expect(result.totalAmount).toBe(1120);
    expect(result.paymentAmount).toBeCloseTo(93.33, 2);
  });
});
