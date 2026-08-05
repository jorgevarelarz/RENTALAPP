import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Client, Issuer, generators } from 'openid-client';
import { User } from '../models/user.model';
import { OAuthLoginCode } from '../models/oauthLoginCode.model';
import { getJwtSecret } from '../utils/getJwtSecret';

export type OAuthProvider = 'google' | 'apple';
export type OAuthMode = 'login' | 'register';
export type PublicRole = 'tenant' | 'landlord' | 'pro';

type OAuthFlow = {
  provider: OAuthProvider;
  mode: OAuthMode;
  role: PublicRole;
  redirect: string;
  state: string;
  nonce: string;
  codeVerifier: string;
};

type SocialProfile = {
  provider: OAuthProvider;
  subject: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
  avatar?: string;
};

export class OAuthAccountNotFoundError extends Error {}
export class OAuthConfigurationError extends Error {}

const OAUTH_COOKIE_ISSUER = 'rentalapp';
const OAUTH_COOKIE_AUDIENCE = 'rentalapp-oauth';

export function sanitizeOAuthRedirect(value: unknown, role: PublicRole = 'tenant') {
  const fallback = role === 'landlord' ? '/landlord' : role === 'pro' ? '/pro' : '/tenant';
  // Browsers normalise backslashes to slashes, so "/\evil.com" resolves as the
  // protocol-relative "//evil.com". Reject both separators after the leading slash.
  if (typeof value !== 'string' || !value.startsWith('/') || /^\/[/\\]/.test(value)) return fallback;
  return value;
}

export function configuredOAuthProviders() {
  return {
    google: Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET),
    apple: Boolean(
      process.env.APPLE_OAUTH_CLIENT_ID &&
      process.env.APPLE_OAUTH_TEAM_ID &&
      process.env.APPLE_OAUTH_KEY_ID &&
      process.env.APPLE_OAUTH_PRIVATE_KEY_BASE64
    ),
  };
}

