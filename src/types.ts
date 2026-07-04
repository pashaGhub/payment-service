export type PaymentStatus = 'pending' | 'requires_action' | 'succeeded' | 'failed';

export type SubscriptionStatus = 'pending' | 'active' | 'past_due' | 'canceled';

/** A tenant of the service, attached to the request by the auth middleware. */
export interface Project {
    id: string;
    name: string;
    apiKeyHash: string;
    createdAt: string;
}

declare global {
    namespace Express {
        interface Request {
            project?: Project;
        }
    }
}
