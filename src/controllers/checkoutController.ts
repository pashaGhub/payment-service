import { RequestHandler } from 'express';
import { respond } from '../middlewares';
import { CheckoutOptionsResponse } from '../schemas';
import { getCheckoutOptions } from '../services/checkoutService';

export const getCheckoutOptionsController: RequestHandler = async (req, res, next) => {
    try {
        const options = await getCheckoutOptions(req.project!.id);
        respond(res, CheckoutOptionsResponse, options);
    } catch (err) {
        next(err);
    }
};
