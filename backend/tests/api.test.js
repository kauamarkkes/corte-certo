const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const SEED_PATH = path.join(__dirname, '..', 'src', 'database.json');
const TMP_DB = path.join(os.tmpdir(), `corte-certo-test-${process.pid}.json`);

process.env.DB_PATH = TMP_DB;
const app = require('../src/app');

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const nextWeekday = (weekday) => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
    return iso(d);
};

const MONDAY = nextWeekday(1);
const SUNDAY = nextWeekday(0);
const PAST = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    return iso(d);
})();

const booking = (overrides = {}) => ({
    clientName: 'Carlos Teste',
    clientPhone: '(81) 99999-0000',
    serviceId: 's1',
    date: MONDAY,
    time: '10:00',
    ...overrides,
});

const book = (overrides) => request(app).post('/api/appointments').send(booking(overrides));

beforeEach(() => {
    fs.copyFileSync(SEED_PATH, TMP_DB);
});

afterAll(() => {
    fs.rmSync(TMP_DB, { force: true });
});

describe('Agendamentos', () => {
    test('TC-01 agendamento válido retorna 201 e status confirmado', async () => {
        const res = await book();
        expect(res.status).toBe(201);
        expect(res.body.status).toBe('confirmado');
    });

    test('TC-02 clientName vazio retorna 400', async () => {
        const res = await book({ clientName: '' });
        expect(res.status).toBe(400);
    });

    test('TC-03 telefone abc retorna 400', async () => {
        const res = await book({ clientPhone: 'abc' });
        expect(res.status).toBe(400);
    });

    test('TC-04 domingo retorna 400', async () => {
        const res = await book({ date: SUNDAY });
        expect(res.status).toBe(400);
    });

    test('TC-05 data passada retorna 400', async () => {
        const res = await book({ date: PAST });
        expect(res.status).toBe(400);
    });

    test('TC-06 hora 03:00 retorna 400', async () => {
        const res = await book({ time: '03:00' });
        expect(res.status).toBe(400);
    });

    test('TC-07 serviço s3 (60 min) às 18:30 na segunda retorna 400', async () => {
        const res = await book({ serviceId: 's3', time: '18:30' });
        expect(res.status).toBe(400);
    });

    test('TC-08 hora xx:yy retorna 400', async () => {
        const res = await book({ time: 'xx:yy' });
        expect(res.status).toBe(400);
    });

    test('TC-09 data 31/12/2026 retorna 400', async () => {
        const res = await book({ date: '31/12/2026' });
        expect(res.status).toBe(400);
    });

    test('TC-10 serviceId 999 retorna 400', async () => {
        const res = await book({ serviceId: '999' });
        expect(res.status).toBe(400);
    });

    test('TC-11 s1 às 10:00 e depois 10:20 conflita (400)', async () => {
        expect((await book({ time: '10:00' })).status).toBe(201);
        const second = await book({ time: '10:20' });
        expect(second.status).toBe(400);
    });

    test('TC-12 s1 às 10:00 e depois 10:40 não conflita (201)', async () => {
        expect((await book({ time: '10:00' })).status).toBe(201);
        const second = await book({ time: '10:40' });
        expect(second.status).toBe(201);
    });

    test('TC-13 cancelar libera o horário para novo agendamento', async () => {
        const created = await book();
        expect(created.status).toBe(201);
        const canceled = await request(app).delete(`/api/appointments/${created.body.id}`);
        expect(canceled.status).toBe(200);
        const again = await book();
        expect(again.status).toBe(201);
    });

    test('TC-14 dois POST idênticos simultâneos resultam em [201, 400]', async () => {
        const results = await Promise.all([book(), book()]);
        const statuses = results.map((r) => r.status).sort();
        expect(statuses).toEqual([201, 400]);
    });
});

describe('Status do agendamento', () => {
    const patchStatus = (id, status) =>
        request(app).patch(`/api/appointments/${id}/status`).send({ status });

    test('TC-15 PATCH status concluido retorna 200', async () => {
        const created = await book();
        const res = await patchStatus(created.body.id, 'concluido');
        expect(res.status).toBe(200);
    });

    test('TC-16 PATCH status banana retorna 400', async () => {
        const created = await book();
        const res = await patchStatus(created.body.id, 'banana');
        expect(res.status).toBe(400);
    });

    test('TC-17 PATCH em id inexistente retorna 404', async () => {
        const res = await patchStatus('nao-existe', 'concluido');
        expect(res.status).toBe(404);
    });
});

