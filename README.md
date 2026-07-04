# Payment Service

A multi-tenant payment service exposing a unified API over interchangeable
payment providers (PSPs). Each project (tenant) enables its own combination of
PSPs, and drives one-time payments and subscriptions through a common adapter
interface. Providers are represented by **mock adapters** so the service runs
end-to-end without real credentials.

## Quick start

```bash
npm install
cp .example.env .env      # PORT, DB_PATH, NODE_ENV
npm run seed              # create the SQLite schema + example data
npm run dev               # start on http://localhost:3000
```

## Testing

```bash
npm test
```

Tests are **self-contained** — no `.env` required:

- `npm test` seeds a **separate** test database (`NODE_ENV=test` →
  `./data/payments.test.db`) before running Jest, so it never touches your dev db.
- PSP webhook secrets fall back to mock defaults, so signature checks work out of
  the box.

Coverage is collected on every run; open the HTML report with:

```bash
npm run coverage        # or: npm run test:coverage  (run tests, then open)
```

> After a **schema change**, run `npm run clean-db` first (or `npm run reseed`)

## Example projects (seeded)

The seed creates two tenants with **different PSP combinations**, which is why
their checkout options differ. Only the sha256 hash of each API key is stored.

| Project   | API key (raw)      | Enabled PSPs               |
| --------- | ------------------ | -------------------------- |
| Project A | `pk_test_projectA` | `mock_card`                |
| Project B | `pk_test_projectB` | `mock_card`, `mock_wallet` |

Authenticate with `Authorization: Bearer <api key>` (or `X-Api-Key: <api key>`).

### Checkout options reflect the per-project PSP set

The same request returns a different set of PSPs depending on which project's key
is used.

**Project A** — only `mock_card`:

```bash
curl -s localhost:3000/api/checkout/options \
  -H "Authorization: Bearer pk_test_projectA"
```

```jsonc
{
  "options": [
    {
      "pspCode": "mock_card",
      "displayName": "Mock Card",
      "supports": { "oneTime": true, "subscription": true },
    },
  ],
}
```

**Project B** — `mock_card` + `mock_wallet` (in display order):

```bash
curl -s localhost:3000/api/checkout/options \
  -H "Authorization: Bearer pk_test_projectB"
```

```jsonc
{
  "options": [
    {
      "pspCode": "mock_card",
      "displayName": "Mock Card",
      "supports": { "oneTime": true, "subscription": true },
    },
    {
      "pspCode": "mock_wallet",
      "displayName": "Mock Wallet",
      "supports": { "oneTime": true, "subscription": false },
    },
  ],
}
```

## API reference

All routes are under `/api`. Every endpoint except the webhook requires the
project API key via `Authorization: Bearer <key>` (or `X-Api-Key: <key>`); the
webhook is authenticated by the provider signature instead. Request bodies are
validated with Zod (unknown keys are stripped); responses are validated too.

**Layering:** `routes → controllers → services → db`.

**Money:** `amount` is always an integer in the currency's minor units per its
ISO-4217 exponent (e.g. `999` = €9.99; note JPY is whole, KWD is 1/1000).

**Error envelope:**

```jsonc
// 400 request validation (Zod)
{ "status": "fail", "errors": [{ "field": "amount", "message": "..." }] }
// any other error (401 / 404 / 400 business rule / 500)
{ "message": "PSP 'mock_wallet' is not enabled for this project" }
```

---

### GET /api/checkout/options

PSPs enabled for the calling project, in display order (drives the checkout page).

- **Auth:** required · **Request body:** none

```jsonc
// 200 OK
{
  "options": [
    {
      "pspCode": "mock_card",
      "displayName": "Mock Card",
      "supports": { "oneTime": true, "subscription": true },
    },
  ],
}
```

- **Errors:** `401` missing/invalid key

---

### POST /api/payments

Create a one-time payment through the selected PSP.

- **Auth:** required

```jsonc
// Request
{
  "pspCode": "mock_card", // string — must be enabled for the project
  "amount": 999, // integer > 0, minor units
  "currency": "EUR", // 3-letter ISO-4217
  "customer": {
    "externalRef": "user-42", // your id for the payer
    "email": "buyer@example.com",
  },
  "metadata": { "orderId": "A-91" }, // optional string→string map
  "idempotencyKey": "idem-123", // optional — repeat returns the same payment
}
```

```jsonc
// 201 Created
{
  "paymentId": "pay_9f1c...",
  "status": "requires_action", // pending | requires_action | succeeded | failed
  "nextAction": { "clientSecret": "cs_mock_..." }, // or { "redirectUrl": "..." }, if any
}
```

