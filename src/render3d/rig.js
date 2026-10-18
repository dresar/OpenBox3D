// SceneRig schema v2: Deskripsi studio berbasis data - lingkungan (HDRI/kubah prosedural/tiga mode latar belakang) + array lampu dinamis + bayangan + tone + kamera + panggung
// Inti render, lab, 3D resmi digunakan bersama; konversi dua arah field datar rig ↔ store (rigToStorePatch / storeToRig), lampu di sisi store disatukan menjadi string JSON lightsSpec3d tunggal
// Item lampu: {id, name, type:'directional'|'point'|'hemi', on, intensity, color, azimuth, elevation, distance, shadow}
//   shadow hanya directional dan unik bernilai true di seluruh array (dipaksakan oleh normalizeLights); hemi mengabaikan azimuth/jarak; point menggunakan koordinat bola azimuth/elevation/distance
// Konvensi azimuth (konsisten dengan lighting.js): x = cosE·cosA, y = sinE, z = cosE·sinA (derajat)
// Kompatibilitas v1: normalizeRig / normalizeLights menerima rig v1 (slot tetap key/fill/rim/top/hemi, intensitas 0=mati) dan field store datar lama, dimigrasikan secara terpadu melalui migrateLightsV1
import { STAGES, stageId } from './stage.js';
import { DOME_PRESETS, defaultDomeSpec, normalizeDomeSpec } from './envDome.js';

export const RIG_SCHEMA_VERSION = 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const isColor = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const num = (v, d) => Number.isFinite(+v) ? +v : d;
const TONE_IDS = ['aces', 'agx', 'neutral', 'linear'];
const BG_MODES = ['gradient', 'hdri', 'color'];
const CAMERA_PROJECTIONS = ['perspective', 'orthographic'];
const STAGE_IDS = STAGES.map(x => x.id);
const LIGHT_TYPES = ['directional', 'point', 'hemi'];
const LIGHT_TYPE_NAMES = { directional: 'Cahaya Terarah', point: 'Cahaya Titik', hemi: 'Cahaya Ambien' };
const MAX_INTENSITY = { directional: 4, point: 2, hemi: 1 }; // point adalah intensitas semantik UI, lighting.js mengalikannya secara internal dengan POINT_SCALE

