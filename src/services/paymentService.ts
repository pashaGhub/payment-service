import createError from 'http-errors';
import { pspRegistry } from '../adapters/registry';
import { findEnabledProjectPsp, findPaymentByIdempotencyKey, getPaymentById, insertPayment, updatePaymentResult, upsertCustomer } from '../db/repositories';
import type { CreatePaymentRequest, CreatePaymentResponse } from '../schemas';
import type { Project } from '../types';

/**
 * Create a one-time payment. Order matters: gate the PSP and resolve the adapter
 * *before* writing any row, so a rejected `pspCode` never persists a payment;
 * short-circuit on a repeated `idempotencyKey` to avoid duplicates.
 */
export async function createPayment(project: Project, dto: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    const psp = await findEnabledProjectPsp(project.id, dto.pspCode);
    if (!psp) {
        throw createError(400, `PSP '${dto.pspCode}' is not enabled for this project`);
    }
    if (!psp.supportsOneTime) {
        throw createError(400, `PSP '${dto.pspCode}' does not support one-time payments`);
    }
    const adapter = pspRegistry.resolve(dto.pspCode);

    if (dto.idempotencyKey) {
        const existing = await findPaymentByIdempotencyKey(project.id, dto.idempotencyKey);
        if (existing) {
            return { paymentId: existing.id, status: existing.status };
        }
    }

    const customerId = await upsertCustomer(project.id, dto.customer.externalRef, dto.customer.email);

    const payment = await insertPayment({
        projectId: project.id,
        customerId,
        projectPspId: psp.projectPspId,
        amount: dto.amount,
        currency: dto.currency,
        status: 'pending',
        idempotencyKey: dto.idempotencyKey,
        metadata: dto.metadata,
    });

    const result = await adapter.createPayment({
        amount: dto.amount,
        currency: dto.currency,
        customer: dto.customer,
        metadata: dto.metadata,
        idempotencyKey: dto.idempotencyKey,
    });

    await updatePaymentResult(payment.id, result.pspReference, result.status);

    return {
        paymentId: payment.id,
        status: result.status,
        nextAction: result.nextAction,
    };
}

export async function getPayment(project: Project, paymentId: string): Promise<CreatePaymentResponse> {
    const payment = await getPaymentById(project.id, paymentId);
    if (!payment) {
        throw createError(404, 'Payment not found');
    }
    return { paymentId: payment.id, status: payment.status };
}
