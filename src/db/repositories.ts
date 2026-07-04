import crypto from 'crypto';
import type { PaymentStatus, Project, SubscriptionStatus } from '../types';
import { getDb } from './connection';

// ---- Shared helpers ----

/** Hash a raw API key the same way the seed does, so lookups match. */
export function hashApiKey(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
}

const now = (): string => new Date().toISOString();
const id = (prefix: string): string => `${prefix}_${crypto.randomUUID()}`;

// ---- Row shapes ----

export interface EnabledProjectPsp {
    projectPspId: string;
    pspId: string;
    pspCode: string;
    displayName: string;
    supportsOneTime: boolean;
    supportsSubscription: boolean;
    displayOrder: number;
}

export interface PaymentRow {
    id: string;
    projectId: string;
    customerId: string;
    projectPspId: string;
    amount: number;
    currency: string;
    status: PaymentStatus;
    pspReference: string | null;
    idempotencyKey: string | null;
    metadata: string | null;
}

export interface SubscriptionRow {
    id: string;
    projectId: string;
    customerId: string;
    projectPspId: string;
    planId: string;
    status: SubscriptionStatus;
    pspReference: string | null;
    metadata: string | null;
}

export interface PlanRow {
    id: string;
    projectId: string;
    name: string;
    amount: number;
    currency: string;
    interval: string;
}

// ---- Projects ----

export async function findProjectByApiKeyHash(apiKeyHash: string): Promise<Project | undefined> {
    const db = await getDb();
    const row = await db.get<{
        id: string;
        name: string;
        api_key_hash: string;
        created_at: string;
    }>(`SELECT * FROM project WHERE api_key_hash = ?`, apiKeyHash);

    if (!row) {
        return;
    }

    return {
        id: row.id,
        name: row.name,
        apiKeyHash: row.api_key_hash,
        createdAt: row.created_at,
    };
}

// ---- Project PSPs ----

interface ProjectPspJoinRow {
    project_psp_id: string;
    psp_id: string;
    code: string;
    display_name: string;
    supports_one_time: number;
    supports_subscription: number;
    display_order: number;
}

const PROJECT_PSP_SELECT = `
  SELECT pp.id AS project_psp_id, pp.psp_id AS psp_id, psp.code AS code,
         psp.display_name AS display_name, psp.supports_one_time AS supports_one_time,
         psp.supports_subscription AS supports_subscription,
         pp.display_order AS display_order
  FROM project_psp pp
  JOIN psp ON psp.id = pp.psp_id
  WHERE pp.project_id = ? AND pp.enabled = 1`;

function mapProjectPsp(row: ProjectPspJoinRow): EnabledProjectPsp {
    return {
        projectPspId: row.project_psp_id,
        pspId: row.psp_id,
        pspCode: row.code,
        displayName: row.display_name,
        supportsOneTime: row.supports_one_time === 1,
        supportsSubscription: row.supports_subscription === 1,
        displayOrder: row.display_order,
    };
}

export async function listEnabledProjectPsps(projectId: string): Promise<EnabledProjectPsp[]> {
    const db = await getDb();
    const rows = await db.all<ProjectPspJoinRow[]>(`${PROJECT_PSP_SELECT} ORDER BY pp.display_order`, projectId);
    return rows.map(mapProjectPsp);
}

export async function findEnabledProjectPsp(projectId: string, pspCode: string): Promise<EnabledProjectPsp | undefined> {
    const db = await getDb();
    const row = await db.get<ProjectPspJoinRow>(`${PROJECT_PSP_SELECT} AND psp.code = ?`, projectId, pspCode);
    return row ? mapProjectPsp(row) : undefined;
}

// ---- Customers ----

export async function upsertCustomer(projectId: string, externalRef: string, email: string): Promise<string> {
    const db = await getDb();
    await db.run(
        `INSERT INTO customer (id, project_id, external_ref, email) VALUES (?, ?, ?, ?)
     ON CONFLICT(project_id, external_ref) DO UPDATE SET email = excluded.email`,
        id('cus'),
        projectId,
        externalRef,
        email,
    );
    const row = await db.get<{ id: string }>(`SELECT id FROM customer WHERE project_id = ? AND external_ref = ?`, projectId, externalRef);
    // The upsert guarantees a row exists.
    return row!.id;
}

// ---- Plans ----

export async function getPlan(projectId: string, planId: string): Promise<PlanRow | undefined> {
    const db = await getDb();
    const row = await db.get<{
        id: string;
        project_id: string;
        name: string;
        amount: number;
        currency: string;
        interval: string;
    }>(`SELECT * FROM plan WHERE project_id = ? AND id = ?`, projectId, planId);
    if (!row) return undefined;
    return {
        id: row.id,
        projectId: row.project_id,
        name: row.name,
        amount: row.amount,
        currency: row.currency,
        interval: row.interval,
    };
}

// ---- Payments ----

interface PaymentDbRow {
    id: string;
    project_id: string;
    customer_id: string;
    project_psp_id: string;
    amount: number;
    currency: string;
    status: string;
    psp_reference: string | null;
    idempotency_key: string | null;
    metadata: string | null;
}

function mapPayment(row: PaymentDbRow): PaymentRow {
    return {
        id: row.id,
        projectId: row.project_id,
        customerId: row.customer_id,
        projectPspId: row.project_psp_id,
        amount: row.amount,
        currency: row.currency,
        status: row.status as PaymentStatus,
        pspReference: row.psp_reference,
        idempotencyKey: row.idempotency_key,
        metadata: row.metadata,
    };
}