// Pustaka preset adegan bawaan (nilai diambil dari riset: rasio intensitas RoomEnvironment, pencahayaan tiga titik fotografi produk, panjang fokus packshot, suhu warna F0 logam)
// az/el cahaya atas dikonversi dari posisi tetap lama (40,420,40); key distance 408 mempertahankan jarak dasar bayangan lembut multi-sampel lama
export const SCENE_PRESETS = [
  {
    id: 'lab-default', name: 'Adegan Bawaan',
    environment: {
      source: 'procedural', intensity: 0.65, rotation: 0, background: 'color', backgroundColor: '#ffffff', backgroundBlur: 0.18,
      dome: { colors: ['#dce7ec', '#56616a', '#181a1c'], bg: ['#f13a2b', '#d72419', '#8b130e'], softboxes: [
        { w: 90, h: 10, energy: 7.5, tint: '#fff3e7', azimuth: -180, elevation: 22, distance: 52 },
        { w: 46, h: 32, energy: 0.3, tint: '#cdeeff', azimuth: 22, elevation: 25, distance: 48 },
        { w: 56, h: 4, energy: 4.5, tint: '#bfeaff', azimuth: -55, elevation: 28, distance: 42 }
      ] }
    },
    lights: [
      { id: 'key', name: 'Cahaya Utama Depan', type: 'directional', on: true, intensity: 1.15, color: '#fff1e3', groundColor: '#68645d', azimuth: 51, elevation: 28, distance: 408, shadow: true, areaIntensity: 0, areaWidth: 145, areaHeight: 115, areaTargetY: 42 },
      { id: 'key2', name: 'Salinan Cahaya Utama Depan', type: 'directional', on: true, intensity: 1.35, color: '#fff1e3', groundColor: '#68645d', azimuth: 93, elevation: 5, distance: 408, shadow: false, areaIntensity: 0, areaWidth: 145, areaHeight: 115, areaTargetY: 42 },
      { id: 'fill', name: 'Pengisi Lemah Kanan', type: 'directional', on: true, intensity: 0.79, color: '#d7efff', groundColor: '#68645d', azimuth: 95, elevation: 25, distance: 400, shadow: false, areaIntensity: 0, areaWidth: 145, areaHeight: 115, areaTargetY: 42 },
      { id: 'rim', name: 'Cahaya Tepi Dingin', type: 'directional', on: true, intensity: 0.7, color: '#bfeaff', groundColor: '#68645d', azimuth: -55, elevation: 34, distance: 400, shadow: false, areaIntensity: 0, areaWidth: 145, areaHeight: 115, areaTargetY: 42 },
      { id: 'top', name: 'Cahaya Atas', type: 'directional', on: true, intensity: 0.67, color: '#fff8ef', groundColor: '#68645d', azimuth: 45, elevation: 82.3, distance: 400, shadow: false, areaIntensity: 0, areaWidth: 145, areaHeight: 115, areaTargetY: 42 },
      { id: 'hemi', name: 'Cahaya Ambien', type: 'hemi', on: true, intensity: 1, color: '#ffffff', groundColor: '#68645d', azimuth: 0, elevation: 90, distance: 400, shadow: false, areaIntensity: 0, areaWidth: 145, areaHeight: 115, areaTargetY: 42 }
    ],
    shadow: { softness: 22, opacity: 0.28 }, tone: { mapping: 'neutral', exposure: 1.1 }, camera: { projection: 'perspective', fov: 27 }, stage: 'none'
  },
  {
    id: 'packshot-white', name: 'Studio Putih E-Commerce',
    environment: {
      source: 'white_studio_03', intensity: 0.9, rotation: 0, background: 'hdri', backgroundColor: '#f4f4f2', backgroundBlur: 0.25,
      dome: { colors: ['#e8e8e6', '#a6a5a1', '#54524e'], bg: ['#f4f4f2', '#e3e3e1', '#cdcdcb'], softboxes: [
        { w: 72, h: 64, energy: 2.2, tint: '#fffbf2', azimuth: 40.6, elevation: 68.2, distance: 49.6 },
        { w: 40, h: 28, energy: 1.0, tint: '#fffbf2', azimuth: 143.7, elevation: 20.8, distance: 45.1 },
        { w: 36, h: 18, energy: 0.45, tint: '#fffbf2', azimuth: 19.4, elevation: 22.6, distance: 39.1 },
        { w: 50, h: 3.2, energy: 9, tint: '#fffbf2', azimuth: 162.1, elevation: 27.6, distance: 36.7 }
      ] }
    },
    lights: [
      { id: 'key', name: 'Cahaya Utama', type: 'directional', on: true, intensity: 2.0, color: '#fff4e6', azimuth: 35, elevation: 50, distance: 408, shadow: true },
      { id: 'fill', name: 'Cahaya Pengisi', type: 'directional', on: true, intensity: 0.5, color: '#eef2f8', azimuth: -50, elevation: 30, distance: 400, shadow: false },
      { id: 'rim', name: 'Cahaya Tepi', type: 'directional', on: true, intensity: 0.4, color: '#ffffff', azimuth: -140, elevation: 55, distance: 400, shadow: false },
      { id: 'top', name: 'Cahaya Atas', type: 'directional', on: true, intensity: 0.8, color: '#ffffff', azimuth: 45, elevation: 82.3, distance: 400, shadow: false },
      { id: 'hemi', name: 'Cahaya Ambien', type: 'hemi', on: true, intensity: 0.1, color: '#f2f3f2', azimuth: 0, elevation: 90, distance: 400, shadow: false }
    ],
    shadow: { softness: 14, opacity: 0.16 }, tone: { mapping: 'neutral', exposure: 1.05 }, camera: { fov: 27 }, stage: 'none'
  },
  {
    id: 'neutral-proof', name: 'Proofing Netral',
    environment: { source: 'studio_small_08', intensity: 0.36, rotation: 0, background: 'gradient', backgroundColor: '#e1dfda', backgroundBlur: 0.35, dome: DOME_PRESETS['neutral-proof'] },
    lights: [
      { id: 'key', name: 'Cahaya Utama', type: 'directional', on: true, intensity: 1.8, color: '#fff6e9', azimuth: 30, elevation: 54, distance: 408, shadow: true },
      { id: 'fill', name: 'Cahaya Pengisi', type: 'directional', on: true, intensity: 0.08, color: '#e6edf7', azimuth: 155.2, elevation: 27.6, distance: 400, shadow: false }, // Dikonversi dari posisi tetap lama (-260,150,120)
      { id: 'rim', name: 'Cahaya Tepi', type: 'directional', on: true, intensity: 0.24, color: '#ffffff', azimuth: -77, elevation: 50.2, distance: 400, shadow: false }, // Dikonversi dari posisi tetap lama (60,320,-260)
      { id: 'top', name: 'Cahaya Atas', type: 'directional', on: false, intensity: 0, color: '#ffffff', azimuth: 45, elevation: 82.3, distance: 400, shadow: false },
      { id: 'hemi', name: 'Cahaya Ambien', type: 'hemi', on: true, intensity: 0.04, color: '#f2f3f2', azimuth: 0, elevation: 90, distance: 400, shadow: false }
    ],
    shadow: { softness: 20, opacity: 0.23 }, tone: { mapping: 'aces', exposure: 1.0 }, camera: { fov: 35 }, stage: 'none'
  },
  {
    id: 'high-key', name: 'Studio Pamer Terang',
    environment: {
      source: 'procedural', intensity: 0.92, rotation: 0, background: 'gradient', backgroundColor: '#fbfbfa', backgroundBlur: 0.18,
      dome: { colors: ['#f4f5f4', '#a8aaa8', '#4b4d4c'], bg: ['#ffffff', '#f7f7f5', '#e7e7e4'], softboxes: [
        { w: 100, h: 75, energy: 2.8, tint: '#fff9f2', azimuth: 78, elevation: 40, distance: 54 },
        { w: 60, h: 45, energy: 1.0, tint: '#edf5ff', azimuth: 22, elevation: 25, distance: 50 },
        { w: 56, h: 5, energy: 6.0, tint: '#eef7ff', azimuth: -55, elevation: 30, distance: 44 },
        { w: 55, h: 22, energy: 2.0, tint: '#ffffff', azimuth: 45, elevation: 76, distance: 52 }
      ] }
    },
    lights: [
      { id: 'key', name: 'Cahaya Lembut Depan Luas', type: 'directional', on: true, intensity: 1.85, color: '#fff7ef', azimuth: 78, elevation: 36, distance: 408, shadow: true },
      { id: 'fill', name: 'Pengisi Kanan', type: 'directional', on: true, intensity: 0.4, color: '#e8f2ff', azimuth: 22, elevation: 28, distance: 400, shadow: false },
      { id: 'rim', name: 'Cahaya Tepi', type: 'directional', on: true, intensity: 0.28, color: '#eef7ff', azimuth: -55, elevation: 35, distance: 400, shadow: false },
      { id: 'top', name: 'Cahaya Atas', type: 'directional', on: true, intensity: 0.15, color: '#ffffff', azimuth: 45, elevation: 82.3, distance: 400, shadow: false },
      { id: 'hemi', name: 'Cahaya Ambien', type: 'hemi', on: true, intensity: 0.16, color: '#f2f3f2', azimuth: 0, elevation: 90, distance: 400, shadow: false }
    ],
    shadow: { softness: 12, opacity: 0.18 }, tone: { mapping: 'neutral', exposure: 1.08 }, camera: { fov: 30 }, stage: 'none'
  },
  {
    id: 'warm-boutique', name: 'Butik Nuansa Hangat',
    environment: {
      source: 'studio_small_09', intensity: 0.9, rotation: 0, background: 'gradient', backgroundColor: '#efe7da', backgroundBlur: 0.35,
      dome: { colors: ['#e3d9c8', '#8f8271', '#38322a'], bg: ['#efe7da', '#dcd0be', '#c2b3a0'], softboxes: [
        { w: 72, h: 64, energy: 1.8, tint: '#ffedd8', azimuth: 40.6, elevation: 68.2, distance: 49.6 },
        { w: 40, h: 28, energy: 0.7, tint: '#ffedd8', azimuth: 143.7, elevation: 20.8, distance: 45.1 },
        { w: 36, h: 18, energy: 0.3, tint: '#ffedd8', azimuth: 19.4, elevation: 22.6, distance: 39.1 },
        { w: 50, h: 3.2, energy: 6, tint: '#ffedd8', azimuth: 162.1, elevation: 27.6, distance: 36.7 }
      ] }
    },
    lights: [
      { id: 'key', name: 'Cahaya Utama', type: 'directional', on: true, intensity: 2.2, color: '#ffd9a4', azimuth: 40, elevation: 48, distance: 408, shadow: true }, // Cahaya utama hangat ≈3200K
      { id: 'fill', name: 'Cahaya Pengisi', type: 'directional', on: true, intensity: 0.3, color: '#cfe0ff', azimuth: -55, elevation: 28, distance: 400, shadow: false }, // Kontras pengisi dingin
      { id: 'rim', name: 'Cahaya Tepi', type: 'directional', on: true, intensity: 0.55, color: '#ffe9c9', azimuth: -120, elevation: 50, distance: 400, shadow: false },
      { id: 'top', name: 'Cahaya Atas', type: 'directional', on: true, intensity: 0.5, color: '#ffffff', azimuth: 45, elevation: 82.3, distance: 400, shadow: false },
      { id: 'hemi', name: 'Cahaya Ambien', type: 'hemi', on: true, intensity: 0.06, color: '#f2f3f2', azimuth: 0, elevation: 90, distance: 400, shadow: false }
    ],
    shadow: { softness: 18, opacity: 0.26 }, tone: { mapping: 'agx', exposure: 1.04 }, camera: { fov: 30 }, stage: 'wood_table_001'
  },
  {
    id: 'poster-red', name: 'Studio Merah Poster',
    environment: {
      source: 'procedural', intensity: 0.65, rotation: 0, background: 'gradient', backgroundColor: '#df291d', backgroundBlur: 0.18,
      dome: { colors: ['#dce7ec', '#56616a', '#181a1c'], bg: ['#f13a2b', '#d72419', '#8b130e'], softboxes: [
        { w: 90, h: 68, energy: 1.8, tint: '#fff3e7', azimuth: 78, elevation: 37, distance: 52 },
        { w: 46, h: 32, energy: 0.3, tint: '#cdeeff', azimuth: 22, elevation: 25, distance: 48 },
        { w: 56, h: 4, energy: 4.5, tint: '#bfeaff', azimuth: -55, elevation: 28, distance: 42 }
      ] }
    },
    lights: [
      { id: 'key', name: 'Cahaya Utama Depan', type: 'directional', on: true, intensity: 2.15, color: '#fff1e3', azimuth: 78, elevation: 33, distance: 408, shadow: true },
      { id: 'fill', name: 'Pengisi Lemah Kanan', type: 'directional', on: true, intensity: 0.27, color: '#d7efff', azimuth: 22, elevation: 26, distance: 400, shadow: false },
      { id: 'rim', name: 'Cahaya Tepi Dingin', type: 'directional', on: true, intensity: 0.3, color: '#bfeaff', azimuth: -55, elevation: 34, distance: 400, shadow: false },
      { id: 'top', name: 'Cahaya Atas', type: 'directional', on: true, intensity: 0.14, color: '#fff8ef', azimuth: 45, elevation: 82.3, distance: 400, shadow: false },
      { id: 'hemi', name: 'Cahaya Ambien', type: 'hemi', on: true, intensity: 0.1, color: '#f2f3f2', azimuth: 0, elevation: 90, distance: 400, shadow: false }
    ],
    shadow: { softness: 9, opacity: 0.28 }, tone: { mapping: 'neutral', exposure: 1.1 }, camera: { projection: 'perspective', fov: 27 }, stage: 'none'
  },
  {
    id: 'dark-craft', name: 'Kriya Gelap',
    environment: { source: 'studio_small_08', intensity: 1.1, rotation: 0, background: 'gradient', backgroundColor: '#45433f', backgroundBlur: 0.35, dome: DOME_PRESETS['dark-craft'] },
    lights: [
      { id: 'key', name: 'Cahaya Utama', type: 'directional', on: true, intensity: 2.05, color: '#fff6e9', azimuth: 30, elevation: 54, distance: 408, shadow: true },
      { id: 'fill', name: 'Cahaya Pengisi', type: 'directional', on: true, intensity: 0.55, color: '#e6edf7', azimuth: 155.2, elevation: 27.6, distance: 400, shadow: false },
      { id: 'rim', name: 'Cahaya Tepi', type: 'directional', on: true, intensity: 0.65, color: '#ffffff', azimuth: -77, elevation: 50.2, distance: 400, shadow: false },
      { id: 'top', name: 'Cahaya Atas', type: 'directional', on: false, intensity: 0, color: '#ffffff', azimuth: 45, elevation: 82.3, distance: 400, shadow: false },
      { id: 'hemi', name: 'Cahaya Ambien', type: 'hemi', on: true, intensity: 0.25, color: '#f2f3f2', azimuth: 0, elevation: 90, distance: 400, shadow: false }
    ],
    shadow: { softness: 17, opacity: 0.28 }, tone: { mapping: 'aces', exposure: 1.14 }, camera: { fov: 35 }, stage: 'none'
  },
  {
    id: 'cool-metal', name: 'Logam Nuansa Dingin',
    environment: {
      source: 'studio_small_03', intensity: 0.85, rotation: 0, background: 'gradient', backgroundColor: '#e8ebef', backgroundBlur: 0.35,
      dome: { colors: ['#dde2e8', '#878e97', '#33363b'], bg: ['#e8ebef', '#d3d8de', '#b6bcc4'], softboxes: [
        { w: 72, h: 64, energy: 1.9, tint: '#f2f6ff', azimuth: 40.6, elevation: 68.2, distance: 49.6 },
        { w: 40, h: 28, energy: 0.75, tint: '#f2f6ff', azimuth: 143.7, elevation: 20.8, distance: 45.1 },
        { w: 36, h: 18, energy: 0.35, tint: '#f2f6ff', azimuth: 19.4, elevation: 22.6, distance: 39.1 },
        { w: 50, h: 3.2, energy: 7, tint: '#f2f6ff', azimuth: 162.1, elevation: 27.6, distance: 36.7 }
      ] }
    },
    lights: [
      { id: 'key', name: 'Cahaya Utama', type: 'directional', on: true, intensity: 2.5, color: '#f4f7ff', azimuth: 25, elevation: 62, distance: 408, shadow: true },
      { id: 'fill', name: 'Cahaya Pengisi', type: 'directional', on: true, intensity: 0.2, color: '#dfe8f5', azimuth: -55, elevation: 30, distance: 400, shadow: false },
      { id: 'rim', name: 'Cahaya Tepi', type: 'directional', on: true, intensity: 0.85, color: '#ffffff', azimuth: -140, elevation: 60, distance: 400, shadow: false },
      { id: 'top', name: 'Cahaya Atas', type: 'directional', on: true, intensity: 1.0, color: '#ffffff', azimuth: 45, elevation: 82.3, distance: 400, shadow: false },
      { id: 'hemi', name: 'Cahaya Ambien', type: 'hemi', on: true, intensity: 0.05, color: '#f2f3f2', azimuth: 0, elevation: 90, distance: 400, shadow: false }
    ],
    shadow: { softness: 12, opacity: 0.2 }, tone: { mapping: 'aces', exposure: 1.02 }, camera: { fov: 27 }, stage: 'checkered_pavement_tiles'
  }
];

