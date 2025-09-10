import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import morgan from 'morgan';

import authRoutes from './routes/auth.routes';
import propertyRoutes from './routes/property.routes';
import contractRoutes from './routes/contract.routes';
import userRoutes from './routes/user.routes';
import adminRoutes from './routes/admin.routes';

import adminEarningsRoutes from './routes/admin.earnings.routes';
import { requireAdmin } from './middleware/requireAdmin';

import proRoutes from './routes/pro.routes';
import ticketRoutes from './routes/ticket.routes';
import reviewRoutes from './routes/review.routes';
import verificationRoutes from './routes/verification.routes';
import { requireVerified } from './middleware/requireVerified';

import connectRoutes from './routes/connect.routes';
import paymentsRoutes from './routes/payments.routes';
import contractPaymentsRoutes from './routes/contract.payments.routes';
import stripeWebhookRoutes from './routes/stripe.webhook';
import identityRoutes from './routes/identity.routes';
import signatureRoutes from './routes/signature.routes';
import chatRoutes from './routes/chat.routes';
import serviceOfferRoutes from './routes/serviceOffers.routes';
import demoContractRoutes from './routes/demoContract.routes';
import { errorHandler } from './middleware/errorHandler';

// Load environment variables
dotenv.config();

const app = express();

app.use(morgan('dev'));

// Stripe webhook BEFORE JSON parser (uses express.raw)
app.use('/api', stripeWebhookRoutes);

app.use(cors({
  origin:'http://localhost:3001',
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-user-id"],
  credentials:true
}));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

// Public routes
app.use('/api/auth', authRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/kyc', identityRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api', demoContractRoutes);

// Protected routes (verified users)
app.use('/api/contracts', requireVerified, contractRoutes);
app.use('/api/users', requireVerified, userRoutes);
app.use('/api/pros', requireVerified, proRoutes);
app.use('/api/tickets', requireVerified, ticketRoutes);
app.use('/api/reviews', requireVerified, reviewRoutes);
app.use('/api/chat', requireVerified, chatRoutes);
app.use('/api', requireVerified, contractPaymentsRoutes);
app.use('/api', paymentsRoutes);
app.use('/api', requireVerified, connectRoutes);
app.use('/api', requireVerified, signatureRoutes);
app.use('/api', requireVerified, serviceOfferRoutes);

// Admin
app.use('/api/admin', requireVerified, requireAdmin, adminRoutes, adminEarningsRoutes);

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
const mongoUrl = process.env.MONGO_URL || process.env.MONGO_URI || '';

let server: any;

mongoose
  .connect(mongoUrl)
  .then(() => {
    if (process.env.NODE_ENV !== 'test') {
      server = app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
    }
  })
  .catch(err => console.error('Error al conectar a MongoDB:', err));
 

export { app, server };
export default app;
