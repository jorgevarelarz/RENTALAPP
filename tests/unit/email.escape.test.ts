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
    await email.sendPaymentNoticeEmail('a@test.com', {
      audience: 'payer',
      concept: '<b>Renta</b>',
      amount: 900,
      paidAt: new Date('2026-10-05T10:00:00Z'),
      name: evil,
      hasReceipt: true,
    });
    const html = lastHtml();
    expect(html).not.toContain('<b>Renta</b>');
    expect(html).not.toContain('<a href="https://phish');
    expect(html).toContain('&lt;b&gt;Renta&lt;/b&gt;');
    expect(html).toContain('5 de octubre de 2026');
    expect(html).toContain('href="https://app.example.test/tenant/payments"');
  });

  it('aviso de cobro al casero: quién paga, vivienda y enlace a los cobros del contrato', () => {
    const { subject, html } = email.paymentNoticeEmail({
      audience: 'payee',
      concept: 'Renta de octubre de 2026',
      amount: 800,
      paidAt: new Date('2026-10-05T10:00:00Z'),
      contractId: 'abc123',
      name: 'Casero',
      payerName: evil,
      propertyTitle: 'Piso en Chamberí',
      propertyAddress: 'Calle de Fuencarral 100, Madrid',
    });
    expect(subject).toMatch(/^Cobro recibido: Renta de octubre de 2026 · 800,00\s€$/);
    expect(html).not.toContain('<a href="https://phish');
    expect(html).toContain('ha pagado la renta de octubre de 2026 de <strong>Piso en Chamberí</strong>');
    expect(html).toContain('href="https://app.example.test/contracts/abc123"');
    expect(html).toContain('Ver cobros y recibos');
  });

  it('justificante de un pago sin recibo PDF: sin botón de descarga', () => {
    const { subject, html } = email.paymentNoticeEmail({
      audience: 'payer',
      concept: 'Servicio de fontanería',
      amount: 60,
      paidAt: new Date('2026-10-05T10:00:00Z'),
    });
    expect(subject).toBe('Pago recibido: Servicio de fontanería');
    expect(html).not.toContain('href=');
    expect(html).toContain('Guarda este correo como justificante.');
  });

  it('contrato activo: título escapado', async () => {
    await email.sendContractActiveEmail('a@test.com', 'Ana', evil, 'abc123');
    expect(lastHtml()).not.toContain('<a href="https://phish');
  });
});
