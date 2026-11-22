/* Meditazioni cabalistiche: la famiglia di una sefirah come polvere di lettere.
   È la tavola 22 di meaning-machine/esperimenti-middah portata sul sito. Geometria, tempi, regola della musica
   e numeri sono quelli della tavola; cambia solo il modo di disegnare, perché la pagina resti leggera:
   - i granelli sono punti di WebGL che pescano la lettera da un atlante preparato una volta;
   - posizioni e luce di ogni granello si calcolano nella scheda grafica, a ogni quadro passano solo sei numeri;
   - l'alone non sfoca la tela intera: la polvere si disegna su una tela nascosta, si rimpicciolisce e si sfoca
     in piccolo, a un quarto e a un ottavo del lato, poi si somma;
   - la tela segue lo schermo fino a un tetto, il giro si ferma quando la pagina non è in vista;
   - il suono si scarica e parte solo dopo un tocco.
   Espone window.Polvere. Ha bisogno di window.Middah. */
(function () {
  "use strict";
  const SEFIROT = [["כתר", 13], ["חכמה", 32], ["בינה", 50], ["חסד", 31], ["גבורה", 42], ["תפארת", 26],
    ["נצח", 40], ["הוד", 15], ["יסוד", 18], ["מלכות", 10], ["דעת", 11]];
  const U = 1600;                      // il lato della tavola d'origine: tutte le misure sono in questi punti
  const M = 4000, TIENI = 10, MIGRA = 12, ALONE = 46, NEBBIA = 1.35, SFUMA = 2.4, LUCE_NASCITA = 0.6;
  const TETTO = 1600, QUADRI = 30;     // lato massimo della tela in punti veri, quadri al secondo
  const LETTERE = [..."אבגדהוזחטיכלמנסעפצקרשתךםןףץ"], CELLA = 128, CORPO = 96;
  const dolce = e => e * e * (3 - 2 * e);
  const caso = (() => { let s = 11; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const campana = () => caso() + caso() + caso() - 1.5;
  // ogni granello: scarto dalla linea, fase, passo dell'oscillazione, corpo, luce. Uno su tre sta nel nucleo, gli altri nell'alone
  const G = Array.from({ length: M }, (_, i) => {
    const nucleo = i % 3 === 0, larg = (nucleo ? 9 : ALONE) * NEBBIA;
    return { dx: campana() * larg, dy: campana() * larg, f: caso() * 6.28, w: 0.2 + caso() * 0.45,
      c: nucleo ? Math.round(15 + caso() * caso() * 26) : Math.round(8 + caso() * 9), a: nucleo ? 0.3 + caso() * 0.55 : 0.08 + caso() * 0.22, nucleo };
  });

  /** I giri di partenza: il k ammesso più vicino a r·m/6, cioè la svolta più vicina a 60 gradi. */
  function kVicino(r, m) {
    const K = Middah.kAmmessi(r, m), meta = r * m / 6;
    return K.reduce((b, k) => Math.abs(k - meta) < Math.abs(b - meta) ? k : b, K[0]);
  }

  let tela, gl, quale = 0, KK = [], ki = 0, A, B, t0 = 0, ora = 0, tieni = TIENI, gira = false, inVista = true, avviso = () => {};
  const figura = i => { const [w, r] = SEFIROT[quale]; return Middah.figura(w, { r, k: KK[((i % KK.length) + KK.length) % KK.length] }); };
  /** I posti dei granelli lungo la linea della figura: x, y, lettera. */
  function granelli(F) {
    const s = U * 0.4 / F.raggio, X = p => U / 2 + (p[0] - F.baricentro[0]) * s, Y = p => U / 2 + (p[1] - F.baricentro[1]) * s, tot = F.numeri.lunghezza;
    const out = new Float32Array(M * 3); let t = 0, fatta = 0;
    for (let i = 0; i < M; i++) {
      const d = (i + 0.5) / M * tot;
      while (t < F.tratti.length - 1 && fatta + F.tratti[t].stanza < d) { fatta += F.tratti[t].stanza; t++; }
      const T = F.tratti[t], u = (d - fatta) / T.stanza;
      out[i * 3] = X(T.da) + (X(T.a) - X(T.da)) * u; out[i * 3 + 1] = Y(T.da) + (Y(T.a) - Y(T.da)) * u; out[i * 3 + 2] = LETTERE.indexOf(T.lettera);
    }
    return out;
  }

  /* ------------------------------------------------------------------ la musica, come nella tavola 22 */
  const UNITA = 0.2, LEGATO = 0.5, RESPIRO = 0.14, VOL_NOME = 1.4, VOL_ARPA = 0.9;
  let AC = null, USCITA, ECO = null, BORD = [], FA = null, nj = 0, prossima = 0, detto = false, bordonePronto = false, ultimoNome = -99, voluto = false;
  const ARPA = {}, NOMI = [], PICCHI = new WeakMap();
  const FILE_NOMI = ["00_keter", "01_chokhmah", "02_binah", "03_chesed", "04_gevurah", "05_tiferet", "06_netzach", "07_hod", "08_yesod", "09_malkhut", "10_daat"];
  const ottava = c => Math.floor(Middah.AB.indexOf(Middah.FIN[c] || c) / 9);
  // la tonica sta su un semitono: il la grave più la svolta della figura arrotondata
  const tonicaMidi = F => 45 + Math.round(12 * F.theta_gradi / 360), hz = m => 440 * Math.pow(2, (m - 69) / 12), tonica = F => hz(tonicaMidi(F));
  const PENTA = [0, 3, 5, 7, 10];
  /* Le vocali come toni: holam alto e hiriq basso da Idel su Abulafia; l'ordine dei tre di mezzo è una deduzione, non una fonte.
     Una lettera senza vocale propria risuona piano sul tono della vocale vicina. */
  const VOCALI = { "כתר": "ss-", "חכמה": "q-q-", "בינה": "h-q-", "חסד": "ss-", "גבורה": "-u-q-", "תפארת": "h-ss-", "נצח": "sp-", "הוד": "o--", "יסוד": "-o--", "מלכות": "p-u--", "דעת": "pp-" };
  const GRADO = { h: 0, s: 1, q: 2, p: 2, u: 3, o: 5 };
  function tono(F, i) {
    const v = VOCALI[F.parola] || ""; let k = i;
    if (!GRADO.hasOwnProperty(v[i])) { k = -1; for (let j = i - 1; j >= 0; j--) if (GRADO.hasOwnProperty(v[j])) { k = j; break; } if (k < 0) for (let j = i + 1; j < v.length; j++) if (GRADO.hasOwnProperty(v[j])) { k = j; break; } }
    return { grado: k < 0 ? 0 : GRADO[v[k]], piena: k === i };
  }
  const midiNota = (F, i, n = 0) => { let dir = ((n * F.theta_gradi) % 360 + 360) % 360; if (360 - dir < 1e-6) dir = 0; /* un giro compiuto vale zero, anche se il conto in virgola cade appena sotto */ const g = tono(F, i).grado + Math.floor(dir / 360 * 5 + 1e-6); return tonicaMidi(F) + PENTA[g % 5] + 12 * Math.floor(g / 5); };
  const freq = (F, i, n = 0) => hz(midiNota(F, i, n));
  const suonaOra = () => AC && AC.state === "running";

  async function scarica(via) { for (let prova = 0; prova < 3; prova++) { try { const r = await fetch(via); if (r.ok) return await AC.decodeAudioData(await r.arrayBuffer()); } catch (e) {} await new Promise(z => setTimeout(z, 300)); } return null; }
  async function caricaArpa() { const note = []; for (let m = 45; m <= 84; m++) note.push(m); for (let i = 0; i < note.length; i += 8) await Promise.all(note.slice(i, i + 8).map(async m => { if (!ARPA[m]) ARPA[m] = await scarica("/meditazioni/arpa/" + m + ".mp3"); })); }
  async function caricaNomi() { await Promise.all(FILE_NOMI.map(async (f, i) => { if (!NOMI[i]) NOMI[i] = await scarica("/meditazioni/nomi/" + f + ".mp3"); })); }

  /** Accende o spegne il suono. Va chiamata da un tocco. */
  function suono() {
    // conta ciò che è stato chiesto, non lo stato: appena creato il contesto non risulta ancora in moto
    if (AC) { voluto = !voluto; voluto ? AC.resume() : AC.suspend(); setTimeout(() => avviso(stato()), 150); return; }
    AC = new (window.AudioContext || window.webkitAudioContext)(); voluto = true;
    USCITA = AC.createGain(); USCITA.gain.value = 0.9; USCITA.connect(AC.destination);
    const eco = AC.createConvolver(), n = AC.sampleRate * 5, imp = AC.createBuffer(2, n, AC.sampleRate);
    for (let c = 0; c < 2; c++) { const d = imp.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2); }
    eco.buffer = imp; const bagnato = AC.createGain(); bagnato.gain.value = 0.65; USCITA.connect(eco); eco.connect(bagnato); bagnato.connect(AC.destination); ECO = eco;
    caricaArpa().then(caricaNomi).then(() => { if (ora - t0 < tieni - 5) dici(quale); });
    // il bordone: tonica, quinta e ottava
    for (const [rapporto, vol] of [[1, 0.04], [1.5, 0.018], [2, 0.014]]) { const o = AC.createOscillator(), g = AC.createGain(); o.type = "sine"; o.frequency.value = tonica(FA) * rapporto; g.gain.value = vol; o.connect(g); g.connect(USCITA); o.start(); BORD.push([o, rapporto, g, vol]); }
    setTimeout(() => avviso(stato()), 150);
  }
  /** Il nome detto: mai due a meno di sei secondi, tutti allo stesso livello. */
  function dici(i) {
    if (!suonaOra() || !NOMI[i] || AC.currentTime - ultimoNome < 6) return; ultimoNome = AC.currentTime;
    const s = AC.createBufferSource(), g = AC.createGain(), manda = AC.createGain(); s.buffer = NOMI[i];
    let picco = 0.01; const d = NOMI[i].getChannelData(0); for (let k = 0; k < d.length; k += 5) picco = Math.max(picco, Math.abs(d[k]));
    g.gain.value = VOL_NOME * 0.35 / picco; manda.gain.value = 0.5; s.connect(g); g.connect(AC.destination); g.connect(manda); manda.connect(ECO); s.start();
  }
  function arpa(m, dura, forza) {
    const b = ARPA[Math.max(45, Math.min(84, m))]; if (!b) return;
    let picco = PICCHI.get(b); if (!picco) { picco = 0.01; const d = b.getChannelData(0); for (let k = 0; k < d.length; k += 3) picco = Math.max(picco, Math.abs(d[k])); PICCHI.set(b, picco); }
    const t = AC.currentTime, sorg = AC.createBufferSource(), g = AC.createGain(); sorg.buffer = b; g.gain.setValueAtTime(VOL_ARPA * forza * 0.42 / picco, t);
    g.gain.setTargetAtTime(0, t + dura * 2 + 1.6, 0.9); sorg.connect(g); g.connect(USCITA); sorg.start(t);
  }
  // l'arpa dà il tocco, e sotto ogni nota una voce morbida entra piano e resta a lungo: lega una nota alla seguente
  function nota(f, dura, ordine, forza) {
    if (!suonaOra()) return;
    arpa(Math.round(69 + 12 * Math.log2(f / 440)), dura, forza); forza *= LEGATO;
    const t = AC.currentTime, g = AC.createGain(), entra = 0.35, coda = 2.6 + dura * 2.5, picco = 0.2 * forza;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(picco, t + entra); g.gain.setTargetAtTime(picco * 0.55, t + entra, dura * 0.8 + 0.2); g.gain.setTargetAtTime(0.0001, t + entra + dura, coda / 4); g.connect(USCITA);
    for (const [m, v, scarto] of [[1, 1, 0], [1, 0.6, 4], [2, [0.06, 0.14, 0.24][ordine], 0]]) { const o = AC.createOscillator(), h = AC.createGain(); o.type = "sine"; o.frequency.value = f * m; o.detune.value = scarto; h.gain.value = v; o.connect(h); h.connect(g); o.start(t); o.stop(t + entra + dura + coda); }
  }
  // il bordone non scivola: si spegne, cambia nota in silenzio e torna
  function bordoneVerso(f) {
    if (!AC || !BORD.length || Math.abs(BORD[0][0].frequency.value - f) < 0.5) return;
    for (const [o, rapporto, g, vol] of BORD) { const a = AC.currentTime; g.gain.cancelScheduledValues(a); g.gain.setTargetAtTime(0, a, 0.35); o.frequency.setValueAtTime(f * rapporto, a + 1.5); g.gain.setTargetAtTime(vol, a + 1.6, 0.7); }
  }
  // una figura nuova è in vista: da capo la parola, e quante volte suonarla
  function intona(F, t) {
    detto = false; FA = F; nj = 0; prossima = t + 0.4; const parola = F.somma_stanze * UNITA; tieni = Math.max(1, Math.round(TIENI / parola)) * parola + 0.6;
    bordoneVerso(tonica(F)); bordonePronto = false;
  }
  function musica(t, e) {
    // la voce chiama: il nome si dice poco prima che la polvere si muova, e la figura nuova nasce in risposta
    if (e >= -1.3 / MIGRA && !detto) { detto = true; dici(quale); }
    if (!FA) return;
    if (t - prossima > 2) prossima = t;
    const tace = e >= 1 - 4.5 / MIGRA; // le note tacciono prima dell'arrivo, così le code si spengono prima della tonalità nuova
    if (tace && !bordonePronto) { bordonePronto = true; bordoneVerso(tonica(figura(ki + 1))); }
    while (t >= prossima) {
      const n = nj % FA.tratti.length, T = FA.tratti[n];
      // la figura entra piano e cresce in otto note; ogni nota ha una forza un poco sua; ogni parola ha un arco
      const entra = Math.min(1, 0.35 + 0.085 * nj), arco = 0.82 + 0.18 * Math.sin(Math.PI * (T.i + 0.5) / FA.m), umano = 0.86 + 0.28 * Math.random();
      if (!tace) nota(freq(FA, T.i, n), T.stanza * UNITA, ottava(T.lettera), (e < 0 ? 1 : 0.4) * (tono(FA, T.i).piena ? 1 : 0.38) * entra * arco * umano);
      // il tempo respira, e la fine della parola si allarga appena
      prossima += T.stanza * UNITA * (1 + (Math.random() - 0.5) * RESPIRO + (T.i === FA.m - 1 ? RESPIRO * 0.6 : 0)); nj++;
    }
  }

  /* ------------------------------------------------------------------ il disegno */
  const VS_GRANI = `#version 300 es
precision highp float;
layout(location=0) in vec4 g1; layout(location=1) in vec3 g2; layout(location=2) in vec3 pa; layout(location=3) in vec3 pb;
uniform float e, t, neb, vel, nascita, scala, massimo;
out float vA; out vec3 vC; flat out float vL;
void main(){
  vec2 p = mix(pa.xy, pb.xy, e) + g1.xy*neb + 6.0*vec2(sin(t*g1.w+g1.z), cos(t*g1.w*0.8+g1.z));
  vA = min(1.0, g2.y*(g2.z>0.5?vel:1.0)*(0.72+0.28*sin(t*g1.w*1.7+g1.z*2.0))*nascita);
  vC = g2.x>26.0 ? vec3(236.,242.,252.)/255. : vec3(127.,162.,220.)/255.;
  vL = e<0.5 ? pa.z : pb.z;
  gl_Position = vec4(p.x/800.0-1.0, 1.0-p.y/800.0, 0.0, 1.0);
  gl_PointSize = min(massimo, g2.x*${(CELLA / CORPO).toFixed(4)}*scala);
}`;
  const FS_GRANI = `#version 300 es
precision mediump float; precision mediump sampler2DArray;
uniform sampler2DArray atlante; in float vA; in vec3 vC; flat in float vL; out vec4 o;
void main(){ float a = texture(atlante, vec3(gl_PointCoord, vL), -0.75).a*vA; o = vec4(vC*a, a); }`;
  const VS_PIENO = `#version 300 es
out vec2 uv; void main(){ vec2 p = vec2(float((gl_VertexID<<1)&2), float(gl_VertexID&2)); uv = p; gl_Position = vec4(p*2.0-1.0, 0.0, 1.0); }`;
  const FS_SFOCA = `#version 300 es
precision highp float; uniform sampler2D src; uniform vec2 passo; uniform float sigma; in vec2 uv; out vec4 o;
void main(){ vec4 s = vec4(0.0); float tot = 0.0;
  for(int i=-24;i<=24;i++){ float x = float(i); if(abs(x) > 3.0*sigma) continue; float w = exp(-x*x/(2.0*sigma*sigma)); s += texture(src, uv+passo*x)*w; tot += w; }
  o = s/tot; }`;
  const FS_SOMMA = `#version 300 es
precision highp float; uniform sampler2D netta, stretta, larga; in vec2 uv; out vec4 o;
float grana(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
void main(){ vec3 c = texture(netta, uv).rgb + 0.6*texture(stretta, uv).rgb + 0.55*texture(larga, uv).rgb;
  c = clamp(c + (grana(gl_FragCoord.xy)-0.5)/255.0, 0.0, 1.0); o = vec4(c, max(c.r, max(c.g, c.b))); }`;

  let P = {}, tele = null, lato = 0, vao, bufA, bufB, mezzoFloat = false, massimoPunto = 64;
  function programma(vs, fs) {
    const p = gl.createProgram();
    for (const [tipo, testo] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) { const s = gl.createShader(tipo); gl.shaderSource(s, testo); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); gl.attachShader(p, s); }
    gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i < n; i++) { const nome = gl.getActiveUniform(p, i).name; u[nome] = gl.getUniformLocation(p, nome); }
    return { p, u };
  }
  function telaNascosta(l, mip) {
    const tx = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tx);
    gl.texImage2D(gl.TEXTURE_2D, 0, mezzoFloat ? gl.RGBA16F : gl.RGBA8, l, l, 0, gl.RGBA, mezzoFloat ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tx, 0);
    return { tx, fb, l };
  }
  function misura() {
    const r = tela.getBoundingClientRect(), l = Math.max(320, Math.min(TETTO, Math.round(r.width * Math.min(2, window.devicePixelRatio || 1))));
    if (l === lato || !gl) return; lato = l; tela.width = tela.height = l;
    if (tele) for (const k in tele) { gl.deleteTexture(tele[k].tx); gl.deleteFramebuffer(tele[k].fb); }
    const q = Math.max(64, Math.round(l / 4)), o = Math.max(32, Math.round(l / 8));
    tele = { netta: telaNascosta(l, true), q1: telaNascosta(q), q2: telaNascosta(q), o1: telaNascosta(o), o2: telaNascosta(o) };
  }
  function prepara() {
    gl = tela.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: "default" });
    if (!gl) return false;
    mezzoFloat = !!gl.getExtension("EXT_color_buffer_float") || !!gl.getExtension("EXT_color_buffer_half_float");
    massimoPunto = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1];
    P = { grani: programma(VS_GRANI, FS_GRANI), sfoca: programma(VS_PIENO, FS_SFOCA), somma: programma(VS_PIENO, FS_SOMMA) };
    // l'atlante: ogni lettera scritta una volta, bianca, in una cella sua
    const c = document.createElement("canvas"); c.width = c.height = CELLA; const x = c.getContext("2d", { willReadFrequently: true });
    const at = gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, at);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 8, gl.RGBA8, CELLA, CELLA, LETTERE.length);
    x.textAlign = "center"; x.textBaseline = "middle"; x.font = `${CORPO}px "Frank Ruhl Libre"`; x.fillStyle = "#fff";
    LETTERE.forEach((l, i) => { x.clearRect(0, 0, CELLA, CELLA); x.fillText(l, CELLA / 2, CELLA / 2); gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, CELLA, CELLA, 1, gl.RGBA, gl.UNSIGNED_BYTE, x.getImageData(0, 0, CELLA, CELLA)); });
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    P.atlante = at;
    // i granelli: ciò che non cambia mai sta in due file di numeri, i posti sulle due figure in altre due
    vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const d1 = new Float32Array(M * 4), d2 = new Float32Array(M * 3);
    G.forEach((g, i) => { d1.set([g.dx, g.dy, g.f, g.w], i * 4); d2.set([g.c, g.a, g.nucleo ? 1 : 0], i * 3); });
    const fila = (posto, dati, n, uso) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, dati, uso); gl.enableVertexAttribArray(posto); gl.vertexAttribPointer(posto, n, gl.FLOAT, false, 0, 0); return b; };
    fila(0, d1, 4, gl.STATIC_DRAW); fila(1, d2, 3, gl.STATIC_DRAW);
    bufA = fila(2, A || new Float32Array(M * 3), 3, gl.DYNAMIC_DRAW); bufB = fila(3, B || new Float32Array(M * 3), 3, gl.DYNAMIC_DRAW);
    gl.bindVertexArray(null); lato = 0; tele = null; misura();
    return true;
  }
  function posti() { if (!gl) return; gl.bindBuffer(gl.ARRAY_BUFFER, bufA); gl.bufferData(gl.ARRAY_BUFFER, A, gl.DYNAMIC_DRAW); gl.bindBuffer(gl.ARRAY_BUFFER, bufB); gl.bufferData(gl.ARRAY_BUFFER, B, gl.DYNAMIC_DRAW); }

  function disegna(t, e, nascita) {
    const neb = 1 + SFUMA * Math.sin(Math.PI * e), vel = 1 - 0.35 * Math.sin(Math.PI * e), T = tele, s = lato / U;
    gl.disable(gl.DEPTH_TEST);
    // la polvere, netta, sulla tela nascosta
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.netta.fb); gl.viewport(0, 0, lato, lato); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(P.grani.p); const u = P.grani.u;
    gl.uniform1f(u.e, e); gl.uniform1f(u.t, t); gl.uniform1f(u.neb, neb); gl.uniform1f(u.vel, vel); gl.uniform1f(u.nascita, nascita); gl.uniform1f(u.scala, s); gl.uniform1f(u.massimo, massimoPunto);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, P.atlante); gl.uniform1i(u.atlante, 0);
    gl.bindVertexArray(vao); gl.drawArrays(gl.POINTS, 0, M); gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
    gl.bindTexture(gl.TEXTURE_2D, T.netta.tx); gl.generateMipmap(gl.TEXTURE_2D);
    // i due aloni: sfocature fatte in piccolo, prima in orizzontale poi in verticale
    gl.useProgram(P.sfoca.p); const v = P.sfoca.u; gl.uniform1i(v.src, 0);
    const passa = (da, a, px, py, sigma) => { gl.bindFramebuffer(gl.FRAMEBUFFER, a.fb); gl.viewport(0, 0, a.l, a.l); gl.bindTexture(gl.TEXTURE_2D, da.tx); gl.uniform2f(v.passo, px / a.l, py / a.l); gl.uniform1f(v.sigma, sigma); gl.drawArrays(gl.TRIANGLES, 0, 3); };
    const s14 = Math.max(0.6, 14 * s * T.q1.l / lato), s46 = Math.max(0.8, Math.round(34 * NEBBIA) * s * T.o1.l / lato);
    passa(T.netta, T.q1, 1, 0, s14); passa(T.q1, T.q2, 0, 1, s14);
    passa(T.netta, T.o1, 1, 0, s46); passa(T.o1, T.o2, 0, 1, s46);
    // la somma, sulla tela in vista
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, lato, lato); gl.useProgram(P.somma.p); const w = P.somma.u;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T.netta.tx); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, T.q2.tx); gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, T.o2.tx);
    gl.uniform1i(w.netta, 0); gl.uniform1i(w.stretta, 1); gl.uniform1i(w.larga, 2); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.activeTexture(gl.TEXTURE0);
  }

  function quadro(t) {
    let e = (t - t0 - tieni) / MIGRA;
    if (e >= 1) { ki++; A = B; B = granelli(figura(ki + 1)); posti(); t0 = t; e = -1; intona(figura(ki), t); avviso(stato()); }
    musica(t, e);
    // quanta luce: cresce mentre la figura nuova si forma, è piena quando è nata, poi si posa piano
    const nascita = 1 + LUCE_NASCITA * (e >= 0 ? e * e : Math.exp(-(t - t0) / 3.5));
    disegna(t, e < 0 ? 0 : dolce(e), nascita);
  }

  /** Sceglie la sefirah. La polvere in vista migra verso la prima figura della famiglia nuova, senza nero. */
  function parola(i) {
    const prima = A == null; let e = prima ? 0 : (ora - t0 - tieni) / MIGRA;
    quale = i; const [w, r] = SEFIROT[i], m = Middah.pulisci(w).length;
    KK = Middah.kAmmessi(r, m).filter(k => k <= r * m / 2); ki = Math.max(0, KK.indexOf(kVicino(r, m)));
    if (prima) { A = granelli(figura(ki)); B = granelli(figura(ki + 1)); t0 = ora; intona(figura(ki), ora); }
    else {
      if (e > 0) { // a metà di un passaggio: la polvere riparte da dove si trova, nebbia compresa
        e = dolce(Math.min(1, e)); const neb = SFUMA * Math.sin(Math.PI * e), C = new Float32Array(M * 3);
        for (let j = 0; j < M; j++) { C[j * 3] = A[j * 3] + (B[j * 3] - A[j * 3]) * e + G[j].dx * neb; C[j * 3 + 1] = A[j * 3 + 1] + (B[j * 3 + 1] - A[j * 3 + 1]) * e + G[j].dy * neb; C[j * 3 + 2] = e < 0.5 ? A[j * 3 + 2] : B[j * 3 + 2]; }
        A = C; detto = false;
      }
      ki--; B = granelli(figura(ki + 1)); t0 = ora - tieni;
    }
    posti(); avviso(stato());
  }
  /** Chiama subito la sorella, se la figura è ferma. */
  function sorella() { if (ora - t0 < tieni) t0 = ora - tieni; }
  /** Lo stato per la pagina: quale sefirah, quale figura fra quante, la svolta in gradi, il suono. In viaggio vale la figura d'arrivo. */
  function stato() {
    const inViaggio = ora - t0 >= tieni, n = ((((inViaggio ? ki + 1 : ki) % KK.length) + KK.length) % KK.length), F = figura(n);
    return { sefirah: quale, figura: n + 1, figure: KK.length, svolta: F.theta_gradi, suono: !!AC && voluto, contesto: AC ? AC.state : null, inViaggio };
  }

  /* ------------------------------------------------------------------ il giro */
  let ultimo = 0, vecchio = 0; const tempi = [], cadenze = [];
  function giro(adesso) {
    if (!gira) return; requestAnimationFrame(giro);
    if (adesso - ultimo < 1000 / QUADRI - 4) return;
    const dt = Math.min(0.25, (adesso - ultimo) / 1000); if (ultimo) cadenze.push(adesso - ultimo); ultimo = adesso; ora += dt;
    const a = performance.now(); quadro(ora); if (Polvere.misuraFine) gl.finish(); tempi.push(performance.now() - a);
    if (tempi.length > 600) { tempi.shift(); cadenze.shift(); }
    if (stato().inViaggio !== vecchio) { vecchio = stato().inViaggio; avviso(stato()); }
  }
  function regola() {
    const deve = inVista && !document.hidden && !!gl;
    if (deve && !gira) { gira = true; ultimo = 0; requestAnimationFrame(giro); if (AC && voluto) AC.resume(); }
    else if (!deve && gira) { gira = false; if (AC) AC.suspend(); }
  }
  /** Avvia il pezzo sulla tela. opzioni: { sefirah, avviso(stato) }. Restituisce false se il browser non ha WebGL 2. */
  async function avvia(telaPagina, opzioni = {}) {
    tela = telaPagina; avviso = opzioni.avviso || avviso;
    try { await document.fonts.load(`${CORPO}px "Frank Ruhl Libre"`, "אבג"); } catch (e) {}
    parola(opzioni.sefirah || 0);
    let va = false; try { va = prepara(); } catch (e) { console.warn("Polvere:", e); gl = null; }
    if (!va) return false;
    posti();
    tela.addEventListener("webglcontextlost", ev => { ev.preventDefault(); gl = null; regola(); });
    tela.addEventListener("webglcontextrestored", () => { try { prepara(); posti(); } catch (e) { gl = null; } regola(); });
    new ResizeObserver(misura).observe(tela);
    new IntersectionObserver(v => { inVista = v[v.length - 1].isIntersecting; regola(); }, { threshold: 0.02 }).observe(tela);
    document.addEventListener("visibilitychange", regola);
    regola(); return true;
  }
  /** Il tempo per quadro, in millesimi di secondo: media e peggiore del lavoro, e la cadenza vera fra un quadro e l'altro. */
  function tempo() {
    const ord = a => [...a].sort((x, y) => x - y), med = a => a.reduce((s, v) => s + v, 0) / (a.length || 1), o = ord(tempi), c = ord(cadenze);
    return { quadri: tempi.length, lato, lavoro_medio: +med(tempi).toFixed(2), lavoro_95: +(o[Math.floor(o.length * 0.95)] || 0).toFixed(2), lavoro_peggiore: +(o[o.length - 1] || 0).toFixed(2), cadenza_media: +med(cadenze).toFixed(1), cadenza_95: +(c[Math.floor(c.length * 0.95)] || 0).toFixed(1), mezzoFloat };
  }
  const Polvere = { avvia, parola, sorella, suono, stato, tempo, SEFIROT, misuraFine: false };
  window.Polvere = Polvere;
})();
