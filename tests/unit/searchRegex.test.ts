import { accentInsensitivePattern } from '../../src/utils/searchRegex';

const matches = (query: string, value: string) =>
  new RegExp(`^${accentInsensitivePattern(query)}$`, 'i').test(value);

describe('accentInsensitivePattern', () => {
  it('encuentra el texto sin distinguir tildes ni mayúsculas', () => {
    expect(matches('a coruna', 'A Coruña')).toBe(true);
    expect(matches('A CORUÑA', 'A Coruna')).toBe(true);
    expect(matches('avila', 'Ávila')).toBe(true);
    expect(matches('caceres', 'Cáceres')).toBe(true);
    expect(matches('lleida', 'Lleida')).toBe(true);
    expect(matches('sant cugat', 'Sant Cugat')).toBe(true);
    expect(matches('barca', 'Barça')).toBe(true);
    expect(matches("l'hospitalet", 'L’Hospitalet')).toBe(true);
  });

  it('no confunde letras distintas ni ejecuta operadores de regex', () => {
    expect(matches('evila', 'Ávila')).toBe(false);
    expect(matches('.*', 'Madrid')).toBe(false);
    expect(matches('(a+)+', 'aaaa')).toBe(false);
    expect(() => new RegExp(accentInsensitivePattern('['))).not.toThrow();
  });
});
