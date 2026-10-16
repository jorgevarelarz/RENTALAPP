/** Descarga un Blob con el nombre indicado. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const readBlob = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });

/**
 * Cuerpo JSON del error de una petición con `responseType: 'blob'`
 * (axios deja el JSON dentro del Blob). Devuelve null si no se puede leer.
 */
export async function blobErrorBody(err: any): Promise<{ error?: string; message?: string } | null> {
  const data = err?.response?.data;
  if (data instanceof Blob) {
    try {
      return JSON.parse(await readBlob(data));
    } catch {
      return null;
    }
  }
  return data && typeof data === 'object' ? data : null;
}
