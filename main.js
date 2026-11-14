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
}
fit();
window.addEventListener('resize', fit);

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
const layers = [['.paper-tile', 12], ['.orb', -18], ['.dot', 10], ['.pointer', -14], ['.portrait', 4]];
if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  window.addEventListener('pointermove', (e) => {
    const x = e.clientX / window.innerWidth - 0.5;
    const y = e.clientY / window.innerHeight - 0.5;
    for (const [sel, d] of layers) {
      const el = stage.querySelector(sel);
      if (el) el.style.translate = `${x * d}px ${y * d}px`;
    }
  });
}
