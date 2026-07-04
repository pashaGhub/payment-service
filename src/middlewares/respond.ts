import { Response } from 'express';
import type { ZodType } from 'zod';

interface ServerError extends Error {
    status: number;
}

/**
 * Sends `data` as JSON only after it passes the endpoint's response schema.
 *
 * Because Zod object schemas strip unknown keys, this also guards against
 * leaking internal/sensitive fields. A parse failure means our own output
 * violates its contract — a server bug — so it surfaces as a 500 through the
 * central `errorHandler`, never as a malformed body or a client-facing 400.
 */
export function respond<T>(res: Response, schema: ZodType<T>, data: unknown, status = 200): void {
    const result = schema.safeParse(data);

    if (!result.success) {
        console.error('Response validation failed:', result.error.issues);
        const error = new Error('Internal server error') as ServerError;
        error.status = 500;
        throw error;
    }

    res.status(status).json(result.data);
}
