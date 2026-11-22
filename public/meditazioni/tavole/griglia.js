/* Griglia di lettere: la linea della Middah resa su una griglia regolare, ogni cella porta la lettera
   del tratto che la attraversa. La geometria viene dal motore, qui si decide solo la materia. */
(function (radice) {
  "use strict";
  const NOTTE = "#1B2A56", CELESTE = "127,162,220", GHIACCIO = "236,242,252";

  /** I giri di partenza: il k ammesso più vicino a r·m/6, cioè la svolta più vicina a 60 gradi. */
  function kVicino(r, m) {
    const K = Middah.kAmmessi(r, m), meta = r * m / 6;
    return K.reduce((b, k) => Math.abs(k - meta) < Math.abs(b - meta) ? k : b, K[0]);
  }
  function figuraDi(parola, r, k) {
    const m = Middah.pulisci(parola).length;
    return Middah.figura(parola, { r, k: k || kVicino(r, m) });
  }
  const virgola = (n, d = 3) => n.toFixed(d).replace(/\.?0+$/, "").replace(".", ",");

  /** Disegna la figura F sulla tela c.
      col: celle per lato. min, max: corpo della lettera in parti di cella, dal passaggio più lieve al più denso.
      soglia: quanta linea serve per il corpo pieno, in parti del massimo.
      sovrapposte: tutte le lettere che passano nella cella, una sull'altra, a luce sommata.
      vuote: "nulla", "punti" oppure "lettere", la parola scritta di seguito da destra a sinistra.
      firma: una riga di codice sotto la figura. */
  function disegna(c, F, o) {
    o = Object.assign({ lato: 1100, col: 62, min: 0.62, max: 1.12, soglia: 0.5, sovrapposte: false, vuote: "nulla", firma: false }, o);
    const L = o.lato, H = L + (o.firma ? Math.round(L * 0.075) : 0), n = o.col, cw = L / n;
    c.width = L; c.height = H;
    const x = c.getContext("2d");
    x.fillStyle = o.fondo || NOTTE; x.fillRect(0, 0, L, H);
    const s = L * 0.44 / F.raggio, X = p => L / 2 + (p[0] - F.baricentro[0]) * s, Y = p => L / 2 + (p[1] - F.baricentro[1]) * s;
    const G = Array.from({ length: n * n }, () => ({ n: 0, per: {} }));
    for (const t of F.tratti) {
      const ax = X(t.da), ay = Y(t.da), bx = X(t.a), by = Y(t.a), passi = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 2));
      for (let i = 0; i <= passi; i++) {
        const cx = Math.floor((ax + (bx - ax) * i / passi) / cw), cy = Math.floor((ay + (by - ay) * i / passi) / cw);
        if (cx >= 0 && cx < n && cy >= 0 && cy < n) { const q = G[cy * n + cx]; q.n++; q.per[t.lettera] = (q.per[t.lettera] || 0) + 1; }
      }
    }
    const max = Math.max(...G.map(q => q.n)) * o.soglia;
    x.textAlign = "center"; x.textBaseline = "middle";
    const scrivi = (lett, v, px, py) => {
      x.font = `${Math.max(4, Math.round(cw * (o.min + v * (o.max - o.min))))}px "Frank Ruhl Libre"`;
      x.fillStyle = `rgba(${v > 0.65 ? GHIACCIO : CELESTE},${0.4 + v * 0.6})`;
      x.fillText(lett, px, py);
    };
    let vuota = 0;
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) {
      const col = n - 1 - k, q = G[r * n + col], px = col * cw + cw / 2, py = r * cw + cw / 2; // si scorre da destra, come si legge
      if (!q.n) {
        if (o.vuote === "punti") { x.fillStyle = `rgba(${CELESTE},0.3)`; x.beginPath(); x.arc(px, py, Math.max(1.1, cw * 0.07), 0, 7); x.fill(); }
        else if (o.vuote === "lettere") { x.font = `${Math.round(cw * 0.5)}px "Frank Ruhl Libre"`; x.fillStyle = `rgba(${CELESTE},0.16)`; x.fillText(F.lettere[vuota % F.m], px, py); }
        vuota++; continue;
      }
      if (o.sovrapposte) {
        x.globalCompositeOperation = "lighter";
        for (const [lett, quante] of Object.entries(q.per).sort((a, b) => b[1] - a[1])) scrivi(lett, Math.min(1, quante / max), px, py);
        x.globalCompositeOperation = "source-over";
      } else scrivi(Object.entries(q.per).sort((a, b) => b[1] - a[1])[0][0], Math.min(1, q.n / max), px, py);
    }
    if (o.firma) {
      const y = L + (H - L) * 0.42;
      x.textBaseline = "middle"; x.textAlign = "left";
      x.font = `${Math.round(L * 0.0165)}px "Space Mono"`; x.fillStyle = `rgba(${CELESTE},0.75)`;
      x.fillText(`middah  r ${F.r}  k ${F.k}  svolta ${virgola(F.theta_gradi)}°  lunghezza ${F.numeri.lunghezza}  valore ${F.numeri.valore_totale}`, L * 0.035, y);
      x.textAlign = "right"; x.font = `${Math.round(L * 0.034)}px "Frank Ruhl Libre"`; x.fillStyle = `rgba(${GHIACCIO},0.9)`;
      x.fillText(F.parola, L * 0.965, y);
    }
  }

  const SEFIROT = [["כתר", 13, "Keter"], ["חכמה", 32, "Chokhmah"], ["בינה", 50, "Binah"], ["חסד", 31, "Chesed"], ["גבורה", 42, "Gevurah"],
    ["תפארת", 26, "Tiferet"], ["נצח", 40, "Netzach"], ["הוד", 15, "Hod"], ["יסוד", 18, "Yesod"], ["מלכות", 10, "Malkhut"], ["דעת", 11, "Da'at"]];
  const pronti = () => Promise.all([document.fonts.load('20px "Frank Ruhl Libre"', "אבג"), document.fonts.load('20px "Space Mono"', "abc")]);

  radice.Griglia = { kVicino, figuraDi, disegna, virgola, SEFIROT, pronti };
})(window);
