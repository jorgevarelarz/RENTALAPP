import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import propertyRoutes from './routes/property.routes';
import contractRoutes from './routes/contract.routes';
import userRoutes from './routes/user.routes';
import adminRoutes from './routes/admin.routes';
import proRoutes from './routes/pro.routes';
import ticketRoutes from './routes/ticket.routes';

// Load environment variables
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/contracts', contractRoutes);
// User management routes
app.use('/api/users', userRoutes);
// Admin functionality
app.use('/api/admin', adminRoutes);
app.use('/api', proRoutes);
app.use('/api/tickets', ticketRoutes);

const PORT = process.env.PORT || 3000;

// Connect to MongoDB and start the server
mongoose
  .connect(process.env.MONGO_URI || '')
  .then(() =>
    app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`)),
  )
  .catch(err => console.error('Error al conectar a MongoDB:', err));