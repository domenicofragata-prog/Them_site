// Wish Room sul sito: la cassetta delle lettere fra i telefoni e il Mac della stanza.
// I desideri entrano qui e aspettano in Redis (Upstash, dal Marketplace di Vercel); il Mac li va a prendere
// con una chiave segreta, li compone e rimanda lo stato e le immagini. Il Mac non è mai raggiungibile da fuori.
import { createHash, timingSafeEqual } from 'node:crypto';

const URL_REDIS = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const TOKEN_REDIS = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const SEGRETO = process.env.WISHROOM_SEGRETO || '';

export const P = 'wr:';
export const GIORNI_VOCE = 90 * 86400;     // il desiderio e il suo stato
export const GIORNI_PALCO = 10 * 86400;    // le immagini grandi del processo
export const GIORNI_GALLERIA = 120 * 86400; // le miniature della galleria
export const SVEGLIO_MS = 45_000;          // il Mac è sveglio se si è fatto vivo da meno di 45 s

export function pronto() {
  return Boolean(URL_REDIS && TOKEN_REDIS && SEGRETO);
}

export async function redis(...comando: (string | number)[]): Promise<any> {
  const r = await fetch(URL_REDIS, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN_REDIS}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(comando.map(String)),
  });
  const j = await r.json();
  if (j.error) throw new Error('redis: ' + j.error);
  return j.result;
}

export async function tubo(comandi: (string | number)[][]): Promise<any[]> {
  if (!comandi.length) return [];
  const r = await fetch(URL_REDIS.replace(/\/$/, '') + '/pipeline', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN_REDIS}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(comandi.map((c) => c.map(String))),
  });
  const j = await r.json();
  if (!Array.isArray(j)) throw new Error('redis: ' + (j.error || 'pipeline'));
  return j.map((x: any) => {
    if (x.error) throw new Error('redis: ' + x.error);
    return x.result;
  });
}

export function json(dati: unknown, stato = 200, cache = 'no-store') {
  return new Response(JSON.stringify(dati), {
    status: stato,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache },
  });
}

export function eDelMac(request: Request) {
  const h = request.headers.get('authorization') || '';
  const dato = Buffer.from(h.replace(/^Bearer\s+/i, ''));
  const atteso = Buffer.from(SEGRETO);
  return SEGRETO.length >= 24 && dato.length === atteso.length && timingSafeEqual(dato, atteso);
}

// l'indirizzo del telefono non si conserva mai in chiaro: solo un'impronta, per il limite e per il Mac
export function impronta(ip: string) {
  return createHash('sha256').update(SEGRETO + '|' + ip).digest('hex').slice(0, 16);
}

export function nuovoId() {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export const ID = /^[a-f0-9]{24}$/;
export const IMMAGINI = new Set(['immagine', 'lettere', 'galleria']);

// il giorno della stanza è quello di Roma, come la spesa che il Mac conta
export function oggiARoma() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date());
}

export function oraARoma() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome', dateStyle: 'short', timeStyle: 'medium' })
    .format(new Date()).replace(' ', 'T');
}

export const PREDEFINITE = {
  limite_caratteri: 600,
  secondi_mostra: 25,
  lingua: 'en',
  nome: 'Wish Room',
  evento: {},
  galleria: true,
  limite_remoto_per_ora: 4,
};
