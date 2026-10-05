import {
  calculateLoanPayment,
  calculateSimpleInterest,
  calculateFrenchSystem,
  generateAmortizationSchedule,
  calculateEndDate,
  formatCurrency,
  convertCurrency,
  calculatePaymentProgress,
  calculateLatePenalty,
  formatPenaltyStatus,
} from '../loanCalculator';
import { ExchangeRate } from '../../../types';

describe('calculateLoanPayment — sistema simple', () => {
  it('calcula interés fijo mensual (capital 1000, 12% anual, 12 cuotas)', () => {
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

  it('calcula con plazo semanal (52 períodos por año)', () => {
    const result = calculateLoanPayment({
      principalAmount: 1000,
      annualInterestRate: 52, // 1% semanal exacto
      termValue: 10,
      termType: 'weeks',
      interestType: 'simple',
    });

    // periodicRate = 52/100/52 = 0.01
    expect(result.periodicRate).toBeCloseTo(0.01, 6);
    expect(result.totalInterest).toBeCloseTo(100, 2); // 1000 * 0.01 * 10
    expect(result.totalAmount).toBeCloseTo(1100, 2);
    expect(result.paymentAmount).toBeCloseTo(110, 2);
  });

  it('calculateSimpleInterest delega en calculateLoanPayment con interestType simple', () => {
    const viaWrapper = calculateSimpleInterest({
      principalAmount: 1000,
      annualInterestRate: 12,
      termValue: 12,
      termType: 'months',
    });
    const viaDirect = calculateLoanPayment({
      principalAmount: 1000,
      annualInterestRate: 12,
      termValue: 12,
      termType: 'months',
      interestType: 'simple',
    });

    expect(viaWrapper).toEqual(viaDirect);
  });
});

describe('calculateLoanPayment — sistema francés', () => {
  it('calcula cuota fija con interés sobre saldo (capital 1000, 24% anual, 2 cuotas mensuales)', () => {
    const result = calculateLoanPayment({
      principalAmount: 1000,
      annualInterestRate: 24,
      termValue: 2,
      termType: 'months',
      interestType: 'french',
    });

    // Verificado a mano: r = 0.02, PMT = 1000*0.02*1.02^2 / (1.02^2 - 1) ≈ 515.0495
    expect(result.paymentAmount).toBeCloseTo(515.05, 2);
    expect(result.totalAmount).toBeCloseTo(1030.1, 2);
    expect(result.totalInterest).toBeCloseTo(30.1, 2);
  });

  it('la cuota es igual en todos los períodos (a diferencia del sistema simple)', () => {
    const result = calculateLoanPayment({
      principalAmount: 5000,
      annualInterestRate: 36,
      termValue: 6,
      termType: 'months',
      interestType: 'french',
    });

    // El total pagado siempre debe ser cuota fija * cantidad de cuotas
    expect(result.totalAmount).toBeCloseTo(result.paymentAmount * 6, 1);
  });

  it('calculateFrenchSystem delega en calculateLoanPayment con interestType french', () => {
    const viaWrapper = calculateFrenchSystem({
      principalAmount: 1000,
      annualInterestRate: 24,
      termValue: 2,
      termType: 'months',
    });
    const viaDirect = calculateLoanPayment({
      principalAmount: 1000,
      annualInterestRate: 24,
      termValue: 2,
      termType: 'months',
      interestType: 'french',
    });

    expect(viaWrapper).toEqual(viaDirect);
  });
});

describe('calculateLoanPayment — bordes', () => {
  it('préstamo sin interés (tasa 0) reparte el capital en partes iguales', () => {
    const result = calculateLoanPayment({
      principalAmount: 1200,
      annualInterestRate: 0,
      termValue: 12,
      termType: 'months',
      interestType: 'french',
    });

    expect(result.totalInterest).toBe(0);
    expect(result.totalAmount).toBe(1200);
    expect(result.paymentAmount).toBe(100);
  });

  it('préstamo abierto (interestType open) no calcula cuota ni cronograma', () => {
    const result = calculateLoanPayment({
      principalAmount: 5000,
      annualInterestRate: 15,
      termValue: 0,
      termType: 'months',
      interestType: 'open',
    });

    expect(result.paymentAmount).toBe(0);
    expect(result.totalInterest).toBe(0);
    expect(result.totalAmount).toBe(5000);
  });

  it('redondea a 2 decimales aunque el cálculo interno tenga más precisión', () => {
    const result = calculateLoanPayment({
      principalAmount: 1000,
      annualInterestRate: 13,
      termValue: 7,
      termType: 'months',
      interestType: 'simple',
    });

    const decimals = (n: number) => (n.toString().split('.')[1] || '').length;
    expect(decimals(result.paymentAmount)).toBeLessThanOrEqual(2);
    expect(decimals(result.totalInterest)).toBeLessThanOrEqual(2);
    expect(decimals(result.totalAmount)).toBeLessThanOrEqual(2);
  });
});

describe('generateAmortizationSchedule', () => {
  it('genera una entrada por cuota y termina en balance 0', () => {
    const schedule = generateAmortizationSchedule(
      1000,
      0.02,
      515.05,
      2,
      'months',
      new Date(2026, 0, 1)
    );

    expect(schedule).toHaveLength(2);
    expect(schedule[schedule.length - 1].remainingBalance).toBe(0);
  });

  it('la suma de las porciones de capital es igual al capital inicial', () => {
    const schedule = generateAmortizationSchedule(
      1000,
      0.02,
      515.05,
      2,
      'months',
      new Date(2026, 0, 1)
    );

    const totalPrincipal = schedule.reduce((sum, e) => sum + e.principalPortion, 0);
    expect(totalPrincipal).toBeCloseTo(1000, 2);
  });

  it('ajusta el redondeo en la última cuota para que el balance cierre en 0', () => {
    // Caso con más cuotas, donde el redondeo por período acumula diferencia
    const schedule = generateAmortizationSchedule(
      1000,
      0.019166666666, // tasa "fea" para forzar arrastre de redondeo
      93.33,
      12,
      'months',
      new Date(2026, 0, 1)
    );

    expect(schedule[schedule.length - 1].remainingBalance).toBe(0);
  });

  it('avanza las fechas en incrementos semanales', () => {
    const schedule = generateAmortizationSchedule(
      1000,
      0.01,
      520,
      3,
      'weeks',
      new Date(2026, 0, 1)
    );

    expect(schedule[0].dueDate.getTime()).toBe(new Date(2026, 0, 1).getTime());
    expect(schedule[1].dueDate.getTime()).toBe(new Date(2026, 0, 8).getTime());
    expect(schedule[2].dueDate.getTime()).toBe(new Date(2026, 0, 15).getTime());
  });

  it('avanza las fechas en incrementos mensuales', () => {
    const schedule = generateAmortizationSchedule(
      1000,
      0.02,
      515.05,
      2,
      'months',
      new Date(2026, 0, 15)
    );

    expect(schedule[0].dueDate.getMonth()).toBe(0); // enero
    expect(schedule[1].dueDate.getMonth()).toBe(1); // febrero
  });
});

describe('calculateEndDate', () => {
  it('calcula la fecha de fin para plazo en meses', () => {
    const endDate = calculateEndDate(new Date(2026, 0, 15), 3, 'months');
    expect(endDate.getFullYear()).toBe(2026);
    expect(endDate.getMonth()).toBe(2); // marzo (enero + 2)
    expect(endDate.getDate()).toBe(15);
  });

  it('calcula la fecha de fin para plazo en semanas', () => {
    const endDate = calculateEndDate(new Date(2026, 0, 1), 4, 'weeks');
    // (4 - 1) * 7 = 21 días después del 1/1
    expect(endDate.getTime()).toBe(new Date(2026, 0, 22).getTime());
  });

  it('con un único pago, la fecha de fin es la misma que la de inicio', () => {
    const start = new Date(2026, 0, 1);
    expect(calculateEndDate(start, 1, 'months').getTime()).toBe(start.getTime());
    expect(calculateEndDate(start, 1, 'weeks').getTime()).toBe(start.getTime());
  });
});

describe('formatCurrency', () => {
  it('formatea en ARS por defecto', () => {
    const formatted = formatCurrency(1234.5);
    expect(formatted).toContain('1.234,50');
    expect(formatted).toMatch(/ARS|\$/);
  });

  it('formatea en USD cuando se pasa explícito', () => {
    const formatted = formatCurrency(1234.5, 'USD');
    expect(formatted).toContain('1.234,50');
    expect(formatted).toMatch(/US\$|\$/);
  });

  it('formatea montos negativos', () => {
    const formatted = formatCurrency(-50, 'ARS');
    expect(formatted).toContain('50,00');
    expect(formatted).toMatch(/-/);
  });
});

describe('calculatePaymentProgress', () => {
  it('calcula el porcentaje pagado', () => {
    expect(calculatePaymentProgress(500, 1000)).toBe(50);
  });

  it('devuelve 0 cuando el total es 0 (evita división por cero)', () => {
    expect(calculatePaymentProgress(0, 0)).toBe(0);
  });

  it('redondea el porcentaje a 2 decimales', () => {
    expect(calculatePaymentProgress(1, 3)).toBeCloseTo(33.33, 2);
  });

  it('puede superar el 100% si se pagó de más', () => {
    expect(calculatePaymentProgress(1200, 1000)).toBe(120);
  });
});

describe('calculateLatePenalty', () => {
  const baseInput = {
    dueDate: new Date(2026, 0, 1),
    paymentAmount: 1000,
    gracePeriodDays: 2,
    latePenaltyType: 'fixed' as const,
    latePenaltyRate: 5,
  };

  it('no hay mora si el pago todavía no venció', () => {
    const result = calculateLatePenalty({
      ...baseInput,
      currentDate: new Date(2025, 11, 30),
    });

    expect(result.isOverdue).toBe(false);
    expect(result.penaltyAmount).toBe(0);
    expect(result.totalWithPenalty).toBe(1000);
  });

  it('el día de vencimiento exacto todavía no está en mora', () => {
    const result = calculateLatePenalty({
      ...baseInput,
      currentDate: new Date(2026, 0, 1),
    });

    expect(result.isOverdue).toBe(false);
  });

  it('está vencido pero dentro del período de gracia: no hay penalización', () => {
    const result = calculateLatePenalty({
      ...baseInput,
      currentDate: new Date(2026, 0, 3), // 2 días de atraso, gracia = 2
    });

    expect(result.isOverdue).toBe(true);
    expect(result.daysOverdue).toBe(2);
    expect(result.daysAfterGrace).toBe(0);
    expect(result.penaltyAmount).toBe(0);
  });

  it('latePenaltyType "none" nunca penaliza aunque esté vencido hace mucho', () => {
    const result = calculateLatePenalty({
      ...baseInput,
      latePenaltyType: 'none',
      currentDate: new Date(2026, 1, 1), // muy vencido
    });

    expect(result.isOverdue).toBe(true);
    expect(result.penaltyAmount).toBe(0);
  });

  it('penalización fija: se cobra una sola vez, sin importar cuántos días pasaron después de la gracia', () => {
    const result = calculateLatePenalty({
      ...baseInput,
      latePenaltyType: 'fixed',
      latePenaltyRate: 5,
      currentDate: new Date(2026, 0, 10), // 9 días de atraso, 7 después de gracia
    });

    expect(result.daysAfterGrace).toBe(7);
    expect(result.penaltyAmount).toBe(50); // 1000 * 5%
    expect(result.totalWithPenalty).toBe(1050);
  });

  it('penalización diaria: se acumula por cada día después de la gracia', () => {
    const result = calculateLatePenalty({
      ...baseInput,
      latePenaltyType: 'daily',
      latePenaltyRate: 1,
      currentDate: new Date(2026, 0, 10), // 7 días después de gracia
    });

    expect(result.penaltyAmount).toBe(70); // 1000 * 1% * 7
  });

  it('penalización semanal: redondea hacia arriba semanas parciales', () => {
    const exactWeek = calculateLatePenalty({
      ...baseInput,
      latePenaltyType: 'weekly',
      latePenaltyRate: 2,
      currentDate: new Date(2026, 0, 10), // 7 días después de gracia = 1 semana exacta
    });
    expect(exactWeek.penaltyAmount).toBe(20); // 1000 * 2% * 1

    const partialWeek = calculateLatePenalty({
      ...baseInput,
      latePenaltyType: 'weekly',
      latePenaltyRate: 2,
      currentDate: new Date(2026, 0, 11), // 8 días después de gracia = 2 semanas (ceil)
    });
    expect(partialWeek.penaltyAmount).toBe(40); // 1000 * 2% * 2
  });
});

describe('formatPenaltyStatus', () => {
  it('muestra "Al día" cuando no está vencido', () => {
    const status = formatPenaltyStatus({
      isOverdue: false,
      daysOverdue: 0,
      daysAfterGrace: 0,
      penaltyAmount: 0,
      totalWithPenalty: 1000,
    });
    expect(status).toBe('Al día');
  });

  it('muestra el mensaje de período de gracia (singular)', () => {
    const status = formatPenaltyStatus({
      isOverdue: true,
      daysOverdue: 1,
      daysAfterGrace: 0,
      penaltyAmount: 0,
      totalWithPenalty: 1000,
    });
    expect(status).toBe('Vencido hace 1 día (en período de gracia)');
  });

  it('muestra el mensaje de período de gracia (plural)', () => {
    const status = formatPenaltyStatus({
      isOverdue: true,
      daysOverdue: 2,
      daysAfterGrace: 0,
      penaltyAmount: 0,
      totalWithPenalty: 1000,
    });
    expect(status).toBe('Vencido hace 2 días (en período de gracia)');
  });

  it('muestra el monto de mora cuando ya pasó el período de gracia', () => {
    const status = formatPenaltyStatus({
      isOverdue: true,
      daysOverdue: 9,
      daysAfterGrace: 7,
      penaltyAmount: 50,
      totalWithPenalty: 1050,
    });
    expect(status).toBe('Vencido hace 9 días - Mora: $50.00');
  });
});

describe('convertCurrency', () => {
  const rate: ExchangeRate = {
    type: 'blue',
    sell: 1000,
    buy: 950,
    date: '2026-10-05T12:00:00.000Z',
    fetchedAt: '2026-10-05T12:00:00.000Z',
  };

  it('devuelve el mismo monto si las monedas son iguales', () => {
    expect(convertCurrency(500, 'ARS', 'ARS', rate)).toBe(500);
    expect(convertCurrency(500, 'USD', 'USD', rate)).toBe(500);
  });

  it('convierte USD a ARS multiplicando por la venta', () => {
    expect(convertCurrency(10, 'USD', 'ARS', rate)).toBe(10000);
  });

  it('convierte ARS a USD dividiendo por la venta', () => {
    expect(convertCurrency(10000, 'ARS', 'USD', rate)).toBe(10);
  });

  it('redondea a 2 decimales', () => {
    // 100 / 1000 = 0.1; 333 / 1000 = 0.333 -> 0.33
    expect(convertCurrency(333, 'ARS', 'USD', rate)).toBe(0.33);
  });
});
