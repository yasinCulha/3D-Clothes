# Akatsuki Store — 3D ürün sayfası

Scroll ile kameranın Akatsuki pelerininin etrafında dolaşıp detaylara yaklaştığı e-ticaret ürün sayfası (Vite + Three.js + GSAP + Lenis).

```bash
npm install
npm run assets   # ../3D-model'den normal/AO haritalarını üretir, public/models/akatsuki-coat.glb yazar
npm run dev      # http://localhost:5173
npm run build    # dist/
```

- `scripts/build-assets.mjs` — eksik haritaları üretir: normal map (baseColor → yükseklik → Sobel), AO/cavity map, ORM dokusu; dokuları 2048² WebP yapar, Draco ile sıkıştırır. İnceleme kopyaları `generated/` klasörüne yazılır.
- `src/shots.js` — kamera durakları ve hotspot koordinatları. Yeni duraklar için `http://localhost:5173/?debug` açın, kamerayı sürükleyin, **P** tuşuyla pozu konsola yazdırın.
- `src/shop.js` — beden, adet, sepet (localStorage).

3D model: "Akatsuki coat - Itachi's clothes" — Marc Ed, CC-BY-4.0 (kredi sayfa altında).
