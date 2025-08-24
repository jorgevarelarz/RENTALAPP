import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
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

// Load environment variables
dotenv.config();

const app = express();
app.use(cors());
app.use('/api', stripeWebhookRoutes);
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/kyc', identityRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/contracts', requireVerified, contractRoutes);
// User management routes
app.use('/api/users', requireVerified, userRoutes);
// Admin functionality
app.use('/api/admin', requireVerified, requireAdmin, adminRoutes, adminEarningsRoutes);
app.use('/api/pros', requireVerified, proRoutes);
app.use('/api/tickets', requireVerified, ticketRoutes);
app.use('/api/reviews', requireVerified, reviewRoutes);
app.use('/api', requireVerified, connectRoutes);
app.use('/api', requireVerified, paymentsRoutes);
app.use('/api', requireVerified, contractPaymentsRoutes);
app.use('/api', requireVerified, signatureRoutes);

const PORT = process.env.PORT || 3000;

// Connect to MongoDB and start the server
mongoose
  .connect(process.env.MONGO_URI || '')
  .then(() =>
    app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`)),
  )
  .catch(err => console.error('Error al conectar a MongoDB:', err));
