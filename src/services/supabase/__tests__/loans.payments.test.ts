import { http, HttpResponse } from 'msw';
import { server } from '../../../test/msw/server';
import { supabase } from '../client';
import {
  markPaymentAsPaid,
  revertPaymentToPending,
  deleteLoan,
  getActiveLoans,
  getNextPendingPaymentDatesByLoan,
  getLoanStats,
  getLinkedLoanPaymentStats,
  updatePaymentPenalty,
  updateLoanPenalties,
} from '../loans';

const SUPABASE_URL = 'https://test.supabase.co';

function makeLoan(overrides: Record<string, unknown> = {}) {
  return {
    id: 'loan-1',
    borrower_id: 'borrower-1',
    lender_id: 'lender-1',
    status: 'active',
    principal_amount: 1000,
    total_amount: 1120,
    total_interest: 120,
    payment_amount: 93.33,
    currency: 'ARS',
    interest_rate: 12,
    interest_type: 'simple',
    term_type: 'months',
    term_value: 12,
    delivery_date: '2026-01-01',
    first_payment_date: '2026-02-01',
    end_date: null,
    color_code: null,
    grace_period_days: 3,
    late_penalty_type: 'fixed',
    late_penalty_rate: 5,
    notes: null,
    transfer_proof_url: null,
    reminder_days_before: 3,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makePayment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'payment-1',
    loan_id: 'loan-1',
    payment_number: 1,
    due_date: '2026-02-01',
    principal_portion: 80,
    interest_portion: 13.33,
    total_amount: 93.33,
    status: 'pending',
    paid_amount: null,
    paid_date: null,
    penalty_amount: 0,
    penalty_calculated_at: null,
    borrower_comment: null,
    borrower_comment_date: null,
    lender_note: null,
    remaining_balance: 920,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Responde en orden a llamadas sucesivas al mismo method+path (para awaits secuenciales). */
function sequentialHandler(
  method: 'get' | 'post' | 'patch' | 'delete',
  path: string,
  responses: { status?: number; body?: unknown }[]
) {
  let i = 0;
  return http[method](path, () => {
    const r = responses[Math.min(i, responses.length - 1)];
    i++;
    if (r.body === undefined) return new HttpResponse(null, { status: r.status ?? 204 });
    return HttpResponse.json(r.body, { status: r.status ?? 200 });
  });
}

/** Permite que el mock de /rest/v1/profiles no sea necesario mockear a mano en cada test. */
function mockNoLinkedProfile() {
  server.use(http.get(`${SUPABASE_URL}/rest/v1/profiles`, () => HttpResponse.json([])));
}

describe('markPaymentAsPaid', () => {
  it('marca el pago como pagado pero no completa el préstamo si quedan cuotas pendientes', async () => {
    const updated = makePayment({ status: 'paid', paid_amount: 93.33 });
    let loanPatched = false;

    server.use(
      sequentialHandler('get', `${SUPABASE_URL}/rest/v1/payments`, [
        { body: { loan_id: 'loan-1' } },
        { body: [{ status: 'paid' }, { status: 'pending' }] },
      ]),
      http.patch(`${SUPABASE_URL}/rest/v1/payments`, () => HttpResponse.json(updated)),
      http.patch(`${SUPABASE_URL}/rest/v1/loans`, () => {
        loanPatched = true;
        return new HttpResponse(null, { status: 204 });
      })
    );

    const result = await markPaymentAsPaid('payment-1', 93.33);

    expect(result).toEqual(updated);
    expect(loanPatched).toBe(false);
  });

  it('completa el préstamo automáticamente cuando se paga la última cuota pendiente', async () => {
    const updated = makePayment({ status: 'paid', paid_amount: 93.33 });
    let loanPatchBody: unknown = null;

    server.use(
      sequentialHandler('get', `${SUPABASE_URL}/rest/v1/payments`, [
        { body: { loan_id: 'loan-1' } },
        { body: [{ status: 'paid' }, { status: 'paid' }] },
      ]),
      http.patch(`${SUPABASE_URL}/rest/v1/payments`, () => HttpResponse.json(updated)),
      http.patch(`${SUPABASE_URL}/rest/v1/loans`, async ({ request }) => {
        loanPatchBody = await request.json();
        return new HttpResponse(null, { status: 204 });
      })
    );

    await markPaymentAsPaid('payment-1', 93.33);

    expect(loanPatchBody).toEqual({ status: 'completed' });
  });
});

describe('revertPaymentToPending', () => {
  it('revierte el pago a pendiente y reactiva el préstamo si estaba completado', async () => {
    const reverted = makePayment({ status: 'pending', paid_amount: 0, paid_date: null });
    let loanPatchBody: unknown = null;

    server.use(
      sequentialHandler('get', `${SUPABASE_URL}/rest/v1/payments`, [{ body: { loan_id: 'loan-1' } }]),
      http.patch(`${SUPABASE_URL}/rest/v1/payments`, () => HttpResponse.json(reverted)),
      http.patch(`${SUPABASE_URL}/rest/v1/loans`, async ({ request }) => {
        loanPatchBody = await request.json();
        return new HttpResponse(null, { status: 204 });
      })
    );

    const result = await revertPaymentToPending('payment-1');

    expect(result).toEqual(reverted);
    expect(loanPatchBody).toEqual({ status: 'active' });
  });
});

describe('deleteLoan', () => {
  it('no permite eliminar un préstamo que no está completado', async () => {
    server.use(
      http.get(`${SUPABASE_URL}/rest/v1/loans`, () => HttpResponse.json(makeLoan({ status: 'active' })))
    );
    mockNoLinkedProfile();

    let deleteCalled = false;
    server.use(http.delete(`${SUPABASE_URL}/rest/v1/loans`, () => {
      deleteCalled = true;
      return new HttpResponse(null, { status: 204 });
    }));

    await expect(deleteLoan('loan-1')).rejects.toThrow('Solo se pueden eliminar préstamos completados');
    expect(deleteCalled).toBe(false);
  });

  it('elimina el préstamo si está completado', async () => {
    server.use(
      http.get(`${SUPABASE_URL}/rest/v1/loans`, () => HttpResponse.json(makeLoan({ status: 'completed' })))
    );
    mockNoLinkedProfile();

    let deleteCalled = false;
    server.use(http.delete(`${SUPABASE_URL}/rest/v1/loans`, () => {
      deleteCalled = true;
      return new HttpResponse(null, { status: 204 });
    }));

    await expect(deleteLoan('loan-1')).resolves.toBeUndefined();
    expect(deleteCalled).toBe(true);
  });

  it('propaga el error si el préstamo no existe', async () => {
    // .single() sobre 0 filas devuelve un error de PostgREST (nunca `data: null`
    // con status 200) — por eso el chequeo `if (!loan)` en deleteLoan es
    // defensivo pero en la práctica este es el camino real de "no existe".
    server.use(
      http.get(`${SUPABASE_URL}/rest/v1/loans`, () =>
        HttpResponse.json({ message: 'JSON object requested, multiple (or no) rows returned' }, { status: 406 })
      )
    );

    await expect(deleteLoan('loan-inexistente')).rejects.toThrow();
  });
});

describe('getActiveLoans', () => {
  const authGetUser = jest.spyOn(supabase.auth, 'getUser');
  afterEach(() => authGetUser.mockReset());

  it('devuelve [] sin hacer requests si no hay usuario autenticado', async () => {
    authGetUser.mockResolvedValue({ data: { user: null }, error: null } as never);
    expect(await getActiveLoans()).toEqual([]);
  });

  it('filtra por lender_id del usuario autenticado (regresión L4: no debe traer préstamos donde es prestatario)', async () => {
    authGetUser.mockResolvedValue({ data: { user: { id: 'lender-1' } }, error: null } as never);

    let seenParams: URLSearchParams | null = null;
    server.use(
      http.get(`${SUPABASE_URL}/rest/v1/loans`, ({ request }) => {
        seenParams = new URL(request.url).searchParams;
        return HttpResponse.json([makeLoan()]);
      })
    );

    await getActiveLoans();

    expect(seenParams!.get('lender_id')).toBe('eq.lender-1');
    expect(seenParams!.get('status')).toBe('eq.active');
  });
});

describe('getNextPendingPaymentDatesByLoan', () => {
  it('devuelve un objeto vacío sin hacer requests si no hay loanIds', async () => {
    expect(await getNextPendingPaymentDatesByLoan([])).toEqual({});
  });

  it('se queda con la fecha más próxima por préstamo (la primera de cada loan_id, ya vienen ordenadas)', async () => {
    server.use(
      http.get(`${SUPABASE_URL}/rest/v1/payments`, () =>
        HttpResponse.json([
          { loan_id: 'loan-1', due_date: '2026-02-01' },
          { loan_id: 'loan-2', due_date: '2026-02-05' },
          { loan_id: 'loan-1', due_date: '2026-03-01' },
        ])
      )
    );

    const result = await getNextPendingPaymentDatesByLoan(['loan-1', 'loan-2']);

    expect(result).toEqual({ 'loan-1': '2026-02-01', 'loan-2': '2026-02-05' });
  });
});

describe('getLoanStats', () => {
  const authGetUser = jest.spyOn(supabase.auth, 'getUser');
  afterEach(() => authGetUser.mockReset());

  it('separa los totales por moneda y solo cuenta totalLent de préstamos activos', async () => {
    authGetUser.mockResolvedValue({ data: { user: { id: 'lender-1' } }, error: null } as never);

    server.use(
      http.get(`${SUPABASE_URL}/rest/v1/loans`, () =>
        HttpResponse.json([
          { id: 'loan-ars-active', status: 'active', total_amount: 1120, principal_amount: 1000, currency: 'ARS' },
          { id: 'loan-ars-done', status: 'completed', total_amount: 500, principal_amount: 450, currency: 'ARS' },
          { id: 'loan-usd-active', status: 'active', total_amount: 200, principal_amount: 180, currency: 'USD' },
        ])
      ),
      http.get(`${SUPABASE_URL}/rest/v1/payments`, ({ request }) => {
        const status = new URL(request.url).searchParams.get('status');
        if (status === 'eq.paid') {
          return HttpResponse.json([
            { loan_id: 'loan-ars-active', paid_amount: 100 },
            { loan_id: 'loan-ars-done', paid_amount: 500 },
          ]);
        }
        // status === 'eq.pending'
        return HttpResponse.json([
          { loan_id: 'loan-ars-active', total_amount: 1020, penalty_amount: 10 },
          { loan_id: 'loan-usd-active', total_amount: 200, penalty_amount: 0 },
        ]);
      })
    );

    const stats = await getLoanStats();

    expect(stats.activeLoans).toBe(2);
    expect(stats.completedLoans).toBe(1);
    expect(stats.currencies.sort()).toEqual(['ARS', 'USD']);

    expect(stats.byCurrency.ARS.totalLent).toBe(1000); // solo el activo
    expect(stats.byCurrency.ARS.totalExpected).toBe(1620); // 1120 + 500
    expect(stats.byCurrency.ARS.totalRecovered).toBe(600); // 100 + 500
    expect(stats.byCurrency.ARS.totalPending).toBe(1030); // 1020 + 10

    expect(stats.byCurrency.USD.totalLent).toBe(180);
    expect(stats.byCurrency.USD.totalExpected).toBe(200);
    expect(stats.byCurrency.USD.totalRecovered).toBe(0);
    expect(stats.byCurrency.USD.totalPending).toBe(200);
  });

  it('no consulta payments si el lender no tiene préstamos', async () => {
    authGetUser.mockResolvedValue({ data: { user: { id: 'lender-1' } }, error: null } as never);
    server.use(http.get(`${SUPABASE_URL}/rest/v1/loans`, () => HttpResponse.json([])));

    const stats = await getLoanStats();

    expect(stats.totalLoans).toBe(0);
    expect(stats.currencies).toEqual([]);
    expect(stats.byCurrency.ARS).toEqual({ totalLent: 0, totalExpected: 0, totalRecovered: 0, totalPending: 0 });
  });
});

describe('getLinkedLoanPaymentStats', () => {
  it('devuelve todo en cero sin hacer requests si no hay loanIds', async () => {
    const result = await getLinkedLoanPaymentStats([]);
    expect(result.ARS).toEqual({ totalToPay: 0, totalPaid: 0, remainingToPay: 0 });
    expect(result.USD).toEqual({ totalToPay: 0, totalPaid: 0, remainingToPay: 0 });
  });

  it('separa los totales por moneda usando la moneda heredada del préstamo', async () => {
    server.use(
      http.get(`${SUPABASE_URL}/rest/v1/loans`, () =>
        HttpResponse.json([
          { id: 'loan-1', currency: 'ARS' },
          { id: 'loan-2', currency: 'USD' },
        ])
      ),
      http.get(`${SUPABASE_URL}/rest/v1/payments`, () =>
        HttpResponse.json([
          { loan_id: 'loan-1', total_amount: 100, paid_amount: 100, status: 'paid' },
          { loan_id: 'loan-1', total_amount: 100, paid_amount: 0, status: 'pending' },
          { loan_id: 'loan-2', total_amount: 50, paid_amount: 0, status: 'pending' },
        ])
      )
    );

    const result = await getLinkedLoanPaymentStats(['loan-1', 'loan-2']);

    expect(result.ARS).toEqual({ totalToPay: 200, totalPaid: 100, remainingToPay: 100 });
    expect(result.USD).toEqual({ totalToPay: 50, totalPaid: 0, remainingToPay: 50 });
  });
});

describe('updatePaymentPenalty', () => {
  it('si el pago ya está pagado, devuelve el pago actual sin recalcular ni actualizar', async () => {
    const current = makePayment({ status: 'paid' });
    let patchCalled = false;

    server.use(
      sequentialHandler('get', `${SUPABASE_URL}/rest/v1/payments`, [
        { body: { ...current, loan: { grace_period_days: 3, late_penalty_type: 'fixed', late_penalty_rate: 5 } } },
        { body: current },
      ]),
      http.patch(`${SUPABASE_URL}/rest/v1/payments`, () => {
        patchCalled = true;
        return HttpResponse.json(current);
      })
    );

    const result = await updatePaymentPenalty('payment-1');

    expect(result).toEqual(current);
    expect(patchCalled).toBe(false);
  });

  it('si el préstamo no tiene penalización configurada, devuelve el pago actual sin recalcular', async () => {
    const current = makePayment({ status: 'pending' });
    let patchCalled = false;

    server.use(
      sequentialHandler('get', `${SUPABASE_URL}/rest/v1/payments`, [
        { body: { ...current, loan: { grace_period_days: 3, late_penalty_type: 'none', late_penalty_rate: 0 } } },
        { body: current },
      ]),
      http.patch(`${SUPABASE_URL}/rest/v1/payments`, () => {
        patchCalled = true;
        return HttpResponse.json(current);
      })
    );

    const result = await updatePaymentPenalty('payment-1');

    expect(result).toEqual(current);
    expect(patchCalled).toBe(false);
  });

  it('calcula la penalización y marca el pago como vencido cuando corresponde', async () => {
    const overduePayment = makePayment({
      status: 'pending',
      due_date: '2026-01-01', // muy vencido respecto al "hoy" real de la corrida
      total_amount: 1000,
    });
    let patchBody: Record<string, unknown> | null = null;

    server.use(
      http.get(`${SUPABASE_URL}/rest/v1/payments`, () =>
        HttpResponse.json({
          ...overduePayment,
          loan: { grace_period_days: 0, late_penalty_type: 'fixed', late_penalty_rate: 5 },
        })
      ),
      http.patch(`${SUPABASE_URL}/rest/v1/payments`, async ({ request }) => {
        patchBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...overduePayment, ...patchBody });
      })
    );

    const result = await updatePaymentPenalty('payment-1');

    expect(patchBody).not.toBeNull();
    expect(patchBody!.status).toBe('overdue');
    expect(patchBody!.penalty_amount).toBe(50); // 1000 * 5%
    expect(result.status).toBe('overdue');
  });
});

