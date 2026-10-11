// Adjuntos de chat: solo ficheros subidos con /api/uploads/images.
// Acepta «/uploads/<nombre>» y la misma ruta bajo APP_URL, FRONTEND_URL o
// cualquiera de las bases de UPLOADS_BASE_URL (separadas por comas).
// Así no se cuelan imágenes de otros dominios (píxeles de rastreo, phishing).

const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]*(\.[A-Za-z0-9]+)?$/;

function bases(): string[] {
  const configured = (process.env.UPLOADS_BASE_URL || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const own = [process.env.APP_URL, process.env.FRONTEND_URL]
    .filter((v): v is string => Boolean(v && v.trim()))
    .map(v => `${v.trim().replace(/\/+$/, '')}/uploads`);
  return [...configured, ...own, '/uploads'].map(b => b.replace(/\/+$/, ''));
}

export function isOwnUploadUrl(url: string): boolean {
  if (url.length > 500) return false;
  return bases().some(base => {
    if (!url.startsWith(`${base}/`)) return false;
    return SAFE_NAME.test(url.slice(base.length + 1));
  });
}
