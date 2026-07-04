import express from 'express';
import request from 'supertest';
import { getDb } from '../db/connection';
import { authProject, errorHandler } from './index';

const app = express();
app.get('/whoami', authProject, (req, res) => {
    res.json({ projectId: req.project?.id });
});
app.use(errorHandler);

afterAll(async () => {
    (await getDb()).close();
});

describe('authProject', () => {
    it('attaches the project for a valid Bearer key', async () => {
        const res = await request(app).get('/whoami').set('Authorization', 'Bearer pk_test_projectA');
        expect(res.status).toBe(200);
        expect(res.body.projectId).toBe('proj_a');
    });

    it('responds 401 when no key is provided', async () => {
        const res = await request(app).get('/whoami');
        expect(res.status).toBe(401);
    });

    it('responds 401 for an invalid key', async () => {
        const res = await request(app).get('/whoami').set('X-Api-Key', 'wrong');
        expect(res.status).toBe(401);
    });
});
