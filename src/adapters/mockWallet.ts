import { MockPspAdapter } from './mockBase';
import type { Capabilities, PaymentNextAction } from './types';

/** Redirect-style provider: no subscriptions, confirmation via a redirect URL. */
export class MockWalletAdapter extends MockPspAdapter {
    readonly code = 'mock_wallet';
    readonly capabilities: Capabilities = { oneTime: true, subscription: false };

    protected paymentNextAction(pspReference: string): PaymentNextAction {
        return { redirectUrl: `https://mock-wallet.psp/pay/${pspReference}` };
    }
}
