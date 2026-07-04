import { RequestHandler } from 'express';
import type { ZodType } from 'zod';

/**
 * Validates `req.body` against the given Zod schema.
 *
 * On success, `req.body` is replaced with the parsed value (unknown keys are
 * stripped). On failure, the `ZodError` is forwarded to `next()` so the
 * central `errorHandler` produces the response.
 */
export const validateReq =
    <T>(schema: ZodType<T>): RequestHandler =>
    (req, _res, next) => {
        const result = schema.safeParse(req.body);

        if (!result.success) {
            return next(result.error);
        }

        req.body = result.data;
        next();
    };
