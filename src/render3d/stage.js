// Adegan lantai: Material PBR foto nyata Poly Haven CC0 (paket diff + nor_gl + arm, public/textures/)
// Peta kemasan arm: R=AO, G=Roughness, B=Metalness — roughnessMap membaca saluran G, langsung digunakan
import * as THREE from 'three';
import { asset } from '../asset.js';

export const STAGES = [
  { id: 'none', name: 'Tanpa Lantai (Latar Polos)' },
  { id: 'wood_table_001', name: 'Meja Kayu Solid Gelap', tileMm: 600, source: 'https://polyhaven.com/a/wood_table_001' },
  { id: 'checkered_pavement_tiles', name: 'Ubin Batu Papan Catur', tileMm: 1800, source: 'https://polyhaven.com/a/checkered_pavement_tiles' },
  { id: 'beige_wall_001', name: 'Dinding Tekstur Krem', tileMm: 1200, source: 'https://polyhaven.com/a/beige_wall_001' },
  { id: 'crepe_satin', name: 'Satin Crepe Aprikot', tileMm: 800, source: 'https://polyhaven.com/a/crepe_satin' },
  { id: 'painted_plaster_wall', name: 'Dinding Plester Cat', tileMm: 1500, source: 'https://polyhaven.com/a/painted_plaster_wall' },
  { id: 'climbing_wall_base', name: 'Tekstur Lempengan Batu', tileMm: 1500, source: 'https://polyhaven.com/a/climbing_wall_base' },
  { id: 'stretch_poplin', name: 'Poplin Hijau Toska', tileMm: 800, source: 'https://polyhaven.com/a/stretch_poplin' }
];

// ID lantai prosedural lama -> pemetaan material baru (kompatibilitas arsip/URL/preset lama)
const LEGACY = { wood: 'wood_table_001', oak: 'wood_table_001', kraft: 'beige_wall_001', slate: 'checkered_pavement_tiles' };
export const stageId = id => STAGES.some(s => s.id === id) ? id : (LEGACY[id] || 'none');
export const stagePreset = id => STAGES.find(s => s.id === stageId(id)) || STAGES[0];

// Hasilkan mesh lantai (radius R mm); none mengembalikan null. Tekstur dimuat secara asinkron, abu-abu netral sebelum siap;
// Objek yang dikembalikan memiliki dispose() — menghancurkan sebelum pemuatan selesai akan menyetel penanda, tekstur yang terlambat langsung dilepas tanpa tampil di layar.
export function makeStageGround(id, renderer) {
  const spec = stagePreset(id);
  if (!spec || spec.id === 'none') return null;
  const R = 3200, repeat = (R * 2) / spec.tileMm;
  const mat = new THREE.MeshStandardMaterial({ color: 0xb8b4ac, roughness: 0.85, metalness: 0 });
  const geo = new THREE.CircleGeometry(R, 72);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -0.6; // Jaring penerima bayangan (ShadowMaterial) di y=0, menghindari z-fight
  mesh.receiveShadow = false; // Bayangan dikomposisikan secara seragam oleh jaring penerima bayangan transparan di y=0, menghindari lantai padat menerima bayangan dua kali dan membuat bayangan ganda terlalu gelap
  const loader = new THREE.TextureLoader(), texs = [];
  let disposed = false, pending = 3;
  const mk = (file, srgb) => {
    const t = loader.load(asset('/textures/' + file), () => {
      if (disposed) { t.dispose(); return; }
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat, repeat);
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      if (--pending === 0) { mat.map = texs[0]; mat.roughnessMap = texs[2]; mat.normalMap = texs[1]; mat.roughness = 1; mat.color.set(0xffffff); mat.needsUpdate = true; }
    });
    texs.push(t);
    return t;
  };
  mk(spec.id + '_diff_1k.jpg', true);
  mk(spec.id + '_nor_gl_1k.jpg', false);
  mk(spec.id + '_arm_1k.jpg', false);
  mesh.userData.dispose = () => { disposed = true; geo.dispose(); mat.dispose(); texs.forEach(t => t.dispose()); };
  return mesh;
}
