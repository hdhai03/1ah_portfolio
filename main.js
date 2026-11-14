// Scale the 1920x1080 design stage to the viewport.
const root = document.documentElement;
const DESIGN_W = 1920;
const DESIGN_H = 1080;
const MOBILE_VISIBLE_W = 1100; // on narrow screens, crop the sides and keep the portrait centred

function fit() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  let s;
  let left = 0;
  if (w >= 900) {
    s = w / DESIGN_W;
  } else {
    s = Math.min(w / MOBILE_VISIBLE_W, (h * 0.8) / DESIGN_H);
    left = (w - DESIGN_W * s) / 2;
  }
  root.style.setProperty('--s', s.toFixed(4));
  root.style.setProperty('--ns', Math.max(s, 0.75).toFixed(4)); // keep the menu tappable on small screens
  root.style.setProperty('--stage-left', `${left}px`);
  const hero = document.getElementById('home');
  if (hero) root.style.setProperty('--hero-top', `${hero.offsetTop}px`);
}
fit();
window.addEventListener('resize', fit);

// ---------- Loader ----------
// 1. ring spins, face draws (CSS, ~2.5s)  2. wait for the page to finish loading
// 3. the blue background shrinks into the Home portrait circle while the face grows to its Home size
// 4. Home elements pop in (CSS transitions keyed off html.is-loading)
const loader = document.getElementById('loader');
const loaderFace = document.getElementById('loaderFace');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const DRAW_MS = reduceMotion ? 0 : 2600;
const MAX_WAIT_MS = 8000;

// Loader face (Figma Loading frame) -> Home face (Group 85 in the Home frame), in stage units
const FACE_FROM = { x: 800.06, y: 336.0, w: 320.418 };
const FACE_TO = { x: 783.426, y: 316.0, w: 353.64 };
const CIRCLE_R = 740.667 / 2;       // portrait circle radius (design units)
const CIRCLE_C = { x: 960.333, y: 529.333 };

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const pageLoaded = new Promise((r) => {
  if (document.readyState === 'complete') r();
  else window.addEventListener('load', r, { once: true });
});

function finishLoading() {
  if (!loader) return;
  if (reduceMotion || !loader.animate) {
    root.classList.remove('is-loading');
    loader.remove();
    return;
  }
  fit();
  const s = parseFloat(getComputedStyle(root).getPropertyValue('--s')) || 1;
  const stageLeft = parseFloat(getComputedStyle(root).getPropertyValue('--stage-left')) || 0;
  const heroTop = document.getElementById('home').getBoundingClientRect().top;
  const cx = stageLeft + CIRCLE_C.x * s;
  const cy = heroTop + CIRCLE_C.y * s;
  const r = CIRCLE_R * s;
  const R = Math.hypot(Math.max(cx, innerWidth - cx), Math.max(cy, innerHeight - cy));
  const timing = { duration: 1100, easing: 'cubic-bezier(.76, 0, .24, 1)', fill: 'forwards' };

  const k = FACE_TO.w / FACE_FROM.w;
  loaderFace.animate(
    [{ transform: 'none' },
     { transform: `translate(${FACE_TO.x - FACE_FROM.x}px, ${FACE_TO.y - FACE_FROM.y}px) scale(${k})` }],
    timing,
  );
  const shrink = loader.animate(
    [{ clipPath: `circle(${R}px at ${cx}px ${cy}px)` }, { clipPath: `circle(${r}px at ${cx}px ${cy}px)` }],
    timing,
  );
  // start revealing Home a little before the circle lands
  setTimeout(() => root.classList.remove('is-loading'), 750);
  shrink.finished.then(() => {
    loader.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'forwards' })
      .finished.then(() => loader.remove());
  });
}

Promise.race([Promise.all([pageLoaded, wait(DRAW_MS)]), wait(MAX_WAIT_MS)]).then(finishLoading);

// ---------- Hills as an After Effects speed graph ----------
// Each hill is the speed graph of ONE animated segment between two keyframes (A -> B), like AE:
//  - the value curve is a cubic bézier  P0=(0,0)  P1=(i1·T, s1·i1·T)  P2=(T−i2·T, D−s2·i2·T)  P3=(T,D)
//    (i = influence 0..1, s = speed at the keyframe, T = duration, D = distance travelled)
//  - the hill is its derivative (speed over time), so the peak is NOT a fixed point: it emerges from both handles
//  - the area under the hill (= D) stays constant: longer handles make a narrower, taller peak;
//    raising a keyframe's speed lowers the middle.
// Handles are horizontal (as in AE's speed graph): drag sideways = influence, drag up/down = keyframe speed.
const SVGNS = 'http://www.w3.org/2000/svg';
const K = 118 / (0.59 * 634.667); // handle drawn length = influence·T·K (first handle = the 118px Figma sample)
const LINE_DY = -2.333;    // Figma draws the handle line at y=900, 2.33px above the hill baseline
const SAMPLES = 96;
const MAX_INFLUENCE_SUM = 1.5;

