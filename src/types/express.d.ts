import { JwtUserPayload } from '../config/jwt';
import type { ResolvedClause } from '../services/clauses.service';

declare global {
  namespace Express {
    interface UserPayload extends JwtUserPayload {}
    interface Request {
      user?: UserPayload;
      resolvedClauses?: ResolvedClause[];
    }
  }
}

export {};