const LEGACY_SCENE_IDS = { neutral: 'neutral-proof' }; // Kompatibilitas id studio lama (id high-key/dark-craft tidak berubah)
const DEFAULT_RIG = SCENE_PRESETS.find(x => x.id === 'neutral-proof');

function normalizeLightEntry(raw, i, usedIds) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const type = LIGHT_TYPES.includes(s.type) ? s.type : 'directional';
  let id = typeof s.id === 'string' && s.id.trim() ? s.id.trim().slice(0, 40) : 'light-' + (i + 1);
  while (usedIds.has(id)) id += '_';
  usedIds.add(id);
  return {
    id,
    name: typeof s.name === 'string' && s.name.trim() ? s.name.trim().slice(0, 24) : LIGHT_TYPE_NAMES[type],
    type,
    on: s.on !== false,
    intensity: clamp(num(s.intensity, type === 'hemi' ? 0.1 : 1), 0, MAX_INTENSITY[type]),
    color: isColor(s.color) ? s.color : (type === 'hemi' ? '#f2f3f2' : '#ffffff'),
    groundColor: isColor(s.groundColor) ? s.groundColor : '#68645d',
    azimuth: clamp(num(s.azimuth, 30), -180, 180),
    elevation: clamp(num(s.elevation, 55), 5, 90),
    distance: clamp(num(s.distance, 400), 50, 2000),
    areaIntensity: type === 'hemi' ? 0 : clamp(num(s.areaIntensity, 0), 0, 10),
    areaWidth: clamp(num(s.areaWidth, 145), 1, 300),
    areaHeight: clamp(num(s.areaHeight, 115), 1, 300),
    areaTargetY: clamp(num(s.areaTargetY, 42), -200, 600),
    shadow: type === 'directional' && s.shadow === true
  };
}

