// Genera rig/ajolote.html (fragmento estático) a partir de geometría paramétrica.
// node gen.js
const fs = require("fs");
const path = require("path");
const RIG = path.join(__dirname, "..");
const W = {};
new Function("window", fs.readFileSync(path.join(RIG, "poses.js"), "utf8"))(W);
const C = {
  pink: "#f7c1cc", light: "#fde3e8", shade: "#eea3b5", line: "#d0708a", tail: "#f5b8c6", stripe: "#e98ca3",
  gill: "#ff6a45", gillCore: "#ff8a5e", gillLine: "#d9452f", vein: "#b8331f",
  eye: "#2a1520", mouth: "#7a1f37", tongue: "#ff7f99", cheek: "#ff8aa3", brow: "#c05f7b",
};
const r1 = (v) => Math.round(v * 10) / 10;

// branquia plumosa a lo largo de +x (0..L), con `lobes` foliolos por lado
function plume(L, Wd, lobes) {
  const h = (u) => Wd * (0.62 + 0.5 * Math.sin(Math.PI * Math.min(1, u * 1.15))) * Math.pow(1 - u, 0.55);
  const span = 0.94, step = span / lobes;
  const edge = (sg) => {
    const pts = [];
    for (let j = 0; j < lobes; j++) {
      const uv = j * step, ut = uv + step * 0.82, un = (j + 1) * step;
      const v = [L * uv, sg * h(uv) * 0.62], tp = [L * ut + 4, sg * (h(ut) + Wd * 0.18)], nv = [L * un, sg * h(un) * 0.62];
      pts.push({ v, tp, nv });
    }
    return pts;
  };
  let d = `M0 ${r1(-h(0) * 0.62)}`;
  edge(-1).forEach(({ v, tp, nv }) => {
    d += ` Q${r1(v[0] + (tp[0] - v[0]) * 0.25)} ${r1(tp[1] * 0.98)} ${r1(tp[0])} ${r1(tp[1])}`;
    d += ` Q${r1(tp[0] - 2)} ${r1((tp[1] + nv[1]) / 2 + (nv[1] - tp[1]) * 0.25)} ${r1(nv[0])} ${r1(nv[1])}`;
  });
  d += ` L${L} 0`;
  const low = edge(1).reverse();
  d += ` L${r1(low[0].nv[0])} ${r1(low[0].nv[1])}`;
  low.forEach(({ v, tp, nv }) => {
    d += ` Q${r1(tp[0] - 2)} ${r1((tp[1] + nv[1]) / 2 + (nv[1] - tp[1]) * 0.25)} ${r1(tp[0])} ${r1(tp[1])}`;
    d += ` Q${r1(v[0] + (tp[0] - v[0]) * 0.25)} ${r1(tp[1] * 0.98)} ${r1(v[0])} ${r1(v[1])}`;
  });
  d += " Z";
  // venas: eje + ramitas hacia cada foliolo
  let vein = `M6 0 Q${r1(L * 0.5)} -1.5 ${r1(L * 0.9)} 0`;
  for (let j = 1; j < lobes; j++) {
    const u = j * step + step * 0.15, x = L * u;
    vein += ` M${r1(x)} 0 L${r1(x + L * step * 0.55)} ${r1(-h(u) * 0.55)} M${r1(x)} 0 L${r1(x + L * step * 0.55)} ${r1(h(u) * 0.55)}`;
  }
  // núcleo más cálido (misma silueta, más estrecha)
  const core = `M4 ${r1(-h(0) * 0.3)} Q${r1(L * 0.45)} ${r1(-Wd * 0.62)} ${r1(L * 0.86)} 0 Q${r1(L * 0.45)} ${r1(Wd * 0.62)} 4 ${r1(h(0) * 0.3)} Z`;
  return { d, vein, core };
}
const GILLS = [
  { id: 1, x: -104, y: -262, a: -146, L: 80, W: 15, n: 4 },
  { id: 2, x: -121, y: -224, a: -177, L: 88, W: 16, n: 4 },
  { id: 3, x: -113, y: -186, a: 152, L: 76, W: 14, n: 4 },
];
function gillSide(S) {
  return GILLS.map((g) => {
    const p = plume(g.L, g.W, g.n);
    return `<g transform="translate(${g.x} ${g.y}) rotate(${g.a})"><g id="ax-g${S}${g.id}"><g id="ax-g${S}${g.id}w">` +
      `<path d="${p.d}" fill="${C.gill}" stroke="${C.gillLine}" stroke-width="2.6" stroke-linejoin="round"/>` +
      `<path d="${p.core}" fill="${C.gillCore}" opacity="0.75"/>` +
      `<path d="${p.vein}" fill="none" stroke="${C.vein}" stroke-width="1.7" stroke-linecap="round" opacity="0.55"/>` +
      `</g></g></g>`;
  }).join("");
}
function star(r, ri, n = 5) {
  let d = "";
  for (let i = 0; i < n * 2; i++) {
    const a = (Math.PI / n) * i - Math.PI / 2, rr = i % 2 ? ri : r;
    d += (i ? " L" : "M") + r1(Math.cos(a) * rr) + " " + r1(Math.sin(a) * rr);
  }
  return d + " Z";
}
// brazo: tubo con contorno + manita de 3 deditos + dedo índice para señalar
function arm(S) {
  const ARM = "M-11 -4 C-12 10 -11 22 -10 31 C-15 37 -15 45 -10 48 C-8 50 -4 50 -3 47 C-2 52 3 54 5 50 C7 53 12 51 12 47 C16 46 18 40 14 34 C12 24 12 10 11 -4 C11 -10 -11 -10 -11 -4 Z";
  return `<g id="ax-arm${S}"><g id="ax-arm${S}w"><g id="ax-arm${S}s">` +
    `<g id="ax-finger${S}" opacity="0"><path d="M2 44 L3 68" stroke="${C.line}" stroke-width="13" stroke-linecap="round"/><path d="M2 44 L3 68" stroke="${C.pink}" stroke-width="7.5" stroke-linecap="round"/></g>` +
    `<path d="${ARM}" fill="${C.pink}" stroke="${C.line}" stroke-width="4" stroke-linejoin="round"/>` +
    `<path d="M-3 47 C-3 44 -2 42 -1 41 M5 50 C5 46 5 44 5 42" fill="none" stroke="${C.line}" stroke-width="2.2" stroke-linecap="round" opacity="0.75"/>` +
    `</g></g></g>`;
}
function eye(S) {
  const tx = S === "L" ? -48 : 48;
  const sqz = S === "L" ? "M-8 -8 L6 0 L-8 8" : "M8 -8 L-6 0 L8 8";
  return `<g transform="translate(${tx} -208)"><g id="ax-eye${S}">` +
    `<g id="ax-open${S}"><g id="ax-blink${S}"><g id="ax-look${S}">` +
    `<ellipse rx="11" ry="13" fill="${C.eye}"/>` +
    `<g id="ax-hl${S}"><circle cx="3.8" cy="-5" r="4.2" fill="#fff"/><circle cx="-3.6" cy="4.6" r="1.9" fill="#fff" opacity="0.85"/></g>` +
    `</g></g></g>` +
    `<path id="ax-happy${S}" opacity="0" d="M-11 4 Q0 -11 11 4" fill="none" stroke="${C.eye}" stroke-width="5" stroke-linecap="round"/>` +
    `<path id="ax-sqz${S}" opacity="0" d="${sqz}" fill="none" stroke="${C.eye}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path id="ax-wink${S}" opacity="0" d="M-11 -1 Q0 7 11 -1" fill="none" stroke="${C.eye}" stroke-width="5" stroke-linecap="round"/>` +
    `</g></g>`;
}
function brow(S) {
  const tr = S === "L" ? "translate(-48 -238)" : "translate(48 -238) scale(-1 1)";
  return `<g transform="${tr}"><g id="ax-brow${S}"><path id="ax-brow${S}r" d="M-9 2 Q-1 -3 9 0" fill="none" stroke="${C.brow}" stroke-width="4.2" stroke-linecap="round" opacity="0.8"/></g></g>`;
}
const tail0 = W.AxTailPaths({ ph1: 0, amp1: 1, ph2: 0, amp2: 0, lift: 0, curl: 0 });
const HEAD = "M0 -314 C82 -314 134 -276 134 -214 C134 -152 78 -124 0 -124 C-78 -124 -134 -152 -134 -214 C-134 -276 -82 -314 0 -314 Z";
const BODY = "M0 -152 C50 -152 76 -108 74 -62 C72 -20 46 -2 0 -2 C-46 -2 -72 -20 -74 -62 C-76 -108 -50 -152 0 -152 Z";
const stripes = (x0, y0, w, h, n, sk) => {
  let d = ""; const sw = w / n;
  for (let i = 0; i < n; i += 2) d += `M${r1(x0 + i * sw + sk)} ${y0} L${r1(x0 + (i + 1) * sw + sk)} ${y0} L${r1(x0 + (i + 1) * sw)} ${y0 + h} L${r1(x0 + i * sw)} ${y0 + h} Z `;
  return d.trim();
};