describe('Serviços e autenticação', () => {
    const service = (overrides = {}) => ({ name: 'Sobrancelha', price: 20, duration: 15, ...overrides });

    test('TC-18 POST /api/services válido retorna 201', async () => {
        const res = await request(app).post('/api/services').send(service());
        expect(res.status).toBe(201);
    });

    test('TC-19 serviço com price abc retorna 400', async () => {
        const res = await request(app).post('/api/services').send(service({ price: 'abc' }));
        expect(res.status).toBe(400);
    });

    test('TC-20 serviço com duration -5 retorna 400', async () => {
        const res = await request(app).post('/api/services').send(service({ duration: -5 }));
        expect(res.status).toBe(400);
    });

    test('TC-21 login com senha errada retorna 401', async () => {
        const res = await request(app).post('/api/admin/login').send({ password: 'errada' });
        expect(res.status).toBe(401);
    });

    test.failing('TC-22 criar serviço sem token deve retornar 401 (BUG-007 aberto)', async () => {
        const res = await request(app).post('/api/services').send(service());
        expect(res.status).toBe(401);
    });
});

describe('Defeitos adicionais', () => {
    test('TC-23 clientName só com espaços retorna 400 (BUG-015)', async () => {
        const res = await book({ clientName: '   ' });
        expect(res.status).toBe(400);
    });

    test('TC-24 reativar agendamento cancelado em horário já ocupado retorna 400 (BUG-013)', async () => {
        const first = await book();
        expect(first.status).toBe(201);
        await request(app).delete(`/api/appointments/${first.body.id}`);
        expect((await book()).status).toBe(201);
        const res = await request(app)
            .patch(`/api/appointments/${first.body.id}/status`)
            .send({ status: 'confirmado' });
        expect(res.status).toBe(400);
    });

    test('TC-25 remover serviço com agendamento ativo retorna 409 (BUG-014)', async () => {
        expect((await book({ serviceId: 's1' })).status).toBe(201);
        const blocked = await request(app).delete('/api/services/s1');
        expect(blocked.status).toBe(409);
        const free = await request(app).delete('/api/services/s2');
        expect(free.status).toBe(200);
    });
});

describe('Consentimento, bloqueios e serviços (front integrado)', () => {
    const block = (overrides = {}) => ({ date: MONDAY, start: '12:00', end: '13:00', reason: 'Almoço', ...overrides });

    test('TC-26 whatsappConsent é guardado e o padrão é false', async () => {
        const withConsent = await book({ whatsappConsent: true });
        expect(withConsent.status).toBe(201);
        expect(withConsent.body.whatsappConsent).toBe(true);
        const without = await book({ time: '11:00' });
        expect(without.body.whatsappConsent).toBe(false);
    });

    test('TC-27 PUT de serviço com active não booleano retorna 400', async () => {
        const res = await request(app).put('/api/services/s1').send({ active: 'abc' });
        expect(res.status).toBe(400);
    });

    test('TC-28 agendar dentro de um bloqueio retorna 400', async () => {
        expect((await request(app).post('/api/blocks').send(block())).status).toBe(201);
        const res = await book({ time: '12:20' });
        expect(res.status).toBe(400);
    });

    test('TC-29 criar bloqueio sobre agendamento ativo retorna 409', async () => {
        expect((await book({ time: '12:00' })).status).toBe(201);
        const res = await request(app).post('/api/blocks').send(block());
        expect(res.status).toBe(409);
    });

    test('TC-30 remover o bloqueio libera o horário', async () => {
        const created = await request(app).post('/api/blocks').send(block({ start: null, end: null }));
        expect(created.status).toBe(201);
        expect((await book()).status).toBe(400);
        expect((await request(app).delete(`/api/blocks/${created.body.id}`)).status).toBe(200);
        expect((await book()).status).toBe(201);
    });
});
