import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../utils/getJwtSecret';
import { frontendUrl } from '../utils/frontendUrl';
import { recordFunnelEvent } from '../services/funnelEvents.service';
import {
  OAuthAccountNotFoundError,
  OAuthConfigurationError,
  OAuthMode,
  OAuthProvider,
  PublicRole,
  configuredOAuthProviders,
  consumeOAuthLoginCode,
  createOAuthFlow,
  issueOAuthLoginCode,
  oauthAuthorizationUrl,
  oauthCallbackUrl,
  oauthClient,
  resolveSocialUser,
  socialProfileFromClaims,
  verifyOAuthFlow,
} from '../services/oauth.service';

const oauthCookieName = () =>
  process.env.NODE_ENV === 'production' ? '__Host-rentalapp_oauth' : 'rentalapp_oauth';

function parseCookies(header = '') {
  return Object.fromEntries(
    header
      .split(';')
      .map(part => part.trim().split('='))
      .filter(([name, value]) => Boolean(name && value))
      .map(([name, ...value]) => [name, decodeURIComponent(value.join('='))]),
  );
}

function setFlowCookie(res: Response, token: string) {
  const secure = process.env.NODE_ENV === 'production';
  res.cookie(oauthCookieName(), token, {
    httpOnly: true,
    maxAge: 10 * 60 * 1000,
    path: '/',
    sameSite: secure ? 'none' : 'lax',
    secure,
  });
}

function clearFlowCookie(res: Response) {
  const secure = process.env.NODE_ENV === 'production';
  res.clearCookie(oauthCookieName(), {
    httpOnly: true,
    path: '/',
    sameSite: secure ? 'none' : 'lax',
    secure,
  });
}

function authPayload(user: any) {
  const payload: any = { id: user._id, role: user.role };
  if (user.isVerified) payload.isVerified = true;
  return payload;
}

function publicUser(user: any) {
  return {
    _id: user._id,
    email: user.email,
    role: user.role,
    isVerified: Boolean(user.isVerified),
  };
}

export const listOAuthProviders = async (_req: Request, res: Response) => {
  res.json({ providers: configuredOAuthProviders() });
};

export const startOAuth = async (req: Request, res: Response) => {
  try {
    const provider = req.params.provider as OAuthProvider;
    const mode = (req.query.mode === 'register' ? 'register' : 'login') as OAuthMode;
    const role = (['tenant', 'landlord', 'pro'].includes(String(req.query.role))
      ? req.query.role
      : 'tenant') as PublicRole;
    const client = oauthClient(provider);
    const { flow, cookieToken } = createOAuthFlow(provider, mode, role, req.query.redirect);
    setFlowCookie(res, cookieToken);
    res.redirect(oauthAuthorizationUrl(client, flow));
  } catch (error) {
    if (error instanceof OAuthConfigurationError) {
      return res.status(503).json({ message: 'Este método de acceso todavía no está disponible' });
    }
    throw error;
  }
};

export const finishOAuth = async (req: Request, res: Response) => {
  const provider = req.params.provider as OAuthProvider;
  try {
    const cookies = parseCookies(req.headers.cookie);
    const cookieToken = cookies[oauthCookieName()];
    if (!cookieToken) throw new Error('Sesión OAuth ausente');
    const flow = verifyOAuthFlow(cookieToken);
    if (flow.provider !== provider) throw new Error('Proveedor OAuth no coincide');

    const client = oauthClient(provider);
    const params = client.callbackParams(req);
    const tokens = await client.callback(oauthCallbackUrl(provider), params, {
      state: flow.state,
      nonce: flow.nonce,
      code_verifier: flow.codeVerifier,
    });
    const profile = socialProfileFromClaims(provider, tokens.claims(), req.body?.user);
    const user = await resolveSocialUser(profile, flow.mode, flow.role);
    await recordFunnelEvent(req, flow.mode === 'register' ? 'register' : 'login', {
      resourceType: 'user',
      resourceId: String(user._id),
      meta: { userId: String(user._id), role: user.role, provider },
    });
    const code = await issueOAuthLoginCode(user._id, flow.redirect);
    clearFlowCookie(res);
    return res.redirect(frontendUrl('/auth/callback') + `#code=${encodeURIComponent(code)}`);
  } catch (error) {
    clearFlowCookie(res);
    if (error instanceof OAuthAccountNotFoundError) {
      return res.redirect(frontendUrl('/register', { oauth_error: 'account_not_found', provider }));
    }
    const reason = error instanceof Error ? `${error.name}: ${error.message}` : 'unknown_error';
    console.error(`[oauth] ${provider} callback failed: ${reason}`);
    return res.redirect(frontendUrl('/login', { oauth_error: 'access_failed' }));
  }
};

export const exchangeOAuthCode = async (req: Request, res: Response) => {
  const result = await consumeOAuthLoginCode(req.body.code);
  if (!result) return res.status(400).json({ message: 'El acceso ha caducado. Inténtalo de nuevo.' });
  const token = jwt.sign(authPayload(result.user), getJwtSecret(), { expiresIn: '7d' });
  return res.json({
    token,
    user: publicUser(result.user),
    redirect: result.redirect,
  });
};