const svg = `<svg id="ax-svg" viewBox="-220 -380 440 420" xmlns="http://www.w3.org/2000/svg" aria-label="Ajolote">
  <defs>
    <filter id="ax-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4"/></filter>
    <filter id="ax-blur" x="-50%" y="-200%" width="200%" height="500%"><feGaussianBlur stdDeviation="5"/></filter>
    <clipPath id="ax-clip" clipPathUnits="userSpaceOnUse"><rect id="ax-clipRect" x="-3000" y="-3000" width="6000" height="6000"/></clipPath>
    <clipPath id="ax-headClip"><path d="${HEAD}"/></clipPath>
    <clipPath id="ax-bodyClip"><path d="${BODY}"/></clipPath>
    <clipPath id="ax-mouthClip"><use href="#ax-mouth"/></clipPath>
  </defs>
  <g id="ax-shadow"><ellipse cx="0" cy="4" rx="96" ry="12" fill="#000" opacity="0.38" filter="url(#ax-blur)"/></g>
  <g id="ax-all" clip-path="url(#ax-clip)">
  <g id="ax-hop"><g id="ax-tilt">
    <g id="ax-flip"><g id="ax-squash"><g id="ax-breath">
      <path id="ax-tail" d="${tail0.body}" fill="${C.tail}" stroke="${C.line}" stroke-width="4" stroke-linejoin="round"/>
      <path id="ax-tailStripe" d="${tail0.stripe}" fill="none" stroke="${C.stripe}" stroke-width="5" stroke-linecap="round"/>
      <path d="${BODY}" fill="${C.pink}" stroke="${C.line}" stroke-width="4.5"/>
      <g clip-path="url(#ax-bodyClip)">
        <ellipse cx="0" cy="-50" rx="47" ry="41" fill="${C.light}"/>
        <ellipse cx="0" cy="-134" rx="78" ry="26" fill="${C.shade}" opacity="0.6"/>
        <path d="M-30 -60 Q0 -54 30 -60 M-26 -38 Q0 -32 26 -38" fill="none" stroke="${C.shade}" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
      </g>
      <g><ellipse cx="-36" cy="-6" rx="22" ry="11.5" fill="${C.pink}" stroke="${C.line}" stroke-width="4"/><path d="M-44 -9 L-44 -2 M-34 -9 L-34 -1" stroke="${C.line}" stroke-width="2.4" stroke-linecap="round" opacity="0.7"/></g>
      <g><ellipse cx="36" cy="-6" rx="22" ry="11.5" fill="${C.pink}" stroke="${C.line}" stroke-width="4"/><path d="M44 -9 L44 -2 M34 -9 L34 -1" stroke="${C.line}" stroke-width="2.4" stroke-linecap="round" opacity="0.7"/></g>
      <g id="ax-headY"><g id="ax-head"><g id="ax-headBob"><g id="ax-headBobR">
        <g>${gillSide("L")}</g>
        <g transform="scale(-1 1)">${gillSide("R")}</g>
        <path d="${HEAD}" fill="${C.pink}" stroke="${C.line}" stroke-width="4.5"/>
        <g clip-path="url(#ax-headClip)">
          <ellipse cx="0" cy="-116" rx="150" ry="36" fill="${C.shade}" opacity="0.55"/>
          <path d="M-78 -270 C-66 -292 -30 -302 0 -298 C-26 -292 -56 -282 -70 -262 C-74 -258 -80 -262 -78 -270 Z" fill="${C.light}" opacity="0.9"/>
          <circle cx="22" cy="-294" r="5" fill="${C.light}" opacity="0.85"/>
        </g>
        <g id="ax-face">
          <g transform="translate(-84 -176)"><ellipse id="ax-cheekL" rx="17" ry="10" fill="${C.cheek}" opacity="0.55" filter="url(#ax-soft)"/></g>
          <g transform="translate(84 -176)"><ellipse id="ax-cheekR" rx="17" ry="10" fill="${C.cheek}" opacity="0.55" filter="url(#ax-soft)"/></g>
          ${eye("L")}${eye("R")}
          ${brow("L")}${brow("R")}
          <path id="ax-mouth" d="${W.AxMouthD("smile")}" fill="${C.mouth}" stroke="${C.mouth}" stroke-width="2" stroke-linejoin="round"/>
          <ellipse cx="0" cy="-138" rx="13" ry="9" fill="${C.tongue}" clip-path="url(#ax-mouthClip)"/>
        </g>
      </g></g></g></g>
      <g transform="translate(0 -72) scale(1.15)"><g id="ax-clapY"><g id="ax-clap" opacity="0">
        <rect x="-60" y="-26" width="120" height="68" rx="7" fill="#1b1b20" stroke="#0b0b0d" stroke-width="3"/>
        <rect x="-60" y="-26" width="120" height="14" rx="3" fill="#ece8dc"/>
        <path d="${stripes(-60, -26, 120, 14, 10, 6)}" fill="#1b1b20"/>
        <line x1="-52" y1="12" x2="52" y2="12" stroke="#4a4a54" stroke-width="1.5"/>
        <line x1="0" y1="-6" x2="0" y2="36" stroke="#4a4a54" stroke-width="1.5"/>
        <text x="-26" y="6" text-anchor="middle" font-family="JB Mono, monospace" font-size="9" fill="#9a978f">ESCENA</text>
        <text x="26" y="6" text-anchor="middle" font-family="JB Mono, monospace" font-size="9" fill="#9a978f">TOMA</text>
        <text x="-26" y="31" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="800" font-size="17" fill="#f0c94a">1</text>
        <text x="26" y="31" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="800" font-size="17" fill="#ece8dc">1</text>
        <g transform="translate(-60 -28)"><g id="ax-clapStick">
          <rect x="0" y="-14" width="120" height="14" rx="3" fill="#ece8dc" stroke="#0b0b0d" stroke-width="2"/>
          <path d="${stripes(0, -14, 120, 14, 10, -6)}" fill="#1b1b20"/>
          <circle cx="5" cy="-1" r="3" fill="#4a4a54"/>
        </g></g>
      </g></g></g>
      <g transform="translate(-66 -106) scale(-1 1) rotate(-9)">${arm("L")}</g>
      <g transform="translate(66 -106) rotate(-9)">${arm("R")}</g>
    </g></g></g>
    <g id="ax-fx">
      <g transform="translate(128 -340) scale(1.5)"><g id="ax-fxBangY"><g id="ax-fxBang" opacity="0"><path d="M-7 -34 L7 -34 L4 2 L-4 2 Z" fill="#f0c94a" stroke="#0b0b0d" stroke-width="3" stroke-linejoin="round"/><circle cx="0" cy="13" r="6" fill="#f0c94a" stroke="#0b0b0d" stroke-width="3"/></g></g></g>
      <g transform="translate(98 -256)"><g id="ax-fxSpark" opacity="0"><path d="M0 -16 Q2 -2 16 0 Q2 2 0 16 Q-2 2 -16 0 Q-2 -2 0 -16 Z" fill="#fff4c4"/></g></g>
      <g transform="translate(118 -306)"><circle id="ax-th1" r="6" fill="#ece8dc" opacity="0"/></g>
      <g transform="translate(142 -334)"><circle id="ax-th2" r="9" fill="#ece8dc" opacity="0"/></g>
      <g transform="translate(174 -366)"><circle id="ax-th3" r="13" fill="#ece8dc" opacity="0"/></g>
      <g transform="translate(0 -60)"><g id="ax-fxImpact" opacity="0" stroke="#f0c94a" stroke-width="5" stroke-linecap="round" fill="none">
        <path d="M-84 -40 L-102 -54"/><path d="M-90 -6 L-112 -6"/><path d="M-84 26 L-102 40"/>
        <path d="M84 -40 L102 -54"/><path d="M90 -6 L112 -6"/><path d="M84 26 L102 40"/>
      </g></g>
      <g transform="translate(0 -324) scale(1 0.36)"><g id="ax-fxStars" opacity="0">
        <path transform="translate(80 0)" d="${star(13, 5.5)}" fill="#f0c94a"/>
        <path transform="translate(-40 69)" d="${star(11, 4.5)}" fill="#ece8dc"/>
        <path transform="translate(-40 -69)" d="${star(12, 5)}" fill="#f0c94a"/>
      </g></g>
      <g transform="translate(118 -262)"><g id="ax-fxSweatY"><path id="ax-fxSweat" opacity="0" d="M0 -12 C6 -2 9 3 9 7 C9 12 5 15 0 15 C-5 15 -9 12 -9 7 C-9 3 -6 -2 0 -12 Z" fill="#9cc2ff" stroke="#5b86c9" stroke-width="2"/></g></g>
      <g transform="translate(0 -10) scale(1.1 0.7)"><g id="ax-fxImpact2" opacity="0" stroke="#f0c94a" stroke-width="5" stroke-linecap="round" fill="none">
        <path d="M-84 -40 L-102 -54"/><path d="M-90 -6 L-112 -6"/><path d="M-84 26 L-102 40"/>
        <path d="M84 -40 L102 -54"/><path d="M90 -6 L112 -6"/><path d="M84 26 L102 40"/>
      </g></g>
    </g>
  </g></g>
  </g>
</svg>`;

const bubs = Array.from({ length: 16 }, () => `<i class="ax-bub"></i>`).join("");
const frag = `<!-- ===== AJOLOTE v2 · rig SVG (ids con prefijo ax-) =====
     Pegar dentro del root de la composición. #ax se coloca con GSAP x/y = punto entre los pies.
     Requiere poses.js (window.AxRig). Generado por build/gen.js -->
<style>
  #ax { position: absolute; left: -220px; top: -380px; width: 440px; height: 420px; z-index: 30; pointer-events: none; }
  #ax-svg { display: block; width: 100%; height: 100%; overflow: visible; }
  #ax-trail { position: absolute; left: 0; top: 0; width: 1px; height: 1px; z-index: 29; pointer-events: none; }
  .ax-bub { position: absolute; display: block; left: -10px; top: -10px; width: 20px; height: 20px; border-radius: 50%;
    border: 2.5px solid rgba(236, 232, 220, 0.6); background: rgba(236, 232, 220, 0.07); opacity: 0; }
</style>
<div id="ax-trail">${bubs}</div>
<div id="ax">
${svg}
</div>
`;
fs.writeFileSync(path.join(RIG, "ajolote.html"), frag);
console.log("ok", frag.length);
