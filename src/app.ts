import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';

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
import postsignRouter from './routes/postsign';
import tenantProRoutes from './routes/tenantPro.routes';
import tenantProMeRoutes from './routes/tenantPro.me';
import adminTenantProRoutes from './routes/admin.tenantPro.routes';
import { purgeOldTenantProDocs } from './jobs/tenantProRetention';

import helmet from 'helmet';
import hpp from 'hpp';
import rateLimit from 'express-rate-limit';
import { requestId } from './middleware/requestId';
import { loadEnv } from './config/env';
import { metricsMiddleware, metricsHandler } from './metrics';

// Load environment variables
dotenv.config();
const env = loadEnv();

const app = express();
// Endurecer cabeceras y parámetros
app.disable('x-powered-by');
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy:
      process.env.NODE_ENV === 'production'
        ? {
            useDefaults: true,
            directives: {
              defaultSrc: ["'self'"],
              imgSrc: ["'self'", 'data:', 'https:', 'http:'],
              scriptSrc: ["'self'", "'unsafe-inline'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              connectSrc: [
                "'self'",
                ...(process.env.CORS_ORIGIN || '')
                  .split(',')
                  .map(s => s.trim())
                  .filter(Boolean),
              ],
            },
          }
        : false,
    hsts: process.env.NODE_ENV === 'production' ? undefined : false,
  }),
);

// ID de solicitud para trazabilidad
app.use(requestId);
// Compresión (si el paquete está disponible)
let compressionFn: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  compressionFn = require('compression');
} catch {}
if (compressionFn) {
  app.use(compressionFn());
}
app.use(metricsMiddleware);

app.use(morgan('dev'));

// Stripe webhook BEFORE JSON parser (uses express.raw)
app.use('/api', stripeWebhookRoutes);

// CORS: configurar orígenes desde CORS_ORIGIN (coma-separado). En producción, sin fallback amplio.
const allowedOrigins = (process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000,http://localhost:3001'))
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : false,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: [
    'Content-Type', 'Authorization', 'X-Requested-With', 'x-admin', 'x-user-id'
  ],
  exposedHeaders: ['Content-Disposition'],
  credentials:true
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
// Proteger contra HTTP Parameter Pollution en query; no tocar body JSON para evitar falsos positivos
app.use(hpp({ checkBody: false, checkQuery: true }));
// Serve uploaded files
app.use('/uploads', express.static('uploads'));

const tenantProLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/tenant-pro', tenantProLimiter);

const tenantProConsentVersion = process.env.TENANT_PRO_CONSENT_VERSION || 'v1';

app.get('/api/legal/tenant-pro-consent', (_req, res) => {
  const consentPath = path.resolve(process.cwd(), `legal/pro-consent_${tenantProConsentVersion}.md`);
  try {
    const content = fs.readFileSync(consentPath, 'utf-8');
    res.json({ version: tenantProConsentVersion, content });
  } catch (error) {
    console.error('No se pudo servir el consentimiento Tenant PRO:', error);
    res.status(500).json({ error: 'consent-text-unavailable', version: tenantProConsentVersion });
  }
});

app.get('/health', (_req, res) =>
  res.json({ ok: true, env: process.env.NODE_ENV, mongo: { state: mongoose.connection.readyState } }),
);
// Alias: /api/health redirige al endpoint canónico /health (evita romper clientes antiguos)
app.get('/api/health', (_req, res) => res.redirect(301, '/health'));
app.get('/metrics', metricsHandler);

// Public routes
app.use('/api/auth', authRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/kyc', identityRoutes);
app.use('/api', propertyRoutes);
app.use('/api', clausesRoutes);
app.use('/api', uploadRoutes);
app.use('/api', demoContractRoutes);
app.use('/api', notifyRoutes);
app.use('/api', authenticate, postsignRouter);
app.use('/api', tenantProRoutes);
app.use('/api', tenantProMeRoutes);
app.use('/api', requireVerified, appointmentsFlowRoutes);

// Protected routes (verified users)
app.use('/api/contracts', requireVerified, contractRoutes);
app.use('/api/users', requireVerified, userRoutes);
app.use('/api/pros', requireVerified, proRoutes);
// Tickets necesitan usuario autenticado; permitir bypass de verificación en test si aplica
app.use('/api/tickets', authenticate, requireVerified, ticketRoutes);
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

// Root route for health check
app.get('/', (_req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'RENTALAPP API is running',
    timestamp: new Date().toISOString()
  });
});

// 404 handler for undefined routes
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use(errorHandler);

export { app };
export default app;

// Start server if this file is run directly
if (require.main === module) {
  const PORT = Number(process.env.PORT) || 3000;  
  // Connect to MongoDB
  mongoose.connect(process.env.MONGO_URL || '')
    .then(async () => {
      console.log('MongoDB connected');

async function runSeedIfNeeded() {
  console.log('SEED CHECK RUN_SEED:', process.env.RUN_SEED);

  if (process.env.RUN_SEED !== 'true') {
    return;
  }

  try {
    console.log('RUN_SEED is true. Executing seed.');
    const { default: runSeed } = await import('./seed/seed-beta');
    await runSeed();
    console.log('Seed execution finished.');
  } catch (err) {
    console.error('Seed execution failed:', err);
    throw err;
  }
}

          await runSeedIfNeeded();
    })
    .catch((error) => {
      console.error('MongoDB connection error:', error);
      process.exit(1);
    });
  // Trigger Railway deployment
}
