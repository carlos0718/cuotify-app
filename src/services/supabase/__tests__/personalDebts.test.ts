import { http, HttpResponse } from 'msw';
import { server } from '../../../test/msw/server';
import { supabase } from '../client';
import {
  createPersonalDebt,
  deletePersonalDebt,
  getDebtStats,
  getOverdueDebtPayments,
  getDebtPaidAmounts,
  getNextPendingPaymentDates,
  PersonalDebt,
  CreatePersonalDebtInput,
} from '../personalDebts';

const SUPABASE_URL = 'https://test.supabase.co';

function makeDebt(overrides: Partial<PersonalDebt> = {}): PersonalDebt {
  return {
    id: 'debt-1',
    user_id: 'user-1',
    creditor_name: 'Banco X',
    principal_amount: 1000,
    interest_rate: 20,
    interest_type: 'simple',
    term_value: 5,
    term_type: 'months',
    currency: 'ARS',
    first_payment_date: '2026-02-01',
    delivery_date: '2026-01-01',
    late_penalty_type: 'none',
    late_penalty_rate: 0,
    grace_period_days: 0,
    total_amount: 1200,
    installment_amount: 240,
    status: 'active',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const baseInput: CreatePersonalDebtInput = {
  creditor_name: 'Banco X',
  principal_amount: 1000,
  interest_rate: 20,
  interest_type: 'simple',
  term_value: 5,
  term_type: 'months',
  currency: 'ARS',
  first_payment_date: '2026-02-01',
};

describe('createPersonalDebt', () => {
  const authGetUser = jest.spyOn(supabase.auth, 'getUser');
  afterEach(() => authGetUser.mockReset());

  it('lanza error si no hay usuario autenticado, sin llegar a crear nada', async () => {
    authGetUser.mockResolvedValue({ data: { user: null }, error: null } as never);
    await expect(createPersonalDebt(baseInput)).rejects.toThrow('Usuario no autenticado');
  });

  it('calcula el total con interés simple (nota: acá interest_rate se usa como tasa del período, no anual — ver L6)', async () => {
    authGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null } as never);
    let insertBody: Record<string, unknown> | null = null;

    server.use(
      http.post(`${SUPABASE_URL}/rest/v1/personal_debts`, async ({ request }) => {
        insertBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(makeDebt({ id: 'debt-1' }));
      }),
      http.post(`${SUPABASE_URL}/rest/v1/rpc/generate_debt_payment_schedule`, () => HttpResponse.json(null))
    );

    await createPersonalDebt(baseInput);

    // total = 1000 * (1 + 20/100) = 1200; installment = 1200 / 5 = 240
    expect(insertBody!.total_amount).toBe(1200);
    expect(insertBody!.installment_amount).toBe(240);
  });

  it('calcula el total con sistema francés', async () => {
    authGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null } as never);
    let insertBody: Record<string, unknown> | null = null;

    server.use(
      http.post(`${SUPABASE_URL}/rest/v1/personal_debts`, async ({ request }) => {
        insertBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(makeDebt({ id: 'debt-1' }));
      }),
      http.post(`${SUPABASE_URL}/rest/v1/rpc/generate_debt_payment_schedule`, () => HttpResponse.json(null))
    );

    await createPersonalDebt({ ...baseInput, interest_type: 'french', interest_rate: 10, term_value: 3 });

    // rate=0.10, installment = (1000*0.1) / (1 - 1.1^-3) ≈ 402.11
    expect(insertBody!.installment_amount as number).toBeCloseTo(402.1148, 3);
    expect(insertBody!.total_amount as number).toBeCloseTo(1206.3445, 3);
  });

  it('usa hoy como delivery_date si no se pasa una', async () => {
    authGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null } as never);
    let insertBody: Record<string, unknown> | null = null;

    server.use(
      http.post(`${SUPABASE_URL}/rest/v1/personal_debts`, async ({ request }) => {
        insertBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(makeDebt());
      }),
      http.post(`${SUPABASE_URL}/rest/v1/rpc/generate_debt_payment_schedule`, () => HttpResponse.json(null))
    );

    await createPersonalDebt(baseInput);

    const today = new Date().toISOString().split('T')[0];
    expect(insertBody!.delivery_date).toBe(today);
  });

  it('si falla la generación del cronograma, borra la deuda recién creada y propaga el error', async () => {
    authGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null } as never);
    const created = makeDebt({ id: 'debt-to-rollback' });
    let deletedId: string | null = null;

    server.use(
      http.post(`${SUPABASE_URL}/rest/v1/personal_debts`, () => HttpResponse.json(created)),
      http.post(`${SUPABASE_URL}/rest/v1/rpc/generate_debt_payment_schedule`, () =>
        HttpResponse.json({ message: 'función RPC falló' }, { status: 500 })
      ),
      http.delete(`${SUPABASE_URL}/rest/v1/personal_debts`, ({ request }) => {
        deletedId = new URL(request.url).searchParams.get('id');
        return new HttpResponse(null, { status: 204 });
      })
    );

    await expect(createPersonalDebt(baseInput)).rejects.toThrow('función RPC falló');
    expect(deletedId).toBe('eq.debt-to-rollback');
  });
});

