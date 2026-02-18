import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
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
import chatRoutes from './routes/chat.routes';
import serviceOfferRoutes from './routes/serviceOffers.routes';
import demoContractRoutes from './routes/demoContract.routes';
import { errorHandler } from './middleware/errorHandler';
import appointmentsFlowRoutes from './routes/appointments.routes';
import uploadRoutes from './routes/upload.routes';
import clausesRoutes from './routes/clauses.routes';
import policyRoutes from './routes/policy.routes';
import notifyRoutes from './routes/notify.routes';
import postsignRouter from './routes/postsign';
import tenantProRoutes from './routes/tenantPro.routes';
import tenantProMeRoutes from './routes/tenantPro.me';
import adminTenantProRoutes from './routes/admin.tenantPro.routes';
import institutionRoutes from './routes/institution.routes';
import { purgeOldTenantProDocs } from './jobs/tenantProRetention';
import { startContractActivationJob } from './jobs/contractActivation.job';
import { startRentGenerationJob } from './jobs/rentGeneration.job';
import applicationsRoutes from './routes/applications.routes';
import invitesRoutes from './routes/invites.routes';
import meRoutes from './routes/me.routes';
import taxReportRoutes from './routes/taxReport.routes';

import helmet from 'helmet';
import hpp from 'hpp';
import rateLimit from 'express-rate-limit';
import { requestId } from './middleware/requestId';
import { adminRateLimit } from './middleware/adminRateLimit';
import { loadEnv } from './config/env';
import { metricsMiddleware, metricsHandler } from './metrics';
import { signatureWebhook } from './controllers/contract.signature.controller';
import { authorizeRoles } from './middleware/role.middleware';
import { loadInstitutionScope } from './middleware/institutionScope';

// Load environment variables
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
              baseUri: ["'self'"],
              objectSrc: ["'none'"],
              frameAncestors: ["'self'"],
              imgSrc: [
                "'self'",
                'data:',
                'blob:',
                'https://*.stripe.com',
                'https://via.placeholder.com',
                'https://upload.wikimedia.org',
              ],
              scriptSrc: [
                "'self'",
                'https://loader.sandbox.signaturit.com',
                'https://js.stripe.com',
                'https://connect-js.stripe.com',
              ],
              styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://unpkg.com'],
              fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com', 'https://unpkg.com'],
              connectSrc: [
                "'self'",
                ...(process.env.CORS_ORIGIN || '')
                  .split(',')
                  .map(s => s.trim())
                  .filter(Boolean),
                'https://connect-js.stripe.com',
                'https://*.sandbox.signaturit.com',
                'https://api.stripe.com',
              ],
              frameSrc: [
                "'self'",
                'https://*.sandbox.signaturit.com',
                'https://js.stripe.com',
                'https://connect-js.stripe.com',
              ],
            },
          }
        : false,
    hsts: process.env.NODE_ENV === 'production' ? undefined : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }),
);

app.use((_req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

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

if (process.env.NODE_ENV !== 'test') {
  startContractActivationJob();
  startRentGenerationJob();
}

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Stripe webhook BEFORE JSON parser (uses express.raw)
app.use('/api', stripeWebhookRoutes);

// CORS: configurar orígenes desde CORS_ORIGIN (coma-separado). En producción, sin fallback amplio.
const allowedOrigins = (process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000,http://localhost:3001,http://localhost:5173,http://localhost:5174'))
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : false,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: [
    'Content-Type', 'Authorization', 'X-Requested-With', 'x-admin', 'x-user-id', 'Cache-Control'
  ],
  exposedHeaders: ['Content-Disposition'],
  credentials:true
}));

