'use strict';

// Deterministic seed for the payment service. Run as `node db/seed.js`
// (invoked by `npm run seed` and, with NODE_ENV=test, by `npm test`).
// Applies db/schema.sql, wipes existing rows, and inserts a fixed catalog +
// two example projects with different PSP combinations.
//
// Raw API keys (documented here for tests; only their sha256 hash is stored):
//   Project A -> pk_test_projectA   (PSPs: mock_card)
//   Project B -> pk_test_projectB   (PSPs: mock_card + mock_wallet)

require('dotenv/config');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

function resolveDbPath() {
    if (process.env.NODE_ENV === 'test') {
        return process.env.TEST_DB_PATH ?? './data/payments.test.db';
    }
    return process.env.DB_PATH ?? './data/payments.db';
}

function hashKey(raw) {
    return crypto.createHash('sha256').update(raw).digest('hex');
}

// Child-before-parent order so DELETEs respect foreign keys.
const TABLES_IN_DELETE_ORDER = ['webhook_event', 'payment', 'subscription', 'plan', 'customer', 'project_psp', 'psp', 'project'];

async function main() {
    const filename = resolveDbPath();
    fs.mkdirSync(path.dirname(filename), { recursive: true });

    const db = await open({ filename, driver: sqlite3.Database });
    await db.exec('PRAGMA foreign_keys = ON;');

    const schema = fs.readFileSync(path.resolve(process.cwd(), 'db/schema.sql'), 'utf-8');
    await db.exec(schema);

    for (const table of TABLES_IN_DELETE_ORDER) {
        await db.exec(`DELETE FROM ${table};`);
    }

    const now = new Date().toISOString();
    // PSP catalog
    await db.run(`INSERT INTO psp (id, code, display_name, supports_one_time, supports_subscription) VALUES (?, ?, ?, ?, ?)`, 'psp_mock_card', 'mock_card', 'Mock Card', 1, 1);
    await db.run(
        `INSERT INTO psp (id, code, display_name, supports_one_time, supports_subscription) VALUES (?, ?, ?, ?, ?)`,
        'psp_mock_wallet',
        'mock_wallet',
        'Mock Wallet',
        1,
        0,
    );

    // Projects
    await db.run(`INSERT INTO project (id, name, api_key_hash, created_at) VALUES (?, ?, ?, ?)`, 'proj_a', 'Project A', hashKey('pk_test_projectA'), now);
    await db.run(`INSERT INTO project (id, name, api_key_hash, created_at) VALUES (?, ?, ?, ?)`, 'proj_b', 'Project B', hashKey('pk_test_projectB'), now);

    // Per-project enabled PSPs (no secrets here — see src/config/psp.ts)
    await db.run(`INSERT INTO project_psp (id, project_id, psp_id, enabled, display_order) VALUES (?, ?, ?, ?, ?)`, 'pp_a_card', 'proj_a', 'psp_mock_card', 1, 0);
    await db.run(`INSERT INTO project_psp (id, project_id, psp_id, enabled, display_order) VALUES (?, ?, ?, ?, ?)`, 'pp_b_card', 'proj_b', 'psp_mock_card', 1, 0);
    await db.run(`INSERT INTO project_psp (id, project_id, psp_id, enabled, display_order) VALUES (?, ?, ?, ?, ?)`, 'pp_b_wallet', 'proj_b', 'psp_mock_wallet', 1, 1);

    // A plan for Project A
    await db.run(`INSERT INTO plan (id, project_id, name, amount, currency, interval) VALUES (?, ?, ?, ?, ?, ?)`, 'plan_a_pro', 'proj_a', 'Pro Monthly', 999, 'EUR', 'month');

    console.log(`Seeded ${filename}: 2 psps, 2 projects, 3 project_psp, 1 plan`);
    await db.close();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
