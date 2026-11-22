/* Come nasce una figura: la linea della Middah tracciata un tratto alla volta, nuda, perché si veda il metodo.
   La prima volta la parola si scrive piano, con la lettera e la stanza accanto a ogni tratto; poi si ripete
   più in fretta finché la linea si chiude. Il cursore dei giri mostra la famiglia: stessa parola, stessa misura,
   svolta diversa. Disegna solo mentre traccia, poi si ferma. Ha bisogno di window.Middah. Espone window.Nascita. */
(function () {
  "use strict";
  const SEFIROT = [["כתר", 13], ["חכמה", 32], ["בינה", 50], ["חסד", 31], ["גבורה", 42], ["תפארת", 26],
    ["נצח", 40], ["הוד", 15], ["יסוד", 18], ["מלכות", 10], ["דעת", 11]];
  const CELESTE = "127,162,220", GHIACCIO = "236,242,252";
  let tela, x, lato = 0, quale = 0, KK = [], fi = 0, F = null, fatti = 0, ultimo = 0, gira = false, avviso = () => {};

  function kVicino(r, m) { const K = Middah.kAmmessi(r, m), meta = r * m / 6; return K.reduce((b, k) => Math.abs(k - meta) < Math.abs(b - meta) ? k : b, K[0]); }
  function misura() {
    const l = Math.max(320, Math.min(1400, Math.round(tela.getBoundingClientRect().width * Math.min(2, window.devicePixelRatio || 1))));
    if (l !== lato) { lato = l; tela.width = tela.height = l; disegna(); }
  }
  function disegna() {
    if (!F || !lato) return;
    const L = lato, u = L / 900, s = L * 0.43 / F.raggio, X = p => L / 2 + (p[0] - F.baricentro[0]) * s, Y = p => L / 2 + (p[1] - F.baricentro[1]) * s;
    x.clearRect(0, 0, L, L); x.lineJoin = x.lineCap = "round";
    const interi = Math.floor(fatti), resto = fatti - interi, T = F.tratti;
    const pezzo = (da, a, colore, spessore) => {
      if (a <= da) return; x.beginPath(); x.moveTo(X(T[da].da), Y(T[da].da));
      for (let i = da; i < Math.min(a, interi); i++) x.lineTo(X(T[i].a), Y(T[i].a));
      if (a > interi && interi < T.length && resto > 0) { const t = T[interi]; x.lineTo(X(t.da) + (X(t.a) - X(t.da)) * resto, Y(t.da) + (Y(t.a) - Y(t.da)) * resto); }
      x.strokeStyle = colore; x.lineWidth = spessore * u; x.stroke();
    };
    const fine = Math.min(T.length, interi + (resto > 0 ? 1 : 0));
    // le ripetizioni in celeste, la prima scrittura della parola in chiaro sopra
    pezzo(Math.min(F.m, interi), fine, `rgba(${CELESTE},.78)`, 1.3);
    pezzo(0, Math.min(F.m, fine), `rgba(${GHIACCIO},1)`, 2.4);
    // dove comincia: un cerchio vuoto
    x.beginPath(); x.arc(X(T[0].da), Y(T[0].da), 6 * u, 0, 7); x.strokeStyle = `rgba(${GHIACCIO},.9)`; x.lineWidth = 1.4 * u; x.stroke();
    // accanto a ogni tratto della prima scrittura, la lettera e la sua stanza
    x.textAlign = "center"; x.textBaseline = "middle";
    for (let i = 0; i < Math.min(F.m, interi + (resto > 0.5 ? 1 : 0)); i++) {
      const t = T[i], mx = (X(t.da) + X(t.a)) / 2, my = (Y(t.da) + Y(t.a)) / 2, dx = X(t.a) - X(t.da), dy = Y(t.a) - Y(t.da), n = Math.hypot(dx, dy) || 1, o = 24 * u;
      let px = mx - dy / n * o, py = my + dx / n * o; // di lato al tratto, verso l'esterno della figura
      if (Math.hypot(px - L / 2, py - L / 2) < Math.hypot(mx - L / 2, my - L / 2)) { px = mx + dy / n * o; py = my - dx / n * o; }
      x.font = `${Math.round(25 * u)}px "Frank Ruhl Libre"`; x.fillStyle = `rgba(${GHIACCIO},1)`; x.fillText(t.lettera, px - 9 * u, py);
      x.font = `${Math.round(15 * u)}px "Space Mono", monospace`; x.fillStyle = `rgba(${CELESTE},1)`; x.fillText(String(t.stanza), px + 11 * u, py + 2 * u);
    }
    // la testa della linea mentre scrive
    if (fatti < T.length) { const t = T[Math.min(interi, T.length - 1)], hx = X(t.da) + (X(t.a) - X(t.da)) * resto, hy = Y(t.da) + (Y(t.a) - Y(t.da)) * resto; x.beginPath(); x.arc(hx, hy, 3.4 * u, 0, 7); x.fillStyle = `rgba(${GHIACCIO},1)`; x.fill(); }
  }
  function stato() {
    const [w, r] = SEFIROT[quale], tot = F.tratti.length, i = Math.min(tot, Math.floor(fatti) + (fatti < tot ? 1 : 0));
    return { sefirah: quale, parola: w, misura: r, lettere: F.lettere, stanze: F.stanze, figura: fi + 1, figure: KK.length, giri: KK[fi], svolta: F.theta_gradi,
      tratto: i, tratti: tot, ripetizione: Math.min(r, Math.floor((Math.max(1, i) - 1) / F.m) + 1), chiusa: fatti >= tot, lunghezza: F.numeri.lunghezza, totale: F.numeri.valore_totale };
  }
  function giro(adesso) {
    if (!gira) return;
    const dt = Math.max(0, Math.min(0.1, (adesso - ultimo) / 1000 || 0)); ultimo = adesso; // il primo quadro può portare un tempo appena precedente
    // la prima scrittura va piano, un tratto ogni otto decimi; il resto si compie in sette secondi circa
    const tot = F.tratti.length, passo = fatti < F.m ? 1.25 : Math.max(9, (tot - F.m) / 7);
    fatti = Math.min(tot, fatti + passo * dt); disegna(); avviso(stato());
    if (fatti >= tot) { gira = false; return; }
    requestAnimationFrame(giro);
  }
  function figura() { const [w, r] = SEFIROT[quale]; F = Middah.figura(w, { r, k: KK[fi] }); }
  /** Traccia da capo la figura in vista. */
  function traccia() { fatti = 0; if (!gira) { gira = true; ultimo = performance.now(); requestAnimationFrame(giro); } }
  /** Sceglie il nome: si riparte dalla figura con la svolta più vicina a 60 gradi, tracciata da capo. */
  function parola(i) { quale = i; const [w, r] = SEFIROT[i], m = Middah.pulisci(w).length; KK = Middah.kAmmessi(r, m).filter(k => k <= r * m / 2); fi = Math.max(0, KK.indexOf(kVicino(r, m))); figura(); traccia(); avviso(stato()); }
  /** Sceglie la figura nella famiglia, da 1 a quante sono: appare già chiusa, per confrontarle scorrendo. */
  function sorella(n) { fi = Math.max(0, Math.min(KK.length - 1, n - 1)); figura(); gira = false; fatti = F.tratti.length; disegna(); avviso(stato()); }
  async function avvia(telaPagina, opzioni = {}) {
    tela = telaPagina; x = tela.getContext("2d"); avviso = opzioni.avviso || avviso;
    try { await Promise.all([document.fonts.load('25px "Frank Ruhl Libre"', "אבג"), document.fonts.load('15px "Space Mono"', "123")]); } catch (e) {}
    quale = opzioni.sefirah || 0; const [w, r] = SEFIROT[quale], m = Middah.pulisci(w).length; KK = Middah.kAmmessi(r, m).filter(k => k <= r * m / 2); fi = Math.max(0, KK.indexOf(kVicino(r, m))); figura(); fatti = 0;
    new ResizeObserver(misura).observe(tela); misura(); avviso(stato());
    // comincia a tracciare quando la tela entra in vista
    const o = new IntersectionObserver(v => { if (v.some(e => e.isIntersecting)) { o.disconnect(); traccia(); } }, { threshold: 0.4 }); o.observe(tela);
  }
  window.Nascita = { avvia, parola, sorella, traccia, stato, SEFIROT };
})();
