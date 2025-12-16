import type { JwtPayload } from 'jsonwebtoken';

declare global {
  namespace Express {
    interface UserPayload extends JwtPayload {
      id?: string;
      _id?: string;
      email?: string;
      role?: string;
      isVerified?: boolean;
    }

    interface Request {
      user?: UserPayload;
    }
  }
}

export {};
