import request from 'supertest';
import { app } from '../app';
import { getDb } from '../db/connection';

const A = 'Bearer pk_test_projectA';
const B = 'Bearer pk_test_projectB';

afterAll(async () => {
    (await getDb()).close();
});

describe('subscriptions', () => {
    it('creates a subscription for a valid plan and PSP', async () => {
        const res = await request(app)
            .post('/api/subscriptions')
            .set('Authorization', A)
            .send({
                pspCode: 'mock_card',
                planId: 'plan_a_pro',
                customer: { externalRef: 'u1', email: 'u1@ex.com' },
            });
        expect(res.status).toBe(201);
        expect(res.body.subscriptionId).toMatch(/^sub_/);
    });

    it('rejects a PSP that does not support subscriptions', async () => {
        const res = await request(app)
            .post('/api/subscriptions')
            .set('Authorization', B)
            .send({
                pspCode: 'mock_wallet',
                planId: 'irrelevant',
                customer: { externalRef: 'u2', email: 'u2@ex.com' },
            });
        expect(res.status).toBe(400);
    });

    it('rejects an unknown plan', async () => {
        const res = await request(app)
            .post('/api/subscriptions')
            .set('Authorization', A)
            .send({
                pspCode: 'mock_card',
                planId: 'plan_missing',
                customer: { externalRef: 'u1', email: 'u1@ex.com' },
            });
        expect(res.status).toBe(400);
    });
});
