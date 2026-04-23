import { logger } from './logger';

type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitBreakerOptions {
  failureThreshold?: number;
  successThreshold?: number;
  timeoutMs?: number;
  name: string;
}

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;

  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly timeoutMs: number;
  private readonly name: string;

  constructor(opts: CircuitBreakerOptions) {
    this.name = opts.name;
    this.failureThreshold = opts.failureThreshold ?? 5;
    this.successThreshold = opts.successThreshold ?? 2;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
  }

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime >= this.timeoutMs) {
        this.state = 'half-open';
        this.successCount = 0;
        logger.info(`[circuit-breaker] ${this.name} → half-open`);
      } else {
        throw Object.assign(
          new Error(`Service temporarily unavailable: ${this.name}`),
          { code: 'CIRCUIT_OPEN', status: 503 },
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess() {
    if (this.state === 'half-open') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = 'closed';
        this.failureCount = 0;
        logger.info(`[circuit-breaker] ${this.name} → closed`);
      }
    } else {
      this.failureCount = 0;
    }
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.state === 'half-open' || this.failureCount >= this.failureThreshold) {
      this.state = 'open';
      logger.error(`[circuit-breaker] ${this.name} → open (${this.failureCount} failures)`);
    }
  }

  get status(): CircuitState {
    return this.state;
  }
}

// Singletons para cada servicio externo
export const stripeBreaker = new CircuitBreaker({ name: 'stripe', failureThreshold: 3, timeoutMs: 20_000 });
export const emailBreaker = new CircuitBreaker({ name: 'email', failureThreshold: 5, timeoutMs: 60_000 });
export const signatureBreaker = new CircuitBreaker({ name: 'signature', failureThreshold: 3, timeoutMs: 30_000 });
export const smsBreaker = new CircuitBreaker({ name: 'sms', failureThreshold: 5, timeoutMs: 60_000 });
