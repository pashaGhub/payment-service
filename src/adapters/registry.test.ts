import { mockSign } from './mockBase';
import { pspRegistry } from './registry';

describe('PSP adapters', () => {
    it('resolves a known adapter and creates a payment', async () => {
        const adapter = pspRegistry.resolve('mock_card');
        const result = await adapter.createPayment({
            amount: 500,
            currency: 'EUR',
            customer: { externalRef: 'u1', email: 'a@b.com' },
        });
        expect(result.pspReference).toContain('mock_card');
        expect(['pending', 'requires_action', 'succeeded', 'failed']).toContain(result.status);
    });

    it('throws for an unknown PSP code', () => {
        expect(() => pspRegistry.resolve('nope')).toThrow();
    });

    it('mock_wallet does not support subscriptions', async () => {
        const wallet = pspRegistry.resolve('mock_wallet');
        expect(wallet.capabilities.subscription).toBe(false);
        await expect(
            wallet.createSubscription({
                plan: { amount: 999, currency: 'EUR', interval: 'month' },
                customer: { externalRef: 'u1', email: 'a@b.com' },
            }),
        ).rejects.toThrow();
    });

    it('verifies a valid webhook signature and rejects a bad one', () => {
        const adapter = pspRegistry.resolve('mock_card');
        const secret = 'whsec_mock';
        const raw = {
            eventId: 'evt_1',
            pspReference: 'mock_card_pay_x',
            kind: 'payment' as const,
            status: 'succeeded',
            signature: mockSign(secret, 'evt_1'),
        };
        expect(adapter.parseWebhook(raw, secret).status).toBe('succeeded');
        expect(() => adapter.parseWebhook({ ...raw, signature: 'bad' }, secret)).toThrow();
    });
});