// Normalisasi array lampu v2: deduplikasi id, jepit intensitas sesuai tipe, bayangan (shadow:true) unik di seluruh array (pertahankan yang pertama, hapus paksa sisanya)
export function normalizeLights(input) {
  if (!Array.isArray(input)) return migrateLightsV1(input);
  const used = new Set();
  const list = input.map((s, i) => normalizeLightEntry(s, i, used));
  let shadowTaken = false;
  for (const l of list) { if (l.shadow) { if (shadowTaken) l.shadow = false; else shadowTaken = true; } }
  return list;
}

// Migrasi lampu v1 → v2: menerima rig v1 (lights adalah objek slot tetap key/fill/rim/top/hemi) atau field store datar lama (keyIntensity3d/keyAngle dll.)
// Intensitas 0 = mati → on:false; key memiliki shadow:true unik seluruh array; field yang hilang kembali ke lampu yang sesuai di adegan default (neutral-proof)
export function migrateLightsV1(src) {
  const o = src && typeof src === 'object' ? src : {};
  const L = o.lights && typeof o.lights === 'object' && !Array.isArray(o.lights) ? o.lights : {};
  const def = id => DEFAULT_RIG.lights.find(x => x.id === id);
  const read = (slot, fI, fC, fA, fE) => {
    const s = L[slot] || {}, d = def(slot);
    return {
      intensity: num(s.intensity != null ? s.intensity : o[fI], d.intensity),
      color: isColor(s.color) ? s.color : (isColor(o[fC]) ? o[fC] : d.color),
      azimuth: num(s.azimuth != null ? s.azimuth : o[fA], d.azimuth),
      elevation: num(s.elevation != null ? s.elevation : o[fE], d.elevation)
    };
  };
  const dir = (slot, name, shadow, fI, fC, fA, fE) => {
    const v = read(slot, fI, fC, fA, fE), d = def(slot);
    return { id: slot, name, type: 'directional', on: v.intensity > 0, intensity: v.intensity, color: v.color, azimuth: v.azimuth, elevation: v.elevation, distance: d.distance, shadow };
  };
  const hm = read('hemi', 'hemiIntensity3d');
  return normalizeLights([
    dir('key', 'Cahaya Utama', true, 'keyIntensity3d', 'keyColor3d', 'keyAngle', 'keyElevation3d'),
    dir('fill', 'Cahaya Pengisi', false, 'fillIntensity3d', 'fillColor3d', 'fillAngle3d', 'fillElevation3d'),
    dir('rim', 'Cahaya Tepi', false, 'rimIntensity3d', 'rimColor3d', 'rimAngle3d', 'rimElevation3d'),
    dir('top', 'Cahaya Atas', false, 'topIntensity3d', 'topColor3d'),
    { id: 'hemi', name: 'Cahaya Ambien', type: 'hemi', on: hm.intensity > 0, intensity: hm.intensity, color: def('hemi').color, azimuth: 0, elevation: 90, distance: 400, shadow: false }
  ]);
}

