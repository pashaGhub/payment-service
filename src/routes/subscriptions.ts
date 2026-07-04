import { Router } from 'express';
import { createSubscriptionController, getSubscriptionController } from '../controllers/subscriptionController';
import { authProject, validateReq } from '../middlewares';
import { CreateSubscriptionRequest } from '../schemas';

export const subscriptionsRouter = Router();

subscriptionsRouter.post('/', authProject, validateReq(CreateSubscriptionRequest), createSubscriptionController);
subscriptionsRouter.get('/:id', authProject, getSubscriptionController);
