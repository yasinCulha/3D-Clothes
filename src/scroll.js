import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { SHOTS } from './shots.js';

gsap.registerPlugin(ScrollTrigger);

const KEYS = ['az', 'el', 'dist', 'tx', 'ty', 'tz', 'shift', 'shiftM', 'spin', 'idle'];
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Scroll konumunu bölümler arasında sürekli bir "p" değerine çevirir
 * (0 = ilk bölüm, 1 = ikinci …) ve kamera rig'ini iki durak arasında ara değerler.
 * Bölüm üst kenarı ekranın üstüne geldiğinde o bölümün durağı tam oturur.
 */
export function setupScroll(rig, { onSection } = {}) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sections = [...document.querySelectorAll('#story [data-shot]')];
  const shots = sections.map((s) => SHOTS[s.dataset.shot]);

  let lenis = null;
  if (!reduce) {
    lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  let tops = [];
  const measure = () => {
    tops = sections.map((s) => s.getBoundingClientRect().top + window.scrollY);
  };
  measure();
  window.addEventListener('resize', measure);
  ScrollTrigger.addEventListener('refresh', measure);
  window.addEventListener('load', measure);

  let current = -1;
  const progress = () => {
    const y = window.scrollY;
    if (y <= tops[0]) return 0;
    for (let i = 0; i < tops.length - 1; i++) {
      if (y < tops[i + 1]) return i + (y - tops[i]) / (tops[i + 1] - tops[i]);
    }
    return tops.length - 1;
  };

  function sample() {
    const p = progress();
    const i = Math.min(shots.length - 2, Math.floor(p));
    // Her bölümde kısa bir "bekleme" olsun: geçiş scroll'un ortasında yoğunlaşır.
    const f = smooth(0.12, 0.88, p - i);
    const a = shots[i], b = shots[i + 1];
    for (const k of KEYS) rig[k] = a[k] + (b[k] - a[k]) * f;

    const active = Math.round(p);
    if (active !== current) {
      current = active;
      onSection?.(active, sections[active]);
    }
    return p;
  }

  // Kart animasyonları
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) e.target.classList.toggle('in', e.isIntersecting);
  }, { threshold: 0.35 });
  document.querySelectorAll('.card').forEach((c) => io.observe(c));

  const scrollTo = (target) => {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { duration: 1.8 });
    else el.scrollIntoView({ behavior: 'auto' });
  };

  // Sayfa içi bağlantılar yumuşak kaysın
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.getAttribute('href').length < 2) return;
    e.preventDefault();
    scrollTo(a.getAttribute('href'));
  });

  return {
    sections,
    sample,
    scrollTo,
    measure,
    stop: () => { lenis?.stop(); document.documentElement.style.overflow = 'hidden'; },
    start: () => { lenis?.start(); document.documentElement.style.overflow = ''; },
  };
}
