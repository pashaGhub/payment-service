-- Payment service schema (SQLite). Single source of DDL, applied by both
-- src/db/migrate.ts (app startup) and db/seed.js. Idempotent via IF NOT EXISTS.
-- Foreign keys are only enforced when `PRAGMA foreign_keys = ON` is set per connection.

-- Tenants using the service
CREATE TABLE IF NOT EXISTS project (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  api_key_hash  TEXT NOT NULL UNIQUE,
  created_at    TEXT NOT NULL
);

-- Catalog of providers the service can talk to
CREATE TABLE IF NOT EXISTS psp (
  id                    TEXT PRIMARY KEY,
  code                  TEXT NOT NULL UNIQUE,     -- "mock_card", "mock_wallet"
  display_name          TEXT NOT NULL,
  supports_one_time     INTEGER NOT NULL,         -- 0/1
  supports_subscription INTEGER NOT NULL          -- 0/1
);

-- Which PSPs a given project has enabled + its per-project credentials.
-- Source of truth for a project's checkout options.
-- The service authenticates to each PSP with its *own* account credentials
-- (held in the environment, see src/config/psp.ts), so no secrets live here —
-- this table only records which PSPs a project has enabled and in what order.
CREATE TABLE IF NOT EXISTS project_psp (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES project(id),
  psp_id        TEXT NOT NULL REFERENCES psp(id),
  enabled       INTEGER NOT NULL DEFAULT 1,
  display_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (project_id, psp_id)
);

-- Payer, scoped to a project
CREATE TABLE IF NOT EXISTS customer (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL REFERENCES project(id),
  external_ref TEXT NOT NULL,                     -- the project's own user id
  email        TEXT NOT NULL,
  UNIQUE (project_id, external_ref)
);

-- Recurring plan owned by a project
CREATE TABLE IF NOT EXISTS plan (
  id             TEXT PRIMARY KEY,
  project_id     TEXT NOT NULL REFERENCES project(id),
  name           TEXT NOT NULL,
  amount         INTEGER NOT NULL,                -- integer minor units per ISO-4217 exponent
  currency       TEXT NOT NULL,
  interval       TEXT NOT NULL                    -- "month" | "year"
);

-- One-time payment
CREATE TABLE IF NOT EXISTS payment (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES project(id),
  customer_id     TEXT NOT NULL REFERENCES customer(id),
  project_psp_id  TEXT NOT NULL REFERENCES project_psp(id),
  amount          INTEGER NOT NULL,               -- integer minor units per ISO-4217 exponent
  currency        TEXT NOT NULL,
  status          TEXT NOT NULL,                  -- PaymentStatus
  psp_reference   TEXT,                           -- provider id; join key for webhooks, null until PSP responds
  idempotency_key TEXT,
  metadata        TEXT,                           -- JSON, project-defined correlation bag
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  UNIQUE (project_id, idempotency_key)
);

-- Subscription
CREATE TABLE IF NOT EXISTS subscription (
  id                   TEXT PRIMARY KEY,
  project_id           TEXT NOT NULL REFERENCES project(id),
  customer_id          TEXT NOT NULL REFERENCES customer(id),
  project_psp_id       TEXT NOT NULL REFERENCES project_psp(id),
  plan_id              TEXT NOT NULL REFERENCES plan(id),
  status               TEXT NOT NULL,             -- SubscriptionStatus
  psp_reference        TEXT,                      -- provider id; join key for webhooks
  current_period_start TEXT,
  current_period_end   TEXT,
  metadata             TEXT,                      -- JSON, project-defined correlation bag
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);

-- Idempotent inbound webhook log (inbox pattern)
CREATE TABLE IF NOT EXISTS webhook_event (
  id                TEXT PRIMARY KEY,
  psp_id            TEXT NOT NULL REFERENCES psp(id),
  provider_event_id TEXT NOT NULL,                -- from the PSP
  kind              TEXT NOT NULL,                -- "payment" | "subscription"
  psp_reference     TEXT,
  payload           TEXT NOT NULL,                -- raw JSON
  processed         INTEGER NOT NULL DEFAULT 0,
  received_at       TEXT NOT NULL,
  UNIQUE (psp_id, provider_event_id)
);
