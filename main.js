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
