export function isTensionedRulesEnforced() {
  return String(process.env.ENFORCE_TENSIONED_RULES || '').toLowerCase() === 'true';
}
