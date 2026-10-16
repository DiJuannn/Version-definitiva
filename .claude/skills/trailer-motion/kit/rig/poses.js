/* =====================================================================
   AJOLOTE v2 · biblioteca de poses (GSAP 3)
   - Una sola gsap.timeline({paused:true}) para todo: cada función recibe
     el tiempo absoluto `t` y devuelve el tiempo en que termina la acción.
   - Determinista: PRNG con semilla, sin relojes, sin repeat:-1.
   - Cada tween SVG lleva svgOrigin; el contenedor HTML lleva transformOrigin.
   - Ningún elemento animado tiene transform inicial (ni CSS ni atributo):
     los transforms estáticos viven en <g> envoltorios que no se animan.
   Uso:
     const tl = gsap.timeline({ paused: true });
     const ax = AxRig(tl);           // prefijo "ax" por defecto
     ax.init(0); ax.place(0, {x:960, y:900, s:0.8});
     let t = ax.swimIn(0.2, {from:{x:-200,y:700}, to:{x:960,y:900}});
     t = ax.wave(t + 0.1); ...
     ax.base(0, END);  ax.blinks(0, END);   // al final (usa las ventanas ocupadas)
   ===================================================================== */
(function (root) {
  "use strict";

  /* ---------- paleta ---------- */
  const COL = {
    pink: "#f7c1cc", light: "#fde3e8", shade: "#eea3b5", line: "#d0708a",
    tail: "#f5b8c6", stripe: "#e98ca3",
    gill: "#ff6a45", gillCore: "#ff8a5e", gillLine: "#d9452f", vein: "#b8331f",
    eye: "#2a1520", mouth: "#7a1f37", tongue: "#ff7f99", cheek: "#ff8aa3", brow: "#c05f7b",
  };

  /* ---------- cola procedural (un único path que ondula sin costuras) ---------- */
  const TAIL = { x0: 24, y0: -40, n: 18, len: 210, a0: 14, k: -6.6, w0: 34, fin: 8 };
  const f1 = (v) => String(Math.round(v * 10) / 10);
  function crPath(pts, move) {
    let d = (move === false ? " L" : "M") + f1(pts[0][0]) + " " + f1(pts[0][1]);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += " C" + f1(p1[0] + (p2[0] - p0[0]) / 6) + " " + f1(p1[1] + (p2[1] - p0[1]) / 6) + " " +
        f1(p2[0] - (p3[0] - p1[0]) / 6) + " " + f1(p2[1] - (p3[1] - p1[1]) / 6) + " " + f1(p2[0]) + " " + f1(p2[1]);
    }
    return d;
  }
  // s = { ph1, amp1, ph2, amp2, lift, curl }
  function tailPaths(s) {
    const T = TAIL, seg = T.len / T.n, rad = Math.PI / 180;
    let x = T.x0, y = T.y0, a = T.a0 - (s.lift || 0) * 10;
    const sp = [[x, y, a]];
    for (let i = 1; i <= T.n; i++) {
      const u = i / T.n;
      a += T.k * (1 + (s.curl || 0)) - (s.lift || 0) * 2.2 * u
        + (s.amp1 || 0) * 4.2 * u * Math.sin((s.ph1 || 0) - 0.48 * i)
        + (s.amp2 || 0) * 9.0 * u * Math.sin((s.ph2 || 0) - 0.62 * i);
      x += Math.cos(a * rad) * seg; y += Math.sin(a * rad) * seg;
      sp.push([x, y, a]);
    }
    const top = [], bot = [], str = [];
    sp.forEach((p, i) => {
      const u = i / T.n, w = T.w0 * Math.pow(1 - u, 0.85) + 0.6;
      const nx = -Math.sin(p[2] * rad), ny = Math.cos(p[2] * rad); // normal "abajo" de la marcha
      const fin = u > 0.12 ? T.fin * Math.pow(Math.sin(Math.PI * Math.min(1, (u - 0.12) / 0.85)), 1.4) : 0;
      const up = w * 0.52 + fin, dn = w * 0.48;
      if (i < T.n) { top.push([p[0] - nx * up, p[1] - ny * up]); bot.push([p[0] + nx * dn, p[1] + ny * dn]); }
      if (i >= 2 && i <= T.n - 2) str.push([p[0] - nx * (up * 0.42), p[1] - ny * (up * 0.42)]);
    });
    const tip = [sp[T.n][0], sp[T.n][1]];
    const ring = top.concat([tip], bot.reverse());
    return { body: crPath(ring) + " Z", stripe: crPath(str) };
  }

  /* ---------- bocas: todas con la misma estructura (M C C Z) para poder morphear ---------- */
  // [lx, ly, rx, ry, ctrlArriba, ctrlAbajo, inset]
  const MOUTHS = {
    smile:   [-17, -170, 17, -170, -162, -151, 6],
    grin:    [-20, -172, 20, -172, -168, -139, 4],
    talkA:   [-13, -169, 13, -169, -173, -148, 3],
    talkB:   [-10, -168, 10, -168, -167, -155, 3],
    o:       [-8, -167, 8, -167, -181, -151, 0.6],
    wow:     [-12, -168, 12, -168, -191, -142, 0],
    laugh:   [-23, -173, 23, -173, -177, -131, 2],
    hmm:     [-11, -164, 11, -166, -165, -160, 4],
    smirk:   [-15, -166, 19, -173, -161, -154, 6],
    ouch:    [-17, -163, 17, -163, -171, -155, 2],
  };
  function mouthD(n) {
    const m = MOUTHS[n] || MOUTHS.smile, [lx, ly, rx, ry, uy, by, c] = m;
    return `M${lx} ${ly} C${lx + c} ${uy} ${rx - c} ${uy} ${rx} ${ry} C${rx - c} ${by} ${lx + c} ${by} ${lx} ${ly} Z`;
  }

  function mulberry(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* =================================================================== */
  function AxRig(tl, opt) {
    opt = opt || {};
    const P = opt.prefix || "ax";
    const q = (id) => "#" + P + "-" + id;
    const byId = (id) => document.getElementById(P + "-" + id);
    const WRAP = "#" + P;
    const TO = "220px 380px"; // pies del personaje dentro del contenedor 440x420
    const rnd = mulberry(opt.seed || 7);
    const busy = []; // ventanas en las que no se parpadea
    const ORIG = { shadow: "0 4", head: "0 -132", headBobR: "0 -132" };
    const SIDES = ["L", "R"];
    const GILLS = ["1", "2", "3"];

    const o = (id) => ORIG[id] || "0 0";
    // Anti-solapes: por elemento+propiedad se recuerda el último tween; si uno nuevo
    // empieza mientras el anterior sigue vivo, el anterior se acorta para acabar justo ahí
    // (así nunca hay dos tweens peleando por la misma propiedad).
    const NOKEY = { svgOrigin: 1, transformOrigin: 1, duration: 1, ease: 1, yoyo: 1, repeat: 1, immediateRender: 1, onUpdate: 1, onComplete: 1, delay: 1 };
    const reg = {};
    function track(id, vars, tw) {
      const st = tw.startTime(), en = st + tw.totalDuration();
      Object.keys(vars).forEach((k) => {
        if (NOKEY[k]) return;
        const arr = reg[id + "|" + k] || (reg[id + "|" + k] = []);
        arr.forEach((p) => {
          const ps = p.startTime(), pe = ps + p.totalDuration();
          if (ps < st && pe > st + 1e-4) p.totalDuration(Math.max(0.001, st - ps));
          else if (ps > st && en > ps + 1e-4) tw.totalDuration(Math.max(0.001, ps - st));
        });
        arr.push(tw);
      });
      return tw;
    }
    const add = (id, tw, vars, t) => { tl.add(tw, t); return track(id, vars, tw); };
    const A = (id, v, t) => add(id, gsap.to(q(id), Object.assign({ svgOrigin: o(id) }, v)), v, t);
    const S = (id, v, t) => tl.set(q(id), Object.assign({ svgOrigin: o(id) }, v), t);
    const F = (id, a, b, t) => add(id, gsap.fromTo(q(id), Object.assign({ svgOrigin: o(id) }, a), Object.assign({ svgOrigin: o(id), immediateRender: false }, b)), b, t);
    const W = (v, t) => add("wrap", gsap.to(WRAP, Object.assign({ transformOrigin: TO }, v)), v, t);
    const both = (fn) => SIDES.forEach(fn);

    /* ---- cola ---- */
    const tailS = { ph1: 0, amp1: 1, ph2: 0, amp2: 0, lift: 0, curl: 0 };
    const tailBody = byId("tail"), tailStripe = byId("tailStripe");
    const drawTail = () => { const p = tailPaths(tailS); tailBody.setAttribute("d", p.body); tailStripe.setAttribute("d", p.stripe); };
    const TT = (v, t) => add("tail", gsap.to(tailS, Object.assign({ onUpdate: drawTail }, v)), v, t);

    const ax = { tl, tailPaths, mouthD, MOUTHS, COL };
    // orientación actual (1 = cola a la derecha). Las poses se construyen en orden
    // cronológico, así que basta con un estado de "construcción".
    let curFlip = 1;

    /* ------------------------------------------------------------ */
    /* utilidades de cara                                            */
    /* ------------------------------------------------------------ */
    ax.mouth = (t, name, d = 0.12, ease = "power2.out") => {
      if (!d) S("mouth", { attr: { d: mouthD(name) } }, t);
      else A("mouth", { attr: { d: mouthD(name) }, duration: d, ease }, t);
      return t + d;
    };
    // style: "open" | "happy" | "sqz" | "wink"  ; o {L:"open", R:"wink"}
    ax.eyes = (t, style) => {
      const st = typeof style === "string" ? { L: style, R: style } : style;
      both((s) => ["open", "happy", "sqz", "wink"].forEach((k) => S(k + s, { opacity: st[s] === k ? 1 : 0 }, t)));
      return t;
    };
    ax.look = (t, x = 0, y = 0, d = 0.2, ease = "power3.out") => {
      both((s) => { A("look" + s, { x, y, duration: d, ease }, t); A("hl" + s, { x: -x * 0.45, y: -y * 0.45, duration: d, ease }, t); });
      A("face", { x: x * 0.7, y: y * 0.5, duration: d * 1.4, ease: "power2.out" }, t);
      return t + d;
    };
    const BROWS = {
      neutral: [[0, 0], [0, 0]], up: [[-8, 0], [-8, 0]], worried: [[-4, -14], [-4, -14]],
      angry: [[2, 14], [2, 14]], think: [[-9, -6], [2, 10]], sly: [[0, 0], [-7, -10]],
    };
    ax.brows = (t, name, d = 0.18, ease = "back.out(2)") => {
      const b = BROWS[name] || BROWS.neutral;
      A("browL", { y: b[0][0], duration: d, ease }, t); A("browLr", { rotation: b[0][1], duration: d, ease }, t);
      A("browR", { y: b[1][0], duration: d, ease }, t); A("browRr", { rotation: b[1][1], duration: d, ease }, t);
      return t + d;
    };
    ax.blush = (t, k = 1, d = 0.3) => { both((s) => A("cheek" + s, { scale: k, opacity: 0.45 + 0.25 * k, duration: d, ease: "power2.out" }, t)); return t + d; };
    ax.blink = (t) => {
      both((s) => { A("blink" + s, { scaleY: 0.08, duration: 0.06, ease: "power2.in" }, t); A("blink" + s, { scaleY: 1, duration: 0.1, ease: "power2.out" }, t + 0.07); });
      return t + 0.17;
    };
    ax.expr = (t, name, d = 0.14) => {
      const E = {
        neutral: ["open", "smile", "neutral"], happy: ["happy", "grin", "neutral"], surprise: ["open", "wow", "up"],
        think: ["open", "hmm", "think"], laugh: ["happy", "laugh", "up"], ouch: ["sqz", "ouch", "worried"],
        sly: [{ L: "open", R: "wink" }, "smirk", "sly"], worried: ["open", "o", "worried"],
      }[name];
      ax.eyes(t, E[0]); ax.mouth(t, E[1], d); ax.brows(t, E[2], d + 0.06);
      return t + d;
    };
    const markBusy = (a, b) => busy.push([a, b]);

    // gesto de branquias: k>0 abre el abanico, k<0 lo cierra/pliega hacia atrás
    const gills = (t, k, d = 0.25, ease = "back.out(2.4)", stag = 0.04) => {
      both((s, si) => GILLS.forEach((g, gi) => {
        const rot = [k, k * 0.25, -k][gi];
        A("g" + s + g, { rotation: rot, duration: d, ease }, t + gi * stag + si * 0.02);
      }));
      return t + d;
    };
    ax.gills = gills;
    // brazo "rubber hose": estira el brazo (scaleY del grupo w) para gestos legibles
    const stretch = (s, k, t, d = 0.25) => A("arm" + s + "s", { scaleY: k, duration: d, ease: k > 1 ? "back.out(2.5)" : "power2.inOut" }, t);
    ax.stretch = stretch;
    // sacudida con follow-through: abre, rebota, se asienta
    const gillFlick = (t, k = 16, d = 0.9) => {
      both((s, si) => GILLS.forEach((g, gi) => {
        const sgn = [1, 0.3, -1][gi], tt = t + gi * 0.05 + si * 0.025;
        A("g" + s + g, { rotation: k * sgn, duration: 0.12, ease: "power2.out" }, tt);
        A("g" + s + g, { rotation: 0, duration: d, ease: "elastic.out(1.1,0.32)" }, tt + 0.12);
      }));
      return t + d + 0.2;
    };
    ax.gillFlick = gillFlick;

    /* ------------------------------------------------------------ */
    /* estado inicial y capa base                                    */
    /* ------------------------------------------------------------ */
    // OJO: ninguna acción debe empezar en el mismo instante exacto que init (deja ≥ 0.02 s):
    // dos tl.set del mismo atributo en el mismo tiempo pueden resolverse distinto según el seek.
    ax.init = (t = 0, p = {}) => {
      tl.set(WRAP, { x: p.x == null ? 960 : p.x, y: p.y == null ? 900 : p.y, scale: p.s == null ? 1 : p.s, rotation: 0, transformOrigin: TO }, t);
      ["hop", "headY", "headBob", "face"].forEach((id) => S(id, { x: 0, y: 0 }, t));
      ["tilt", "flip", "squash", "breath", "head", "headBobR"].forEach((id) => S(id, { rotation: 0, scale: 1 }, t));
      both((s) => {
        S("arm" + s, { rotation: 0 }, t); S("arm" + s + "w", { rotation: 0 }, t); S("arm" + s + "s", { scaleY: 1 }, t); S("finger" + s, { opacity: 0, scale: 1 }, t);
        S("eye" + s, { scale: 1 }, t); S("blink" + s, { scaleY: 1 }, t); S("look" + s, { x: 0, y: 0 }, t); S("hl" + s, { x: 0, y: 0 }, t);
        S("brow" + s, { y: 0 }, t); S("brow" + s + "r", { rotation: 0 }, t); S("cheek" + s, { scale: 1, opacity: 0.55 }, t);
        GILLS.forEach((g) => { S("g" + s + g, { rotation: 0 }, t); });
      });
      ax.eyes(t, "open");
      S("mouth", { attr: { d: mouthD("smile") } }, t);
      S("shadow", { scaleX: 1, scaleY: 1, opacity: 1 }, t);
      S("clap", { opacity: 0, scale: 0.6, rotation: 0 }, t); S("clapY", { y: 0 }, t); S("clapStick", { rotation: 0 }, t);
      ["fxBang", "fxSpark", "fxImpact", "fxImpact2", "fxStars", "fxSweat", "th1", "th2", "th3"].forEach((id) => S(id, { opacity: 0, scale: 0.4, rotation: 0 }, t));
      ["fxBangY", "fxSweatY"].forEach((id) => S(id, { y: 0 }, t));
      tl.set(q("clipRect"), { attr: { x: -3000, y: -3000, width: 6000, height: 6000 } }, t);
      tl.set(tailS, { ph1: 0, amp1: 1, ph2: 0, amp2: 0, lift: 0, curl: 0, onComplete: drawTail }, t);
      return t;
    };

    // respiración + branquias + cola, de t0 a t1
    ax.base = (t0, t1) => {
      const D = t1 - t0, br = 1.15;
      const reps = (c) => Math.max(0, Math.floor(D / c) - 1);
      F("breath", { scaleY: 1, scaleX: 1 }, { scaleY: 1.035, scaleX: 0.986, duration: br, ease: "sine.inOut", yoyo: true, repeat: reps(br) }, t0);
      F("headBob", { y: 0 }, { y: 3, duration: br, ease: "sine.inOut", yoyo: true, repeat: reps(br) - 1 }, t0 + 0.2);
      F("headBobR", { rotation: -1.2 }, { rotation: 1.2, duration: 1.7, ease: "sine.inOut", yoyo: true, repeat: reps(1.7) - 1 }, t0 + 0.4);
      both((s, si) => GILLS.forEach((g, gi) => {
        const half = 0.78, off = gi * 0.11 + si * 0.37;
        F("g" + s + g + "w", { rotation: -5 }, { rotation: 6, duration: half, ease: "sine.inOut", yoyo: true, repeat: Math.max(0, Math.floor((D - off) / half) - 1) }, t0 + off);
      }));
      tl.fromTo(tailS, { ph1: 0, ph2: 0 }, { ph1: (D / 1.9) * Math.PI * 2, ph2: (D / 0.42) * Math.PI * 2, duration: D, ease: "none", onUpdate: drawTail, immediateRender: false }, t0);
      return t1;
    };
    ax.blinks = (t0, t1) => {
      for (let t = t0 + 1.4; t < t1 - 0.5; t += 2.3 + rnd() * 2.2) {
        if (busy.some(([a, b]) => t > a - 0.2 && t < b + 0.2)) continue;
        ax.blink(t);
        if (rnd() < 0.22) ax.blink(t + 0.24);
      }
    };

    /* ------------------------------------------------------------ */
    /* posición / desplazamientos                                    */
    /* ------------------------------------------------------------ */
    ax.place = (t, p) => {
      tl.set(WRAP, { x: p.x, y: p.y, scale: p.s == null ? 1 : p.s, transformOrigin: TO }, t);
      if (p.flip) { S("flip", { scaleX: p.flip }, t); curFlip = p.flip; }
      return t;
    };
    // salto en arco a otra posición, con anticipación y aterrizaje
    ax.hopTo = (t, p) => {
      const d = p.d || 0.6, arc = p.arc == null ? 90 : p.arc, dir = Math.sign((p.lean == null ? 1 : p.lean));
      A("squash", { scaleY: 0.86, scaleX: 1.1, duration: 0.1, ease: "power2.in" }, t);
      const t1 = t + 0.1;
      W({ x: p.x, y: p.y, scale: p.s, duration: d, ease: "power1.inOut" }, t1);
      A("hop", { y: -arc, duration: d / 2, ease: "power2.out" }, t1);
      A("hop", { y: 0, duration: d / 2, ease: "power2.in" }, t1 + d / 2);
      A("squash", { scaleY: 1.12, scaleX: 0.92, duration: 0.14, ease: "power2.out" }, t1);
      A("squash", { scaleY: 1, scaleX: 1, duration: d - 0.2, ease: "sine.inOut" }, t1 + 0.14);
      A("tilt", { rotation: 8 * dir, duration: d / 2, ease: "sine.out" }, t1);
      A("tilt", { rotation: 0, duration: d / 2, ease: "sine.in" }, t1 + d / 2);
      A("shadow", { scaleX: 0.6, opacity: 0.4, duration: d / 2, ease: "power2.out" }, t1);
      A("shadow", { scaleX: 1, opacity: 1, duration: d / 2, ease: "power2.in" }, t1 + d / 2);
      gills(t1, -12, 0.2, "power2.out");
      return land(t1 + d);
    };
    function land(t, k = 1) {
      A("squash", { scaleY: 1 - 0.16 * k, scaleX: 1 + 0.14 * k, duration: 0.07, ease: "power2.out" }, t);
      A("squash", { scaleY: 1, scaleX: 1, duration: 0.55, ease: "elastic.out(1.2,0.4)" }, t + 0.07);
      gillFlick(t, 15 * k, 0.8);
      return t + 0.45;
    }
    ax.land = land;

    // nadar desde from hasta to (coords de escenario), con estela de burbujas
    ax.swimIn = (t, p) => {
      const d = p.d || 1.5, from = p.from, to = p.to;
      const dir = Math.sign(to.x - from.x) || 1; // +1 → hacia la derecha
      const ease = "power2.out";
      tl.set(WRAP, { x: from.x, y: from.y, scale: p.s || 1, transformOrigin: TO }, t);
      S("flip", { scaleX: dir > 0 ? -1 : 1 }, t); // cola siempre detrás de la marcha
      curFlip = dir > 0 ? -1 : 1;
      S("shadow", { opacity: 0 }, t);
      W({ x: to.x, duration: d, ease }, t);
      W({ y: to.y, duration: d, ease: "sine.inOut" }, t);
      // ondulación vertical de nado (arcos)
      F("hop", { y: 0 }, { y: -26, duration: d / 4, ease: "sine.inOut", yoyo: true, repeat: 3 }, t);
      S("tilt", { rotation: 14 * dir }, t);
      A("tilt", { rotation: -7 * dir, duration: 0.35, ease: "power2.out" }, t + d - 0.25);
      A("tilt", { rotation: 0, duration: 0.6, ease: "elastic.out(1,0.45)" }, t + d + 0.1);
      S("squash", { scaleX: 1.08, scaleY: 0.94 }, t);
      A("squash", { scaleX: 1, scaleY: 1, duration: 0.5, ease: "elastic.out(1,0.5)" }, t + d - 0.1);
      both((s) => S("arm" + s, { rotation: 38 }, t));
      both((s) => A("arm" + s, { rotation: 0, duration: 0.5, ease: "back.out(2.2)" }, t + d - 0.15));
      gills(t, -18, 0.01);
      gillFlick(t + d - 0.2, 18, 1.0);
      TT({ amp2: 1, amp1: 0.3, duration: 0.01 }, t);
      TT({ amp2: 0, amp1: 1, duration: 0.8, ease: "power2.inOut" }, t + d - 0.3);
      A("shadow", { opacity: 1, duration: 0.4 }, t + d - 0.2);
      ax.expr(t, "neutral", 0.01); ax.mouth(t, "o", 0.01); ax.mouth(t + d - 0.1, "grin", 0.2); ax.mouth(t + d + 0.6, "smile", 0.25);
      ax.look(t, dir * 4, 0, 0.01);
      ax.look(t + d - 0.1, 0, 0, 0.3);
      // al llegar, giro a cámara (la cola cambia de lado con un "swish")
      if (p.face !== false && curFlip !== 1) ax.turn(t + d + 0.2, 1);
      // estela de burbujas en coordenadas de escenario
      const e = gsap.parseEase(ease), sc = p.s || 1;
      const n = p.bubbles == null ? 14 : p.bubbles;
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n * 0.92, tb = t + u * d;
        const bx = from.x + (to.x - from.x) * e(u) - dir * (130 + rnd() * 70) * sc, by = from.y + (to.y - from.y) * u - (40 + rnd() * 110) * sc;
        bubble(tb, bx, by, (0.55 + rnd() * 0.9) * sc);
      }
      return t + d + 0.5;
    };
    // girarse: scaleX pasa por ~0 con un pequeño salto, como un giro de 180°
    ax.turn = (t, to) => {
      const from = curFlip;
      if (from === to) return t;
      A("flip", { scaleX: from * 0.08, duration: 0.11, ease: "power2.in" }, t);
      A("flip", { scaleX: to, duration: 0.2, ease: "back.out(2)" }, t + 0.11);
      A("hop", { y: -14, duration: 0.11, ease: "power2.out" }, t);
      A("hop", { y: 0, duration: 0.16, ease: "power2.in" }, t + 0.11);
      TT({ amp2: 0.8, duration: 0.1 }, t); TT({ amp2: 0, duration: 0.4, ease: "power2.out" }, t + 0.2);
      curFlip = to;
      return t + 0.32;
    };
    let bubI = 0;
    const bubs = Array.from(document.querySelectorAll("#" + P + "-trail .ax-bub"));
    function bubble(t, x, y, s) {
      if (!bubs.length) return;
      const b = bubs[bubI++ % bubs.length], life = 0.9 + rnd() * 0.6, rise = 90 + rnd() * 90;
      tl.fromTo(b, { x, y, scale: s * 0.3, opacity: 0 }, { x: x + (rnd() - 0.5) * 30, y: y - rise, scale: s, opacity: 0.9, duration: life * 0.35, ease: "power2.out", immediateRender: false }, t);
      tl.to(b, { y: y - rise * 1.8, opacity: 0, scale: s * 1.15, duration: life * 0.65, ease: "power1.in" }, t + life * 0.35);
    }
    ax.bubble = bubble;

    /* ------------------------------------------------------------ */
    /* gestos                                                        */
    /* ------------------------------------------------------------ */
    // saludar (brazo derecho por defecto)
    ax.wave = (t, p = {}) => {
      const s = p.side || "R", n = p.times || 3;
      A("tilt", { rotation: s === "R" ? -4 : 4, duration: 0.3, ease: "power2.out" }, t);
      A("arm" + s, { rotation: 22, duration: 0.1, ease: "power2.in" }, t); // anticipación
      A("arm" + s, { rotation: -138, duration: 0.32, ease: "back.out(2)" }, t + 0.1);
      stretch(s, 1.3, t + 0.1);
      F("arm" + s + "w", { rotation: 0 }, { rotation: -26, duration: 0.15, ease: "sine.inOut", yoyo: true, repeat: n * 2 - 1 }, t + 0.36);
      A("head", { rotation: s === "R" ? 6 : -6, duration: 0.35, ease: "back.out(2)" }, t + 0.08);
      ax.expr(t + 0.1, "happy", 0.16); ax.blush(t + 0.1, 1.25);
      gillFlick(t + 0.12, 10, 0.7);
      const te = t + 0.36 + n * 0.3;
      A("arm" + s, { rotation: 0, duration: 0.4, ease: "back.out(1.6)" }, te);
      stretch(s, 1, te, 0.3);
      A("head", { rotation: 0, duration: 0.5, ease: "back.out(1.6)" }, te);
      A("tilt", { rotation: 0, duration: 0.5, ease: "power2.inOut" }, te);
      ax.expr(te, "neutral", 0.18); ax.blush(te, 1);
      markBusy(t, te);
      return te + 0.4;
    };

    // señalar: dir = "left" | "right" | "up"
    ax.point = (t, p = {}) => {
      const dir = p.dir || "right", hold = p.hold == null ? 0.6 : p.hold;
      const F_ = curFlip, vis = dir === "left" ? "L" : "R";
      const s = F_ === 1 ? vis : (vis === "L" ? "R" : "L"); // brazo que queda en ese lado de pantalla
      const ang = dir === "up" ? -122 : -96;
      stretch(s, dir === "up" ? 1.5 : 1.32, t + 0.1, 0.28);
      const lx = dir === "left" ? -5 : dir === "right" ? 5 : 1, ly = dir === "up" ? -5 : -1;
      A("arm" + s, { rotation: 14, duration: 0.1, ease: "power2.in" }, t);
      A("arm" + s, { rotation: ang, duration: 0.28, ease: "back.out(2.6)" }, t + 0.1);
      S("finger" + s, { opacity: 1 }, t + 0.16);
      F("finger" + s, { scale: 0.3 }, { scale: 1, duration: 0.2, ease: "back.out(3)" }, t + 0.16);
      ax.look(t + 0.05, lx * F_, ly, 0.18);
      const lean = dir === "left" ? -5 : dir === "right" ? 5 : 0;
      A("tilt", { rotation: lean, duration: 0.35, ease: "back.out(2)" }, t + 0.08);
      A("head", { rotation: (dir === "up" ? -4 : lean * 0.8) * F_, duration: 0.35, ease: "back.out(2)" }, t + 0.1);
      ax.mouth(t + 0.12, "grin", 0.14); ax.brows(t + 0.1, "up");
      // pequeño "toque" de énfasis
      A("arm" + s + "w", { rotation: -8, duration: 0.1, ease: "power2.out" }, t + 0.42);
      A("arm" + s + "w", { rotation: 0, duration: 0.3, ease: "elastic.out(1,0.4)" }, t + 0.52);
      const te = t + 0.4 + hold;
      if (p.keep) return te;
      ax.unpoint(te, { side: s });
      return te + 0.35;
    };
    ax.unpoint = (t, p = {}) => {
      const s = p.side || "R";
      A("arm" + s, { rotation: 0, duration: 0.35, ease: "back.out(1.5)" }, t);
      stretch(s, 1, t, 0.3);
      S("finger" + s, { opacity: 0 }, t + 0.12);
      A("tilt", { rotation: 0, duration: 0.4, ease: "power2.inOut" }, t);
      A("head", { rotation: 0, duration: 0.4, ease: "power2.inOut" }, t);
      ax.look(t, 0, 0, 0.25); ax.mouth(t, "smile", 0.2); ax.brows(t, "neutral");
      return t + 0.4;
    };

    // sorpresa: anticipación, salto, ojos grandes, "!"
    ax.surprise = (t, p = {}) => {
      const h = p.height || 70;
      A("squash", { scaleY: 0.84, scaleX: 1.1, duration: 0.11, ease: "power2.in" }, t);
      ax.eyes(t, "open"); ax.look(t, 0, 0, 0.05);
      const t1 = t + 0.11;
      A("hop", { y: -h, duration: 0.24, ease: "power3.out" }, t1);
      A("hop", { y: 0, duration: 0.24, ease: "power2.in" }, t1 + 0.3);
      A("squash", { scaleY: 1.14, scaleX: 0.9, duration: 0.12, ease: "power2.out" }, t1);
      A("squash", { scaleY: 1, scaleX: 1, duration: 0.2, ease: "sine.inOut" }, t1 + 0.12);
      A("shadow", { scaleX: 0.62, opacity: 0.45, duration: 0.24, ease: "power3.out" }, t1);
      A("shadow", { scaleX: 1, opacity: 1, duration: 0.24, ease: "power2.in" }, t1 + 0.3);
      both((s) => { A("eye" + s, { scale: 1.42, duration: 0.18, ease: "back.out(4)" }, t1); A("arm" + s, { rotation: -62, duration: 0.18, ease: "back.out(3)" }, t1); });
      ax.mouth(t1, "wow", 0.12); ax.brows(t1, "up", 0.15);
      gills(t1, 22, 0.16, "power3.out", 0.02);
      S("fxBang", { opacity: 1 }, t1 + 0.05);
      F("fxBang", { scale: 0.2, rotation: -25 }, { scale: 1, rotation: 8, duration: 0.3, ease: "back.out(3.5)" }, t1 + 0.05);
      F("fxBangY", { y: 14 }, { y: 0, duration: 0.3, ease: "back.out(3)" }, t1 + 0.05);
      A("fxBang", { rotation: 0, duration: 0.4, ease: "elastic.out(1,0.35)" }, t1 + 0.35);
      A("fxBang", { opacity: 0, scale: 0.6, duration: 0.2, ease: "power2.in" }, t1 + 0.95);
      const tl2 = land(t1 + 0.54, 0.9);
      gills(t1 + 0.54, 0, 0.01);
      const te = t1 + 0.9 + (p.hold || 0);
      both((s) => { A("eye" + s, { scale: 1, duration: 0.3, ease: "back.out(2)" }, te); A("arm" + s, { rotation: 0, duration: 0.4, ease: "back.out(2)" }, te); });
      ax.mouth(te, "smile", 0.2); ax.brows(te, "neutral", 0.25);
      markBusy(t, te + 0.2);
      return Math.max(tl2, te + 0.35);
    };

    // pensar: mano a la barbilla, mirada arriba, burbujitas
    ax.think = (t, p = {}) => {
      const d = p.d || 1.6;
      A("armR", { rotation: 152, duration: 0.42, ease: "back.out(1.6)" }, t);
      A("head", { rotation: -7, duration: 0.5, ease: "back.out(1.8)" }, t + 0.05);
      A("tilt", { rotation: -3, duration: 0.5, ease: "power2.out" }, t);
      ax.look(t + 0.12, -4, -6, 0.3); ax.expr(t + 0.1, "think", 0.2);
      F("armRw", { rotation: 0 }, { rotation: 7, duration: 0.14, ease: "sine.inOut", yoyo: true, repeat: 3 }, t + 0.6);
      ["th1", "th2", "th3"].forEach((id, i) => {
        S(id, { opacity: 1 }, t + 0.35 + i * 0.18);
        F(id, { scale: 0.2 }, { scale: 1, duration: 0.3, ease: "back.out(3)" }, t + 0.35 + i * 0.18);
        A(id, { scale: 0.86, duration: 0.45, ease: "sine.inOut", yoyo: true, repeat: 1 }, t + 0.7 + i * 0.18);
      });
      TT({ curl: 0.25, duration: 0.6, ease: "sine.inOut" }, t);
      const te = t + d;
      ["th1", "th2", "th3"].forEach((id, i) => A(id, { opacity: 0, scale: 0.5, duration: 0.18, ease: "power2.in" }, te - 0.25 + i * 0.05));
      // ¡idea!: cejas arriba y vuelta
      A("armR", { rotation: 0, duration: 0.4, ease: "back.out(1.7)" }, te);
      A("head", { rotation: 0, duration: 0.45, ease: "back.out(2)" }, te);
      A("tilt", { rotation: 0, duration: 0.4, ease: "power2.inOut" }, te);
      ax.look(te, 0, 0, 0.2); ax.expr(te, "neutral", 0.2);
      TT({ curl: 0, duration: 0.6, ease: "sine.inOut" }, te);
      markBusy(t, te);
      return te + 0.4;
    };

    // risa / celebración con saltos
    ax.celebrate = (t, p = {}) => {
      const n = p.jumps || 2, h = p.height || 80;
      ax.expr(t, "laugh", 0.12); ax.blush(t, 1.4);
      both((s) => { A("arm" + s, { rotation: 20, duration: 0.1, ease: "power2.in" }, t); A("arm" + s, { rotation: -132, duration: 0.3, ease: "back.out(2.5)" }, t + 0.1); stretch(s, 1.35, t + 0.1); });
      TT({ lift: 1, duration: 0.4, ease: "back.out(2)" }, t);
      let tt = t + 0.05;
      for (let i = 0; i < n; i++) {
        A("squash", { scaleY: 0.84, scaleX: 1.12, duration: 0.09, ease: "power2.in" }, tt);
        const u = tt + 0.09, sp = i % 2 ? -1 : 1;
        A("hop", { y: -h, duration: 0.24, ease: "power3.out" }, u);
        A("hop", { y: 0, duration: 0.2, ease: "power2.in" }, u + 0.26);
        A("squash", { scaleY: 1.13, scaleX: 0.9, duration: 0.12, ease: "power2.out" }, u);
        A("squash", { scaleY: 1, scaleX: 1, duration: 0.18, ease: "sine.inOut" }, u + 0.12);
        A("tilt", { rotation: 7 * sp, duration: 0.23, ease: "sine.out" }, u);
        A("tilt", { rotation: 0, duration: 0.23, ease: "sine.in" }, u + 0.23);
        A("shadow", { scaleX: 0.6, opacity: 0.4, duration: 0.24, ease: "power3.out" }, u);
        A("shadow", { scaleX: 1, opacity: 1, duration: 0.2, ease: "power2.in" }, u + 0.26);
        both((s, si) => { A("arm" + s + "w", { rotation: -18, duration: 0.12, ease: "sine.inOut" }, u + si * 0.04); A("arm" + s + "w", { rotation: 6, duration: 0.14, ease: "sine.inOut" }, u + 0.2 + si * 0.04); });
        gills(u, 20, 0.14, "power3.out", 0.02);
        gills(u + 0.3, -8, 0.16, "power2.in", 0.02);
        A("squash", { scaleY: 0.86, scaleX: 1.12, duration: 0.06, ease: "power2.out" }, u + 0.46);
        tt = u + 0.52;
      }
      A("squash", { scaleY: 1, scaleX: 1, duration: 0.5, ease: "elastic.out(1.2,0.4)" }, tt);
      gillFlick(tt - 0.06, 14, 0.8);
      const te = tt + (p.hold == null ? 0.3 : p.hold);
      both((s) => { A("arm" + s, { rotation: 0, duration: 0.45, ease: "back.out(1.6)" }, te); A("arm" + s + "w", { rotation: 0, duration: 0.3 }, te); stretch(s, 1, te, 0.3); });
      TT({ lift: 0, duration: 0.6, ease: "sine.inOut" }, te);
      ax.expr(te, "neutral", 0.2); ax.blush(te, 1);
      markBusy(t, te);
      return te + 0.45;
    };

    // claqueta: entra en las manos
    ax.clapIn = (t) => {
      S("clap", { opacity: 1 }, t);
      F("clap", { scale: 0.3, rotation: -14 }, { scale: 1, rotation: 0, duration: 0.42, ease: "back.out(2.2)" }, t);
      F("clapY", { y: 24 }, { y: 0, duration: 0.42, ease: "back.out(2.2)" }, t);
      both((s) => A("arm" + s, { rotation: 24, duration: 0.3, ease: "back.out(2)" }, t + 0.06));
      ax.mouth(t + 0.05, "grin", 0.15);
      return t + 0.45;
    };
    // abre (anticipación) y golpea
    ax.clapSnap = (t, p = {}) => {
      const open = p.open || 0.45, ang = p.angle || -27, hold = p.hold == null ? 0.25 : p.hold;
      A("clapStick", { rotation: ang, duration: open, ease: "back.out(1.8)" }, t);
      A("tilt", { rotation: -4, duration: open, ease: "power2.out" }, t);
      A("head", { rotation: -5, duration: open, ease: "power2.out" }, t);
      ax.brows(t, "angry", 0.2); ax.mouth(t, "hmm", 0.15);
      const hit = t + open + hold;
      A("clapStick", { rotation: 0, duration: 0.07, ease: "power4.in" }, hit - 0.07);
      A("tilt", { rotation: 2, duration: 0.07, ease: "power4.in" }, hit - 0.07);
      A("head", { rotation: 3, duration: 0.07, ease: "power4.in" }, hit - 0.07);
      A("clapY", { y: 5, duration: 0.05, ease: "power2.out" }, hit);
      A("clapY", { y: 0, duration: 0.3, ease: "elastic.out(1,0.4)" }, hit + 0.05);
      A("squash", { scaleY: 0.9, scaleX: 1.08, duration: 0.05, ease: "power2.out" }, hit);
      A("squash", { scaleY: 1, scaleX: 1, duration: 0.5, ease: "elastic.out(1.2,0.35)" }, hit + 0.05);
      S("fxImpact", { opacity: 1 }, hit);
      F("fxImpact", { scale: 0.5 }, { scale: 1.25, duration: 0.25, ease: "power3.out" }, hit);
      A("fxImpact", { opacity: 0, duration: 0.15, ease: "power1.in" }, hit + 0.16);
      ax.eyes(hit, "sqz"); ax.mouth(hit, "grin", 0.08);
      ax.eyes(hit + 0.3, "open"); ax.brows(hit + 0.3, "neutral");
      A("tilt", { rotation: 0, duration: 0.5, ease: "elastic.out(1,0.4)" }, hit + 0.07);
      A("head", { rotation: 0, duration: 0.6, ease: "elastic.out(1,0.35)" }, hit + 0.07);
      gillFlick(hit, 16, 0.8);
      markBusy(t, hit + 0.4);
      ax.hit = hit;
      return hit + 0.45;
    };
    ax.clapOut = (t) => {
      A("clap", { scale: 0.2, rotation: 18, opacity: 0, duration: 0.3, ease: "back.in(2)" }, t);
      both((s) => A("arm" + s, { rotation: 0, duration: 0.35, ease: "back.out(2)" }, t + 0.1));
      return t + 0.4;
    };

    // mirar a cámara y guiñar
    ax.wink = (t, p = {}) => {
      ax.look(t, 0, 0, 0.15);
      A("head", { rotation: 8, duration: 0.3, ease: "back.out(2.5)" }, t);
      A("tilt", { rotation: 3, duration: 0.3, ease: "power2.out" }, t);
      A("squash", { scaleY: 0.95, scaleX: 1.04, duration: 0.12, ease: "power2.out" }, t);
      A("squash", { scaleY: 1, scaleX: 1, duration: 0.4, ease: "elastic.out(1,0.45)" }, t + 0.12);
      ax.expr(t + 0.12, "sly", 0.12); ax.blush(t + 0.12, 1.45);
      S("fxSpark", { opacity: 1 }, t + 0.18);
      F("fxSpark", { scale: 0, rotation: -45 }, { scale: 1.1, rotation: 0, duration: 0.25, ease: "back.out(3)" }, t + 0.18);
      A("fxSpark", { scale: 0, rotation: 45, duration: 0.25, ease: "power2.in" }, t + 0.62);
      A("armL", { rotation: -40, duration: 0.25, ease: "back.out(2)" }, t + 0.06); S("fingerL", { opacity: 1, scale: 1 }, t + 0.1);
      const te = t + 0.5 + (p.hold == null ? 0.45 : p.hold);
      ax.eyes(te, "open"); ax.mouth(te, "smile", 0.2); ax.brows(te, "neutral"); ax.blush(te, 1);
      A("armL", { rotation: 0, duration: 0.35, ease: "back.out(2)" }, te); S("fingerL", { opacity: 0 }, te + 0.1);
      A("head", { rotation: 0, duration: 0.4, ease: "back.out(1.8)" }, te);
      A("tilt", { rotation: 0, duration: 0.4, ease: "power2.inOut" }, te);
      markBusy(t, te);
      return te + 0.35;
    };

    // tropiezo y culetazo cómico
    ax.trip = (t, p = {}) => {
      // 1. trastabilla hacia delante
      A("tilt", { rotation: 10, duration: 0.14, ease: "power2.out" }, t);
      ax.expr(t, "surprise", 0.08);
      both((s, si) => A("arm" + s, { rotation: -120 + si * 30, duration: 0.14, ease: "back.out(3)" }, t));
      F("armLw", { rotation: 0 }, { rotation: -30, duration: 0.07, ease: "sine.inOut", yoyo: true, repeat: 5 }, t + 0.1);
      F("armRw", { rotation: 0 }, { rotation: 30, duration: 0.07, ease: "sine.inOut", yoyo: true, repeat: 5 }, t + 0.13);
      // 2. vuela hacia atrás
      const t1 = t + 0.2;
      A("tilt", { rotation: -24, duration: 0.2, ease: "power2.out" }, t1);
      A("hop", { y: -36, duration: 0.2, ease: "power2.out" }, t1);
      gills(t1, 20, 0.12, "power2.out", 0.02);
      // 3. culetazo
      const hit = t1 + 0.38;
      A("hop", { y: 8, duration: 0.18, ease: "power3.in" }, hit - 0.18);
      A("tilt", { rotation: -12, duration: 0.18, ease: "power2.in" }, hit - 0.18);
      A("squash", { scaleY: 0.76, scaleX: 1.2, duration: 0.06, ease: "power2.out" }, hit);
      A("squash", { scaleY: 1, scaleX: 1, duration: 0.7, ease: "elastic.out(1.2,0.3)" }, hit + 0.06);
      A("headY", { y: 10, duration: 0.06, ease: "power2.out" }, hit);
      A("headY", { y: 0, duration: 0.6, ease: "elastic.out(1,0.3)" }, hit + 0.08);
      gillFlick(hit, -20, 1.0);
      both((s) => A("arm" + s, { rotation: -30, duration: 0.2, ease: "back.out(2)" }, hit));
      ax.expr(hit, "ouch", 0.06);
      S("fxImpact2", { opacity: 1 }, hit);
      F("fxImpact2", { scale: 0.6 }, { scale: 1.3, duration: 0.25, ease: "power3.out" }, hit);
      A("fxImpact2", { opacity: 0, duration: 0.15 }, hit + 0.15);
      // 4. estrellitas mareo
      S("fxStars", { opacity: 1, scale: 1 }, hit + 0.1);
      F("fxStars", { rotation: 0 }, { rotation: 540, duration: 1.3, ease: "none" }, hit + 0.1);
      A("fxStars", { opacity: 0, duration: 0.25 }, hit + 1.2);
      F("head", { rotation: 0 }, { rotation: 7, duration: 0.16, ease: "sine.inOut", yoyo: true, repeat: 3 }, hit + 0.45);
      // 5. sonrisa avergonzada + gota de sudor, se recompone
      const t3 = hit + 1.15;
      ax.eyes(t3, "happy"); ax.mouth(t3, "grin", 0.15); ax.brows(t3, "worried"); ax.blush(t3, 1.5);
      S("fxSweat", { opacity: 1, scale: 1 }, t3);
      F("fxSweat", { scale: 0.4 }, { scale: 1, duration: 0.3, ease: "back.out(2)" }, t3);
      F("fxSweatY", { y: -6 }, { y: 16, duration: 0.6, ease: "power1.in" }, t3);
      A("fxSweat", { opacity: 0, duration: 0.2 }, t3 + 0.5);
      A("hop", { y: 0, duration: 0.2, ease: "power2.out" }, t3 + 0.5);
      A("tilt", { rotation: 0, duration: 0.5, ease: "back.out(2)" }, t3 + 0.5);
      both((s) => A("arm" + s, { rotation: 0, duration: 0.4, ease: "back.out(2)" }, t3 + 0.5));
      A("squash", { scaleY: 0.9, scaleX: 1.08, duration: 0.1, ease: "power2.in" }, t3 + 0.45);
      A("squash", { scaleY: 1, scaleX: 1, duration: 0.45, ease: "elastic.out(1,0.4)" }, t3 + 0.55);
      const te = t3 + 0.9;
      ax.expr(te, "neutral", 0.2); ax.blush(te, 1);
      markBusy(t, te);
      return te + 0.3;
    };

    // asomarse desde un borde (el borde es la posición del contenedor)
    // edge: "bottom" (el suelo del contenedor es la línea) | "left" | "right"
    ax.peek = (t, p = {}) => {
      const edge = p.edge || "bottom", d = p.d || 1.8;
      S("shadow", { opacity: 0 }, t);
      if (edge === "bottom") {
        tl.set(q("clipRect"), { attr: { x: -3000, y: -3000, width: 6000, height: 3000 + (p.line || -40) } }, t);
        S("hop", { y: 360 }, t);
        A("hop", { y: 190, duration: 0.55, ease: "power2.out" }, t + 0.05); // asoma ojos
        A("hop", { y: 120, duration: 0.3, ease: "back.out(2.4)" }, t + 0.05 + 0.55 + 0.6);
      } else {
        const sg = edge === "right" ? 1 : -1; // right: se asoma desde la derecha hacia la izquierda
        tl.set(q("clipRect"), { attr: { x: sg > 0 ? -3000 : 0, y: -3000, width: 3000, height: 6000 } }, t);
        S("hop", { x: 300 * sg, y: 0 }, t);
        S("tilt", { rotation: 0 }, t);
        A("hop", { x: 100 * sg, duration: 0.55, ease: "power2.out" }, t + 0.05);
        A("tilt", { rotation: -20 * sg, duration: 0.55, ease: "power2.out" }, t + 0.05);
        A("hop", { x: 62 * sg, duration: 0.3, ease: "back.out(2.4)" }, t + 1.2);
        A("tilt", { rotation: -26 * sg, duration: 0.3, ease: "back.out(2.4)" }, t + 1.2);
      }
      ax.brows(t, "up"); ax.mouth(t, "o", 0.01);
      ax.look(t + 0.5, -5, 0, 0.18); ax.look(t + 0.85, 5, 0, 0.18); ax.look(t + 1.15, 0, -1, 0.15);
      ax.mouth(t + 1.2, "grin", 0.15); ax.blush(t + 1.2, 1.3);
      gillFlick(t + 1.2, 14, 0.7);
      const te = t + d;
      if (edge === "bottom") A("hop", { y: 360, duration: 0.28, ease: "back.in(1.8)" }, te);
      else { A("hop", { x: 320 * (edge === "right" ? 1 : -1), duration: 0.28, ease: "back.in(1.8)" }, te); A("tilt", { rotation: 0, duration: 0.28, ease: "power2.in" }, te); }
      ax.expr(te, "neutral", 0.1); ax.blush(te + 0.2, 1);
      markBusy(t, te);
      return te + 0.3;
    };
    // restaura tras peek (vuelve a mostrar entero y sin recorte)
    ax.unpeek = (t) => {
      tl.set(q("clipRect"), { attr: { x: -3000, y: -3000, width: 6000, height: 6000 } }, t);
      S("hop", { x: 0, y: 0 }, t); S("tilt", { rotation: 0 }, t); S("shadow", { opacity: 1 }, t);
      return t;
    };

    // encoger / crecer con anticipación y overshoot (escala del contenedor)
    ax.scaleTo = (t, p) => {
      const s0 = p.from, s1 = p.to, grow = s1 > s0;
      W({ scale: s0 * (grow ? 0.88 : 1.08), duration: 0.14, ease: "power2.in" }, t);
      W({ scale: s1 * (grow ? 1.1 : 0.92), duration: 0.24, ease: "power3.out" }, t + 0.14);
      W({ scale: s1, duration: 0.5, ease: "elastic.out(1,0.45)" }, t + 0.38);
      if (grow) { ax.expr(t + 0.1, "happy", 0.12); ax.expr(t + 0.8, "neutral", 0.2); }
      else { ax.expr(t + 0.1, "worried", 0.12); ax.expr(t + 0.8, "neutral", 0.2); }
      A("squash", { scaleY: grow ? 0.9 : 1.08, scaleX: grow ? 1.08 : 0.94, duration: 0.14, ease: "power2.in" }, t);
      A("squash", { scaleY: 1, scaleX: 1, duration: 0.6, ease: "elastic.out(1,0.4)" }, t + 0.14);
      gillFlick(t + 0.14, grow ? 16 : -12, 0.8);
      markBusy(t, t + 0.9);
      return t + 0.9;
    };

    // hablar (sin envolvente de audio): aleteo determinista de boca
    ax.talk = (t, d, p = {}) => {
      const seq = p.seq || ["talkA", "talkB", "o", "talkA", "smile", "talkB", "talkA", "o", "talkB"];
      let tt = t, i = 0;
      while (tt < t + d - 0.08) { ax.mouth(tt, seq[i % seq.length], 0.05, "none"); tt += 0.085 + rnd() * 0.05; i++; }
      ax.mouth(t + d, p.end || "smile", 0.1);
      F("headY", { y: 0 }, { y: 2.5, duration: 0.18, ease: "sine.inOut", yoyo: true, repeat: Math.max(1, Math.floor(d / 0.18) - 1) | 1 }, t);
      return t + d;
    };
    // sincronía con envolvente de voz: lv = niveles 0..3 por frame
    ax.lipsync = (lv, fps, t0 = 0) => {
      const M = ["smile", "talkB", "talkA", "o"];
      let prev = -1;
      lv.forEach((l, i) => { if (l === prev) return; prev = l; ax.mouth(t0 + i / fps, M[l] || "smile", 0.04, "none"); });
    };

    return ax;
  }

  root.AxRig = AxRig;
  root.AxTailPaths = tailPaths;
  root.AxMouthD = mouthD;
})(typeof window !== "undefined" ? window : globalThis);