// Figma geometry: baseline x-range, baseline y, peak height and area under the hill (px²).
// Initial influences were fitted so the AE ease curve matches the Figma hill shape (RMS error ≈ 9–13px);
// the area is kept equal to the Figma hill, which is the quantity AE conserves.
const HILLS = [
  { el: '.hill--left',  x0: 158,     x1: 792.667,  base: 902.333, h: 253.333, area: 70055.1,  i: [0.59, 0.56],
    anchors: [150, 786] },
  { el: '.hill--lime',  x0: 672.668, x1: 1032.668, base: 902.333, h: 153.333, area: 25514.6,  i: [0.53, 0.58],
    anchors: [666, 1026] },
  { el: '.hill--right', x0: 882,     x1: 1762,     base: 901.667, h: 286.667, area: 106640.1, i: [0.60, 0.58],
    anchors: [875, 1760] },
];

const bez = (p0, p1, p2, p3, u) => {
  const m = 1 - u;
  return m * m * m * p0 + 3 * m * m * u * p1 + 3 * m * u * u * p2 + u * u * u * p3;
};
const dbez = (p0, p1, p2, p3, u) => {
  const m = 1 - u;
  return 3 * (m * m * (p1 - p0) + 2 * m * u * (p2 - p1) + u * u * (p3 - p2));
};

// speed curve samples [t, speed] for a hill (D = 1, so speeds are in 1/px)
function speedCurve(T, i1, i2, s1, s2) {
  const X = [0, i1 * T, T - i2 * T, T];
  const Y = [0, s1 * i1 * T, 1 - s2 * i2 * T, 1];
  const pts = [];
  for (let k = 0; k <= SAMPLES; k++) {
    const u = k / SAMPLES;
    const dx = dbez(...X, u);
    const dy = dbez(...Y, u);
    pts.push([bez(...X, u), dx > 1e-9 ? dy / dx : (u < 0.5 ? s1 : s2)]);
  }
  return pts;
}

HILLS.forEach((h) => {
  h.T = h.x1 - h.x0;
  h.s = [0, 0];                       // ease in / ease out: speed 0 at both keyframes
  h.init = { i: [...h.i], s: [...h.s] };
  h.path = document.querySelector(h.el);
  // with D = 1 the area under the speed curve is 1, so SY = Figma area makes the drawn area match Figma
  h.SY = h.area;                      // px per (1/px) of speed
  h.anchorEls = h.anchors.map((x) => [...document.querySelectorAll('.handle')]
    .find((img) => parseFloat(img.style.left) === x));
});

const f = (n) => +n.toFixed(2);
function renderHill(h) {
  const pts = speedCurve(h.T, h.i[0], h.i[1], h.s[0], h.s[1]);
  let d = `M${f(h.x0)} ${f(h.base)}`;
  for (const [t, v] of pts) d += `L${f(h.x0 + t)} ${f(h.base - v * h.SY)}`;
  h.path.setAttribute('d', `${d}L${f(h.x1)} ${f(h.base)}Z`);
  if (h.outline) h.outline.setAttribute('d', d.replace(/^M[^L]+/, `M${f(h.x0)} ${f(h.base - pts[0][1] * h.SY)}`));
}

const graph = document.getElementById('graph');
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

