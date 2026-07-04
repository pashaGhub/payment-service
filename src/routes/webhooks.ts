import { Router } from 'express';
import { handleWebhookController } from '../controllers/webhookController';
import { validateReq } from '../middlewares';
import { WebhookRequest } from '../schemas';

// No `authProject`: webhooks are authenticated by the adapter's signature check.
export const webhooksRouter = Router();

webhooksRouter.post('/:pspCode', validateReq(WebhookRequest), handleWebhookController);
