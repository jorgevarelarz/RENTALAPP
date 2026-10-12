export const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Cada letra base admite sus variantes con tilde, diéresis o virgulilla (mayúsculas incluidas,
// por si el motor de regex no pliega mayúsculas fuera de ASCII)
const VARIANTS: Record<string, string> = {
  a: 'aáàâäãAÁÀÂÄÃ',
  e: 'eéèêëEÉÈÊË',
  i: 'iíìîïIÍÌÎÏ',
  o: 'oóòôöõOÓÒÔÖÕ',
  u: 'uúùûüUÚÙÛÜ',
  n: 'nñNÑ',
  c: 'cçCÇ',
  "'": "'’",
};

/**
 * Patrón de regex (sin anclar, para usar con la opción `i`) que encuentra el texto sin distinguir
 * tildes: «a coruna» encuentra «A Coruña» y «avila», «Ávila». El texto se escapa, así que no admite
 * operadores de regex.
 */
export function accentInsensitivePattern(text: string): string {
  const base = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/’/g, "'")
    .toLowerCase();
  let out = '';
  for (const ch of base) {
    const variants = VARIANTS[ch];
    out += variants ? `[${variants}]` : escapeRegExp(ch);
  }
  return out;
}