function buildHandle(h, side) {
  const dir = side === 0 ? 1 : -1;                    // start handle points right, end handle points left
  const kx = h.anchors[side] + 6.667;                 // keyframe (anchor square) centre x
  const anchorEl = h.anchorEls[side];
  const g = document.createElementNS(SVGNS, 'g');
  g.setAttribute('class', 'graph__handle');
  g.setAttribute('tabindex', '0');
  g.setAttribute('role', 'slider');
  g.setAttribute('aria-label', 'Keyframe handle: drag sideways for influence, up/down for speed');
  const line = document.createElementNS(SVGNS, 'line');
  line.setAttribute('class', 'graph__line');
  const dot = document.createElementNS(SVGNS, 'circle');
  dot.setAttribute('class', 'graph__dot');
  dot.setAttribute('r', '4');
  const hit = document.createElementNS(SVGNS, 'circle');
  hit.setAttribute('class', 'graph__hit');
  hit.setAttribute('r', '16');
  g.append(line, dot, hit);
  h.group.append(g);

  const lineY = () => h.base + LINE_DY - h.s[side] * h.SY;
  const dotPos = () => [kx + dir * h.i[side] * h.T * K, lineY()];

  function render() {
    const [dx, dy] = dotPos();
    line.setAttribute('x1', kx); line.setAttribute('y1', dy);
    line.setAttribute('x2', dx); line.setAttribute('y2', dy);
    for (const c of [dot, hit]) { c.setAttribute('cx', dx); c.setAttribute('cy', dy); }
    if (anchorEl) anchorEl.style.top = `${893 - h.s[side] * h.SY}px`;   // keyframe rides up with its speed
    renderHill(h);
  }
  // drive both handles of the hill (the other side's curve changes too)
  h.renders = h.renders || [];
  h.renders.push(render);
  const renderAll = () => h.renders.forEach((r) => r());

  function set(dx, dy) {
    // AE allows 0.1%..100% per side; 100% on both sides makes the speed infinite mid-segment,
    // so the two influences together are capped (keeps the peak below the portrait)
    h.i[side] = clamp((dx - kx) * dir / (h.T * K), 0.01, Math.min(1, MAX_INFLUENCE_SUM - h.i[1 - side]));
    h.s[side] = clamp((h.base + LINE_DY - dy) / h.SY, 0, (h.h * 1.15) / h.SY);         // keep it on screen
    renderAll();
  }

  const toStage = (e) => {
    const r = stage.getBoundingClientRect();
    const s = r.width / 1920;
    return [(e.clientX - r.left) / s, (e.clientY - r.top) / s];
  };
  hit.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { hit.setPointerCapture(e.pointerId); } catch (_) { /* synthetic events */ }
    g.classList.add('is-dragging');
    const [px, py] = toStage(e);
    const [dx, dy] = dotPos();
    const off = [dx - px, dy - py];
    const move = (ev) => { const [x, y] = toStage(ev); set(x + off[0], y + off[1]); };
    const up = () => {
      g.classList.remove('is-dragging');
      hit.removeEventListener('pointermove', move);
      hit.removeEventListener('pointerup', up);
      hit.removeEventListener('pointercancel', up);
    };
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerup', up);
    hit.addEventListener('pointercancel', up);
  });
  // double-click resets this keyframe to the Figma ease
  hit.addEventListener('dblclick', () => {
    h.i[side] = h.init.i[side];
    h.s[side] = h.init.s[side];
    renderAll();
  });
  // keyboard: arrows nudge (shift = bigger steps)
  g.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 20 : 4;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    const [dx, dy] = dotPos();
    set(dx + d[0], dy + d[1]);
  });
}
// Selecting a hill (click / tap / keyboard focus) reveals its curve stroke and handles, like picking
// a property in AE's graph editor. Exactly one hill is selected at all times.
function selectHill(sel) {
  HILLS.forEach((h) => {
    const on = h === sel;
    h.group.classList.toggle('is-selected', on);
    h.path.classList.toggle('is-selected', on);
    h.path.setAttribute('aria-pressed', String(on));
    h.anchorEls.forEach((a) => a && a.classList.toggle('is-shown', on));
  });
}
if (graph) {
  HILLS.forEach((h) => {
    h.group = document.createElementNS(SVGNS, 'g');
    h.group.setAttribute('class', 'graph__hill');
    h.outline = document.createElementNS(SVGNS, 'path');
    h.outline.setAttribute('class', 'graph__curve');
    h.group.append(h.outline);
    graph.append(h.group);
    buildHandle(h, 0);
    buildHandle(h, 1);
    h.renders.forEach((r) => r());

    h.path.setAttribute('tabindex', '0');
    h.path.setAttribute('role', 'button');
    h.path.setAttribute('aria-label', 'Select curve to edit its keyframe handles');
    h.path.addEventListener('pointerdown', () => selectHill(h));
    h.path.addEventListener('focus', () => selectHill(h));
  });
  selectHill(HILLS[1]);   // the small lime hill starts selected; one hill is always selected (no deselect)
}


// Menu overlay
const menuBtn = document.getElementById('menuBtn');
const menuPanel = document.getElementById('menuPanel');
function setMenu(open) {
  menuBtn.setAttribute('aria-expanded', String(open));
  menuPanel.hidden = !open;
}
menuBtn.addEventListener('click', () => setMenu(menuPanel.hidden));
menuPanel.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

// Subtle parallax on pointer move
const stage = document.getElementById('stage');
const layers = [['.paper-tile', 12], ['.orb', -18], ['.dot', 10], ['.pointer', -14], ['.portrait-group', 4]];
if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  window.addEventListener('pointermove', (e) => {
    if (root.classList.contains('is-loading')) return;
    const x = e.clientX / window.innerWidth - 0.5;
    const y = e.clientY / window.innerHeight - 0.5;
    for (const [sel, d] of layers) {
      const el = stage.querySelector(sel);
      if (el) el.style.translate = `${x * d}px ${y * d}px`;
    }
  });
}