// Penggabungan toleran + penjepitan: field yang hilang kembali ke rig default, tidak menolak JSON yang diedit manual; lights menerima slot tetap v1 sekaligus array v2, output seragam v2
export function normalizeRig(input) {
  const src = input && typeof input === 'object' ? input : {};
  const env = src.environment || {}, sh = src.shadow || {}, tn = src.tone || {}, cam = src.camera || {};
  return {
    id: typeof src.id === 'string' ? src.id : '', name: typeof src.name === 'string' ? src.name : 'Adegan Kustom',
    environment: {
      source: typeof env.source === 'string' && env.source ? env.source : DEFAULT_RIG.environment.source,
      intensity: clamp(num(env.intensity, DEFAULT_RIG.environment.intensity), 0, 2),
      rotation: clamp(num(env.rotation, 0), -180, 180),
      background: BG_MODES.includes(env.background) ? env.background : 'gradient',
      backgroundColor: isColor(env.backgroundColor) ? env.backgroundColor : DEFAULT_RIG.environment.backgroundColor,
      backgroundBlur: clamp(num(env.backgroundBlur, 0.35), 0, 1),
      dome: normalizeDomeSpec(env.dome)
    },
    lights: normalizeLights(src.lights),
    shadow: { softness: clamp(num(sh.softness, 20), 0, 30), opacity: clamp(num(sh.opacity, 0.23), 0, 0.6) },
    tone: { mapping: TONE_IDS.includes(tn.mapping) ? tn.mapping : 'aces', exposure: clamp(num(tn.exposure, 1), 0.6, 1.8) },
    camera: { projection: CAMERA_PROJECTIONS.includes(cam.projection) ? cam.projection : 'perspective', fov: clamp(num(cam.fov, 35), 16, 46) },
    stage: STAGE_IDS.includes(src.stage) ? src.stage : stageId(src.stage)
  };
}

