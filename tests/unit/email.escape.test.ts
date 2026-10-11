const sendMail = jest.fn().mockResolvedValue({});
jest.mock('nodemailer', () => ({ createTransport: () => ({ sendMail }) }));

describe('Emails: datos de usuario escapados en el HTML', () => {
  let email: typeof import('../../src/utils/email');
  const env = { ...process.env };

  beforeAll(async () => {
    process.env.SMTP_HOST = 'smtp.test';
    process.env.FRONTEND_URL = 'https://app.example.test';
    email = await import('../../src/utils/email');
  });
  afterAll(() => {
    process.env = env;
  });
  beforeEach(() => sendMail.mockClear());

  const lastHtml = () => String(sendMail.mock.calls.at(-1)?.[0]?.html);
  const evil = '<a href="https://phish.example">Pulsa aquí</a>';

  it('alerta de precio: título escapado e importe en euros', async () => {
    await email.sendPriceAlert('a@test.com', { title: evil, price: 1250.5 });
    const html = lastHtml();
    expect(html).not.toContain('<a href="https://phish.example">');
    expect(html).toContain('&lt;a href=&quot;https://phish.example&quot;&gt;');
    expect(html).toMatch(/1250,50\s€/);
  });

  it('contrato pendiente: nombre y dirección escapados, enlace con FRONTEND_URL', async () => {
    await email.sendContractReadyEmail('a@test.com', evil, 'abc123', '<img src=x onerror=alert(1)>');
    const html = lastHtml();
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<a href="https://phish');
    expect(html).toContain('href="https://app.example.test/contracts/abc123"');
  });

  it('recibo: concepto y nombre escapados', async () => {
    await email.sendPaymentReceiptEmail('a@test.com', evil, 900, '<b>Renta</b>', new Date('2026-10-05T10:00:00Z'));
    const html = lastHtml();
    expect(html).not.toContain('<b>Renta</b>');
    expect(html).toContain('&lt;b&gt;Renta&lt;/b&gt;');
    expect(html).toContain('5 de octubre de 2026');
  });

  it('contrato activo: título escapado', async () => {
    await email.sendContractActiveEmail('a@test.com', 'Ana', evil, 'abc123');
    expect(lastHtml()).not.toContain('<a href="https://phish');
  });
});