- **Errors:** `400` validation / `pspCode` not enabled · `401` auth

---

### GET /api/payments/:id

Fetch a payment (scoped to the calling project).

- **Auth:** required · **Request body:** none

```jsonc
// 200 OK
{ "paymentId": "pay_9f1c...", "status": "succeeded" }
```

- **Errors:** `401` auth · `404` not found / belongs to another project

---

### POST /api/subscriptions

Create a subscription against a project-owned plan through the selected PSP.

- **Auth:** required

```jsonc
// Request
{
  "pspCode": "mock_card", // must be enabled AND subscription-capable
  "planId": "plan_a_pro", // must belong to the project
  "customer": { "externalRef": "user-42", "email": "buyer@example.com" },
  "metadata": { "tier": "pro" }, // optional
}
```

```jsonc
// 201 Created
{
  "subscriptionId": "sub_4b7e...",
  "status": "pending", // pending | active | past_due | canceled
  "nextAction": { "redirectUrl": "https://mock.psp/..." }, // if any
}
```

- **Errors:** `400` validation / PSP not enabled / PSP lacks subscription support /
  unknown plan · `401` auth

---

### GET /api/subscriptions/:id

Fetch a subscription (scoped to the calling project).

- **Auth:** required · **Request body:** none

```jsonc
// 200 OK
{ "subscriptionId": "sub_4b7e...", "status": "active" }
```

- **Errors:** `401` auth · `404` not found / belongs to another project

---

### POST /api/webhooks/:pspCode

Inbound provider callback. **No API key** — authenticated by the adapter's
signature check against the service's per-PSP webhook secret. The event is
recorded before its effect is applied, so replaying the same `eventId` is a no-op.

```jsonc
// Request (mock envelope)
{
  "eventId": "evt_1", // provider event id — dedupe key
  "pspReference": "mock_card_pay_...", // provider id of the payment/subscription
  "kind": "payment", // "payment" | "subscription"
  "status": "succeeded", // new status to reconcile to
  "signature": "<hmac-sha256(secret, eventId)>",
}
```

```jsonc
// 200 OK  (also returned for a duplicate replay)
{ "received": true }
```

- **Errors:** `400` validation / unknown PSP / bad signature

---

## Scripts

| Command                  | Description                                                  |
| ------------------------ | ------------------------------------------------------------ |
| `npm run dev`            | Run in watch mode with nodemon + ts-node (`src/index.ts`)    |
| `npm run build`          | Compile TypeScript to `build/`                               |
| `npm start`              | Run the compiled server (`build/index.js`) — build first     |
| `npm run seed`           | (Re)create the schema and seed example data (`NODE_ENV=dev`) |
| `npm run clean-db`       | Delete the `data/` directory (all SQLite db files)           |
| `npm run reseed`         | Clean the db, then seed fresh — use after a schema change    |
| `npm test`               | Seed the test db (`NODE_ENV=test`), then run Jest + coverage |
| `npm run coverage`       | Open the HTML coverage report in the browser                 |
| `npm run test:coverage`  | Run the test suite, then open the coverage report            |
| `npm run prettier-fix`   | Format all files with Prettier                               |
| `npm run prettier-check` | Check formatting without writing                             |

## Roadmap (Nice to have)

Next steps and open questions to revisit:

- **Tooling:** add a Husky `pre-push` hook that runs ESLint and Prettier
  (`prettier-check`) so unformatted / lint-failing code can't be pushed.
- **Test environment:** formalize how tests get their config. Today the test db
  path and PSP secrets rely on hard-coded defaults, and `.env` is not loaded by
  Jest — decide on a single source (e.g. a Jest `setupFiles` / `.env.test`,
  per-suite db isolation, and automatic teardown) so test config can't silently
  drift from what the app uses.
- **Reads & column types:** design the read side of the database and revisit the
  column types (e.g. numeric vs text for money/timestamps, enums for `status`,
  proper indexes on lookup columns like `psp_reference` and `idempotency_key`).
- **Per-project PSP credentials:** reconsider whether each project needs its own
  PSP account credentials instead of the service using a single shared account
  per PSP. If so, credentials move back to a per-`project_psp` secret (encrypted
  / secret-manager reference) and the webhook secret resolution changes with it.
- **Relationships to revisit:**
  - `plan` ↔ `project` — should this become many-to-many (shared/global plans
    reusable across projects) rather than a plan belonging to a single project?
  - Related: how plans map to PSP-side prices, and whether `customer` should be
    shared across projects or stay project-scoped.