export function scenePreset(id) {
  const raw = SCENE_PRESETS.find(x => x.id === id) || SCENE_PRESETS.find(x => x.id === LEGACY_SCENE_IDS[id]) || DEFAULT_RIG;
  return normalizeRig(raw);
}

// Field datar rig → store. Lampu disatukan menjadi string JSON lightsSpec3d tunggal (pola yang sama dengan domeSpec3d);
// backgroundMode3d dan boolean showEnvironmentBackground lama ditulis ganda: saat mode hdri boolean diutamakan, backgroundMode3d mencatat mode fallback setelah boolean dinonaktifkan
export function rigToStorePatch(rig) {
  const r = normalizeRig(rig), env = r.environment;
  const patch = {
    environment3d: env.source, envIntensity3d: env.intensity, envRotation3d: env.rotation,
    showEnvironmentBackground: env.background === 'hdri', backgroundMode3d: env.background === 'hdri' ? 'gradient' : env.background,
    backgroundColor3d: env.backgroundColor, backgroundBlur3d: env.backgroundBlur,
    domeSpec3d: JSON.stringify(env.dome),
    lightsSpec3d: JSON.stringify(r.lights),
    shadowSoftness3d: r.shadow.softness, shadowOpacity3d: r.shadow.opacity,
    toneMapping3d: r.tone.mapping, expo3d: r.tone.exposure, cameraProjection3d: r.camera.projection, fov3d: r.camera.fov, stage3d: r.stage
  };
  if (SCENE_PRESETS.some(x => x.id === r.id)) patch.studio3d = r.id;
  return patch;
}

