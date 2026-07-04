import { CreatePaymentRequest, CreatePaymentResponse } from './index';

describe('schemas', () => {
    it('parses a valid create-payment request', () => {
        const parsed = CreatePaymentRequest.parse({
            pspCode: 'mock_card',
            amount: 999,
            currency: 'EUR',
            customer: { externalRef: 'u1', email: 'a@b.com' },
        });
        expect(parsed.amount).toBe(999);
    });

    it('strips unknown keys from a request', () => {
        const parsed = CreatePaymentRequest.parse({
            pspCode: 'mock_card',
            amount: 999,
            currency: 'EUR',
            customer: { externalRef: 'u1', email: 'a@b.com' },
            secretField: 'leak',
        });
        expect('secretField' in parsed).toBe(false);
    });

    it('strips unknown keys from a response', () => {
        const parsed = CreatePaymentResponse.parse({
            paymentId: 'pay_1',
            status: 'succeeded',
            internalId: 'leak',
        });
        expect('internalId' in parsed).toBe(false);
    });

    it('throws on an invalid payload', () => {
        expect(() =>
            CreatePaymentRequest.parse({
                pspCode: 'mock_card',
                amount: -5,
                currency: 'EUR',
                customer: { externalRef: 'u1', email: 'not-an-email' },
            }),
        ).toThrow();
    });
});
