import request from 'supertest';
import { app } from '../app';
import { getDb } from '../db/connection';

const A = 'Bearer pk_test_projectA';
const B = 'Bearer pk_test_projectB';

afterAll(async () => {
    (await getDb()).close();
});

function paymentBody(overrides: Record<string, unknown> = {}) {
    return {
        pspCode: 'mock_card',
        amount: 999,
        currency: 'EUR',
        customer: { externalRef: 'u1', email: 'u1@ex.com' },
        ...overrides,
    };
}

describe('payments', () => {
    it('creates a one-time payment', async () => {
        const res = await request(app).post('/api/payments').set('Authorization', A).send(paymentBody());
        expect(res.status).toBe(201);
        expect(res.body.paymentId).toMatch(/^pay_/);
        expect(['pending', 'requires_action', 'succeeded', 'failed']).toContain(res.body.status);
    });

    it('returns the original payment for a repeated idempotencyKey', async () => {
        const body = paymentBody({ idempotencyKey: 'idem-123' });
        const first = await request(app).post('/api/payments').set('Authorization', A).send(body);
        const second = await request(app).post('/api/payments').set('Authorization', A).send(body);
        expect(second.status).toBe(201);
        expect(second.body.paymentId).toBe(first.body.paymentId);
    });

    it('rejects a pspCode not enabled for the project', async () => {
        const res = await request(app)
            .post('/api/payments')
            .set('Authorization', A)
            .send(paymentBody({ pspCode: 'mock_wallet' }));
        expect(res.status).toBe(400);
    });

    it("does not expose another project's payment", async () => {
        const created = await request(app).post('/api/payments').set('Authorization', A).send(paymentBody());
        const res = await request(app).get(`/api/payments/${created.body.paymentId}`).set('Authorization', B);
        expect(res.status).toBe(404);
    });

    it('validates the request body', async () => {
        const res = await request(app).post('/api/payments').set('Authorization', A).send({ pspCode: 'mock_card' });
        expect(res.status).toBe(400);
    });
});