// Field datar store → rig (snapshot status saat ini, untuk ekspor/simpan); saat lightsSpec3d hilang atau rusak kembali ke migrasi field lampu datar lama (jalur preset lokal v1)
export function storeToRig(state) {
  let dome = null;
  try { dome = JSON.parse(state.domeSpec3d); } catch (_) { dome = null; }
  let lights = null;
  try { const parsed = JSON.parse(state.lightsSpec3d); if (Array.isArray(parsed)) lights = parsed; } catch (_) { lights = null; }
  return normalizeRig({
    name: 'Adegan Saat Ini',
    environment: {
      source: state.environment3d, intensity: state.envIntensity3d, rotation: state.envRotation3d,
      background: state.showEnvironmentBackground ? 'hdri' : (state.backgroundMode3d === 'color' ? 'color' : 'gradient'),
      backgroundColor: state.backgroundColor3d, backgroundBlur: state.backgroundBlur3d, dome
    },
    lights: lights || migrateLightsV1(state),
    shadow: { softness: state.shadowSoftness3d, opacity: state.shadowOpacity3d },
    tone: { mapping: state.toneMapping3d, exposure: state.expo3d },
    camera: { projection: state.cameraProjection3d, fov: state.fov3d }, stage: state.stage3d
  });
}

export function exportSceneJson(rig) {
  return JSON.stringify({ schema: 'box3d-scene-rig', version: RIG_SCHEMA_VERSION, rig: normalizeRig(rig) }, null, 2);
}

