/* Meditazioni cabalistiche: le due materie di linea sottile, fili e radiografia.
   Sono la tavola 28 di meaning-machine/esperimenti-middah portata sul sito. La geometria è quella di Middah,
   il tempo, la musica e il nome detto restano a polvere.js, che chiama qui solo per disegnare.
   - Fili: da ogni punto del nome un filo dritto allo stesso punto di una, due e tre ripetizioni dopo;
     le curve nascono dall'incrocio. Alle svolte, le lettere fanno da chiodi.
   - Radiografia: la linea ripetuta verso il centro, ogni volta più piccola e un poco voltata; la sorella nasce
     dal centro e arriva per ultima al bordo.
   Nel passaggio ogni punto gira intorno al centro per la via più breve mentre cambia distanza, così la figura
   tiene la sua misura. Si disegna su una tela 2D sua; l'alone è la tela rimpicciolita e sfocata.
   Espone window.Linee. */
(function () {
  "use strict";
  const L = 1400, NF = 3600, MIGRA = 12, AGIO = 0.8, TETTO = 2048, RADA = 5;
  const TINTE = { ghiaccio: "236,242,252", celeste: "127,162,220", cobalto: "46,79,163" };
  const dolce = e => e * e * (3 - 2 * e), stretto = e => e < 0 ? 0 : e > 1 ? 1 : e;
  let tela = null, x, s0, y, s1, z, lato = 0, k = 1, A = null, B = null, NASCE = 1;
  const PX = new Float32Array(NF), PY = new Float32Array(NF);

  // le lettere dei chiodi si scrivono una volta sola e poi si posano come immagini
  const SPR = new Map();
  function sprite(ch) {
    let s = SPR.get(ch); if (s) return s;
    s = document.createElement("canvas"); s.width = s.height = 40; const c = s.getContext("2d");
    c.font = '26px "Frank Ruhl Libre"'; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = `rgb(${TINTE.ghiaccio})`; c.fillText(ch, 20, 21);
    SPR.set(ch, s); return s;
  }
  function posa(ch, px, py, corpo, alfa) {
    if (alfa < 0.012) return; const q = corpo / 26 * k;
    y.globalAlpha = alfa > 1 ? 1 : alfa; y.setTransform(q, 0, 0, q, lato / 2 + (px - L / 2) * k, lato / 2 + (py - L / 2) * k); y.drawImage(sprite(ch), -20, -20);
  }
  const filo = (tinta, alfa, spessore) => { y.strokeStyle = `rgba(${TINTE[tinta]},${Math.min(1, alfa * NASCE)})`; y.lineWidth = Math.max(spessore, 0.75 / k); };
  const rada = (ax, ay) => { const n = NF / RADA, dx = new Float32Array(n), dy = new Float32Array(n); for (let i = 0; i < n; i++) { dx[i] = ax[i * RADA]; dy[i] = ay[i * RADA]; } return [dx, dy]; };

  /** Tutto ciò che serve di una figura: la fila fitta a passi uguali lungo la linea, le svolte, il posto di ogni svolta nella fila. */
  function prepara(F) {
    const s = L * 0.4 / F.raggio, X = p => L / 2 + (p[0] - F.baricentro[0]) * s, Y = p => L / 2 + (p[1] - F.baricentro[1]) * s, tot = F.numeri.lunghezza;
    const fx = new Float32Array(NF), fy = new Float32Array(NF); let t = 0, fatta = 0;
    for (let i = 0; i < NF; i++) {
      const d = (i + 0.5) / NF * tot;
      while (t < F.tratti.length - 1 && fatta + F.tratti[t].stanza < d) { fatta += F.tratti[t].stanza; t++; }
      const T = F.tratti[t], u = (d - fatta) / T.stanza, ax = X(T.da), ay = Y(T.da);
      fx[i] = ax + (X(T.a) - ax) * u; fy[i] = ay + (Y(T.a) - ay) * u;
    }
    const n = F.tratti.length, vx = new Float32Array(n), vy = new Float32Array(n), vl = [], vi = new Int32Array(n); let cammino = 0;
    F.tratti.forEach((T, i) => { vx[i] = X(T.da); vy[i] = Y(T.da); vl.push(T.lettera); vi[i] = Math.min(NF - 1, Math.round(cammino / tot * NF)); cammino += T.stanza; });
    const [dx, dy] = rada(fx, fy);
    return { famiglia: F.parola + " " + F.r, r: F.r, tratti: n, fx, fy, vx, vy, vl, vi, dx, dy };
  }

  // la figura di mezzo: ogni punto gira intorno al centro per la via più breve mentre cambia distanza
  function mescola(ax, ay, bx, by, e) {
    const n = ax.length, c = L / 2;
    for (let i = 0; i < n; i++) {
      const ra = Math.hypot(ax[i] - c, ay[i] - c), rb = Math.hypot(bx[i] - c, by[i] - c), ta = Math.atan2(ay[i] - c, ax[i] - c); let d = Math.atan2(by[i] - c, bx[i] - c) - ta;
      if (d > Math.PI) d -= 6.283185; else if (d < -Math.PI) d += 6.283185;
      const r = ra + (rb - ra) * e, a = ta + d * e; PX[i] = c + r * Math.cos(a); PY[i] = c + r * Math.sin(a);
    }
  }
  const sorelle = () => A.vx && A.famiglia === B.famiglia;

  function fili(e) {
    const neb = Math.sin(Math.PI * e), r = (e < 0.5 ? A : B).r, rado = Math.min(1, Math.sqrt(170 / Math.max(A.tratti, B.tratti)));
    mescola(A.fx, A.fy, B.fx, B.fy, e);
    [[1, "celeste", 0.2], [2, "celeste", 0.14], [3, "cobalto", 0.34]].forEach(([h, tinta, alfa]) => {
      const salto = Math.round(NF / r * h); filo(tinta, alfa * rado * (1 + 0.4 * neb), 0.8); y.beginPath();
      for (let i = (h - 1) * 3; i < NF; i += 9) { const j = (i + salto) % NF; y.moveTo(PX[i], PY[i]); y.lineTo(PX[j], PY[j]); }
      y.stroke();
      // nel passaggio i fili si sparpagliano e da soli si farebbero scuri: una seconda passata celeste li tiene in luce
      if (neb > 0.02) { filo("celeste", 0.3 * rado * neb, 0.9); y.stroke(); }
    });
    // i chiodi: fra sorelle sono gli stessi; cambiando nome quelli di prima sfumano e i nuovi affiorano
    if (sorelle()) for (let i = 0; i < A.vi.length; i++) posa(A.vl[i], PX[A.vi[i]], PY[A.vi[i]], 12, 0.75);
    else { for (let i = 0; i < A.vi.length; i++) posa(A.vl[i], PX[A.vi[i]], PY[A.vi[i]], 12, 0.75 * (1 - e)); for (let i = 0; i < B.vi.length; i++) posa(B.vl[i], PX[B.vi[i]], PY[B.vi[i]], 12, 0.75 * e); }
  }

  function radiografia(t, tau, tieni) {
    // fra sorelle la linea passa per le svolte; cambiando nome le svolte non corrispondono e si usa la fila diradata
    const pari = sorelle(), ax = pari ? A.vx : A.dx, ay = pari ? A.vy : A.dy, bx = pari ? B.vx : B.dx, by = pari ? B.vy : B.dy, n = ax.length;
    // le figure con molti tratti hanno meno echi, più distanti e più lievi, così il centro non diventa una massa piena
    const nv = Math.max(A.tratti, B.tratti), J = Math.max(14, Math.min(44, Math.round(44 * Math.sqrt(48 / nv)))), passo = Math.pow(0.15, 1 / (J - 1));
    const giro = (0.045 + 0.012 * Math.sin(t / 14)) * 44 / J, rado = Math.min(1, 48 / nv), attesa = 5, dura = MIGRA - attesa;
    for (let j = J - 1; j >= 0; j--) {
      const s = Math.pow(passo, j), a = j * giro, ca = Math.cos(a) * s, sa = Math.sin(a) * s, e = dolce(stretto((tau - tieni - (J - 1 - j) / (J - 1) * attesa) / dura));
      filo(j === 0 ? "ghiaccio" : j % 2 ? "celeste" : "cobalto", j === 0 ? 0.75 : (j % 2 ? 0.5 : 0.8) * Math.pow(s, 2.2) * rado + 0.012, j === 0 ? 1.1 : 0.8);
      mescola(ax, ay, bx, by, e); y.beginPath();
      for (let v = 0; v <= n; v++) { const w = v % n, dx = PX[w] - L / 2, dy = PY[w] - L / 2, px = L / 2 + dx * ca - dy * sa, py = L / 2 + dx * sa + dy * ca; v ? y.lineTo(px, py) : y.moveTo(px, py); }
      y.stroke();
    }
  }

  function misura() {
    const r = tela.getBoundingClientRect(), l = Math.max(320, Math.min(TETTO, Math.round(r.width * Math.min(2, window.devicePixelRatio || 1))));
    if (l === lato) return; lato = l; k = l / L * AGIO;
    tela.width = tela.height = s0.width = s0.height = l; s1.width = s1.height = Math.max(80, Math.round(l / 4));
  }

  /** Disegna un quadro. materia: "fili" o "radiografia"; tau: secondi dalla nascita della figura; er: avanzamento del passaggio, negativo a figura ferma. */
  function quadro(materia, t, tau, tieni, er, nascita) {
    if (!tela || !A || !B) return; misura(); NASCE = nascita;
    const e = dolce(stretto(er)), o = lato / 2 - L / 2 * k;
    y.setTransform(1, 0, 0, 1, 0, 0); y.globalAlpha = 1; y.globalCompositeOperation = "source-over"; y.clearRect(0, 0, lato, lato);
    y.globalCompositeOperation = "lighter"; y.setTransform(k, 0, 0, k, o, o);
    if (materia === "radiografia") radiografia(t, tau, tieni); else fili(e);
    y.setTransform(1, 0, 0, 1, 0, 0); y.globalAlpha = 1;
    // l'alone: la tela rimpicciolita e sfocata, sommata a quella netta
    const q = s1.width; z.clearRect(0, 0, q, q); z.filter = `blur(${Math.max(1, 5 * k).toFixed(1)}px)`; z.drawImage(s0, 0, 0, q, q); z.filter = "none";
    x.globalCompositeOperation = "source-over"; x.globalAlpha = 1; x.clearRect(0, 0, lato, lato);
    x.globalCompositeOperation = "lighter"; x.globalAlpha = materia === "radiografia" ? 0.6 : 0.4; x.drawImage(s1, 0, 0, lato, lato); x.globalAlpha = 1; x.drawImage(s0, 0, 0);
  }

  /** La tela su cui disegnare. */
  function avvia(telaPagina) {
    tela = telaPagina; x = tela.getContext("2d"); if (!x) { tela = null; return false; }
    s0 = document.createElement("canvas"); y = s0.getContext("2d"); s1 = document.createElement("canvas"); z = s1.getContext("2d"); lato = 0;
    return true;
  }
  /** Le due figure di partenza. */
  function inizia(FA, FB) { A = prepara(FA); B = prepara(FB); }
  /** Il passaggio è compiuto: la figura d'arrivo diventa quella in vista, e si prepara la seguente. */
  function passa(FB) { A = B; B = prepara(FB); }
  /** Si cambia nome. A metà di un passaggio la figura riparte da dove si trova: e è l'avanzamento, già addolcito. */
  function cambia(FB, e) {
    if (!A) return;
    if (e > 0) {
      mescola(A.fx, A.fy, B.fx, B.fy, e); const fx = PX.slice(), fy = PY.slice(), [dx, dy] = rada(fx, fy), da = e < 0.5 ? A : B;
      A = { famiglia: "", r: da.r, tratti: da.tratti, fx, fy, vx: null, vy: null, vl: da.vl, vi: da.vi, dx, dy };
    }
    B = prepara(FB);
  }
  window.Linee = { avvia, inizia, passa, cambia, quadro };
})();
