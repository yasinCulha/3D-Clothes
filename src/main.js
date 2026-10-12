import './style.css';
import { createStage, createRig, loadModel } from './scene.js';
import { setupScroll } from './scroll.js';
import { createHotspots } from './hotspots.js';
import { setupShop } from './shop.js';
import { SHOTS } from './shots.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');

const stage = createStage(document.getElementById('webgl'));
const rig = createRig(SHOTS.hero);

// ---- İlerleme noktaları ----
const dots = document.getElementById('progress-dots');
const scroll = setupScroll(rig, {
  onSection(i) {
    dots.querySelectorAll('button').forEach((b, j) => b.classList.toggle('active', i === j));
  },
});
scroll.sections.forEach((s) => {
  const li = document.createElement('li');
  li.innerHTML = `<button type="button"><span>${s.dataset.label}</span></button>`;
  li.firstElementChild.addEventListener('click', () => scroll.scrollTo(s));
  dots.appendChild(li);
});

const hotspots = createHotspots(stage, { onSelect: (h) => scroll.scrollTo(`#${h.section}`) });
setupShop();

// ---- Serbest inceleme ----
const exploreUI = document.getElementById('explore-ui');
let exploring = false;
function setExplore(on) {
  if (on === exploring) return;
  exploring = on;
  document.body.classList.toggle('exploring', on);
  exploreUI.hidden = !on;
  if (on) { scroll.stop(); stage.enterExplore(); }
  else { scroll.start(); stage.exitExplore(); }
}
document.querySelectorAll('[data-explore]').forEach((b) => b.addEventListener('click', () => setExplore(true)));
document.getElementById('explore-close').addEventListener('click', () => setExplore(false));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setExplore(false); });

// ---- Yükleme ----
const loader = document.getElementById('loader');
const fill = document.getElementById('loader-fill');
const pct = document.getElementById('loader-pct');
const setProgress = (p) => {
  const v = Math.round(p * 100);
  fill.style.width = `${v}%`;
  pct.textContent = v;
};

loadModel(stage, setProgress)
  .then(() => {
    setProgress(1);
    scroll.measure();
    requestAnimationFrame(() => {
      loader.classList.add('done');
      window.__ready = true;
    });
    if (DEBUG) setupDebug();
  })
  .catch((err) => {
    console.error(err);
    loader.querySelector('.loader-text').textContent = '3D model yüklenemedi. Sayfayı yenileyin.';
  });

// ---- Render döngüsü ----
let autoSpin = 0;
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;

  const p = scroll.sample();
  // Satın alma bölümünde model kendi etrafında yavaşça döner
  const shopWeight = Math.max(0, Math.min(1, p - (scroll.sections.length - 2)));
  autoSpin += dt * 14 * shopWeight;
  rig.spin += autoSpin;
  if (DEBUG && window.__freeze) { rig.spin = 0; rig.idle = 0; }

  stage.update(rig, t, dt);
  hotspots.update(rig);
  stage.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---- Geliştirici modu: ?debug ----
function setupDebug() {
  window.__stage = stage;
  window.__rig = rig;
  setExplore(true);
  console.info('[debug] Serbest kamera açık. "P" ile mevcut pozu SHOTS formatında yazdır.');
  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() !== 'p') return;
    const c = stage.camera.position, tg = stage.controls.target;
    const d = c.clone().sub(tg);
    const dist = d.length();
    const shot = {
      az: +(Math.atan2(d.x, d.z) * 180 / Math.PI).toFixed(1),
      el: +(Math.asin(d.y / dist) * 180 / Math.PI).toFixed(1),
      dist: +dist.toFixed(2),
      tx: +tg.x.toFixed(2), ty: +tg.y.toFixed(2), tz: +tg.z.toFixed(2),
    };
    console.log(JSON.stringify(shot));
  });
}
