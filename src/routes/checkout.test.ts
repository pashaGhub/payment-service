import request from 'supertest';
import { app } from '../app';
import { getDb } from '../db/connection';

afterAll(async () => {
    (await getDb()).close();
});

describe('GET /api/checkout/options', () => {
    it("returns only Project A's enabled PSP", async () => {
        const res = await request(app).get('/api/checkout/options').set('Authorization', 'Bearer pk_test_projectA');
        expect(res.status).toBe(200);
        expect(res.body.options.map((o: { pspCode: string }) => o.pspCode)).toEqual(['mock_card']);
    });

    it("returns Project B's PSPs in display order", async () => {
        const res = await request(app).get('/api/checkout/options').set('Authorization', 'Bearer pk_test_projectB');
        expect(res.status).toBe(200);
        expect(res.body.options.map((o: { pspCode: string }) => o.pspCode)).toEqual(['mock_card', 'mock_wallet']);
        const wallet = res.body.options.find((o: { pspCode: string }) => o.pspCode === 'mock_wallet');
        expect(wallet.supports).toEqual({ oneTime: true, subscription: false });
    });

    it('responds 401 without an API key', async () => {
        const res = await request(app).get('/api/checkout/options');
        expect(res.status).toBe(401);
    });
});
