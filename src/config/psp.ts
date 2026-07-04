/**
 * The payment service holds its *own* account credentials per PSP (not per
 * project) in the environment. Keys follow `PSP_<CODE>_API_KEY` and
 * `PSP_<CODE>_WEBHOOK_SECRET`, e.g. `PSP_MOCK_CARD_WEBHOOK_SECRET`.
 *
 * Mock defaults keep the service runnable out of the box; real providers must
 * set the vars explicitly.
 */
export interface PspCredentials {
    apiKey: string;
    webhookSecret: string;
}

export function getPspCredentials(pspCode: string): PspCredentials {
    const prefix = `PSP_${pspCode.toUpperCase()}`;
    return {
        apiKey: process.env[`${prefix}_API_KEY`] ?? 'mock_api_key',
        webhookSecret: process.env[`${prefix}_WEBHOOK_SECRET`] ?? 'whsec_mock',
    };
}
