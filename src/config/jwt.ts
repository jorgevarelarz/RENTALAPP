import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const secret = process.env.JWT_SECRET;
if (!secret) {
  throw new Error('JWT_SECRET env var is required');
}
if (secret.length < 16) {
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
