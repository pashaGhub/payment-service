import { MockPspAdapter } from './mockBase';
import type { Capabilities, PaymentNextAction } from './types';

/** SDK/embedded-style provider: confirmation via a client secret. */
export class MockCardAdapter extends MockPspAdapter {
    readonly code = 'mock_card';
    readonly capabilities: Capabilities = { oneTime: true, subscription: true };

    protected paymentNextAction(pspReference: string): PaymentNextAction {
        return { clientSecret: `cs_mock_${pspReference}` };
    }
}
