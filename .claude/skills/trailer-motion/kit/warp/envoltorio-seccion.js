// Envoltorio de sección: la sección se escribe en TIEMPO DE PARTITURA (score) con render(t) y
// window.CUES.warp la lleva a TIEMPO REAL, con estiramiento ×K, pausas (hold) y cortes de partitura.
// Pega esto en lugar de `window.__timelines["<id>"] = tl;` y cambia S0_ (inicio en partitura) y SD_ (duración en partitura).
// El audio usa el mismo mapa en audio/build.py (ver build-con-mapa.py: K, WARP_S, HOLD_*, R(), cut()).
// v3: la sección se escribe en tiempo de partitura; CUES.warp la lleva a tiempo real (×K, con pausas y cortes)
  const C_ = window.CUES, K_ = C_.K, WP_ = C_.warp, S0_ = 6, SD_ = 7;
  const R_ = (s) => { for (const w of WP_) if (s < w.s1 + 1e-9 || w === WP_[WP_.length - 1]) return w.r0 + (Math.max(s, w.s0) - w.s0) * K_; };
  const S_ = (r) => { let prev = 0; for (const w of WP_) { if (r < w.r0) return prev; const e = w.r0 + (w.s1 - w.s0) * K_; if (r < e) return w.s0 + (r - w.r0) / K_; prev = w.s1; } return prev; };
  const RA_ = R_(S0_), RD_ = R_(S0_ + SD_) - RA_, px_ = { r: 0 };
  const W_ = gsap.timeline({ paused: true });
  W_.fromTo(px_, { r: 0 }, { r: RD_, duration: RD_, ease: "none", onUpdate: () => tl.time(Math.min(SD_, Math.max(0, S_(RA_ + px_.r) - S0_))) }, 0);
  window.__timelines["<id>"] = W_;
