import https from 'https';
import crypto from 'crypto';
import { LegalDocument } from '../models/legalDocument.model';

const LAU_URL = 'https://www.boe.es/buscar/act.php?id=BOE-A-1994-26003';

const decodeHtml = (value: string) => value
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>');

const stripHtml = (html: string) => {
  const noScripts = html.replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
  const withBreaks = noScripts
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/h\d>/gi, '\n')
    .replace(/<\/li>/gi, '\n');
  const noTags = withBreaks.replace(/<[^>]+>/g, '');
  return decodeHtml(noTags).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
};

const extractVersionDate = (text: string) => {
  const match = text.match(/Última actualización(?:,)? publicada el\s+(\d{2}\/\d{2}\/\d{4})/i)
    || text.match(/Última actualización(?:,)?\s+(\d{2}\/\d{2}\/\d{4})/i);
  return match?.[1];
};

const extractRelevantText = (text: string) => {
  const idx = text.search(/Texto consolidado/i);
  const altIdx = text.search(/\[Bloque\s+1:/i);
  if (idx >= 0) return text.slice(idx);
  if (altIdx >= 0) return text.slice(altIdx);
  return text;
};

const downloadHtml = (url: string) => new Promise<string>((resolve, reject) => {
  https.get(url, {
    headers: {
      'User-Agent': 'RentalAppBot/1.0',
      Accept: 'text/html',
    },
  }, (res) => {
    if (res.statusCode && res.statusCode >= 400) {
      reject(new Error(`HTTP ${res.statusCode}`));
      return;
    }
    res.setEncoding('utf8');
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => resolve(data));
  }).on('error', reject);
});

export async function fetchLauDocument() {
  const html = await downloadHtml(LAU_URL);
  const text = stripHtml(html);
  const versionDate = extractVersionDate(text);
  const content = extractRelevantText(text);
  const hash = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  return {
    source: 'LAU' as const,
    versionDate,
    fetchedAt: new Date(),
    url: LAU_URL,
    content,
    hash,
  };
}

export async function upsertLatestLauDocument() {
  const latest = await LegalDocument.findOne({ source: 'LAU' }).sort({ fetchedAt: -1 }).lean();
  const next = await fetchLauDocument();
  if (latest?.hash === next.hash) {
    return { updated: false, doc: latest };
  }
  const doc = await LegalDocument.create(next);
  return { updated: true, doc: doc.toObject() };
}

export async function getLatestLauDocument() {
  return LegalDocument.findOne({ source: 'LAU' }).sort({ fetchedAt: -1 }).lean();
}
