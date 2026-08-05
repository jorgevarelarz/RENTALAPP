import React, { useEffect, useState } from 'react';
import { api } from '../api/client';

type Provider = 'google' | 'apple';

type Props = {
  mode: 'login' | 'register';
  role?: 'tenant' | 'landlord' | 'pro';
  redirect?: string;
};

const labels: Record<Provider, string> = {
  google: 'Continuar con Google',
  apple: 'Continuar con Apple',
};

function ProviderIcon({ provider }: { provider: Provider }) {
  if (provider === 'apple') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M17.05 12.54c-.03-3.05 2.49-4.53 2.61-4.6a5.6 5.6 0 0 0-4.41-2.39c-1.86-.2-3.67 1.12-4.62 1.12-.97 0-2.43-1.1-4.01-1.07a5.88 5.88 0 0 0-4.95 3.02c-2.14 3.7-.54 9.13 1.5 12.12 1.02 1.46 2.2 3.1 3.78 3.04 1.54-.06 2.11-.98 3.97-.98 1.84 0 2.38.98 3.98.94 1.66-.03 2.7-1.47 3.68-2.94a12.1 12.1 0 0 0 1.68-3.42 5.25 5.25 0 0 1-3.21-4.84ZM14.04 3.58A5.32 5.32 0 0 0 15.26 0a5.45 5.45 0 0 0-3.52 1.7 5.08 5.08 0 0 0-1.25 3.44 4.5 4.5 0 0 0 3.55-1.56Z"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.06H12v3.9h5.38a4.6 4.6 0 0 1-2 3.02v2.53h3.24c1.9-1.75 2.98-4.33 2.98-7.39Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.38l-3.24-2.53c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.61A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.39 13.92A6 6 0 0 1 6.08 12c0-.67.11-1.32.31-1.92V7.47H3.04A10 10 0 0 0 2 12c0 1.63.39 3.17 1.04 4.53l3.35-2.61Z" />
      <path fill="#EA4335" d="M12 5.95c1.47 0 2.78.5 3.82 1.49l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.96 5.47l3.35 2.61C7.18 7.71 9.39 5.95 12 5.95Z" />
    </svg>
  );
}

export default function SocialAuthButtons({ mode, role = 'tenant', redirect }: Props) {
  const [providers, setProviders] = useState<Record<Provider, boolean>>({
    google: false,
    apple: false,
  });

  useEffect(() => {
    let active = true;
    api.get('/api/auth/oauth/providers')
      .then(({ data }) => {
        if (active) setProviders(data.providers);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const enabled = (Object.keys(providers) as Provider[]).filter(provider => providers[provider]);
  if (!enabled.length) return null;

  return (
    <div className="auth-social">
      <div className="auth-social-buttons">
        {enabled.map(provider => {
          const params = new URLSearchParams({ mode, role });
          if (redirect) params.set('redirect', redirect);
          return (
            <a
              key={provider}
              className={`auth-social-button auth-social-${provider}`}
              href={`/api/auth/oauth/${provider}/start?${params.toString()}`}
            >
              <ProviderIcon provider={provider} />
              <span>{labels[provider]}</span>
            </a>
          );
        })}
      </div>
      <div className="auth-divider"><span>o continúa con tu correo</span></div>
    </div>
  );
}
