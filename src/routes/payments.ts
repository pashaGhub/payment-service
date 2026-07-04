import { Router } from 'express';
import { createPaymentController, getPaymentController } from '../controllers/paymentController';
import { authProject, validateReq } from '../middlewares';
import { CreatePaymentRequest } from '../schemas';

export const paymentsRouter = Router();

paymentsRouter.post('/', authProject, validateReq(CreatePaymentRequest), createPaymentController);
paymentsRouter.get('/:id', authProject, getPaymentController);
