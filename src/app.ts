import express from 'express';
import { errorHandler } from './middlewares';
import { checkoutRouter } from './routes/checkout';
import { paymentsRouter } from './routes/payments';
import { subscriptionsRouter } from './routes/subscriptions';
import { webhooksRouter } from './routes/webhooks';

export const app = express();

app.use(express.json());
app.use('/api/checkout', checkoutRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/webhooks', webhooksRouter);
app.use(errorHandler);