describe('deletePersonalDebt', () => {
  it('no permite eliminar una deuda activa', async () => {
    server.use(http.get(`${SUPABASE_URL}/rest/v1/personal_debts`, () => HttpResponse.json(makeDebt({ status: 'active' }))));

    let deleteCalled = false;
    server.use(http.delete(`${SUPABASE_URL}/rest/v1/personal_debts`, () => {
      deleteCalled = true;
      return new HttpResponse(null, { status: 204 });
    }));

    await expect(deletePersonalDebt('debt-1')).rejects.toThrow(
      'No se puede eliminar una deuda activa. Primero cancélala.'
    );
    expect(deleteCalled).toBe(false);
  });

  it('elimina la deuda si está cancelada o completada', async () => {
    server.use(http.get(`${SUPABASE_URL}/rest/v1/personal_debts`, () => HttpResponse.json(makeDebt({ status: 'cancelled' }))));

    let deleteCalled = false;
    server.use(http.delete(`${SUPABASE_URL}/rest/v1/personal_debts`, () => {
      deleteCalled = true;
      return new HttpResponse(null, { status: 204 });
    }));

    await expect(deletePersonalDebt('debt-1')).resolves.toBeUndefined();
    expect(deleteCalled).toBe(true);
  });
});

describe('getDebtStats', () => {
  it('separa los totales por moneda y solo cuenta deudas activas en los montos', async () => {
    server.use(
      http.get(`${SUPABASE_URL}/rest/v1/personal_debts`, () =>
        HttpResponse.json([
          { id: 'debt-ars-active', status: 'active', principal_amount: 1000, total_amount: 1200, currency: 'ARS' },
          { id: 'debt-ars-done', status: 'completed', principal_amount: 500, total_amount: 550, currency: 'ARS' },
          { id: 'debt-usd-active', status: 'active', principal_amount: 100, total_amount: 110, currency: 'USD' },
        ])
      ),
      // El query real filtra `debt_id=in.(activeIds)` — simulamos ese filtro acá para
      // que el mock no devuelva pagos de deudas no-activas que Postgres nunca traería.
      // Así el test valida de verdad que solo se pidan los IDs activos (regresión del
      // bug documentado en el código: antes se restaba el pagado de TODAS las deudas).
      http.get(`${SUPABASE_URL}/rest/v1/debt_payments`, ({ request }) => {
        const inParam = new URL(request.url).searchParams.get('debt_id') || '';
        const allowedIds = inParam.replace(/^in\.\(|\)$/g, '').split(',');
        const allPayments = [
          { debt_id: 'debt-ars-active', paid_amount: 300 },
          { debt_id: 'debt-ars-done', paid_amount: 550 },
        ];
        return HttpResponse.json(allPayments.filter((p) => allowedIds.includes(p.debt_id)));
      })
    );

    const stats = await getDebtStats();

    expect(stats.totalDebts).toBe(3);
    expect(stats.activeDebts).toBe(2);
    expect(stats.completedDebts).toBe(1);
    expect(stats.currencies.sort()).toEqual(['ARS', 'USD']);

    expect(stats.byCurrency.ARS).toEqual({
      totalOwed: 1000,
      totalToPay: 1200,
      totalPaid: 300,
      remainingToPay: 900,
    });
    expect(stats.byCurrency.USD).toEqual({
      totalOwed: 100,
      totalToPay: 110,
      totalPaid: 0,
      remainingToPay: 110,
    });
  });

  it('no consulta debt_payments si no hay deudas activas', async () => {
    server.use(
      http.get(`${SUPABASE_URL}/rest/v1/personal_debts`, () =>
        HttpResponse.json([{ id: 'debt-1', status: 'completed', principal_amount: 500, total_amount: 550, currency: 'ARS' }])
      )
    );
    // Sin handler para debt_payments: si el código lo llamara igual, el test fallaría.

    const stats = await getDebtStats();

    expect(stats.activeDebts).toBe(0);
    expect(stats.byCurrency.ARS.totalPaid).toBe(0);
  });
});