export function importSceneJson(text, baseRig = null) {
  try {
    const doc = JSON.parse(text);
    if (!doc || doc.schema !== 'box3d-scene-rig' || typeof doc.version !== 'number' || doc.version < 1 || doc.version > RIG_SCHEMA_VERSION || !doc.rig) return { ok: false, error: 'Skema atau versi JSON tidak kompatibel.', rig: null };
    let source = doc.rig;
    if (Array.isArray(doc.scope) && baseRig) {
      const base = normalizeRig(baseRig), scoped = new Set(doc.scope);
      source = { ...base };
      if (scoped.has('environment')) source.environment = { ...base.environment, ...(doc.rig.environment || {}) };
      if (scoped.has('lights') && Array.isArray(doc.rig.lights)) source.lights = doc.rig.lights;
      if (scoped.has('shadow')) source.shadow = { ...base.shadow, ...(doc.rig.shadow || {}) };
      if (scoped.has('tone')) source.tone = { ...base.tone, ...(doc.rig.tone || {}) };
      if (scoped.has('camera')) source.camera = { ...base.camera, ...(doc.rig.camera || {}) };
      if (scoped.has('stage') && typeof doc.rig.stage === 'string') source.stage = doc.rig.stage;
    }
    return {
      ok: true,
      error: '',
      rig: normalizeRig(source),
      compatibility: doc.compatibility || null,
      producer: doc.producer || '',
    }; // File v1 otomatis memigrasikan lampu melalui normalizeRig
  } catch (_) { return { ok: false, error: 'JSON tidak dapat diurai.', rig: null }; }
}

// Menghasilkan teks literal JS yang dapat ditempel ke SCENE_PRESETS di rig.js (untuk pembekuan saat waktu kompilasi)
export function sceneCodeSnippet(rig) {
  return '// Tempel ke array SCENE_PRESETS di src/render3d/rig.js\n' + JSON.stringify(normalizeRig(rig), null, 2) + ',';
}
