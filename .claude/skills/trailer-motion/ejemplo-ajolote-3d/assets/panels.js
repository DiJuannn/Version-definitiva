// Paneles de Taller dibujados por fotograma en un <canvas> (la "comp" del método Clawd): su estado sale del tiempo t.
// Cada función recibe (ctx, w, h, t) y pinta el panel entero. Todo determinista.
(function () {
  const H = window.CUES.hits, C = window.CUES.palette;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const prog = (t, a, d) => clamp((t - a) / d, 0, 1);
  const back = (u) => { const s = 1.70158; u -= 1; return u * u * ((s + 1) * u + s) + 1; };   // overshoot
  const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
  const mono = (px, w = 600) => `${w} ${px}px "JB Mono", monospace`;
  const cour = (px, w = 400) => `${w} ${px}px "Courier Prime", monospace`;
  const arch = (px, w = 900) => `${w} ${px}px "Archivo", sans-serif`;
  const pulse = (t, at, d = 0.25) => (t >= at && t < at + d ? Math.sin(((t - at) / d) * Math.PI) : 0);

  // ───────── GUION (papel, Courier) ─────────
  const SCENES = [
    { head: "1. EXT. PLAYA — AMANECER", act: ["LUCÍA (17) camina por la orilla", "con el abrigo rojo de su madre.", "MARCO la sigue a distancia."], chars: ["LUCÍA", "MARCO"], hit: "g1" },
    { head: "2. INT. CASA ABUELA — NOCHE", act: ["La ABUELA fríe algo que huele a", "domingo. TEO pone la mesa."], chars: ["ABUELA", "TEO"], hit: "g2" },
    { head: "3. EXT. FURGONETA — DÍA", act: ["MARCO arranca. El motor tose", "dos veces. Nadie dice adiós."], chars: ["MARCO"], hit: "g3" },
  ];
  function guion(ctx, w, h, t) {
    ctx.fillStyle = C.paper; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(0,0,0,.035)"; for (let y = 0; y < h; y += 6) ctx.fillRect(0, y, w, 1);   // textura de papel
    ctx.fillStyle = "#1b1b20"; ctx.font = cour(44, 700); ctx.textAlign = "center"; ctx.fillText("EL ÚLTIMO VERANO", w / 2, 130);
    ctx.font = cour(24); ctx.textAlign = "right"; ctx.fillText("1.", w - 70, 70); ctx.textAlign = "left";
    let y = 240; const X = 70, LH = 54;
    let nS = 0, nP = 0;
    SCENES.forEach((s) => {
      const k = prog(t, H[s.hit], 0.18);
      if (k > 0) { nS++; nP += s.chars.length; }
      ctx.font = cour(38, 700);
      const hw = ctx.measureText(s.head).width;
      if (k > 0) { ctx.fillStyle = C.yellow; const e = back(k); rr(ctx, X - 10, y - 40, (hw + 20) * e, 54, 6); ctx.fill(); }
      ctx.fillStyle = "#1b1b20"; ctx.fillText(s.head, X, y);
      y += LH + 6; ctx.font = cour(36);
      s.act.forEach((line) => {
        let x = X;
        line.split(/(\s+)/).forEach((tok) => {
          const tw = ctx.measureText(tok).width, clean = tok.replace(/[^\wÁÉÍÓÚÑ]/g, "");
          if (k > 0 && s.chars.includes(clean)) {
            const kk = prog(t, H[s.hit] + 0.08, 0.16); ctx.fillStyle = C.green; rr(ctx, x - 4, y - 34, (tw + 8) * back(kk), 46, 5); ctx.fill();
          }
          ctx.fillStyle = "#1b1b20"; ctx.fillText(tok, x, y); x += tw;
        });
        y += LH;
      });
      y += 46;
      // anillo de impacto donde aterriza el ajolote
      const p = pulse(t, H[s.hit], 0.35);
      if (p > 0) { ctx.strokeStyle = `rgba(240,201,74,${p})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(X + 230, y - 140, 60 + (1 - p) * 120, 0, 7); ctx.stroke(); }
    });
    // contador de desglose
    ctx.fillStyle = "#1b1b20"; rr(ctx, 60, h - 150, w - 120, 96, 14); ctx.fill();
    const cells = [["ESCENAS", nS], ["PERSONAJES", nP], ["LUGARES", nS]];
    cells.forEach(([lab, n], i) => {
      const cx = 60 + (w - 120) * (i + 0.5) / 3;
      ctx.textAlign = "center"; ctx.fillStyle = "#f2eee7"; ctx.font = arch(46); ctx.fillText(String(n), cx, h - 92);
      ctx.fillStyle = "#9a978f"; ctx.font = mono(16); ctx.fillText(lab, cx, h - 66);
    });
    ctx.textAlign = "left";
    // capa seleccionada «ajolote.png» (como en un editor) hasta que se despega
    if (t < H.peel) {
      const P = window.CUES.panels.guion, [, u, v] = window.CUES.spots.sticker;
      const cx = (u / P.w + 0.5) * w, y1 = (v / P.d + 0.5) * h, y0 = y1 - (0.84 / P.d) * h, hw = (0.44 / P.w) * w;
      ctx.strokeStyle = "#3d8bfd"; ctx.lineWidth = 3; ctx.setLineDash([12, 8]); ctx.strokeRect(cx - hw, y0, hw * 2, y1 - y0); ctx.setLineDash([]);
      ctx.fillStyle = "#fff"; [[cx - hw, y0], [cx + hw, y0], [cx - hw, y1], [cx + hw, y1], [cx, y0], [cx, y1]].forEach(([x, y]) => { ctx.fillRect(x - 9, y - 9, 18, 18); ctx.strokeStyle = "#3d8bfd"; ctx.strokeRect(x - 9, y - 9, 18, 18); });
      ctx.fillStyle = "#3d8bfd"; rr(ctx, cx - hw, y0 - 52, 210, 40, 6); ctx.fill(); ctx.fillStyle = "#fff"; ctx.font = mono(22, 700); ctx.fillText("ajolote.png", cx - hw + 14, y0 - 24);
    }
  }

  // ───────── PLAN DE RODAJE (tinta, 3 jornadas) ─────────
  const DAYS = [["JORNADA 1", "LU 6", "d1", [1, 3]], ["JORNADA 2", "MA 7", "d2", [2]], ["JORNADA 3", "MI 8", "d3", [4, 5]]];
  function plan(ctx, w, h, t) {
    ctx.fillStyle = C.ink; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#f2eee7"; ctx.font = arch(44); ctx.fillText("Plan de rodaje", 56, 82);
    ctx.fillStyle = "#9a978f"; ctx.font = mono(18); ctx.fillText("EL ÚLTIMO VERANO · 3 JORNADAS", 56, 118);
    const done = DAYS.filter((d) => t >= H[d[2]]).length;
    ctx.textAlign = "right"; ctx.fillStyle = "#9a978f"; ctx.font = mono(18); ctx.fillText("PLANIFICADO", w - 56, 76);
    ctx.fillStyle = "#f2eee7"; ctx.font = arch(48); ctx.fillText(`${Math.round((done / 3) * 100)}%`, w - 56, 122); ctx.textAlign = "left";
    const colW = (w - 112 - 40) / 3, top = 170, colH = h - top - 60;
    DAYS.forEach(([n, d, hit, scenes], i) => {
      const x = 56 + i * (colW + 20), on = t >= H[hit];
      ctx.fillStyle = on ? "#1f2a24" : "#1c1c20"; rr(ctx, x, top, colW, colH, 16); ctx.fill();
      ctx.strokeStyle = on ? C.green : "#2c2c32"; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = "#f2eee7"; ctx.font = mono(20, 700); ctx.fillText(n, x + 26, top + 46);
      ctx.fillStyle = "#9a978f"; ctx.font = mono(18); ctx.fillText(d, x + colW - 80, top + 46);
      scenes.forEach((sc, j) => {
        const k = prog(t, H[hit] + j * 0.08, 0.22);
        if (k <= 0) return;
        const yy = top + 80 + j * 120 - (1 - back(k)) * 140;
        ctx.globalAlpha = Math.min(1, k * 3);
        ctx.fillStyle = C.yellow; rr(ctx, x + 22, yy, colW - 44, 100, 10); ctx.fill();
        ctx.fillStyle = "#1b1b20"; ctx.font = arch(34); ctx.fillText(`ESC ${sc}`, x + 44, yy + 50);
        ctx.font = mono(16); ctx.fillText(sc === 2 ? "INT · NOCHE" : "EXT · DÍA", x + 44, yy + 80); ctx.globalAlpha = 1;
      });
      const p = pulse(t, H[hit], 0.3);
      if (p > 0) { ctx.strokeStyle = `rgba(95,211,141,${p})`; ctx.lineWidth = 8; rr(ctx, x - 8 * (1 - p), top - 8 * (1 - p), colW + 16 * (1 - p), colH + 16 * (1 - p), 20); ctx.stroke(); }
    });
  }

  // ───────── HOJA DE LLAMADA (tinta, equipo) ─────────
  const CREW = [["Ana", "DIRECCIÓN", "#7fd3e6"], ["Leo", "FOTO", "#ff9f8a"], ["Iris", "SONIDO", "#b9e2c4"], ["Teo", "ARTE", "#ece8dc"], ["Mar", "PRODUCCIÓN", "#f0c94a"]];
  const CHECK_AT = [H.c1, H.c1 + 0.08, H.c2, H.c2 + 0.08, H.c2 + 0.16];
  function hoja(ctx, w, h, t) {
    ctx.fillStyle = C.ink; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#f2eee7"; ctx.font = arch(44); ctx.fillText("Hoja de llamada", 56, 82);
    ctx.fillStyle = "#9a978f"; ctx.font = mono(18); ctx.fillText("JORNADA 1 · CITACIÓN 07:30 · PLAYA", 56, 118);
    const n = CHECK_AT.filter((a) => t >= a).length;
    ctx.textAlign = "right"; ctx.fillStyle = "#9a978f"; ctx.font = mono(18); ctx.fillText("AVISADOS", w - 56, 76);
    ctx.fillStyle = n === 5 ? C.green : "#f2eee7"; ctx.font = arch(48); ctx.fillText(`${n}/5`, w - 56, 122); ctx.textAlign = "left";
    const cw = (w - 112) / 5;
    CREW.forEach(([name, role, col], i) => {
      const cx = 56 + cw * (i + 0.5), cy = 360;
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy, 88, 0, 7); ctx.fill();
      ctx.fillStyle = "#1b1b20"; ctx.font = arch(64); ctx.textAlign = "center"; ctx.fillText(name[0], cx, cy + 22);
      ctx.fillStyle = "#f2eee7"; ctx.font = arch(40, 800); ctx.fillText(name, cx, cy + 160);
      ctx.fillStyle = "#9a978f"; ctx.font = mono(16); ctx.fillText(role, cx, cy + 192);
      const k = prog(t, CHECK_AT[i], 0.2);
      if (k > 0) {
        const s = back(k);
        ctx.strokeStyle = C.green; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(cx, cy, 98, 0, 7); ctx.stroke();
        ctx.fillStyle = C.green; ctx.beginPath(); ctx.arc(cx + 66, cy + 62, 34 * s, 0, 7); ctx.fill();
        ctx.strokeStyle = "#121212"; ctx.lineWidth = 8; ctx.lineCap = "round"; ctx.beginPath();
        ctx.moveTo(cx + 50, cy + 62); ctx.lineTo(cx + 62, cy + 74); ctx.lineTo(cx + 84, cy + 50); if (s > 0.5) ctx.stroke();
        ctx.fillStyle = C.green; ctx.font = mono(18); ctx.fillText("✓ 07:30", cx, cy + 226);
      }
      ctx.textAlign = "left";
    });
  }
  window.Panels = { guion, plan, hoja };
})();
