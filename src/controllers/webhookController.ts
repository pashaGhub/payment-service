import { RequestHandler } from 'express';
import { processWebhook } from '../services/webhookService';

export const handleWebhookController: RequestHandler = async (req, res, next) => {
    try {
        await processWebhook(String(req.params.pspCode), req.body);
        // ACK fast; the state change was reconciled (or the event was a duplicate).
        res.status(200).json({ received: true });
    } catch (err) {
        next(err);
    }
};
