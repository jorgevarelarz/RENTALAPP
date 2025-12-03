import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

// Permit a deterministic secret in tests/Jest if none provided
if (
  !process.env.JWT_SECRET &&
  (process.env.NODE_ENV === 'test' || typeof process.env.JEST_WORKER_ID !== 'undefined')
  ) {
  process.env.JWT_SECRET = 'test-secret-change-me';
}

const envSecret = process.env.JWT_SECRET;
const isJest = typeof process.env.JEST_WORKER_ID !== 'undefined';
const isTest = process.env.NODE_ENV === 'test' || isJest;
const secret = envSecret || (isTest ? 'test-secret-change-me' : undefined);

if (!secret) {
  throw new Error('JWT_SECRET env var is required');
}
if (!isTest && secret.length < 16) {
  throw new Error('JWT_SECRET must be at least 16 characters long');
}

export const JWT_SECRET = secret;

export interface JwtUserPayload {
  id: string;
  _id?: string;
  role: 'tenant' | 'landlord' | 'pro' | 'admin' | 'professional';
  isVerified?: boolean;
}

export const signToken = (payload: JwtUserPayload, opts?: jwt.SignOptions) =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: '7d', ...opts });

export const verifyToken = (token: string): JwtUserPayload =>
  jwt.verify(token, JWT_SECRET) as JwtUserPayload;
