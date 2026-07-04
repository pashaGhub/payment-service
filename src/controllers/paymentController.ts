import { RequestHandler } from 'express';
import { respond } from '../middlewares';
import { CreatePaymentResponse } from '../schemas';
import { createPayment, getPayment } from '../services/paymentService';

export const createPaymentController: RequestHandler = async (req, res, next) => {
    try {
        const result = await createPayment(req.project!, req.body);
        respond(res, CreatePaymentResponse, result, 201);
    } catch (err) {
        next(err);
    }
};

export const getPaymentController: RequestHandler = async (req, res, next) => {
    try {
        const result = await getPayment(req.project!, String(req.params.id));
        respond(res, CreatePaymentResponse, result);
    } catch (err) {
        next(err);
    }
};