// Webhook de firma (público): necesita body parseado + rawBody para HMAC
app.post(
  '/api/contracts/signature/callback',
  express.json({
    limit: '20mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  }),
  signatureWebhook,
);

app.use(express.json({
  limit: '20mb',
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  },
}));
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

app.get('/api/legal/privacy-policy', (_req, res) => {
  const privacyPolicyPath = path.resolve(process.cwd(), 'legal/privacy-policy.md');
  try {
    const content = fs.readFileSync(privacyPolicyPath, 'utf-8');
    res.json({ content });
  } catch (error) {
    console.error('No se pudo servir la política de privacidad:', error);
    res.status(500).json({ error: 'privacy-policy-unavailable' });
  }
});

app.get('/health', (_req, res) =>
  res.json({ ok: true, env: process.env.NODE_ENV, mongo: { state: mongoose.connection.readyState } }),
);
// Alias: /api/health redirige al endpoint canónico /health (evita romper clientes antiguos)
app.get('/api/health', (_req, res) => res.redirect(301, '/health'));
app.get('/metrics', metricsHandler);

// Stripe Connect redirects (avoid 404 when APP_URL points to backend)
app.get('/connect/return', (_req, res) => {
  const target = process.env.FRONTEND_URL || 'http://localhost:3001';
  res.redirect(302, `${target}/landlord/payments?connect=success`);
});
app.get('/connect/refresh', (_req, res) => {
  const target = process.env.FRONTEND_URL || 'http://localhost:3001';
  res.redirect(302, `${target}/landlord/payments?connect=retry`);
});

// Public routes
app.use('/api/auth', authRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/kyc', identityRoutes);
app.use('/api', propertyRoutes);
app.use('/api', clausesRoutes);
app.use('/api/policies', policyRoutes);
app.use('/api', uploadRoutes);
app.use('/api', demoContractRoutes);
app.use('/api', notifyRoutes);
app.use('/api', authenticate, postsignRouter);
app.use('/api', tenantProRoutes);
app.use('/api', tenantProMeRoutes);
app.use('/api', requireVerified, appointmentsFlowRoutes);
app.use('/api', applicationsRoutes);

// Protected routes (verified users)
app.use('/api/contracts', authenticate, requireVerified, contractRoutes);
app.use('/api/users', authenticate, requireVerified, userRoutes);
app.use('/api/pros', requireVerified, proRoutes);
// Tickets necesitan usuario autenticado; permitir bypass de verificación en test si aplica
app.use('/api/tickets', authenticate, requireVerified, ticketRoutes);
app.use('/api/reviews', requireVerified, reviewRoutes);
app.use('/api/chat', authenticate, requireVerified, chatRoutes);
// Contract-specific payments under /api/contracts require verificación
app.use('/api/contracts', authenticate, requireVerified, contractPaymentsRoutes);
app.use('/api', paymentsRoutes);
app.use('/api', authenticate, requireVerified, connectRoutes);
app.use('/api', requireVerified, serviceOfferRoutes);
app.use('/api/invites', authenticate, invitesRoutes);
app.use('/api/me', authenticate, requireVerified, meRoutes);
app.use('/api', authenticate, requireVerified, taxReportRoutes);

// Institution portal (read-only)
app.use(
  '/api/institution',
  authenticate,
  authorizeRoles('institution_viewer'),
  loadInstitutionScope,
  institutionRoutes,
);

// Admin
app.use(
  '/api/admin',
  authenticate,
  requireVerified,
  requireAdmin,
  adminRateLimit,
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

if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.resolve(process.cwd(), 'frontend/build');
  const institutionDist = path.resolve(process.cwd(), 'institution-frontend/dist');

  if (fs.existsSync(institutionDist)) {
    app.use('/institution', express.static(institutionDist));
    app.get('/institution/*', (_req, res) => {
      res.sendFile(path.join(institutionDist, 'index.html'));
    });
  }

  if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.get(/^\/(?!api\/|institution\/).*/, (_req, res) => {
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  }
}

// 404 handler for undefined routes
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use(errorHandler);

export { app };
export default app;

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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function connectMongoWithRetry(uri: string, maxAttempts = 5) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 60000 });
      console.log('MongoDB connected');
      return;
    } catch (error) {
      const isLastAttempt = attempt === maxAttempts;
      console.error(
        `MongoDB connection error (attempt ${attempt}/${maxAttempts}):`,
        error,
      );
      if (isLastAttempt) {
        throw error;
      }
      await sleep(Math.min(5000 * attempt, 30000));
    }
  }
}

// Start server if this file is run directly
if (require.main === module) {
  const PORT = Number(process.env.PORT) || 3000;
  const mongoUri = process.env.MONGO_URL || process.env.MONGO_URI || '';

  if (!mongoUri) {
    console.error('MongoDB connection error: missing MONGO_URL or MONGO_URI');
    process.exit(1);
  }

  connectMongoWithRetry(mongoUri)
    .then(async () => {
      await runSeedIfNeeded();
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on port ${PORT}`);
      });
    })
    .catch((error) => {
      console.error('MongoDB connection error:', error);
      process.exit(1);
    });
}
