import crypto from 'crypto';
import createError from 'http-errors';
import type { PaymentStatus, SubscriptionStatus } from '../types';
import type {
    Capabilities,
    CreatePaymentPspInput,
    CreateSubscriptionPspInput,
    PaymentNextAction,
    PspAdapter,
    PspPaymentResult,
    PspSubscriptionResult,
    PspWebhookEvent,
    RawWebhook,
} from './types';

/**
 * Deterministic mock signature. Exported so tests (and the webhook route) can
 * construct a webhook that verifies against a project's stored secret.
 */
export function mockSign(secret: string, eventId: string): string {
    return crypto.createHmac('sha256', secret).update(eventId).digest('hex');
}

/**
 * Shared mock behavior. Create calls leave the object in a non-terminal state;
 * the terminal status is delivered later by a webhook, exercising the full
 * async reconciliation path without any real network calls.
 */
export abstract class MockPspAdapter implements PspAdapter {
    abstract readonly code: string;
    abstract readonly capabilities: Capabilities;

    protected reference(prefix: string): string {
        return `${this.code}_${prefix}_${crypto.randomUUID()}`;
    }

    protected abstract paymentNextAction(pspReference: string): PaymentNextAction;

    async createPayment(_input: CreatePaymentPspInput): Promise<PspPaymentResult> {
        const pspReference = this.reference('pay');
        return {
            pspReference,
            status: 'requires_action',
            nextAction: this.paymentNextAction(pspReference),
        };
    }

    async createSubscription(_input: CreateSubscriptionPspInput): Promise<PspSubscriptionResult> {
        if (!this.capabilities.subscription) {
            throw createError(400, `${this.code} does not support subscriptions`);
        }
        const pspReference = this.reference('sub');
        return {
            pspReference,
            status: 'pending',
            nextAction: {
                redirectUrl: `https://mock.psp/${this.code}/confirm/${pspReference}`,
            },
        };
    }

    parseWebhook(raw: RawWebhook, secret: string): PspWebhookEvent {
        if (raw.signature !== mockSign(secret, raw.eventId)) {
            throw createError(400, 'Invalid webhook signature');
        }
        return {
            eventId: raw.eventId,
            pspReference: raw.pspReference,
            kind: raw.kind,
            status: raw.status as PaymentStatus | SubscriptionStatus,
        };
    }
}
