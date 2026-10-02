import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { startMongoMemoryServer } from '../../src/__tests__/utils/mongoMemoryServer';
import { User } from '../../src/models/user.model';
import {
  OAuthAccountNotFoundError,
  consumeOAuthLoginCode,
  issueOAuthLoginCode,
  resolveSocialUser,
  sanitizeOAuthRedirect,
} from '../../src/services/oauth.service';

let mongo: Awaited<ReturnType<typeof startMongoMemoryServer>> | null = null;

describe('OAuth account handling', () => {
  beforeAll(async () => {
    mongo = await startMongoMemoryServer();
    await mongoose.connect(mongo.getUri());
  });

  afterEach(async () => {
    await Promise.all(Object.values(mongoose.connection.collections).map(collection => collection.deleteMany({})));
  });

  afterAll(async () => {
    await mongoose.connection.close();
    if (mongo) await mongo.stop();
  });

  it('creates a social-only account without granting KYC verification', async () => {
    const user = await resolveSocialUser(
      {
        provider: 'google',
        subject: 'google-sub-1',
        email: 'social@example.com',
        emailVerified: true,
        name: 'Social User',
      },
      'register',
      'landlord',
    );

    const stored = await User.findById(user._id).select('+passwordHash').lean();
    expect(stored?.role).toBe('landlord');
    expect(stored?.passwordHash).toBeUndefined();
    expect(stored?.isVerified).toBe(false);
    expect((stored as any)?.socialAuth?.google?.subject).toBe('google-sub-1');
    expect(stored?.emailVerifiedAt).toBeInstanceOf(Date);
  });

  it('links a verified provider to an existing account without changing its role', async () => {
    const existing = await User.create({
      name: 'Existing',
      email: 'existing@example.com',
      passwordHash: await bcrypt.hash('password', 10),
      role: 'tenant',
    });

    const linked = await resolveSocialUser(
      {
        provider: 'apple',
        subject: 'apple-sub-1',
        email: 'existing@example.com',
        emailVerified: true,
        name: 'Ignored Name',
      },
      'register',
      'pro',
    );

    expect(String(linked._id)).toBe(String(existing._id));
    expect(linked.role).toBe('tenant');
    expect((linked as any).socialAuth.apple.subject).toBe('apple-sub-1');
  });

  it('does not create an unknown account from the login screen', async () => {
    await expect(resolveSocialUser(
      {
        provider: 'google',
        subject: 'missing-sub',
        email: 'missing@example.com',
        emailVerified: true,
      },
      'login',
      'tenant',
    )).rejects.toBeInstanceOf(OAuthAccountNotFoundError);
  });

  it('exchanges a short-lived login code only once', async () => {
    const user = await User.create({
      name: 'OAuth',
      email: 'oauth@example.com',
      role: 'tenant',
      socialAuth: {
        google: { subject: 'google-code-sub', email: 'oauth@example.com' },
      },
    });
    const code = await issueOAuthLoginCode(user._id, '/tenant');

    const first = await consumeOAuthLoginCode(code);
    const second = await consumeOAuthLoginCode(code);

    expect(first?.user.email).toBe('oauth@example.com');
    expect(first?.redirect).toBe('/tenant');
    expect(second).toBeNull();
  });

  it('rejects external redirects', () => {
    expect(sanitizeOAuthRedirect('https://evil.example', 'pro')).toBe('/pro');
    expect(sanitizeOAuthRedirect('//evil.example', 'landlord')).toBe('/landlord');
    expect(sanitizeOAuthRedirect('/contracts', 'tenant')).toBe('/contracts');
  });
});
