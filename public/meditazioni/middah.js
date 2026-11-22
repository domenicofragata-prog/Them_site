/* Middah, il motore che geometrizza le parole.
   Una parola ebraica diventa un ornamento chiuso: ogni lettera è un tratto, lungo quanto la sua stanza
   (le nove stanze di Aiq Bekar, tradizione cabalistica); dopo ogni tratto la linea svolta di un angolo fisso,
   e la parola si ripete finché la linea torna al punto di partenza. Il tracciato a misura e svolta è il metodo
   dell'opera, un'invenzione nostra. Non usa la ruota delle 22 lettere.
   Accanto alla linea c'è il sigillo: la stessa parola tracciata sul quadrato delle nove stanze, da sola o
   ripetuta intorno al centro quante sono le ripetizioni.
   Modulo a sé, senza dipendenze dalla pagina: nel browser espone window.Middah, in Node module.exports. */
(function (radice) {
  "use strict";
  const AB = "אבגדהוזחטיכלמנסעפצקרשת";
  const FIN = { "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" };
  const VAL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 200, 300, 400];

  const nuda = c => FIN[c] || c;
  /** La stanza della lettera, da 1 a 9. Le finali valgono come la lettera normale. */
  const stanza = c => AB.indexOf(nuda(c)) % 9 + 1;
  /** Solo le 27 lettere: via niqqud, te'amim, maqqef, spazi e ogni altro segno. */
  const pulisci = testo => [...String(testo)].filter(c => AB.includes(nuda(c)));
  const stanze = parola => pulisci(parola).map(stanza);
  /** Valore ghematrico standard, finali come le normali. */
  const valore = parola => pulisci(parola).reduce((s, c) => s + VAL[AB.indexOf(nuda(c))], 0);

  /* ---------- frazioni esatte, in BigInt: la svolta non passa mai dalla virgola mobile ---------- */
  const mcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
  function frazione(num, den = 1n) {
    num = BigInt(num); den = BigInt(den);
    if (den === 0n) throw new Error("Middah: denominatore zero");
    if (den < 0n) { num = -num; den = -den; }
    const g = mcd(num, den) || 1n;
    return { num: num / g, den: den / g };
  }
  /** Legge una svolta: numero intero, decimale scritto («60,75», «60.75»), «243/4», oppure {num, den}. */
  function leggiSvolta(t) {
    if (t && typeof t === "object" && "num" in t) return frazione(t.num, t.den ?? 1n);
    if (typeof t === "bigint") return frazione(t);
    if (typeof t === "number") {
      if (!Number.isFinite(t)) throw new Error("Middah: svolta non valida");
      t = Number.isInteger(t) ? String(t) : String(t); // un numero decimale si legge dalla sua scrittura
    }
    const s = String(t).trim().replace(",", ".").replace(/°$/, "");
    let m = /^(-?\d+)\s*\/\s*(\d+)$/.exec(s);
    if (m) return frazione(m[1], m[2]);
    m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(s);
    if (!m) throw new Error("Middah: svolta non valida, «" + t + "»");
    const dec = m[3] || "";
    return frazione((m[1] ? "-" : "") + m[2] + dec, 10n ** BigInt(dec.length));
  }
  const gradi = f => Number(f.num) / Number(f.den);
  const scrivi = f => f.den === 1n ? String(f.num) : `${f.num}/${f.den}`;

  /** Chiusura: con m lettere e svolta θ ogni ripetizione gira la direzione di m·θ.
      Se m·θ è multiplo di 360° la figura è un fregio che avanza e non si chiude;
      altrimenti si chiude dopo r = 360 / MCD(m·θ mod 360, 360) ripetizioni. */
  function chiusura(m, theta) {
    const f = leggiSvolta(theta), giro = 360n * f.den;
    const resto = ((BigInt(m) * f.num) % giro + giro) % giro; // m·θ mod 360, in unità di 1/den di grado
    if (m < 1) throw new Error("Middah: la parola non ha lettere");
    if (resto === 0n) return { chiude: false, r: null, giro_per_ripetizione: { num: 0n, den: 1n } };
    return { chiude: true, r: Number(giro / mcd(resto, giro)), giro_per_ripetizione: frazione(resto, f.den) };
  }
  /** I k ammessi per r ripetizioni: MCD(k, r) = 1, da 1 a r·m − 1 (oltre, la svolta supera il giro e si ripete). */
  function kAmmessi(r, m) {
    const out = [];
    for (let k = 1; k < r * m; k++) if (mcd(BigInt(k), BigInt(r)) === 1n) out.push(k);
    return out;
  }
  /** La svolta che dà esattamente r ripetizioni: θ = 360·k / (r·m), con MCD(k, r) = 1. */
  function svoltaPer(r, m, k) {
    if (!(r >= 1) || !(m >= 1) || !Number.isInteger(k)) throw new Error("Middah: r, m e k devono essere interi positivi");
    if (mcd(BigInt(k), BigInt(r)) !== 1n) throw new Error(`Middah: k = ${k} e r = ${r} non sono primi fra loro`);
    return frazione(360n * BigInt(k), BigInt(r) * BigInt(m));
  }

  /** Il tracciato: lettere (stringa o array), r ripetizioni, svolta θ dopo ogni tratto.
      Restituisce i punti e i tratti; ogni tratto ricorda la lettera scritta (finale compresa),
      la sua stanza, la ripetizione q e il posto i. L'angolo di ogni tratto è ridotto in frazione
      esatta prima di passare al seno e al coseno, così l'errore non si accumula. */
  function traccia(lettere, r, theta) {
    const L = Array.isArray(lettere) ? lettere.filter(c => AB.includes(nuda(c))) : pulisci(lettere);
    const f = leggiSvolta(theta), giro = 360n * f.den, S = L.map(stanza);
    const P = [[0, 0]], tratti = [];
    let x = 0, y = 0, passo = 0n;
    for (let q = 0; q < r; q++)
      for (let i = 0; i < L.length; i++) {
        const a = Number(((passo * f.num) % giro + giro) % giro) / Number(f.den) * Math.PI / 180;
        const x0 = x, y0 = y;
        x += S[i] * Math.cos(a); y -= S[i] * Math.sin(a);
        P.push([x, y]);
        tratti.push({ lettera: L[i], stanza: S[i], q, i, da: [x0, y0], a: [x, y] });
        passo++;
      }
    return { punti: P, tratti };
  }

  /** La figura intera: tracciato, chiusura, controllo e i tre numeri.
      opzioni: { r, k } oppure { theta }. Con r e k la svolta è 360·k/(r·m); con theta le ripetizioni
      vengono dalla chiusura (un fregio si traccia per `fregio` ripetizioni, 6 se non detto). */
  function figura(parola, opzioni = {}) {
    const L = pulisci(parola), m = L.length;
    if (!m) throw new Error("Middah: scrivi una parola ebraica");
    let theta, r, k = null;
    if (opzioni.theta != null) {
      theta = leggiSvolta(opzioni.theta);
    } else {
      r = opzioni.r; k = opzioni.k ?? 1;
      theta = svoltaPer(r, m, k);
    }
    const c = chiusura(m, theta);
    if (opzioni.theta == null && c.r !== r) throw new Error(`Middah: con k = ${k} la figura chiude in ${c.r} ripetizioni, non in ${r}`);
    r = c.chiude ? c.r : (opzioni.fregio || 6);
    const t = traccia(L, r, theta), ultimo = t.punti[t.punti.length - 1];
    const scarto = Math.hypot(ultimo[0], ultimo[1]);
    if (c.chiude && !(scarto < 1e-6)) throw new Error(`Middah: la figura non torna all'origine, scarto ${scarto}`);
    const somma = L.reduce((s, ch) => s + stanza(ch), 0), val = valore(L.join(""));
    // baricentro dei vertici e raggio, per centrare e scalare la figura nel riquadro
    const V = c.chiude ? t.punti.slice(0, -1) : t.punti;
    const bx = V.reduce((s, p) => s + p[0], 0) / V.length, by = V.reduce((s, p) => s + p[1], 0) / V.length;
    const raggio = Math.max(...t.punti.map(p => Math.hypot(p[0] - bx, p[1] - by)));
    return {
      parola: L.join(""), lettere: L, stanze: L.map(stanza), m,
      chiude: c.chiude, r, k, theta, theta_gradi: gradi(theta), theta_scritta: scrivi(theta),
      punti: t.punti, tratti: t.tratti, scarto, baricentro: [bx, by], raggio,
      valore: val, somma_stanze: somma,
      numeri: { ripetizioni: r, valore_totale: r * val, lunghezza: r * somma },
    };
  }

  /** Chiave delle parole sorelle: stesse stanze nello stesso ordine danno lo stesso ornamento. */
  const chiaveSorelle = parola => stanze(parola).join("");

  /** Il solo tracciato in SVG, sottile: serve per vedere la geometria. */
  function svgLinea(fig, lato = 1200, margine = 0.06, colore = "#1B2A56", spessore = 1.2) {
    const s = lato * (0.5 - margine) / (fig.raggio || 1), c = lato / 2;
    const d = fig.punti.map((p, i) => `${i ? "L" : "M"}${(c + (p[0] - fig.baricentro[0]) * s).toFixed(2)} ${(c + (p[1] - fig.baricentro[1]) * s).toFixed(2)}`).join(" ");
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lato} ${lato}" width="${lato}" height="${lato}">`
      + `<path d="${d}${fig.chiude ? " Z" : ""}" fill="none" stroke="${colore}" stroke-width="${spessore}" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  }

  /* ---------- il sigillo: la parola tracciata sul quadrato delle nove stanze ---------- */
  const FINALI = "ךםןףץ";
  /** Il posto della lettera sul quadrato di Aiq Bekar, tre stanze per tre, da destra a sinistra come si scrive:
      in alto ג ב א, in mezzo ו ה ד, in basso ט ח ז. Dentro la stanza le unità stanno in alto, le decine in basso
      a destra, le centinaia in basso a sinistra; le cinque finali valgono da 500 a 900 e sono centinaia.
      Le coordinate vanno da 0 a 2, il centro del quadrato è [1, 1]. */
  function postoSigillo(c) {
    let n = AB.indexOf(c); if (n < 0) n = 22 + FINALI.indexOf(c);
    const st = n % 9, ordine = Math.floor(n / 9), d = 0.2;
    return [2 - (st % 3) + [0, d, -d][ordine], Math.floor(st / 3) + [-d, d * 0.6, d * 0.6][ordine]];
  }
  /** Il sigillo di una parola: i punti toccati, uno per lettera, nell'ordine in cui si legge. */
  function sigillo(parola) {
    const L = pulisci(parola);
    if (!L.length) throw new Error("Middah: scrivi una parola ebraica");
    return { parola: L.join(""), lettere: L, punti: L.map(postoSigillo) };
  }
  const tratto = (P, X, Y) => P.map((p, i) => `${i ? "L" : "M"}${X(p[0])} ${Y(p[1])}`).join(" ");
  /** Il sigillo sul suo quadrato: la griglia sottile, la linea, un cerchio vuoto dove comincia e un punto pieno dove finisce. */
  function svgSigillo(sig, lato = 1200, colore = "#1B2A56", griglia = "#7FA2DC") {
    const s = lato * 0.86 / 3, X = x => (lato / 2 + (x - 1) * s).toFixed(2), Y = y => (lato / 2 + (y - 1) * s).toFixed(2);
    const a = sig.punti[0], b = sig.punti[sig.punti.length - 1], w = lato / 1200;
    let o = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lato} ${lato}" width="${lato}" height="${lato}">`;
    for (const v of [0.5, 1.5]) o += `<line x1="${X(v)}" y1="${Y(-0.5)}" x2="${X(v)}" y2="${Y(2.5)}" stroke="${griglia}" stroke-width="${w}"/><line x1="${X(-0.5)}" y1="${Y(v)}" x2="${X(2.5)}" y2="${Y(v)}" stroke="${griglia}" stroke-width="${w}"/>`;
    o += `<path d="${tratto(sig.punti, X, Y)}" fill="none" stroke="${colore}" stroke-width="${3.2 * w}" stroke-linejoin="round" stroke-linecap="round"/>`;
    o += `<circle cx="${X(a[0])}" cy="${Y(a[1])}" r="${13 * w}" fill="none" stroke="${colore}" stroke-width="${2.6 * w}"/><circle cx="${X(b[0])}" cy="${Y(b[1])}" r="${8 * w}" fill="${colore}"/>`;
    return o + "</svg>";
  }
  /** Il sigillo ripetuto r volte girando intorno al centro del quadrato: la forma viene dalla parola, la misura dalle ripetizioni. */
  function svgSigilloGiro(sig, r, lato = 1200, colore = "#1B2A56", spessore = 1.5) {
    r = Math.max(1, Math.round(r));
    const R = Math.max(...sig.punti.map(p => Math.hypot(p[0] - 1, p[1] - 1))) || 1, s = lato * 0.46 / R;
    let o = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lato} ${lato}" width="${lato}" height="${lato}">`;
    for (let j = 0; j < r; j++) {
      const t = 2 * Math.PI * j / r, co = Math.cos(t), si = Math.sin(t);
      const P = sig.punti.map(p => [(p[0] - 1) * co - (p[1] - 1) * si, (p[0] - 1) * si + (p[1] - 1) * co]);
      o += `<path d="${tratto(P, x => (lato / 2 + x * s).toFixed(2), y => (lato / 2 + y * s).toFixed(2))}" fill="none" stroke="${colore}" stroke-width="${spessore}" stroke-linejoin="round" stroke-linecap="round"/>`;
    }
    return o + "</svg>";
  }

  const Middah = { postoSigillo, sigillo, svgSigillo, svgSigilloGiro, AB, FIN, stanza, stanze, pulisci, valore, frazione, leggiSvolta, gradi, scrivi, chiusura, kAmmessi, svoltaPer, traccia, figura, chiaveSorelle, svgLinea };
  if (typeof module !== "undefined" && module.exports) module.exports = Middah;
  else radice.Middah = Middah;
})(typeof window !== "undefined" ? window : globalThis);
