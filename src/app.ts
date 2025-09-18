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
import { authenticate } from './middleware/auth.middleware';

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
import appointmentsFlowRoutes from './routes/appointments.routes';
import uploadRoutes from './routes/upload.routes';
import clausesRoutes from './routes/clauses.routes';
import notifyRoutes from './routes/notify.routes';
import tenantProRoutes from './routes/tenantPro.routes';
import adminTenantProRoutes from './routes/admin.tenantPro.routes';
import { purgeOldTenantProDocs } from './jobs/tenantProRetention';

import helmet from 'helmet';

// Load environment variables
dotenv.config();

const app = express();
app.use(helmet());

app.use(morgan('dev'));

// Stripe webhook BEFORE JSON parser (uses express.raw)
app.use('/api', stripeWebhookRoutes);

// CORS: permite configurar orígenes desde CORS_ORIGIN (coma-separado). Por defecto, 3000 para CRA.
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:3001')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  // Let the browser echo back requested headers to avoid preflight issues
  allowedHeaders: undefined,
  credentials:true
}));
app.use(express.json());
// Serve uploaded files
app.use('/uploads', express.static('uploads'));

app.get('/health', (_req, res) => res.json({ ok: true }));

// Public routes
app.use('/api/auth', authRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/kyc', identityRoutes);
app.use('/api', propertyRoutes);
app.use('/api', clausesRoutes);
app.use('/api', uploadRoutes);
app.use('/api', demoContractRoutes);
app.use('/api', notifyRoutes);
app.use('/api', tenantProRoutes);
app.use('/api', requireVerified, appointmentsFlowRoutes);

// Protected routes (verified users)
app.use('/api/contracts', requireVerified, contractRoutes);
app.use('/api/users', requireVerified, userRoutes);
app.use('/api/pros', requireVerified, proRoutes);
app.use('/api/tickets', requireVerified, ticketRoutes);
app.use('/api/reviews', requireVerified, reviewRoutes);
app.use('/api/chat', requireVerified, chatRoutes);
// Contract-specific payments under /api/contracts require verificación
app.use('/api/contracts', requireVerified, contractPaymentsRoutes);
app.use('/api', paymentsRoutes);
app.use('/api', requireVerified, connectRoutes);
app.use('/api', requireVerified, signatureRoutes);
app.use('/api', requireVerified, serviceOfferRoutes);

// Admin
app.use(
  '/api/admin',
  authenticate,
  requireVerified,
  requireAdmin,
  adminRoutes,
  adminEarningsRoutes,
  adminTenantProRoutes,
);

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
const mongoUrl = process.env.MONGO_URL || process.env.MONGO_URI || '';

let server: any;

if (mongoUrl) {
  mongoose
    .connect(mongoUrl)
    .then(() => {
      if (process.env.NODE_ENV !== 'test') {
        server = app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
        setInterval(() => purgeOldTenantProDocs().catch(() => {}), 6 * 60 * 60 * 1000);
      }
    })
    .catch(err => console.error('Error al conectar a MongoDB:', err));
} else if (process.env.NODE_ENV !== 'test') {
  console.warn('Mongo URL no configurada; la conexión a la base de datos se omitirá');
}
 

export { app, server };
export default app;
