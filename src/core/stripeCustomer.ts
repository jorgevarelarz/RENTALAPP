import logger from '../utils/logger';
import { getStripeClient, isStripeConfigured } from '../utils/stripe';
import { User } from '../models/user.model';

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 5_000;
const MAX_DELAY_MS = 60_000;
const scheduledRetries = new Map<string, NodeJS.Timeout>();

type AutoMode = 'lazy' | 'eager' | 'off';

function getAutoCreateMode(): AutoMode {
  const value = (process.env.STRIPE_AUTOCREATE_MODE || 'lazy').toLowerCase();
  if (value === 'eager' || value === 'off') return value;
  return 'lazy';
}

function computeDelay(attempt: number) {
  const safeAttempt = Math.max(1, attempt);
  const delay = BASE_DELAY_MS * Math.pow(2, safeAttempt - 1);
  return Math.min(delay, MAX_DELAY_MS);
}

function cancelScheduledRetry(userId: string) {
  const pending = scheduledRetries.get(userId);
  if (pending) {
    clearTimeout(pending);
    scheduledRetries.delete(userId);
  }
}

function scheduleRetry(userId: string, attempt: number, trigger: string) {
  if (attempt >= MAX_ATTEMPTS) {
    logger.warn({ userId, attempt }, '[stripe] Max retry attempts reached, not scheduling');
    return;
  }
  if (scheduledRetries.has(userId)) return;
  const delay = computeDelay(attempt);
  logger.info({ userId, attempt, delay }, '[stripe] Scheduling customer creation retry');
  const timeout = setTimeout(async () => {
    scheduledRetries.delete(userId);
    try {
      await ensureStripeCustomerForUser(userId, `${trigger}:retry`, { allowRetry: true });
    } catch (err) {
      logger.error({ err, userId }, '[stripe] Retry ensureStripeCustomerForUser threw');
    }
  }, delay);
  scheduledRetries.set(userId, timeout);
}

interface EnsureOptions {
  allowRetry?: boolean;
}

export async function ensureStripeCustomerForUser(
  userId: string,
  trigger: string,
  options: EnsureOptions = {},
) {
  const mode = getAutoCreateMode();
  if (mode === 'off') {
    logger.debug({ userId, trigger }, '[stripe] Autocreation disabled (mode=off)');
    return { status: 'disabled' as const };
  }

  const user = await User.findById(userId);
  if (!user) {
    logger.warn({ userId, trigger }, '[stripe] Cannot ensure customer, user not found');
    return { status: 'user_not_found' as const };
  }

  if (user.stripeCustomerId) {
    if (user.stripeCustomerPending || (user.stripeCustomerRetries ?? 0) !== 0) {
      user.stripeCustomerPending = false;
      user.stripeCustomerRetries = 0;
      await user.save();
    }
    cancelScheduledRetry(userId);
    return { status: 'already_exists' as const, customerId: user.stripeCustomerId };
  }

  if (!isStripeConfigured()) {
    logger.warn({ userId, trigger }, '[stripe] Stripe not configured, skipping customer creation');
    user.stripeCustomerPending = true;
    await user.save();
    return { status: 'stripe_unavailable' as const };
  }

  try {
    const stripe = getStripeClient();
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: {
        appUserId: String(user._id || user.id),
        trigger,
        mode,
      },
    });

    user.stripeCustomerId = customer.id;
    user.stripeCustomerPending = false;
    user.stripeCustomerRetries = 0;
    await user.save();
    cancelScheduledRetry(userId);
    logger.info({ userId, trigger, customerId: customer.id }, '[stripe] Created customer');
    return { status: 'created' as const, customerId: customer.id };
  } catch (err: any) {
    logger.error({ err, userId, trigger }, '[stripe] Error creating customer');
    if (options.allowRetry === false) {
      return { status: 'error', error: err } as const;
    }
    const nextAttempt = (user.stripeCustomerRetries ?? 0) + 1;
    user.stripeCustomerPending = true;
    user.stripeCustomerRetries = nextAttempt;
    await user.save();
    if (nextAttempt < MAX_ATTEMPTS) {
      scheduleRetry(userId, nextAttempt, trigger);
    }
    return { status: 'queued' as const, error: err };
  }
}

export function resetStripeCustomerRetryStateForTests() {
  scheduledRetries.forEach(timeout => clearTimeout(timeout));
  scheduledRetries.clear();
}
