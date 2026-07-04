import request from 'supertest';
import { mockSign } from '../adapters/mockBase';
import { app } from '../app';
import { getDb } from '../db/connection';

const A = 'Bearer pk_test_projectA';
const SECRET = 'whsec_mock'; // seeded webhook secret for every project_psp

afterAll(async () => {
    (await getDb()).close();
});

async function createPaymentAndGetRef(): Promise<{ id: string; ref: string }> {
    const res = await request(app)
        .post('/api/payments')
        .set('Authorization', A)
        .send({
            pspCode: 'mock_card',
            amount: 999,
            currency: 'EUR',
            customer: { externalRef: 'wh1', email: 'wh1@ex.com' },
        });
    const id = res.body.paymentId as string;
    const db = await getDb();
    const row = await db.get<{ psp_reference: string }>(`SELECT psp_reference FROM payment WHERE id = ?`, id);
    return { id, ref: row!.psp_reference };
}

function webhookBody(ref: string, eventId: string, status: string) {
    return {
        eventId,
        pspReference: ref,
        kind: 'payment',
        status,
        signature: mockSign(SECRET, eventId),
    };
}

describe('webhooks', () => {
    it('reconciles a payment to its terminal status', async () => {
        const { id, ref } = await createPaymentAndGetRef();
        const res = await request(app)
            .post('/api/webhooks/mock_card')
            .send(webhookBody(ref, 'evt_ok_1', 'succeeded'));
        expect(res.status).toBe(200);

        const got = await request(app).get(`/api/payments/${id}`).set('Authorization', A);
        expect(got.body.status).toBe('succeeded');
    });

    it('does not re-apply a replayed event id', async () => {
        const { id, ref } = await createPaymentAndGetRef();
        const eventId = 'evt_dup_1';
        await request(app)
            .post('/api/webhooks/mock_card')
            .send(webhookBody(ref, eventId, 'succeeded'));
        // Same event id, different status — must be ignored (already seen).
        const replay = await request(app)
            .post('/api/webhooks/mock_card')
            .send(webhookBody(ref, eventId, 'failed'));
        expect(replay.status).toBe(200);

        const got = await request(app).get(`/api/payments/${id}`).set('Authorization', A);
        expect(got.body.status).toBe('succeeded'); // unchanged

        const db = await getDb();
        const count = await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM webhook_event WHERE provider_event_id = ?`, eventId);
        expect(count!.n).toBe(1);
    });

    it('rejects a bad signature', async () => {
        const { ref } = await createPaymentAndGetRef();
        const res = await request(app).post('/api/webhooks/mock_card').send({
            eventId: 'evt_bad',
            pspReference: ref,
            kind: 'payment',
            status: 'succeeded',
            signature: 'bad',
        });
        expect(res.status).toBe(400);
    });
});
