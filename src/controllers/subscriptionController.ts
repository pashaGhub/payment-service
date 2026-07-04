import { RequestHandler } from 'express';
import { respond } from '../middlewares';
import { CreateSubscriptionResponse } from '../schemas';
import { createSubscription, getSubscription } from '../services/subscriptionService';

export const createSubscriptionController: RequestHandler = async (req, res, next) => {
    try {
        const result = await createSubscription(req.project!, req.body);
        respond(res, CreateSubscriptionResponse, result, 201);
    } catch (err) {
        next(err);
    }
};

export const getSubscriptionController: RequestHandler = async (req, res, next) => {
    try {
        const result = await getSubscription(req.project!, String(req.params.id));
        respond(res, CreateSubscriptionResponse, result);
    } catch (err) {
        next(err);
    }
};
