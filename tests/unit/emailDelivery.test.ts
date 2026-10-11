import { sendEmail } from '../../src/utils/email';

describe('sendEmail', () => {
  it('sin SMTP no lanza y devuelve not_configured, para que quien llama pueda avisar', async () => {
    await expect(sendEmail('a@test.com', 'Asunto', '<p>Hola</p>')).resolves.toBe('not_configured');
  });
});