describe('updateLoanPenalties', () => {
  it('si el préstamo no tiene penalización, devuelve los pagos sin modificarlos', async () => {
    const payments = [makePayment({ id: 'p1' }), makePayment({ id: 'p2' })];
    let patchCalled = false;

    server.use(
      http.get(`${SUPABASE_URL}/rest/v1/loans`, () =>
        HttpResponse.json({ grace_period_days: 3, late_penalty_type: 'none', late_penalty_rate: 0 })
      ),
      http.get(`${SUPABASE_URL}/rest/v1/payments`, () => HttpResponse.json(payments)),
      http.patch(`${SUPABASE_URL}/rest/v1/payments`, () => {
        patchCalled = true;
        return HttpResponse.json({});
      })
    );

    const result = await updateLoanPenalties('loan-1');

    expect(result).toEqual(payments);
    expect(patchCalled).toBe(false);
  });

  it('recalcula la penalización de cada pago pendiente/vencido y devuelve la lista final', async () => {
    const pending = [
      makePayment({ id: 'p1', due_date: '2026-01-01', total_amount: 100 }),
      makePayment({ id: 'p2', due_date: '2026-01-05', total_amount: 200 }),
    ];
    const finalList = [
      makePayment({ id: 'p1', status: 'overdue', penalty_amount: 5 }),
      makePayment({ id: 'p2', status: 'overdue', penalty_amount: 10 }),
    ];
    const patchedIds: string[] = [];

    server.use(
      http.get(`${SUPABASE_URL}/rest/v1/loans`, () =>
        HttpResponse.json({ grace_period_days: 0, late_penalty_type: 'fixed', late_penalty_rate: 5 })
      ),
      sequentialHandler('get', `${SUPABASE_URL}/rest/v1/payments`, [{ body: pending }, { body: finalList }]),
      http.patch(`${SUPABASE_URL}/rest/v1/payments`, ({ request }) => {
        const id = new URL(request.url).searchParams.get('id');
        patchedIds.push(id || '');
        return HttpResponse.json(pending[0]);
      })
    );

    const result = await updateLoanPenalties('loan-1');

    expect(patchedIds).toEqual(['eq.p1', 'eq.p2']);
    expect(result).toEqual(finalList);
  });
});
