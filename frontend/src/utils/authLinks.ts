// Enlaces a «Entrar» y «Crear cuenta» que devuelven a la página de origen al terminar.
// Desde el inicio o desde las propias pantallas de acceso no hay a dónde volver: enlace limpio.
type Where = { pathname: string; search?: string; hash?: string };

const NO_RETURN = /^\/(login|register|forgot-password|reset|auth)(\/|$)/;

export function returnPath(where: Where): string | null {
  if (where.pathname === '/' || NO_RETURN.test(where.pathname)) return null;
  return `${where.pathname}${where.search || ''}${where.hash || ''}`;
}

export function authHref(base: '/login' | '/register', where: Where): string {
  const back = returnPath(where);
  return back ? `${base}?redirect=${encodeURIComponent(back)}` : base;
}