describe('getOverdueDebtPayments', () => {
  it('marca como overdue los pagos vencidos encontrados y los devuelve', async () => {
    const overdue = [
      { id: 'dp-1', due_date: '2026-01-01', status: 'pending' },
      { id: 'dp-2', due_date: '2026-01-02', status: 'pending' },
    ];
    let patchedIds: string | null = null;

    server.use(
      http.get(`${SUPABASE_URL}/rest/v1/debt_payments`, () => HttpResponse.json(overdue)),
      http.patch(`${SUPABASE_URL}/rest/v1/debt_payments`, ({ request }) => {
        patchedIds = new URL(request.url).searchParams.get('id');
        return HttpResponse.json({});
      })
    );

    const result = await getOverdueDebtPayments();

    expect(result).toEqual(overdue);
    expect(patchedIds).toBe('in.(dp-1,dp-2)');
  });

  it('no hace ningún PATCH si no hay pagos vencidos', async () => {
    let patchCalled = false;
    server.use(
      http.get(`${SUPABASE_URL}/rest/v1/debt_payments`, () => HttpResponse.json([])),
      http.patch(`${SUPABASE_URL}/rest/v1/debt_payments`, () => {
        patchCalled = true;
        return HttpResponse.json({});
      })
    );

    const result = await getOverdueDebtPayments();

    expect(result).toEqual([]);
    expect(patchCalled).toBe(false);
  });
});

describe('getDebtPaidAmounts', () => {
  it('acumula el monto pagado por cada deuda', async () => {
    server.use(
      http.get(`${SUPABASE_URL}/rest/v1/debt_payments`, () =>
        HttpResponse.json([
          { debt_id: 'debt-1', paid_amount: 100 },
          { debt_id: 'debt-1', paid_amount: 50 },
          { debt_id: 'debt-2', paid_amount: 200 },
        ])
      )
    );

    const result = await getDebtPaidAmounts();

    expect(result).toEqual({ 'debt-1': 150, 'debt-2': 200 });
  });

  it('devuelve un objeto vacío si no hay pagos', async () => {
    server.use(http.get(`${SUPABASE_URL}/rest/v1/debt_payments`, () => HttpResponse.json([])));
    expect(await getDebtPaidAmounts()).toEqual({});
  });
});

describe('getNextPendingPaymentDates', () => {
  it('devuelve un objeto vacío sin hacer requests si no hay debtIds', async () => {
    expect(await getNextPendingPaymentDates([])).toEqual({});
  });

  it('se queda con la fecha más próxima por deuda', async () => {
    server.use(
      http.get(`${SUPABASE_URL}/rest/v1/debt_payments`, () =>
        HttpResponse.json([
          { debt_id: 'debt-1', due_date: '2026-02-01' },
          { debt_id: 'debt-1', due_date: '2026-03-01' },
          { debt_id: 'debt-2', due_date: '2026-02-10' },
        ])
      )
    );

    const result = await getNextPendingPaymentDates(['debt-1', 'debt-2']);

    expect(result).toEqual({ 'debt-1': '2026-02-01', 'debt-2': '2026-02-10' });
  });
});
