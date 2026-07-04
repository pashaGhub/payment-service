import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

interface CustomError extends Error {
    status?: number;
    statusCode?: number;
}

export function errorHandler(err: CustomError, _req: Request, res: Response, _next: NextFunction) {
    // Validation errors: report every failing field with a 400.
    if (err instanceof ZodError) {
        return res.status(400).json({
            status: 'fail',
            errors: err.issues.map((issue) => ({
                field: issue.path.join('.'),
                message: issue.message,
            })),
        });
    }

    // If we have an error object with either `status` or `statusCode` property, use that.
    let statusCode = 500;
    if (err?.status) {
        statusCode = err.status;
    }

    if (!err?.status && err.statusCode) {
        statusCode = err.statusCode;
    }

    res.status(statusCode).json({ message: err?.message ?? 'Internal server error...' });
}
