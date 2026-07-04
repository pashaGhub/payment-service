import { z } from 'zod';
import type { PaymentStatus, SubscriptionStatus } from '../types';

// Status enums live here (with the string unions in types.ts as the declared
// source of truth); `satisfies` guards the two from drifting apart.
export const PaymentStatusSchema = z.enum(['pending', 'requires_action', 'succeeded', 'failed']) satisfies z.ZodType<PaymentStatus>;

export const SubscriptionStatusSchema = z.enum(['pending', 'active', 'past_due', 'canceled']) satisfies z.ZodType<SubscriptionStatus>;

const CustomerInput = z.object({
    externalRef: z.string().min(1),
    email: z.email(),
});

const Metadata = z.record(z.string(), z.string());

// ---- Create one-time payment ----
export const CreatePaymentRequest = z.object({
    pspCode: z.string().min(1),
    amount: z.number().int().positive(), // integer minor units per ISO-4217 exponent
    currency: z.string().length(3),
    customer: CustomerInput,
    metadata: Metadata.optional(),
    idempotencyKey: z.string().min(1).optional(),
});
export type CreatePaymentRequest = z.infer<typeof CreatePaymentRequest>;

export const CreatePaymentResponse = z.object({
    paymentId: z.string(),
    status: PaymentStatusSchema,
    nextAction: z
        .object({
            redirectUrl: z.url().optional(),
            clientSecret: z.string().optional(),
        })
        .optional(),
});
export type CreatePaymentResponse = z.infer<typeof CreatePaymentResponse>;

// ---- Create subscription ----
export const CreateSubscriptionRequest = z.object({
    pspCode: z.string().min(1),
    planId: z.string().min(1),
    customer: CustomerInput,
    metadata: Metadata.optional(),
});
export type CreateSubscriptionRequest = z.infer<typeof CreateSubscriptionRequest>;

export const CreateSubscriptionResponse = z.object({
    subscriptionId: z.string(),
    status: SubscriptionStatusSchema,
    nextAction: z.object({ redirectUrl: z.url().optional() }).optional(),
});
export type CreateSubscriptionResponse = z.infer<typeof CreateSubscriptionResponse>;

// ---- Checkout options (drives the checkout page) ----
export const CheckoutOptionsResponse = z.object({
    options: z.array(
        z.object({
            pspCode: z.string(),
            displayName: z.string(),
            supports: z.object({
                oneTime: z.boolean(),
                subscription: z.boolean(),
            }),
        }),
    ),
});
export type CheckoutOptionsResponse = z.infer<typeof CheckoutOptionsResponse>;

// ---- Inbound webhook envelope (mock providers) ----
export const WebhookRequest = z.object({
    eventId: z.string().min(1),
    pspReference: z.string().min(1),
    kind: z.enum(['payment', 'subscription']),
    status: z.string().min(1),
    signature: z.string().min(1),
});
export type WebhookRequest = z.infer<typeof WebhookRequest>;
