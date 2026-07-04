import fs from 'fs';
import path from 'path';
import { getDb } from './connection';

const SCHEMA_PATH = path.resolve(process.cwd(), 'db/schema.sql');

/** Apply the schema DDL (idempotent) against the shared connection. */
export async function migrate(): Promise<void> {
    const db = await getDb();
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    await db.exec(schema);
}
