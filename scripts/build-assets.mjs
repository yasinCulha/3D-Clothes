// Modelde eksik olan haritaları (normal, AO) dokulardan üretir, dokuları web için
// küçültür/sıkıştırır ve Draco sıkıştırmalı tek bir GLB olarak public/models'a yazar.
import { copyFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import draco3d from 'draco3dgltf';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { dedup, draco, prune, weld } from '@gltf-transform/functions';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modelDir = path.resolve(root, '../3D-model');
const srcGltf = path.join(modelDir, 'akatsuki_coat_-_itachis_clothes-glTF/scene.gltf');
const srcTex = path.join(modelDir, 'akatsuki_coat_-_itachis_clothes-glTF/textures');
const srcGlb = path.join(modelDir, 'akatsuki_coat_-_itachis_clothes (1).glb');
const outModels = path.join(root, 'public/models');
const outGenerated = path.join(root, 'generated');

const SIZE = 2048;
const NORMAL_STRENGTH = 6.0; // ince kumaş/dikiş detayı için
const BUMP_STRENGTH = 2.5;   // bulut kenarları gibi büyük ölçekli kabartma
const AO_STRENGTH = 2.2;

const log = (...a) => console.log('[assets]', ...a);

async function rawGrey(input, blur) {
  let img = sharp(input).resize(SIZE, SIZE).greyscale();
  if (blur) img = img.blur(blur);
  const { data } = await img.raw().toBuffer({ resolveWithObject: true });
  return data; // 1 kanal
}

function toFloat(buf) {
  const f = new Float32Array(buf.length);
  for (let i = 0; i < buf.length; i++) f[i] = buf[i] / 255;
  return f;
}

// Sobel türevi; kenarlarda clamp.
function sobel(h, x, y) {
  const at = (xx, yy) => {
    xx = xx < 0 ? 0 : xx >= SIZE ? SIZE - 1 : xx;
    yy = yy < 0 ? 0 : yy >= SIZE ? SIZE - 1 : yy;
    return h[yy * SIZE + xx];
  };
  const tl = at(x - 1, y - 1), t = at(x, y - 1), tr = at(x + 1, y - 1);
  const l = at(x - 1, y), r = at(x + 1, y);
  const bl = at(x - 1, y + 1), b = at(x, y + 1), br = at(x + 1, y + 1);
  return [
    (tr + 2 * r + br) - (tl + 2 * l + bl),
    (bl + 2 * b + br) - (tl + 2 * t + tr),
  ];
}

async function buildNormalMap(baseColorPath) {
  log('normal map üretiliyor (luminans → yükseklik → Sobel)…');
  const fine = toFloat(await rawGrey(baseColorPath, 0.6));
  const coarse = toFloat(await rawGrey(baseColorPath, 4));
  const out = Buffer.alloc(SIZE * SIZE * 3);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const [fx, fy] = sobel(fine, x, y);
      const [cx, cy] = sobel(coarse, x, y);
      const dx = fx * NORMAL_STRENGTH + cx * BUMP_STRENGTH;
      const dy = fy * NORMAL_STRENGTH + cy * BUMP_STRENGTH;
      // glTF / OpenGL konvansiyonu: yeşil kanal +V (görüntüde yukarı) yönünde.
      let nx = -dx, ny = dy, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const i = (y * SIZE + x) * 3;
      out[i] = Math.round((nx * 0.5 + 0.5) * 255);
      out[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      out[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
    }
  }
  return out;
}

async function buildAO(baseColorPath) {
  log('ambient occlusion / cavity map üretiliyor…');
  const h = toFloat(await rawGrey(baseColorPath, 1));
  const wide = toFloat(await rawGrey(baseColorPath, 12));
  const out = Buffer.alloc(SIZE * SIZE);
  for (let i = 0; i < out.length; i++) {
    // Çevresinden alçakta kalan pikseller (kıvrım, dikiş, girinti) kararır.
    const cavity = Math.max(0, wide[i] - h[i]);
    const ao = 1 - Math.min(0.6, cavity * AO_STRENGTH);
    out[i] = Math.round(ao * 255);
  }
  // Sert geçişleri yumuşat.
  return sharp(out, { raw: { width: SIZE, height: SIZE, channels: 1 } })
    .blur(1.5).raw().toBuffer();
}

async function buildORM(aoBuf, mrPath) {
  log('ORM dokusu birleştiriliyor (R=AO, G=roughness, B=metallic)…');
  const { data: mr, info } = await sharp(mrPath).resize(SIZE, SIZE).removeAlpha()
    .raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(SIZE * SIZE * 3);
  for (let p = 0; p < SIZE * SIZE; p++) {
    out[p * 3] = aoBuf[p];
    out[p * 3 + 1] = mr[p * info.channels + 1];
    out[p * 3 + 2] = mr[p * info.channels + 2];
  }
  return out;
}

const rawImg = (buf, channels) => sharp(buf, { raw: { width: SIZE, height: SIZE, channels } });

async function main() {
  await mkdir(outModels, { recursive: true });
  await mkdir(outGenerated, { recursive: true });

  const baseColorPath = path.join(srcTex, 'clothes_baseColor.png');
  const mrPath = path.join(srcTex, 'clothes_metallicRoughness.png');

  const normalRaw = await buildNormalMap(baseColorPath);
  const aoRaw = await buildAO(baseColorPath);
  const ormRaw = await buildORM(aoRaw, mrPath);

  // İncelemek için PNG kopyaları
  await rawImg(normalRaw, 3).png().toFile(path.join(outGenerated, 'normal.png'));
  await rawImg(aoRaw, 1).png().toFile(path.join(outGenerated, 'ao.png'));
  await rawImg(ormRaw, 3).png().toFile(path.join(outGenerated, 'orm.png'));

  const baseWebp = await sharp(baseColorPath).resize(SIZE, SIZE).webp({ quality: 88 }).toBuffer();
  const normalWebp = await rawImg(normalRaw, 3).webp({ quality: 95 }).toBuffer();
  const ormWebp = await rawImg(ormRaw, 3).webp({ quality: 90 }).toBuffer();

  log('GLB oluşturuluyor…');
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'draco3d.encoder': await draco3d.createEncoderModule(),
      'draco3d.decoder': await draco3d.createDecoderModule(),
    });
  const doc = await io.read(srcGltf);
  doc.createExtension(EXTTextureWebP).setRequired(true);

  const mkTex = (name, img) => doc.createTexture(name).setMimeType('image/webp').setImage(img).setURI(`${name}.webp`);
  const baseTex = mkTex('baseColor', baseWebp);
  const normalTex = mkTex('normal', normalWebp);
  const ormTex = mkTex('orm', ormWebp);

  for (const mat of doc.getRoot().listMaterials()) {
    mat.setBaseColorTexture(baseTex)
      .setMetallicRoughnessTexture(ormTex)
      .setOcclusionTexture(ormTex)
      .setOcclusionStrength(1)
      .setNormalTexture(normalTex)
      .setNormalScale(1);
  }

  await doc.transform(prune(), dedup(), weld(), draco({ method: 'edgebreaker' }));
  const outGlb = path.join(outModels, 'akatsuki-coat.glb');
  await io.write(outGlb, doc);
  log('yazıldı:', outGlb, `${((await stat(outGlb)).size / 1024).toFixed(0)} KB`);

  await copyFile(srcGlb, path.join(outModels, 'akatsuki-coat-original.glb'));
  log('fallback kopyalandı: akatsuki-coat-original.glb');

}

main().catch((e) => { console.error(e); process.exit(1); });