export async function insertPayment(params: {
    projectId: string;
    customerId: string;
    projectPspId: string;
    amount: number;
    currency: string;
    status: PaymentStatus;
    idempotencyKey?: string;
    metadata?: Record<string, string>;
}): Promise<PaymentRow> {
    const db = await getDb();
    const paymentId = id('pay');
    const ts = now();
    await db.run(
        `INSERT INTO payment (id, project_id, customer_id, project_psp_id, amount, currency, status, idempotency_key, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        paymentId,
        params.projectId,
        params.customerId,
        params.projectPspId,
        params.amount,
        params.currency,
        params.status,
        params.idempotencyKey ?? null,
        params.metadata ? JSON.stringify(params.metadata) : null,
        ts,
        ts,
    );
    const row = await db.get<PaymentDbRow>(`SELECT * FROM payment WHERE id = ?`, paymentId);
    return mapPayment(row!);
}

export async function findPaymentByIdempotencyKey(projectId: string, idempotencyKey: string): Promise<PaymentRow | undefined> {
    const db = await getDb();
    const row = await db.get<PaymentDbRow>(`SELECT * FROM payment WHERE project_id = ? AND idempotency_key = ?`, projectId, idempotencyKey);
    return row ? mapPayment(row) : undefined;
}

export async function getPaymentById(projectId: string, paymentId: string): Promise<PaymentRow | undefined> {
    const db = await getDb();
    const row = await db.get<PaymentDbRow>(`SELECT * FROM payment WHERE project_id = ? AND id = ?`, projectId, paymentId);
    return row ? mapPayment(row) : undefined;
}

export async function updatePaymentResult(paymentId: string, pspReference: string, status: PaymentStatus): Promise<void> {
    const db = await getDb();
    await db.run(`UPDATE payment SET psp_reference = ?, status = ?, updated_at = ? WHERE id = ?`, pspReference, status, now(), paymentId);
}

export async function updatePaymentStatusByPspRef(pspReference: string, status: PaymentStatus): Promise<number> {
    const db = await getDb();
    const res = await db.run(`UPDATE payment SET status = ?, updated_at = ? WHERE psp_reference = ?`, status, now(), pspReference);
    return res.changes ?? 0;
}

// ---- Subscriptions ----

interface SubscriptionDbRow {
    id: string;
    project_id: string;
    customer_id: string;
    project_psp_id: string;
    plan_id: string;
    status: string;
    psp_reference: string | null;
    metadata: string | null;
}

function mapSubscription(row: SubscriptionDbRow): SubscriptionRow {
    return {
        id: row.id,
        projectId: row.project_id,
        customerId: row.customer_id,
        projectPspId: row.project_psp_id,
        planId: row.plan_id,
        status: row.status as SubscriptionStatus,
        pspReference: row.psp_reference,
        metadata: row.metadata,
    };
}

export async function insertSubscription(params: {
    projectId: string;
    customerId: string;
    projectPspId: string;
    planId: string;
    status: SubscriptionStatus;
    metadata?: Record<string, string>;
}): Promise<SubscriptionRow> {
    const db = await getDb();
    const subscriptionId = id('sub');
    const ts = now();
    await db.run(
        `INSERT INTO subscription (id, project_id, customer_id, project_psp_id, plan_id, status, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        subscriptionId,
        params.projectId,
        params.customerId,
        params.projectPspId,
        params.planId,
        params.status,
        params.metadata ? JSON.stringify(params.metadata) : null,
        ts,
        ts,
    );
    const row = await db.get<SubscriptionDbRow>(`SELECT * FROM subscription WHERE id = ?`, subscriptionId);
    return mapSubscription(row!);
}

export async function getSubscriptionById(projectId: string, subscriptionId: string): Promise<SubscriptionRow | undefined> {
    const db = await getDb();
    const row = await db.get<SubscriptionDbRow>(`SELECT * FROM subscription WHERE project_id = ? AND id = ?`, projectId, subscriptionId);
    return row ? mapSubscription(row) : undefined;
}

export async function updateSubscriptionResult(subscriptionId: string, pspReference: string, status: SubscriptionStatus): Promise<void> {
    const db = await getDb();
    await db.run(`UPDATE subscription SET psp_reference = ?, status = ?, updated_at = ? WHERE id = ?`, pspReference, status, now(), subscriptionId);
}

export async function updateSubscriptionStatusByPspRef(pspReference: string, status: SubscriptionStatus): Promise<number> {
    const db = await getDb();
    const res = await db.run(`UPDATE subscription SET status = ?, updated_at = ? WHERE psp_reference = ?`, status, now(), pspReference);
    return res.changes ?? 0;
}

// ---- PSP catalog + webhook events ----

export async function findPspByCode(code: string): Promise<{ id: string; code: string } | undefined> {
    const db = await getDb();
    const row = await db.get<{ id: string; code: string }>(`SELECT id, code FROM psp WHERE code = ?`, code);
    return row ?? undefined;
}

/**
 * Record an inbound webhook. Returns false when the (psp_id, provider_event_id)
 * pair was already stored — the caller should then treat the event as a
 * duplicate and skip re-applying its effect.
 */
export async function insertWebhookEvent(params: { pspId: string; providerEventId: string; kind: string; pspReference: string | null; payload: string }): Promise<boolean> {
    const db = await getDb();
    const res = await db.run(
        `INSERT OR IGNORE INTO webhook_event (id, psp_id, provider_event_id, kind, psp_reference, payload, processed, received_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
        id('whk'),
        params.pspId,
        params.providerEventId,
        params.kind,
        params.pspReference,
        params.payload,
        now(),
    );
    return (res.changes ?? 0) > 0;
}

export async function markWebhookProcessed(pspId: string, providerEventId: string): Promise<void> {
    const db = await getDb();
    await db.run(`UPDATE webhook_event SET processed = 1 WHERE psp_id = ? AND provider_event_id = ?`, pspId, providerEventId);
}
