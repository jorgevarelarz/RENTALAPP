import { llmConfig, generateText } from '../services/llm.service';

describe('llm.service', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('prefiere Claude cuando hay ANTHROPIC_API_KEY', () => {
    process.env.ANTHROPIC_API_KEY = 'x';
    process.env.GOOGLE_API_KEY = 'y';
    delete process.env.CLAUDE_MODEL;
    expect(llmConfig()).toEqual({ provider: 'anthropic', model: 'claude-opus-5-5' });
  });

  it('usa Gemini si solo hay GOOGLE_API_KEY', () => {
    delete process.env.ANTHROPIC_API_KEY;
    process.env.GOOGLE_API_KEY = 'y';
    expect(llmConfig()?.provider).toBe('google');
  });

  it('sin claves no hay proveedor y generateText da 500', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    expect(llmConfig()).toBeNull();
    await expect(generateText('hola')).rejects.toMatchObject({ status: 500 });
  });
});
