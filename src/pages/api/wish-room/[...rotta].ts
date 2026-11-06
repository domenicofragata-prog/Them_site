// Le vie della Wish Room sul sito. Pubbliche: impostazioni, affida, stato, img, galleria, polvere, sfondo.
// Del Mac, con la chiave segreta: mac/prendi, mac/aggiorna, mac/pubblica.
import type { APIRoute } from 'astro';
import sfondi from '../../../lib/wishroom_sfondi.json';
import {
  P, GIORNI_VOCE, GIORNI_PALCO, GIORNI_GALLERIA, SVEGLIO_MS, ID, IMMAGINI, PREDEFINITE,
  pronto, redis, tubo, json, eDelMac, impronta, nuovoId, oggiARoma, oraARoma,
} from '../../../lib/wishroom';

export const prerender = false;

const IDIMG = /^[a-f0-9]{8,24}$/;

function mac(grezzo: string | null) {
  try { return grezzo ? JSON.parse(grezzo) : null; } catch { return null; }
}
function impostazioni(m: any) {
  return { ...PREDEFINITE, ...((m && m.impostazioni) || {}) };
}
function sveglio(m: any) {
  return Boolean(m && Date.now() - Number(m.visto || 0) < SVEGLIO_MS);
}
function pubblica(voce: any) {
  const v = { ...voce };
  delete v.ip;
  return v;
}
function ip(request: Request, clientAddress?: string) {
  return (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || clientAddress || 'ignoto';
}
const NIENTE = { status: 404, headers: { 'Cache-Control': 'no-store' } };

export const GET: APIRoute = async ({ params, url, request, clientAddress }) => {
  if (!pronto()) return json({ errore: 'spenta' }, 503);
  const via = params.rotta || '';
  try {
    if (via === 'impostazioni') {
      // chi apre il modulo sveglia il postino del Mac: per due minuti il Mac passa più spesso
      const [m] = await tubo([['GET', P + 'mac'], ['SET', P + 'attivo', '1', 'EX', 120]]);
      const g = mac(m);
      return json({ ...impostazioni(g), sveglia: sveglio(g), sito: true, prova: false });
    }
    if (via === 'stato') {
      const id = url.searchParams.get('id') || '';
      if (!ID.test(id)) return json({ errore: 'sconosciuta' }, 404);
      const [grezza, m, pos] = await tubo([['GET', P + 'v:' + id], ['GET', P + 'mac'], ['LPOS', P + 'nuovi', id]]);
      if (!grezza) return json({ errore: 'sconosciuta' }, 404);
      const voce = pubblica(JSON.parse(grezza));
      const g = mac(m);
      if (pos !== null && pos !== undefined) voce.posizione = Number(pos) + Number((g && sveglio(g) && g.in_attesa) || 0);
      return json({ ...voce, sveglia: sveglio(g) });
    }
    if (via === 'img') {
      const id = url.searchParams.get('id') || '', k = url.searchParams.get('k') || '';
      if (!IDIMG.test(id) || !IMMAGINI.has(k)) return new Response('', NIENTE);
      const b64 = await redis('GET', `${P}img:${id}:${k}`);
      if (!b64) return new Response('', NIENTE);
      return new Response(Buffer.from(b64, 'base64'), {
        headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400, s-maxage=31536000, immutable' },
      });
    }
    if (via === 'galleria') {
      const [m, gal] = await tubo([['GET', P + 'mac'], ['GET', P + 'galleria']]);
      if (!impostazioni(mac(m)).galleria) return json([], 200, 'public, s-maxage=30');
      const elenco: any[] = (mac(gal) || []).filter((o: any) => IDIMG.test(o.id));
      const quante = url.searchParams.get('tutte') ? elenco.length : 12;
      return json(elenco.slice(0, quante).map((o) => ({ id: o.id, src: `/api/wish-room/img?id=${o.id}&k=galleria`, quando: o.quando })),
        200, 'public, s-maxage=30');
    }
    if (via === 'polvere') {
      return json({ lettere: (await redis('GET', P + 'polvere')) || '' }, 200, 'public, s-maxage=60');
    }
    if (via === 'sfondo') {
      const elenco = sfondi as { url: string; piccola: string }[];
      return json(elenco.length ? elenco[Math.floor(Math.random() * elenco.length)] : { url: null });
    }
    return json({ errore: 'via sconosciuta' }, 404);
  } catch (e) {
    console.error(e);
    return json({ errore: 'rete' }, 502);
  }
};

export const POST: APIRoute = async ({ params, request, clientAddress }) => {
  if (!pronto()) return json({ errore: 'spenta' }, 503);
  const via = params.rotta || '';
  let r: any = {};
  try { r = await request.json(); } catch { r = {}; }
  try {
    if (via === 'affida') {
      const testo = String(r.testo || '').replace(/\r/g, '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim();
      const [m, attesa] = await tubo([['GET', P + 'mac'], ['LLEN', P + 'nuovi']]);
      const g = mac(m), imp = impostazioni(g);
      if (!testo) return json({ errore: 'testo vuoto' }, 400);
      if (testo.length > Number(imp.limite_caratteri)) return json({ errore: `troppo lungo: al più ${imp.limite_caratteri} caratteri` }, 400);
      // il tetto: la spesa del giorno detta dal Mac, più una stima per i desideri che lo aspettano qui
      const tetto = Number((g && g.tetto) || 0);
      if (tetto > 0) {
        const spesa = (g.giorno === oggiARoma() ? Number(g.spesa_oggi || 0) : 0) + Number(g.stima || 0.12) * Number(attesa || 0);
        if (spesa >= tetto) return json({ errore: 'tetto' }, 429);
      }
      const orma = impronta(ip(request, clientAddress));
      const chiaveOra = `${P}ip:${orma}:${Math.floor(Date.now() / 3600_000)}`;
      const gia = Number((await redis('GET', chiaveOra)) || 0);
      if (gia >= Number(imp.limite_remoto_per_ora)) return json({ errore: 'limite' }, 429);
      const id = nuovoId();
      const voce = { id, testo, quando: oraARoma(), stato: 'in coda', diario: [], ip: 'sito:' + orma };
      const [, , lunga] = await tubo([
        ['SET', P + 'v:' + id, JSON.stringify(voce), 'EX', GIORNI_VOCE],
        ['INCR', chiaveOra],
        ['RPUSH', P + 'nuovi', id],
        ['EXPIRE', chiaveOra, 3600],
      ]);
      const davanti = Number(lunga) - 1 + Number((g && sveglio(g) && g.in_attesa) || 0);
      return json({ id, posizione: davanti, sveglia: sveglio(g) });
    }

    if (via.startsWith('mac/') && !eDelMac(request)) return json({ errore: 'no' }, 403);

    if (via === 'mac/prendi') {
      // il Mac conferma i desideri presi al giro prima (così nessuno si perde) e ne chiede altri
      const conferma: string[] = (r.conferma || []).filter((x: string) => ID.test(x));
      const comandi: (string | number)[][] = conferma.map((id) => ['LREM', P + 'nuovi', 0, id]);
      if (r.battito) comandi.push(['SET', P + 'mac', JSON.stringify({ ...r.battito, visto: Date.now() }), 'EX', 30 * 86400]);
      comandi.push(['LRANGE', P + 'nuovi', 0, 9], ['EXISTS', P + 'attivo']);
      const uscita = await tubo(comandi);
      const ids: string[] = uscita[uscita.length - 2] || [];
      const attivo = Boolean(Number(uscita[uscita.length - 1]));
      const voci = ids.length ? (await tubo([['MGET', ...ids.map((id) => P + 'v:' + id)]]))[0] : [];
      return json({ voci: (voci || []).filter(Boolean).map((x: string) => JSON.parse(x)), attivo });
    }

    if (via === 'mac/aggiorna') {
      const id = String(r.id || '');
      if (!ID.test(id)) return json({ errore: 'id' }, 400);
      const grezza = await redis('GET', P + 'v:' + id);
      if (!grezza) return json({ errore: 'sconosciuta' }, 404);
      const voce = JSON.parse(grezza);
      const comandi: (string | number)[][] = [];
      const immagini = new Set<string>(voce.immagini || []);
      for (const [k, b64] of Object.entries(r.immagini || {})) {
        if (!IMMAGINI.has(k) || typeof b64 !== 'string') continue;
        comandi.push(['SET', `${P}img:${id}:${k}`, b64, 'EX', k === 'galleria' ? GIORNI_GALLERIA : GIORNI_PALCO]);
        immagini.add(k);
        // l'indirizzo cambia con l'immagine: le immagini restano un anno nella cache di Vercel
        voce.versioni = { ...(voce.versioni || {}), [k]: Date.now() };
      }
      const nuovo = r.voce || {};
      for (const campo of ['stato', 'posizione', 'diario', 'motivo', 'causa']) if (campo in nuovo) voce[campo] = nuovo[campo];
      voce.presa = true;
      voce.immagini = [...immagini];
      const opera: any = { ...(voce.opera || {}), ...(nuovo.opera || {}) };
      opera.url = {};
      for (const k of voce.immagini) if (k !== 'galleria') opera.url[k] = `/api/wish-room/img?id=${id}&k=${k}&v=${(voce.versioni || {})[k] || 0}`;
      voce.opera = opera;
      comandi.push(['SET', P + 'v:' + id, JSON.stringify(voce), 'EX', GIORNI_VOCE]);
      await tubo(comandi);
      return json({ ok: true });
    }

    if (via === 'mac/pubblica') {
      const comandi: (string | number)[][] = [];
      for (const [id, b64] of Object.entries(r.miniature || {})) {
        if (IDIMG.test(id) && typeof b64 === 'string') comandi.push(['SET', `${P}img:${id}:galleria`, b64, 'EX', GIORNI_GALLERIA]);
      }
      if (Array.isArray(r.galleria)) {
        const g = r.galleria.filter((o: any) => o && IDIMG.test(o.id)).slice(0, 1000).map((o: any) => ({ id: o.id, quando: String(o.quando || '') }));
        comandi.push(['SET', P + 'galleria', JSON.stringify(g)]);
      }
      if (typeof r.polvere === 'string') comandi.push(['SET', P + 'polvere', r.polvere.slice(0, 4000)]);
      await tubo(comandi);
      return json({ ok: true });
    }
    return json({ errore: 'via sconosciuta' }, 404);
  } catch (e) {
    console.error(e);
    return json({ errore: 'rete' }, 502);
  }
};