function publicBaseUrl() {
  return (process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

export function oauthCallbackUrl(provider: OAuthProvider) {
  return `${publicBaseUrl()}/api/auth/oauth/${provider}/callback`;
}

function appleClientSecret() {
  const clientId = process.env.APPLE_OAUTH_CLIENT_ID;
  const teamId = process.env.APPLE_OAUTH_TEAM_ID;
  const keyId = process.env.APPLE_OAUTH_KEY_ID;
  const privateKeyBase64 = process.env.APPLE_OAUTH_PRIVATE_KEY_BASE64;
  if (!clientId || !teamId || !keyId || !privateKeyBase64) {
    throw new OAuthConfigurationError('Apple OAuth no está configurado');
  }
  const privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf8');
  return jwt.sign({}, privateKey, {
    algorithm: 'ES256',
    audience: 'https://appleid.apple.com',
    expiresIn: '10m',
    issuer: teamId,
    keyid: keyId,
    subject: clientId,
  });
}

export function oauthClient(provider: OAuthProvider) {
  if (provider === 'google') {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new OAuthConfigurationError('Google OAuth no está configurado');
    }
    const issuer = new Issuer({
      issuer: 'https://accounts.google.com',
      authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      token_endpoint: 'https://oauth2.googleapis.com/token',
      jwks_uri: 'https://www.googleapis.com/oauth2/v3/certs',
    });
    return new issuer.Client({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uris: [oauthCallbackUrl(provider)],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_post',
    });
  }

  const clientId = process.env.APPLE_OAUTH_CLIENT_ID;
  if (!clientId) throw new OAuthConfigurationError('Apple OAuth no está configurado');
  const issuer = new Issuer({
    issuer: 'https://appleid.apple.com',
    authorization_endpoint: 'https://appleid.apple.com/auth/authorize',
    token_endpoint: 'https://appleid.apple.com/auth/token',
    jwks_uri: 'https://appleid.apple.com/auth/keys',
  });
  return new issuer.Client({
    client_id: clientId,
    client_secret: appleClientSecret(),
    redirect_uris: [oauthCallbackUrl(provider)],
    response_types: ['code'],
    token_endpoint_auth_method: 'client_secret_post',
    id_token_signed_response_alg: 'RS256',
  });
}

export function createOAuthFlow(
  provider: OAuthProvider,
  mode: OAuthMode,
  role: PublicRole,
  redirect: unknown,
) {
  const flow: OAuthFlow = {
    provider,
    mode,
    role,
    redirect: sanitizeOAuthRedirect(redirect, role),
    state: generators.state(),
    nonce: generators.nonce(),
    codeVerifier: generators.codeVerifier(),
  };
  const cookieToken = jwt.sign(flow, getJwtSecret(), {
    audience: OAUTH_COOKIE_AUDIENCE,
    expiresIn: '10m',
    issuer: OAUTH_COOKIE_ISSUER,
  });
  return { flow, cookieToken };
}

export function verifyOAuthFlow(cookieToken: string): OAuthFlow {
  return jwt.verify(cookieToken, getJwtSecret(), {
    audience: OAUTH_COOKIE_AUDIENCE,
    issuer: OAUTH_COOKIE_ISSUER,
  }) as OAuthFlow;
}

export function oauthAuthorizationUrl(client: Client, flow: OAuthFlow) {
  return client.authorizationUrl({
    scope: flow.provider === 'apple' ? 'openid name email' : 'openid email profile',
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: generators.codeChallenge(flow.codeVerifier),
    code_challenge_method: 'S256',
    ...(flow.provider === 'apple'
      ? { response_mode: 'form_post' }
      : { prompt: 'select_account', access_type: 'online' }),
  });
}

function normalizedEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function verifiedClaim(value: unknown) {
  return value === true || value === 'true';
}

export function socialProfileFromClaims(
  provider: OAuthProvider,
  claims: Record<string, unknown>,
  appleUser?: unknown,
): SocialProfile {
  let appleName = '';
  if (provider === 'apple' && typeof appleUser === 'string') {
    try {
      const parsed = JSON.parse(appleUser);
      appleName = [parsed?.name?.firstName, parsed?.name?.lastName].filter(Boolean).join(' ');
    } catch {
      appleName = '';
    }
  }
  return {
    provider,
    subject: String(claims.sub || ''),
    email: normalizedEmail(claims.email) || undefined,
    emailVerified: verifiedClaim(claims.email_verified),
    name: appleName || (typeof claims.name === 'string' ? claims.name : undefined),
    avatar: typeof claims.picture === 'string' ? claims.picture : undefined,
  };
}

export async function resolveSocialUser(
  profile: SocialProfile,
  mode: OAuthMode,
  role: PublicRole,
) {
  if (!profile.subject) throw new Error('Identidad social sin subject');
  const subjectPath = `socialAuth.${profile.provider}.subject`;
  let user = await User.findOne({ [subjectPath]: profile.subject });
  if (user) return user;

  if (!profile.email || !profile.emailVerified) {
    throw new Error('El proveedor no confirmó un correo electrónico');
  }

  user = await User.findOne({ email: profile.email });
  if (!user && mode === 'login') {
    throw new OAuthAccountNotFoundError('No existe una cuenta vinculada');
  }

  const identity = {
    subject: profile.subject,
    email: profile.email,
    linkedAt: new Date(),
  };

  if (user) {
    const currentSubject = (user as any).socialAuth?.[profile.provider]?.subject;
    if (currentSubject && currentSubject !== profile.subject) {
      throw new Error('El correo ya está vinculado a otra identidad');
    }
    user.set(`socialAuth.${profile.provider}`, identity);
    if (!(user as any).emailVerifiedAt) (user as any).emailVerifiedAt = new Date();
    if (!user.avatar && profile.avatar) user.avatar = profile.avatar;
    await user.save();
    return user;
  }

  const fallbackName = profile.email.split('@')[0].replace(/[._-]+/g, ' ');
  user = new User({
    name: profile.name?.trim() || fallbackName || 'Usuario RentalApp',
    email: profile.email,
    role,
    emailVerifiedAt: new Date(),
    avatar: profile.avatar,
    socialAuth: { [profile.provider]: identity },
  });
  await user.save();
  return user;
}

export async function issueOAuthLoginCode(userId: unknown, redirect: string) {
  const code = crypto.randomBytes(32).toString('base64url');
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');
  await OAuthLoginCode.create({
    codeHash,
    userId,
    redirect: sanitizeOAuthRedirect(redirect),
    expiresAt: new Date(Date.now() + 2 * 60 * 1000),
  });
  return code;
}

export async function consumeOAuthLoginCode(code: string) {
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');
  const loginCode = await OAuthLoginCode.findOneAndDelete({
    codeHash,
    expiresAt: { $gt: new Date() },
  }).lean();
  if (!loginCode) return null;
  const user = await User.findById(loginCode.userId);
  if (!user) return null;
  return { user, redirect: sanitizeOAuthRedirect(loginCode.redirect) };
}
