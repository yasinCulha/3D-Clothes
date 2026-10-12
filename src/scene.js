import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const DEG = Math.PI / 180;
const MODEL_HEIGHT = 2; // model bu yüksekliğe normalize edilir, kamera durakları buna göre

export const isMobile = () => window.matchMedia('(max-width: 860px)').matches;

/**
 * Kamera "rig" durumu: hedef noktanın etrafında küresel koordinatlar.
 * GSAP bu nesnenin alanlarını tween'ler; her karede kameraya uygulanır.
 */
export function createRig(shot) {
  return { ...shot };
}

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0a0a0c, 9, 18);

  const camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.02, 50);

  // Ortam yansımaları
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  // Işıklar: sıcak key, kırmızı rim, soğuk fill
  const key = new THREE.DirectionalLight(0xfff1e6, 2.4);
  key.position.set(2.5, 3.5, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -2; key.shadow.camera.right = 2;
  key.shadow.camera.top = 2; key.shadow.camera.bottom = -2;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.02;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0xff2a3a, 3.2);
  rim.position.set(-3, 2, -3);
  scene.add(rim);

  const rim2 = new THREE.DirectionalLight(0xff5560, 1.4);
  rim2.position.set(3, 0.5, -2.5);
  scene.add(rim2);

  const fill = new THREE.HemisphereLight(0xbfd4ff, 0x1a0508, 0.6);
  scene.add(fill);

  // Zemin: gölge alan görünmez düzlem + yumuşak kırmızı ışık halkası
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 8),
    new THREE.ShadowMaterial({ opacity: 0.45 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -MODEL_HEIGHT / 2 - 0.001;
  ground.receiveShadow = true;
  scene.add(ground);

  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(1.6, 64),
    new THREE.MeshBasicMaterial({ map: radialTexture(), transparent: true, depthWrite: false, opacity: 0.9 })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = -MODEL_HEIGHT / 2 - 0.002;
  scene.add(glow);

  // Model pivotu: rig.spin + idle salınım buna uygulanır
  const pivot = new THREE.Group();
  scene.add(pivot);

  const target = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const pose = { pos: new THREE.Vector3(), target: new THREE.Vector3() };

  // ---- Serbest inceleme (OrbitControls) ----
  const controls = new OrbitControls(camera, canvas);
  controls.enabled = false;
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 0.5;
  controls.maxDistance = 7;
  controls.minPolarAngle = 10 * DEG;
  controls.maxPolarAngle = 100 * DEG;

  let mode = 'rig'; // 'rig' | 'explore' | 'return'
  const ret = { k: 0, fromPos: new THREE.Vector3(), fromTarget: new THREE.Vector3() };
  let viewShift = 0;

  // Dar/dikey ekranlarda model kadraja sığsın diye kamerayı biraz geri çek
  const distScale = () => {
    const aspect = window.innerWidth / window.innerHeight;
    return aspect < 1 ? 1 + (1 - aspect) * 0.4 : 1;
  };

  function rigPose(rig, out) {
    const az = rig.az * DEG, el = rig.el * DEG;
    const dist = rig.dist * distScale();
    out.target.set(rig.tx, rig.ty, rig.tz);
    out.pos.set(
      rig.tx + dist * Math.cos(el) * Math.sin(az),
      rig.ty + dist * Math.sin(el),
      rig.tz + dist * Math.cos(el) * Math.cos(az)
    );
    return out;
  }

  function applyViewOffset(shift) {
    const w = window.innerWidth, h = window.innerHeight;
    if (Math.abs(shift) < 1e-4) { camera.clearViewOffset(); return; }
    if (isMobile()) camera.setViewOffset(w, h, 0, shift * h, w, h);
    else camera.setViewOffset(w, h, -shift * w, 0, w, h);
  }

  function update(rig, time, dt = 1 / 60) {
    const k = 1 - Math.exp(-dt * 7); // kare hızından bağımsız yumuşatma
    // Model: scroll ile gelen dönüş + idle nefes alma
    pivot.rotation.y = rig.spin * DEG + Math.sin(time * 0.4) * 0.04 * rig.idle;
    pivot.position.y = Math.sin(time * 0.9) * 0.012 * rig.idle;

    if (mode === 'explore') {
      controls.update();
      viewShift += (0 - viewShift) * k;
      applyViewOffset(viewShift);
      return;
    }

    rigPose(rig, pose);
    if (mode === 'return') {
      ret.k = Math.min(1, ret.k + dt * 1.4);
      const e = 1 - Math.pow(1 - ret.k, 3);
      pose.pos.lerpVectors(ret.fromPos, pose.pos, e);
      pose.target.lerpVectors(ret.fromTarget, pose.target, e);
      if (ret.k >= 1) mode = 'rig';
    }
    camera.position.copy(pose.pos);
    target.copy(pose.target);
    camera.lookAt(target);

    const wanted = isMobile() ? rig.shiftM : rig.shift;
    viewShift += (wanted - viewShift) * k;
    applyViewOffset(viewShift);
  }

  function enterExplore() {
    mode = 'explore';
    controls.target.copy(target);
    controls.enabled = true;
    controls.update();
  }

  function exitExplore() {
    controls.enabled = false;
    ret.fromPos.copy(camera.position);
    ret.fromTarget.copy(controls.target);
    ret.k = 0;
    mode = 'return';
  }

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  }
  window.addEventListener('resize', resize);

  return {
    THREE, renderer, scene, camera, pivot, controls, target,
    update, enterExplore, exitExplore,
    render: () => renderer.render(scene, camera),
    projectToScreen(v) {
      tmp.copy(v).project(camera);
      return { x: (tmp.x * 0.5 + 0.5) * window.innerWidth, y: (-tmp.y * 0.5 + 0.5) * window.innerHeight, z: tmp.z };
    },
  };
}

/** GLB'yi yükler, ortalar, MODEL_HEIGHT'e ölçekler. Optimize edilmiş dosya başarısız olursa orijinale düşer. */
export async function loadModel(stage, onProgress) {
  // three r18x+: decoder dosyalarını kendi paketinden bulur, Vite bunları bundle'a ekler.
  const draco = new DRACOLoader();
  const loader = new GLTFLoader().setDRACOLoader(draco);

  const load = (url) => new Promise((resolve, reject) => {
    loader.load(url, resolve, (e) => {
      if (e.total) onProgress?.(e.loaded / e.total);
    }, reject);
  });

  let gltf;
  try {
    gltf = await load('/models/akatsuki-coat.glb');
  } catch (err) {
    console.warn('Optimize model yüklenemedi, orijinal kullanılıyor:', err);
    gltf = await load('/models/akatsuki-coat-original.glb');
  }

  const model = gltf.scene;
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const s = MODEL_HEIGHT / size.y;
  model.scale.setScalar(s);
  model.position.copy(center).multiplyScalar(-s);

  const maxAniso = stage.renderer.capabilities.getMaxAnisotropy();
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const m = o.material;
    m.side = THREE.DoubleSide;
    m.envMapIntensity = 0.9;
    for (const t of [m.map, m.normalMap, m.roughnessMap, m.aoMap]) {
      if (t) t.anisotropy = maxAniso;
    }
    if (m.normalMap) m.normalScale.set(0.9, 0.9);
    m.aoMapIntensity = 1;
  });

  stage.pivot.add(model);
  return model;
}

function radialTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(208,28,42,0.45)');
  grad.addColorStop(0.45, 'rgba(120,10,20,0.18)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
