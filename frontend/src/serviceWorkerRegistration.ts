// Based on CRA's default service worker registration template.
// Registers the `src/service-worker.ts` (Workbox) only in production builds.

type Config = {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
};

const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
    window.location.hostname === '[::1]' ||
    // 127.0.0.0/8 IPv4 range
    /^127(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d?\d)){3}$/.test(window.location.hostname),
);

export function register(config?: Config) {
  if (process.env.NODE_ENV !== 'production') return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    const publicUrl = new URL(process.env.PUBLIC_URL, window.location.href);
    if (publicUrl.origin !== window.location.origin) return;

    const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;

    if (isLocalhost) {
      checkValidServiceWorker(swUrl, config);
      navigator.serviceWorker.ready.then(() => {
        // eslint-disable-next-line no-console
        console.log('PWA: service worker ready (localhost)');
      });
    } else {
      registerValidSW(swUrl, config);
    }
  });
}

function registerValidSW(swUrl: string, config?: Config) {
  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (!installingWorker) return;

        installingWorker.onstatechange = () => {
          if (installingWorker.state !== 'installed') return;

          if (navigator.serviceWorker.controller) {
            // New content available; will be used after tabs close.
            config?.onUpdate?.(registration);
          } else {
            // Content cached for offline use.
            config?.onSuccess?.(registration);
          }
        };
      };
    })
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error('PWA: service worker registration failed:', error);
    });
}

function checkValidServiceWorker(swUrl: string, config?: Config) {
  fetch(swUrl, { headers: { 'Service-Worker': 'script' } })
    .then((response) => {
      const contentType = response.headers.get('content-type');
      if (response.status === 404 || (contentType && !contentType.includes('javascript'))) {
        // No SW found. Reload to reset state.
        navigator.serviceWorker.ready
          .then((registration) => registration.unregister())
          .then(() => window.location.reload());
      } else {
        registerValidSW(swUrl, config);
      }
    })
    .catch(() => {
      // eslint-disable-next-line no-console
      console.log('PWA: offline mode (service worker not fetched)');
    });
}

export function unregister() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready.then((registration) => registration.unregister());
}

