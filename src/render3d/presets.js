// Preset tampilan 3D: kombinasi ortogonal kertas dan laminasi film; energi lingkungan hanya milik studio, tidak ditulis ke material.
// Preset studio (STUDIO_PRESETS) diturunkan sebagai ringkasan dari SCENE_PRESETS di rig.js, id lama kompatibel melalui pemetaan scenePreset.
import { SCENE_PRESETS, scenePreset } from './rig.js';

// Bidang ekstensi kertas (semua memiliki nilai default cadangan, perilaku jenis kertas lama tidak berubah): sheen 0, specularIntensity 1 (karton hitam 0.72), metalBase 0 (warna dasar metalness saat bake, untuk jenis karton perak)
export const PAPER_PRESETS = [
  { id: 'coated-white', name: 'Karton Putih Coated', color: '#f4f1e8', roughness: 0.48, grain: 'fine', grainStrength: 0.45, grainMm: 8, core: '#d8cdb2' },
  { id: 'ivory-uncoated', name: 'Karton Ivory Uncoated', color: '#eee5d2', roughness: 0.72, grain: 'open', grainStrength: 0.72, grainMm: 9, core: '#d2c3a6' },
  { id: 'art-paper', name: 'Kertas Art Paper', color: '#f6f3eb', roughness: 0.38, grain: 'fine', grainStrength: 0.28, grainMm: 7, core: '#ded8c9' },
  { id: 'kraft-natural', name: 'Karton Kraft Alami', color: '#b9834c', roughness: 0.9, grain: 'kraft', grainStrength: 0.28, grainMm: 8, core: '#a9703e' },
  { id: 'black-card', name: 'Karton Hitam', color: '#24211e', roughness: 0.68, grain: 'fine', grainStrength: 0.12, grainMm: 14, core: '#4a443d', specularIntensity: 0.72 },
  { id: 'white-grayback', name: 'Karton Dupleks Putih Abu-Abu', color: '#eeeae0', roughness: 0.62, grain: 'open', grainStrength: 0.55, grainMm: 9, core: '#77756f' },
  { id: 'pearlescent-white', name: 'Karton Putih Mutiara', color: '#f2eee6', roughness: 0.42, grain: 'fine', grainStrength: 0.3, grainMm: 7, core: '#ddd5c4', sheen: 0.35 },
  { id: 'metal-silver-card', name: 'Karton Perak', color: '#e8e8ea', roughness: 0.32, grain: 'fine', grainStrength: 0.25, grainMm: 7, core: '#c9c9cc', metalBase: 0.9 }
];

// Bidang ekstensi film specularIntensity (default 1; laminasi doff 0.5, meredupkan pantulan spekular)
export const FILM_PRESETS = [
  { id: 'none', name: 'Tanpa Laminasi', clearcoat: 0, clearcoatRoughness: 0.5, roughnessFactor: 1, sheen: 0 },
  { id: 'matte', name: 'Laminasi Doff (Matte)', clearcoat: 0.38, clearcoatRoughness: 0.5, roughnessFactor: 0.92, sheen: 0.05, specularIntensity: 0.5 },
  { id: 'gloss', name: 'Laminasi Glossy (Kilap)', clearcoat: 1, clearcoatRoughness: 0.045, roughnessFactor: 0.42, sheen: 0 },
  { id: 'soft', name: 'Laminasi Soft Touch', clearcoat: 0.18, clearcoatRoughness: 0.72, roughnessFactor: 1.12, sheen: 0.48 }
];

// Ringkasan studio (bidang arsip/UI lama): parameter lengkap lihat SCENE_PRESETS di rig.js (larik lampu skema v2, intensitas diambil berdasarkan id)
export const STUDIO_PRESETS = SCENE_PRESETS.map(r => {
  const I = id => { const l = r.lights.find(x => x.id === id); return l ? l.intensity : 0; };
  return {
    id: r.id, name: r.name, env: r.environment.intensity, exposure: r.tone.exposure,
    key: I('key'), fill: I('fill'), rim: I('rim'), hemi: I('hemi'),
    shadowSoftness: r.shadow.softness, shadowOpacity: r.shadow.opacity
  };
});

// Pustaka lingkungan HDRI (lokal 1K, Poly Haven CC0, lihat public/hdri/manifest.json); kb adalah anotasi suhu warna/suasana, source untuk tampilan UI
export const ENVIRONMENT_PRESETS = [
  { id: 'procedural', name: 'Studio Prosedural', url: null, kb: 'Kubah bawaan dapat diedit', source: 'Bawaan' },
  { id: 'room-neutral', name: 'Lab Ruangan Netral', url: null, kb: 'RoomEnvironment cahaya lembut netral', source: 'Bawaan' },
  { id: 'studio_small_08', name: 'Studio Cahaya Lembut · Studio Small 08', url: '/hdri/studio_small_08_1k.hdr', kb: '~6000K Nada dingin bersih', source: 'Poly Haven' },
  { id: 'studio_small_03', name: 'Studio Kontras Tinggi · Studio Small 03', url: '/hdri/studio_small_03_1k.hdr', kb: '~5400K Kontras tinggi', source: 'Poly Haven' },
  { id: 'studio_small_09', name: 'Studio Nada Hangat · Studio Small 09', url: '/hdri/studio_small_09_1k.hdr', kb: '2750K Nada hangat premium', source: 'Poly Haven' },
  { id: 'white_studio_03', name: 'Studio E-Commerce Latar Putih · White Studio 03', url: '/hdri/white_studio_03_1k.hdr', kb: '~5300K Studio putih', source: 'Poly Haven' },
  { id: 'white_studio_06', name: 'Studio Putih Terang · White Studio 06', url: '/hdri/white_studio_06_1k.hdr', kb: 'Studio putih terang', source: 'Poly Haven' },
  { id: 'cyclorama_hard_light', name: 'Studio Siklorama Putih Murni · Cyclorama', url: '/hdri/cyclorama_hard_light_1k.hdr', kb: '~5400K Cahaya keras', source: 'Poly Haven' },
  { id: 'photo_studio_01', name: 'Studio Foto Nada Dingin · Photo Studio 01', url: '/hdri/photo_studio_01_1k.hdr', kb: '~5622K Kontras sedang', source: 'Poly Haven' }
];

export const paperPreset = id => PAPER_PRESETS.find(x => x.id === id) || PAPER_PRESETS[0];
export const filmPreset = id => FILM_PRESETS.find(x => x.id === id) || FILM_PRESETS[0];
export const studioPreset = id => STUDIO_PRESETS.find(x => x.id === id) || STUDIO_PRESETS.find(x => x.id === scenePreset(id).id) || STUDIO_PRESETS[0];
export const environmentPreset = id => ENVIRONMENT_PRESETS.find(x => x.id === id) || ENVIRONMENT_PRESETS[1];

export function legacyAppearance(id) {
  return {
    sbs: ['coated-white', 'none'], black: ['black-card', 'none'], kraft: ['kraft-natural', 'none'],
    matte: ['coated-white', 'matte'], gloss: ['coated-white', 'gloss'], soft: ['coated-white', 'soft']
  }[id] || ['coated-white', 'none'];
}
