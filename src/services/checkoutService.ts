import { listEnabledProjectPsps } from '../db/repositories';
import type { CheckoutOptionsResponse } from '../schemas';

/** The PSP options a project's checkout page should render, in display order. */
export async function getCheckoutOptions(projectId: string): Promise<CheckoutOptionsResponse> {
    const psps = await listEnabledProjectPsps(projectId);
    return {
        options: psps.map((psp) => ({
            pspCode: psp.pspCode,
            displayName: psp.displayName,
            supports: {
                oneTime: psp.supportsOneTime,
                subscription: psp.supportsSubscription,
            },
        })),
    };
}
