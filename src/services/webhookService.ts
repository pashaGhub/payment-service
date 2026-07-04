import createError from 'http-errors';
import { pspRegistry } from '../adapters/registry';
import { getPspCredentials } from '../config/psp';
import { findPspByCode, insertWebhookEvent, markWebhookProcessed, updatePaymentStatusByPspRef, updateSubscriptionStatusByPspRef } from '../db/repositories';
import type { WebhookRequest } from '../schemas';
import type { PaymentStatus, SubscriptionStatus } from '../types';

/**
 * Reconcile an inbound provider webhook. The signing secret is the service's own
 * per-PSP secret (from the environment), so the signature is verified up front
 * without needing to resolve the referenced object first. The event is recorded
 * before its effect is applied, so a replayed provider event id is a no-op
 * rather than a double-applied state change.
 */
export async function processWebhook(pspCode: string, body: WebhookRequest): Promise<{ duplicate: boolean }> {
    const adapter = pspRegistry.resolve(pspCode); // 400 if unknown PSP
    const psp = await findPspByCode(pspCode);
    if (!psp) {
        throw createError(400, `Unknown PSP: ${pspCode}`);
    }

    const { webhookSecret } = getPspCredentials(pspCode);

    // Verify signature and normalize (throws 400 on a bad signature).
    const event = adapter.parseWebhook(
        {
            eventId: body.eventId,
            pspReference: body.pspReference,
            kind: body.kind,
            status: body.status,
            signature: body.signature,
        },
        webhookSecret,
    );

    // Idempotent inbox: a duplicate provider event id is recorded once, applied once.
    const isNew = await insertWebhookEvent({
        pspId: psp.id,
        providerEventId: event.eventId,
        kind: event.kind,
        pspReference: event.pspReference,
        payload: JSON.stringify(body),
    });
    if (!isNew) {
        return { duplicate: true };
    }

    if (event.kind === 'payment') {
        await updatePaymentStatusByPspRef(event.pspReference, event.status as PaymentStatus);
    } else {
        await updateSubscriptionStatusByPspRef(event.pspReference, event.status as SubscriptionStatus);
    }
    await markWebhookProcessed(psp.id, event.eventId);

    return { duplicate: false };
}
