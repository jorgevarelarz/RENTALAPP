import { describe, expect, it } from 'vitest';
import { safeInternalPath } from './coTenants';

describe('safeInternalPath', () => {
  it('solo acepta rutas internas', () => {
    expect(safeInternalPath('/invites/accept?token=a', '/')).toBe('/invites/accept?token=a');
    expect(safeInternalPath('//evil.example', '/')).toBe('/');
    expect(safeInternalPath('/\\evil.example', '/')).toBe('/');
    expect(safeInternalPath('https://evil.example', '/')).toBe('/');
    expect(safeInternalPath(null, '/tenant')).toBe('/tenant');
  });
});
