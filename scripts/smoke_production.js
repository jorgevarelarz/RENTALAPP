const baseUrl = process.env.SMOKE_BASE_URL || 'https://app.rentalapp.es';

const checks = [
  { path: '/health', expect: 200, contains: '"ok":true' },
  { path: '/ready', expect: 200, contains: '"ready":true' },
  { path: '/', expect: 200, contains: '<!DOCTYPE html>' },
  { path: '/api/properties?limit=1', expect: 200, contains: '"items"' },
  { path: '/.env', expect: 404 },
  { path: '/backup.sql', expect: 404 },
  { path: '/secrets.json', expect: 404 },
  { path: '/config/production.json', expect: 404 },
  { path: '/wp-config.php', expect: 404 },
];

async function loginSmoke() {
  const email = process.env.SMOKE_LOGIN_EMAIL;
  const password = process.env.SMOKE_LOGIN_PASSWORD;
  if (!email || !password) {
    console.log('/api/auth/login skipped (set SMOKE_LOGIN_EMAIL and SMOKE_LOGIN_PASSWORD)');
    return;
  }

  const response = await fetch(new URL('/api/auth/login', baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.text();
  if (response.status !== 200 || !body.includes('"token"')) {
    throw new Error(`/api/auth/login expected 200 token, got ${response.status}`);
  }
  console.log('/api/auth/login 200');
}

async function main() {
  for (const check of checks) {
    const response = await fetch(new URL(check.path, baseUrl));
    const body = await response.text();
    if (response.status !== check.expect) {
      throw new Error(`${check.path} expected ${check.expect}, got ${response.status}`);
    }
    if (check.contains && !body.includes(check.contains)) {
      throw new Error(`${check.path} missing expected content ${check.contains}`);
    }
    console.log(`${check.path} ${response.status}`);
  }
  await loginSmoke();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
