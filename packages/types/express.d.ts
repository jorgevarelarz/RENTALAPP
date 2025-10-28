import { Logger } from 'pino';

declare module 'express-serve-static-core' {
  interface Request {
    logger?: Logger;
  }
}
