import { coTenantInviteEmail } from '../../src/utils/email';

describe('coTenantInviteEmail', () => {
  const base = {
    link: 'https://app.example.test/invites/accept?token=abc&x=1',
    expiresAt: new Date('2026-10-13T10:30:00Z'),
  };

  it('says who invites and which home, with the link and the expiry', () => {
    const { subject, html } = coTenantInviteEmail({
      ...base,
      inviterName: 'Ana López',
      propertyTitle: 'Piso en Chamberí',
      propertyAddress: 'Calle Real 1, Madrid',
    });
    expect(subject).toBe('Ana López te invita a compartir su alquiler');
    expect(html).toContain('<strong>Ana López</strong> te ha invitado');
    expect(html).toContain('Piso en Chamberí');
    expect(html).toContain('Calle Real 1, Madrid');
    expect(html).toContain('href="https://app.example.test/invites/accept?token=abc&amp;x=1"');
    expect(html).toContain('13 de octubre');
  });

  it('escapes user-controlled text and keeps the subject on one line', () => {
    const { subject, html } = coTenantInviteEmail({
      ...base,
      inviterName: '<a href="https://evil.test">Banco</a>\r\nBcc: x@evil.test',
      propertyTitle: '<img src=x onerror=alert(1)>',
    });
    expect(html).not.toContain('<a href="https://evil.test"');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
    expect(subject).not.toMatch(/[\r\n]/);
  });

  it('works without inviter or property', () => {
    const { subject, html } = coTenantInviteEmail(base);
    expect(subject).toBe('Invitación para compartir un alquiler');
    expect(html).toContain('Te han invitado');
    expect(html).not.toContain('background-color: #f3f4f6');
  });
});
