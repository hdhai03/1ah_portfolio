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

// ---------- Hills as an After Effects-style graph editor ----------
// Each hill is two cubic béziers: A -> c1 -> c2 -> P (peak) and P -> c3 -> c4 -> B, values from the Figma vectors.
// The baseline handles (c1, c4) are exposed as draggable dots. Handles are drawn at K x the real
// control length, so the first one matches the 118px sample in Figma.
const SVGNS = 'http://www.w3.org/2000/svg';
const K = 118 / 181.333;
const HANDLE_Y = 900;                     // Figma: handle line sits on y = 900
const HILLS = [
  { el: '.hill--left',  A: [158, 902.333],     c1: [339.333, 902.333],  c2: [379.333, 649], P: [482, 649],
    c3: [584.667, 649], c4: [632.667, 902.333], B: [792.667, 902.333], anchors: [156.667, 792.667] },
  { el: '.hill--lime',  A: [672.668, 902.333], c1: [766.001, 902.333],  c2: [766.001, 749], P: [843.335, 749],
    c3: [920.668, 749], c4: [926.001, 902.333], B: [1032.668, 902.333], anchors: [672.667, 1032.667] },
  { el: '.hill--right', A: [882, 901.667],     c1: [1158, 901.667],     c2: [1184.667, 615], P: [1322, 615],
    c3: [1464.667, 615], c4: [1531.333, 901.667], B: [1762, 901.667], anchors: [881.667, 1766.667] },
];
HILLS.forEach((h) => { h.init = { c1: [...h.c1], c4: [...h.c4] }; h.path = document.querySelector(h.el); });

const f = (n) => +n.toFixed(3);
function hillPath(h) {
  const { A, c1, c2, P, c3, c4, B } = h;
  return `M${f(A[0])} ${f(A[1])}C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(P[0])} ${f(P[1])}`
       + `C${f(c3[0])} ${f(c3[1])} ${f(c4[0])} ${f(c4[1])} ${f(B[0])} ${f(B[1])}H${f(A[0])}Z`;
}

const graph = document.getElementById('graph');
const clamp = (v, a, b) => Math.min(Math.max(v, Math.min(a, b)), Math.max(a, b));

function buildHandle(h, side) {
  // side 0 = start (A, c1, grows right), side 1 = end (B, c4, grows left)
  const key = side === 0 ? 'c1' : 'c4';
  const base = side === 0 ? h.A : h.B;
  const ox = h.anchors[side];
  const g = document.createElementNS(SVGNS, 'g');
  g.setAttribute('class', 'graph__handle');
  g.setAttribute('tabindex', '0');
  g.setAttribute('role', 'slider');
  g.setAttribute('aria-label', 'Graph handle — drag, or use arrow keys');
  const line = document.createElementNS(SVGNS, 'line');
  line.setAttribute('class', 'graph__line');
  const dot = document.createElementNS(SVGNS, 'circle');
  dot.setAttribute('class', 'graph__dot');
  dot.setAttribute('r', '4');
  const hit = document.createElementNS(SVGNS, 'circle');
  hit.setAttribute('class', 'graph__hit');
  hit.setAttribute('r', '16');
  g.append(line, dot, hit);
  graph.append(g);

  // dot position <-> control point
  const toDot = (c) => [ox + (c[0] - base[0]) * K, HANDLE_Y + (c[1] - base[1]) * K];
  const fromDot = (d) => [base[0] + (d[0] - ox) / K, base[1] + (d[1] - HANDLE_Y) / K];
  const limitX = ox + (h.P[0] - base[0]) * K;       // can't pass the peak
  const limitY = HANDLE_Y + (h.P[1] - base[1]) * K; // can't go above the peak

  function render() {
    const [dx, dy] = toDot(h[key]);
    line.setAttribute('x1', ox); line.setAttribute('y1', HANDLE_Y);
    line.setAttribute('x2', dx); line.setAttribute('y2', dy);
    for (const c of [dot, hit]) { c.setAttribute('cx', dx); c.setAttribute('cy', dy); }
    h.path.setAttribute('d', hillPath(h));
  }
  function set(dx, dy) {
    h[key] = fromDot([clamp(dx, ox, limitX), clamp(dy, HANDLE_Y, limitY)]);
    render();
  }

  const toStage = (e) => {
    const r = stage.getBoundingClientRect();
    const s = r.width / 1920;
    return [(e.clientX - r.left) / s, (e.clientY - r.top) / s];
  };
  hit.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    hit.setPointerCapture(e.pointerId);
    g.classList.add('is-dragging');
    const [px, py] = toStage(e);
    const [dx, dy] = toDot(h[key]);
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
  // double-click resets to the Figma curve
  hit.addEventListener('dblclick', () => { h[key] = [...h.init[key]]; render(); });
  // keyboard: arrows nudge (shift = bigger steps)
  g.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 20 : 4;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    const [dx, dy] = toDot(h[key]);
    set(dx + d[0], dy + d[1]);
  });
  render();
}
if (graph) HILLS.forEach((h) => { buildHandle(h, 0); buildHandle(h, 1); });

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
