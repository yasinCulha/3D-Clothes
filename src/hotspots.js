import * as THREE from 'three';
import { HOTSPOTS } from './shots.js';

/** Modelin üzerindeki detay noktalarını ekrana projekte edilen tıklanabilir etiketlere çevirir. */
export function createHotspots(stage, { onSelect }) {
  const layer = document.getElementById('hotspots');
  const world = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const toCam = new THREE.Vector3();

  const items = HOTSPOTS.map((h) => {
    const el = document.createElement('button');
    el.className = 'hotspot hidden';
    el.type = 'button';
    el.setAttribute('aria-label', `${h.label} detayına git`);
    el.innerHTML = `<span class="hotspot-dot">+</span><span class="hotspot-label">${h.label}</span>`;
    el.addEventListener('click', () => onSelect(h));
    layer.appendChild(el);
    return {
      ...h,
      el,
      local: new THREE.Vector3(...h.pos),
      localNormal: new THREE.Vector3(...h.normal).normalize(),
    };
  });

  return {
    update(rig) {
      // Yakın çekimlerde etiketler kalabalık yaratmasın
      const overview = rig.dist > 3.4;
      for (const it of items) {
        world.copy(it.local);
        stage.pivot.localToWorld(world);
        normal.copy(it.localNormal).applyQuaternion(stage.pivot.quaternion);
        toCam.copy(stage.camera.position).sub(world).normalize();
        const facing = normal.dot(toCam) > 0.15;

        const p = stage.projectToScreen(world);
        it.el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
        it.el.classList.toggle('hidden', !(overview && facing && p.z < 1));
      }
    },
  };
}
