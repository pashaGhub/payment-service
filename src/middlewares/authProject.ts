import { Request, RequestHandler } from 'express';
import createError from 'http-errors';
import { findProjectByApiKeyHash, hashApiKey } from '../db/repositories';

function extractApiKey(req: Request): string | undefined {
    const header = req.header('authorization');
    if (header?.startsWith('Bearer ')) {
        return header.slice('Bearer '.length).trim() || undefined;
    }
    return req.header('x-api-key')?.trim() || undefined;
}

/**
 * Authenticates the caller by API key and attaches the resolved `project` to
 * the request; every downstream query is then scoped to `req.project.id`.
 */
export const authProject: RequestHandler = async (req, _res, next) => {
    try {
        const raw = extractApiKey(req);
        if (!raw) {
            throw createError(401, 'Missing API key');
        }
        const project = await findProjectByApiKeyHash(hashApiKey(raw));
        if (!project) {
            throw createError(401, 'Invalid API key');
        }

        req.project = project;
        next();
    } catch (err) {
        next(err);
    }
};
