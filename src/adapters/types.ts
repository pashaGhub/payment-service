import type { PaymentStatus, SubscriptionStatus } from '../types';

export interface Capabilities {
    oneTime: boolean;
    subscription: boolean;
}

export interface PspCustomer {
    externalRef: string;
    email: string;
}

export interface CreatePaymentPspInput {
    amount: number;
    currency: string;
    customer: PspCustomer;
    metadata?: Record<string, string>;
    idempotencyKey?: string;
}

export interface CreateSubscriptionPspInput {
    plan: { amount: number; currency: string; interval: string };
    customer: PspCustomer;
    metadata?: Record<string, string>;
}

export interface PaymentNextAction {
    redirectUrl?: string;
    clientSecret?: string;
}

export interface PspPaymentResult {
    pspReference: string;
    status: PaymentStatus;
    nextAction?: PaymentNextAction;
}

export interface PspSubscriptionResult {
    pspReference: string;
    status: SubscriptionStatus;
    nextAction?: { redirectUrl?: string };
}

/** Normalized inbound webhook, as handed to an adapter for verification. */
export interface RawWebhook {
    eventId: string;
    pspReference: string;
    kind: 'payment' | 'subscription';
    status: string;
    signature: string;
}

/** An adapter's normalized view of a verified webhook. */
export interface PspWebhookEvent {
    eventId: string;
    pspReference: string;
    kind: 'payment' | 'subscription';
    status: PaymentStatus | SubscriptionStatus;
}

/**
 * The unified provider abstraction. High-level services depend only on this
 * interface (DIP); concrete providers are named solely in the registry.
 */
export interface PspAdapter {
    readonly code: string;
    readonly capabilities: Capabilities;
    createPayment(input: CreatePaymentPspInput): Promise<PspPaymentResult>;
    createSubscription(input: CreateSubscriptionPspInput): Promise<PspSubscriptionResult>;
    parseWebhook(raw: RawWebhook, secret: string): PspWebhookEvent;
}
