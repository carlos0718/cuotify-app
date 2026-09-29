import { http, HttpResponse } from 'msw';
import { server } from '../../../test/msw/server';
import {
  createBorrower,
  getBorrowers,
  findBorrowerByDni,
  findBorrowerByPhone,
  getOrCreateBorrower,
} from '../loans';
import { Borrower } from '../../../types';

const SUPABASE_URL = 'https://test.supabase.co';

function makeBorrower(overrides: Partial<Borrower> = {}): Borrower {
  return {
    id: 'borrower-1',
    lender_id: 'lender-1',
    full_name: 'Juan Pérez',
    dni: '30111222',
    phone: '+541122223333',
    email: null,
    address: null,
    notes: null,
    linked_profile_id: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('createBorrower', () => {
  it('inserta un prestatario y devuelve el registro creado', async () => {
    const newBorrower = makeBorrower();
    server.use(
      http.post(`${SUPABASE_URL}/rest/v1/borrowers`, () => HttpResponse.json(newBorrower, { status: 201 }))
    );

    const result = await createBorrower({
      lender_id: 'lender-1',
      full_name: 'Juan Pérez',
    } as never);

    expect(result).toEqual(newBorrower);
  });

  it('convierte el error de Postgres en un Error con el mensaje original', async () => {
    server.use(
      http.post(`${SUPABASE_URL}/rest/v1/borrowers`, () =>
        HttpResponse.json({ message: 'duplicate key value violates unique constraint' }, { status: 409 })
      )
    );

    await expect(
      createBorrower({ lender_id: 'lender-1', full_name: 'Juan Pérez' } as never)
    ).rejects.toThrow('duplicate key value violates unique constraint');
  });
});

describe('getBorrowers', () => {
  it('devuelve la lista de prestatarios del lender', async () => {
    const borrowers = [makeBorrower(), makeBorrower({ id: 'borrower-2', full_name: 'Ana Gómez' })];
    server.use(
      http.get(`${SUPABASE_URL}/rest/v1/borrowers`, () => HttpResponse.json(borrowers))
    );

    const result = await getBorrowers();
    expect(result).toEqual(borrowers);
  });

  it('devuelve un array vacío si no hay prestatarios', async () => {
    server.use(http.get(`${SUPABASE_URL}/rest/v1/borrowers`, () => HttpResponse.json([])));
    expect(await getBorrowers()).toEqual([]);
  });
});

describe('findBorrowerByDni', () => {
  it('no hace ninguna request si el DNI está vacío', async () => {
    // Sin handlers registrados: onUnhandledRequest:'error' hace fallar el test
    // si findBorrowerByDni llegara a pegarle a la red.
    expect(await findBorrowerByDni('lender-1', '')).toBeNull();
    expect(await findBorrowerByDni('lender-1', '   ')).toBeNull();
  });

  it('devuelve el prestatario si existe con ese DNI', async () => {
    const borrower = makeBorrower();
    server.use(http.get(`${SUPABASE_URL}/rest/v1/borrowers`, () => HttpResponse.json([borrower])));

    expect(await findBorrowerByDni('lender-1', '30111222')).toEqual(borrower);
  });

  it('devuelve null si no hay ningún prestatario con ese DNI', async () => {
    server.use(http.get(`${SUPABASE_URL}/rest/v1/borrowers`, () => HttpResponse.json([])));
    expect(await findBorrowerByDni('lender-1', '99999999')).toBeNull();
  });
});

describe('findBorrowerByPhone', () => {
  it('no hace ninguna request si el teléfono está vacío', async () => {
    expect(await findBorrowerByPhone('lender-1', '')).toBeNull();
  });

  it('devuelve el prestatario si existe con ese teléfono', async () => {
    const borrower = makeBorrower();
    server.use(http.get(`${SUPABASE_URL}/rest/v1/borrowers`, () => HttpResponse.json([borrower])));

    expect(await findBorrowerByPhone('lender-1', '+541122223333')).toEqual(borrower);
  });
});

describe('getOrCreateBorrower', () => {
  const input = { lender_id: 'lender-1', full_name: 'Juan Pérez', dni: '30111222', phone: '+541122223333' };

  it('devuelve el prestatario existente por DNI sin crear uno nuevo (ya vinculado)', async () => {
    const existing = makeBorrower({ linked_profile_id: 'profile-1' });
    server.use(http.get(`${SUPABASE_URL}/rest/v1/borrowers`, () => HttpResponse.json([existing])));

    const result = await getOrCreateBorrower(input as never);

    expect(result).toEqual({ borrower: existing, isNew: false });
  });

  it('vincula automáticamente al perfil si encuentra uno con el mismo DNI', async () => {
    const existing = makeBorrower({ linked_profile_id: null });
    let patchCalled = false;

    server.use(
      http.get(`${SUPABASE_URL}/rest/v1/borrowers`, () => HttpResponse.json([existing])),
      http.get(`${SUPABASE_URL}/rest/v1/profiles`, () => HttpResponse.json([{ id: 'profile-9' }])),
      http.patch(`${SUPABASE_URL}/rest/v1/borrowers`, () => {
        patchCalled = true;
        return new HttpResponse(null, { status: 204 });
      })
    );

    const result = await getOrCreateBorrower(input as never);

    expect(patchCalled).toBe(true);
    expect(result).toEqual({
      borrower: { ...existing, linked_profile_id: 'profile-9' },
      isNew: false,
    });
  });

  it('devuelve el existente sin vincular si no hay perfil con ese DNI', async () => {
    const existing = makeBorrower({ linked_profile_id: null });
    server.use(
      http.get(`${SUPABASE_URL}/rest/v1/borrowers`, () => HttpResponse.json([existing])),
      http.get(`${SUPABASE_URL}/rest/v1/profiles`, () => HttpResponse.json([]))
    );

    const result = await getOrCreateBorrower(input as never);
    expect(result).toEqual({ borrower: existing, isNew: false });
  });

  it('busca por teléfono si no encuentra por DNI', async () => {
    const existing = makeBorrower();
    server.use(
      http.get(`${SUPABASE_URL}/rest/v1/borrowers`, ({ request }) => {
        const params = new URL(request.url).searchParams;
        if (params.has('dni')) return HttpResponse.json([]);
        return HttpResponse.json([existing]);
      })
    );

    const result = await getOrCreateBorrower(input as never);
    expect(result).toEqual({ borrower: existing, isNew: false });
  });

  it('crea un prestatario nuevo si no existe ni por DNI ni por teléfono', async () => {
    const created = makeBorrower({ id: 'borrower-new', linked_profile_id: 'profile-9' });

    server.use(
      http.get(`${SUPABASE_URL}/rest/v1/borrowers`, () => HttpResponse.json([])),
      http.get(`${SUPABASE_URL}/rest/v1/profiles`, () => HttpResponse.json([{ id: 'profile-9' }])),
      http.post(`${SUPABASE_URL}/rest/v1/borrowers`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.linked_profile_id).toBe('profile-9');
        return HttpResponse.json(created, { status: 201 });
      })
    );

    const result = await getOrCreateBorrower(input as never);
    expect(result).toEqual({ borrower: created, isNew: true });
  });
});
