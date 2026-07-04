import { Router } from 'express';
import { getCheckoutOptionsController } from '../controllers/checkoutController';
import { authProject } from '../middlewares';

export const checkoutRouter = Router();

checkoutRouter.get('/options', authProject, getCheckoutOptionsController);
