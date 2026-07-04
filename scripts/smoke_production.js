const baseUrl = process.env.SMOKE_BASE_URL || 'https://app.rentalapp.es';

const checks = [
  { path: '/health', expect: 200, contains: '"ok":true' },
  { path: '/ready', expect: 200, contains: '"ready":true' },
  { path: '/', expect: 200, contains: '<!DOCTYPE html>' },
  { path: '/.env', expect: 404 },
  { path: '/backup.sql', expect: 404 },
  { path: '/wp-config.php', expect: 404 },
];

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
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
