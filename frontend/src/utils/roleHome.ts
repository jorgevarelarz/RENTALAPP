const HOMES: Record<string, string> = {
  tenant: '/tenant',
  landlord: '/landlord',
  pro: '/pro',
  admin: '/admin',
  agency: '/agency',
};

/** Inicio de cada rol; `fallback` si el rol no se conoce. */
export function roleHome(role: string | undefined | null, fallback = '/'): string {
  return (role && HOMES[role]) || fallback;
}
