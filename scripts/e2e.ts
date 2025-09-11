/* eslint-disable no-console */
import jwt from 'jsonwebtoken';

const base = 'http://127.0.0.1:3000';

type Token = string;

function decodeUserId(token: Token): string {
  try {
    const [, payload] = token.split('.');
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const data = JSON.parse(json);
    return String(data.id || data.userId || data.sub);
  } catch {
    return '';
  }
}

async function req(path: string, options: any = {}) {
  const res = await fetch(base + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  } as any);
  const text = await res.text();
  const body = (() => { try { return JSON.parse(text); } catch { return text; } })();
  return { status: res.status, body } as { status: number; body: any };
}

async function main() {
  console.log('E2E start');
  const suffix = Date.now();
  // 1) Register landlord
  let r = await req('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'Owner', email: `owner+${suffix}@example.com`, password: 'password', role: 'landlord' }),
  });
  if (r.status !== 201) throw new Error('register landlord failed ' + JSON.stringify(r.body));
  const ownerToken = r.body.token as Token;
  const ownerId = decodeUserId(ownerToken);
  console.log('Owner registered', ownerId);

  // 2) Register tenant
  r = await req('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'Tenant', email: `tenant+${suffix}@example.com`, password: 'password', role: 'tenant' }),
  });
  if (r.status !== 201) throw new Error('register tenant failed ' + JSON.stringify(r.body));
  const tenantToken = r.body.token as Token;
  const tenantId = decodeUserId(tenantToken);
  console.log('Tenant registered', tenantId);

  // 2.1) Verify identities (owner, tenant, pro) to pass requireVerified
  const verify = async (uid: string) => {
    let vr = await req('/api/verification/submit', {
      method: 'POST',
      headers: { 'x-user-id': uid },
      body: JSON.stringify({ method: 'dni', files: { idFrontUrl: 'https://ex/id-front', selfieUrl: 'https://ex/selfie' } }),
    });
    if (vr.status !== 201) throw new Error('verification submit failed ' + JSON.stringify(vr.body));
    vr = await req(`/api/verification/${uid}/approve`, {
      method: 'POST',
      headers: { 'x-admin': 'true' },
    });
    if (vr.status !== 200) throw new Error('verification approve failed ' + JSON.stringify(vr.body));
  };

  // 3) Register pro
  r = await req('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'Pro', email: `pro+${suffix}@example.com`, password: 'password', role: 'tenant' }),
  });
  if (r.status !== 201) throw new Error('register pro failed ' + JSON.stringify(r.body));
  const proToken = r.body.token as Token;
  const proId = decodeUserId(proToken);
  console.log('Pro registered', proId);

  // Verify all users
  await verify(ownerId);
  await verify(tenantId);
  await verify(proId);

  // 4) Create property (owner)
  r = await req('/api/properties', {
    method: 'POST',
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({ title: 'Nice flat', description: '2 rooms', price: 1000, address: 'Main St 1' }),
  });
  if (r.status !== 201) throw new Error('create property failed ' + JSON.stringify(r.body));
  const propertyId = r.body._id as string;
  console.log('Property created', propertyId);

  // 5) Create PRO profile
  r = await req('/api/pros', {
    method: 'POST',
    headers: { 'x-user-id': proId },
    body: JSON.stringify({ displayName: 'Super Pro', city: 'Madrid', services: [{ key: 'plumbing' }] }),
  });
  if (r.status !== 201) throw new Error('create pro failed ' + JSON.stringify(r.body));
  console.log('Pro profile created');

  // 6) Create minimal contract (owner auth + verified)
  const startDate = new Date();
  const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  r = await req('/api/contracts', {
    method: 'POST',
    headers: { 'x-user-id': ownerId, Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({ tenantId, propertyId, rent: 1000, deposit: 1000, startDate, endDate }),
  });
  if (r.status !== 201) throw new Error('create contract failed ' + JSON.stringify(r.body));
  const contractId = r.body.contract?._id || r.body.contract?.id || r.body.contract?.contract?._id;
  if (!contractId) throw new Error('no contract id in response ' + JSON.stringify(r.body));
  console.log('Contract created', contractId);

  // 7) Tenant opens a ticket
  r = await req('/api/tickets', {
    method: 'POST',
    headers: { 'x-user-id': tenantId },
    body: JSON.stringify({ contractId, ownerId, propertyId, service: 'plumbing', title: 'Leak', description: 'Kitchen leak' }),
  });
  if (r.status !== 201) throw new Error('open ticket failed ' + JSON.stringify(r.body));
  const ticketId = r.body._id as string;
  console.log('Ticket opened', ticketId);

  // 8) Pro sends quote
  r = await req(`/api/tickets/${ticketId}/quote`, {
    method: 'POST',
    headers: { 'x-user-id': proId },
    body: JSON.stringify({ amount: 50 }),
  });
  if (r.status !== 200) throw new Error('quote failed ' + JSON.stringify(r.body));
  console.log('Quote sent');

  // 9) Owner approves (hold mock escrow)
  r = await req(`/api/tickets/${ticketId}/approve`, {
    method: 'POST',
    headers: { 'x-user-id': ownerId },
    body: JSON.stringify({ customerId: 'cus_test' }),
  });
  if (r.status !== 200) throw new Error('approve failed ' + JSON.stringify(r.body));
  console.log('Approved, escrow created');

  // 10) Pro completes
  r = await req(`/api/tickets/${ticketId}/complete`, {
    method: 'POST',
    headers: { 'x-user-id': proId },
    body: JSON.stringify({ invoiceUrl: 'https://example.com/invoice.pdf' }),
  });
  if (r.status !== 200) throw new Error('complete failed ' + JSON.stringify(r.body));
  console.log('Completed');

  // 11) Owner validates (release)
  r = await req(`/api/tickets/${ticketId}/validate`, {
    method: 'POST',
    headers: { 'x-user-id': ownerId },
  });
  if (r.status !== 200) throw new Error('validate failed ' + JSON.stringify(r.body));
  console.log('Released');

  // 12) Ensure chat conversation and send a message
  r = await req('/api/chat/conversations/ensure', {
    method: 'POST',
    headers: { 'x-user-id': ownerId },
    body: JSON.stringify({ kind: 'ticket', refId: ticketId }),
  });
  if (r.status !== 200) throw new Error('ensure conversation failed ' + JSON.stringify(r.body));
  const convId = r.body._id as string;
  r = await req(`/api/chat/${convId}/messages`, {
    method: 'POST',
    headers: { 'x-user-id': tenantId },
    body: JSON.stringify({ body: 'Hola, ¿cuándo vienen?' }),
  });
  if (r.status !== 201) throw new Error('send message failed ' + JSON.stringify(r.body));
  console.log('Chat OK');

  console.log('E2E success');
}

main().catch((e) => {
  console.error('E2E failed:', e);
  process.exit(1);
});
