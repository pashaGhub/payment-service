import createError from 'http-errors';
import { pspRegistry } from '../adapters/registry';
import { findEnabledProjectPsp, getPlan, getSubscriptionById, insertSubscription, updateSubscriptionResult, upsertCustomer } from '../db/repositories';
import type { CreateSubscriptionRequest, CreateSubscriptionResponse } from '../schemas';
import type { Project } from '../types';

/**
 * Create a subscription. Gate the PSP (enabled + subscription-capable) and the
 * project-owned plan before writing any row.
 */
export async function createSubscription(project: Project, dto: CreateSubscriptionRequest): Promise<CreateSubscriptionResponse> {
    const psp = await findEnabledProjectPsp(project.id, dto.pspCode);
    if (!psp) {
        throw createError(400, `PSP '${dto.pspCode}' is not enabled for this project`);
    }
    if (!psp.supportsSubscription) {
        throw createError(400, `PSP '${dto.pspCode}' does not support subscriptions`);
    }

    const plan = await getPlan(project.id, dto.planId);
    if (!plan) {
        throw createError(400, `Plan '${dto.planId}' not found for this project`);
    }

    const adapter = pspRegistry.resolve(dto.pspCode);

    const customerId = await upsertCustomer(project.id, dto.customer.externalRef, dto.customer.email);

    const subscription = await insertSubscription({
        projectId: project.id,
        customerId,
        projectPspId: psp.projectPspId,
        planId: plan.id,
        status: 'pending',
        metadata: dto.metadata,
    });

    const result = await adapter.createSubscription({
        plan: {
            amount: plan.amount,
            currency: plan.currency,
            interval: plan.interval,
        },
        customer: dto.customer,
        metadata: dto.metadata,
    });

    await updateSubscriptionResult(subscription.id, result.pspReference, result.status);

    return {
        subscriptionId: subscription.id,
        status: result.status,
        nextAction: result.nextAction,
    };
}

export async function getSubscription(project: Project, subscriptionId: string): Promise<CreateSubscriptionResponse> {
    const subscription = await getSubscriptionById(project.id, subscriptionId);
    if (!subscription) {
        throw createError(404, 'Subscription not found');
    }
    return { subscriptionId: subscription.id, status: subscription.status };
}
