import React, { useEffect, useState } from 'react';
import { exchangeOAuthCode } from '../../services/auth';

export default function OAuthCallbackPage() {
  const [message, setMessage] = useState('Completando el acceso seguro…');

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const code = params.get('code');
    window.history.replaceState({}, document.title, '/auth/callback');

    if (!code) {
      window.location.replace('/login?oauth_error=access_failed');
      return;
    }

    exchangeOAuthCode(code)
      .then(({ redirect }) => window.location.replace(redirect))
      .catch(() => {
        setMessage('No se pudo completar el acceso. Volviendo al inicio…');
        window.setTimeout(() => window.location.replace('/login?oauth_error=access_failed'), 900);
      });
  }, []);

  return (
    <div className="auth-callback" role="status" aria-live="polite">
      <span className="auth-callback-spinner" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}
