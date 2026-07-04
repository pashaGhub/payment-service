import fs from 'fs';
import path from 'path';
import { Database, open } from 'sqlite';
import * as sqlite3 from 'sqlite3';

export type Db = Database<sqlite3.Database, sqlite3.Statement>;

/**
 * Resolve the SQLite file path. Tests are forced onto a separate file so a test
 * run never clobbers dev data, regardless of a `DB_PATH` picked up from `.env`.
 */
export function resolveDbPath(): string {
    if (process.env.NODE_ENV === 'test') {
        return process.env.TEST_DB_PATH ?? './data/payments.test.db';
    }
    return process.env.DB_PATH ?? './data/payments.db';
}

let dbPromise: Promise<Db> | null = null;

/** Open (once) and return the shared connection with foreign keys enforced. */
export async function getDb(): Promise<Db> {
    if (!dbPromise) {
        dbPromise = (async () => {
            const filename = resolveDbPath();
            fs.mkdirSync(path.dirname(filename), { recursive: true });
            const db = await open({ filename, driver: sqlite3.Database });
            await db.exec('PRAGMA foreign_keys = ON;');
            return db;
        })();
    }
    return dbPromise;
}
