// Kamera durakları. Model yüksekliği 2 birime normalize edildi (y: -1 etek, +1 yaka).
// az: yatay açı (0 = ön), el: dikey açı, dist: hedefe uzaklık, t*: bakılan nokta,
// shift: masaüstünde modelin yatay kayması (ekran oranı, + sağa), shiftM: mobilde dikey kayma,
// spin: model dönüşü (derece), idle: hafif salınım miktarı.
export const SHOTS = {
  hero:   { az: 0,   el: 6,  dist: 5.0,  tx: 0,     ty: 0.05, tz: 0,     shift: 0.2,   shiftM: 0.14, spin: -18, idle: 1 },
  collar: { az: 25,  el: 18, dist: 1.7,  tx: 0,     ty: 0.8,  tz: 0.08,  shift: -0.18, shiftM: 0.2,  spin: 0,   idle: 0.4 },
  cloud:  { az: -25, el: 5,  dist: 1.2,  tx: -0.16, ty: 0.08, tz: 0.17,  shift: 0.18,  shiftM: 0.2,  spin: 0,   idle: 0.3 },
  sleeve: { az: 50,  el: -4, dist: 2.0,  tx: 0.33,  ty: 0.05, tz: 0.05,  shift: -0.1,  shiftM: 0.2,  spin: 0,   idle: 0.4 },
  back:   { az: 180, el: 6,  dist: 5.0,  tx: 0,     ty: 0.05, tz: 0,     shift: 0.2,   shiftM: 0.14, spin: 0,   idle: 1 },
  fabric: { az: 165, el: 10, dist: 0.75, tx: 0,     ty: 0.45, tz: -0.16, shift: -0.18, shiftM: 0.2,  spin: 0,   idle: 0.2 },
  shop:   { az: 380, el: 6,  dist: 5.0,  tx: 0,     ty: 0.05, tz: 0,     shift: -0.2,  shiftM: 0.24, spin: 0,   idle: 1 },
};

// Modele bağlı detay noktaları (normalize model koordinatları, raycast ile ölçüldü).
// section: tıklanınca kaydırılacak bölüm. normal: noktanın baktığı yön (arkada kalınca gizlenir).
export const HOTSPOTS = [
  { id: 'collar', label: 'Yüksek yaka', section: 'yaka', pos: [0.047, 0.819, 0.118], normal: [0, 0.2, 1] },
  { id: 'cloud', label: 'Bulut motifi', section: 'bulut', pos: [-0.15, 0.092, 0.171], normal: [-0.47, 0.12, 0.88] },
  { id: 'sleeve', label: 'Kol & manşet', section: 'kol', pos: [0.33, 0.071, 0.094], normal: [0.3, 0, 1] },
  { id: 'fabric', label: 'Kumaş dokusu', section: 'kumas', pos: [0, 0.45, -0.16], normal: [0, 0, -1] },
];
