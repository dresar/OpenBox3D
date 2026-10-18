// Skema bola material v1: parameter kertas/laminasi film/warna foil/holografis/intensitas teknik khusus, bidang daftar putih + pembatasan (clamp) + impor/ekspor JSON
// Nama bidang sama dengan nama bidang datar store, materialToStorePatch dapat langsung store.set
import { PAPER_PRESETS, FILM_PRESETS, paperPreset, filmPreset } from './presets.js';

export const MATERIAL_SCHEMA_VERSION = 1;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const isColor = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

// Daftar putih: type range=[min,max] | enum=larik | color | boolean
const FIELDS = {
  paper3d: { enum: PAPER_PRESETS.map(x => x.id) }, film3d: { enum: FILM_PRESETS.map(x => x.id) }, paperTint3d: { color: true }, // Warna dasar kertas: ''=tidak menimpa, mengikuti warna dasar preset jenis kertas
  surfaceRoughness: { range: [0.12, 1] }, grainStrength: { range: [0, 1.2] }, grainScale: { range: [3, 20] },
  filmClearcoat3d: { range: [0, 1] }, filmClearcoatRoughness3d: { range: [0, 1] }, filmRoughnessFactor3d: { range: [0.25, 1.4] }, filmSheen3d: { range: [0, 1] },
  foilColor3d: { color: true }, silverColor3d: { color: true }, holoColor3d: { color: true }, foilMetalness3d: { range: [0, 1] }, foilRoughness3d: { range: [0.04, 0.65] }, iridescence3d: { range: [0, 1] }, holoSpan3d: { range: [0, 1] }, holoRainbow3d: { range: [0, 1] },
  uvClearcoat3d: { range: [0, 1] }, uvRoughness3d: { range: [0.02, 0.7] }, glossRoughness3d: { range: [0.02, 0.5] },
  embSharpness3d: { range: [0, 1] }, embNormalStrength3d: { range: [0, 3] }, embDisplacementStrength3d: { range: [0, 2] }, embDepth: { range: [0.05, 1.5] }, embBoost: { boolean: true }
};

export const DEFAULT_MATERIAL = {
  paper3d: 'coated-white', film3d: 'none', paperTint3d: '',
  surfaceRoughness: 0.48, grainStrength: 0.45, grainScale: 8,
  filmClearcoat3d: 0, filmClearcoatRoughness: 0.5, filmRoughnessFactor3d: 1, filmSheen3d: 0,
  foilColor3d: '#ffdb91', silverColor3d: '#faf7f2', holoColor3d: '#edf1f6', foilMetalness3d: 1, foilRoughness3d: 0.22, iridescence3d: 0, holoSpan3d: 0.5, holoRainbow3d: 0,
  uvClearcoat3d: 1, uvRoughness3d: 0.05, glossRoughness3d: 0.08,
  embSharpness3d: 0.85, embNormalStrength3d: 1.2, embDisplacementStrength3d: 0.35, embDepth: 0.3, embBoost: false
};

// Penggabungan toleran: bidang yang hilang kembali ke default, nilai dibatasi rentang, enum/warna tidak valid kembali ke default
export function normalizeMaterial(input) {
  const src = input && typeof input === 'object' ? input : {}, out = {};
  for (const [key, spec] of Object.entries(FIELDS)) {
    const v = src[key], d = DEFAULT_MATERIAL[key];
    if (spec.range) out[key] = clamp(Number.isFinite(+v) ? +v : d, spec.range[0], spec.range[1]);
    else if (spec.enum) out[key] = spec.enum.includes(v) ? v : d;
    else if (spec.color) out[key] = isColor(v) ? v : d;
    else out[key] = typeof v === 'boolean' ? v : d;
  }
  if (typeof src.id === 'string') out.id = src.id;
  if (typeof src.name === 'string') out.name = src.name;
  return out;
}

// Berdasarkan preset kertas + laminasi film sebagai dasar, sesuaikan bidang pengganti; pastikan parameter serat kertas/laminasi film di dalam bola material konsisten dengan preset terpilih
const fromPaperFilm = (paperId, filmId, extra) => {
  const p = paperPreset(paperId), f = filmPreset(filmId);
  return {
    ...DEFAULT_MATERIAL, paper3d: p.id, surfaceRoughness: p.roughness, grainStrength: p.grainStrength, grainScale: p.grainMm,
    film3d: f.id, filmClearcoat3d: f.clearcoat, filmClearcoatRoughness3d: f.clearcoatRoughness, filmRoughnessFactor3d: f.roughnessFactor, filmSheen3d: f.sheen,
    ...extra
  };
};

// Pustaka material bawaan (nilai diambil dari riset: logam F0 sRGB, foil kilap roughness 0.1–0.15, foil doff 0.3–0.45, holografis iridescence 0.5–1.0)
export const MATERIAL_PRESETS = [
  fromPaperFilm('coated-white', 'none', { id: 'bright-gold-white', name: 'Foil Emas Kilap Karton Putih', foilColor3d: '#ffdb91', foilRoughness3d: 0.12 }),
  fromPaperFilm('black-card', 'matte', { id: 'matte-gold-black', name: 'Foil Emas Doff Karton Hitam', foilColor3d: '#f0d092', foilRoughness3d: 0.38 }),
  fromPaperFilm('kraft-natural', 'none', { id: 'silver-kraft', name: 'Foil Perak Karton Kraft', silverColor3d: '#faf7f2', foilRoughness3d: 0.2 }),
  fromPaperFilm('coated-white', 'gloss', { id: 'laser-white', name: 'Foil Holografis Karton Putih', foilColor3d: '#e9edf4', foilRoughness3d: 0.15, iridescence3d: 0.9, holoSpan3d: 0.75 }),
  fromPaperFilm('coated-white', 'gloss', { id: 'laser-cyan', name: 'Holografis Sian Iridescent', foilColor3d: '#e9edf4', foilRoughness3d: 0.15, iridescence3d: 0.9, holoColor3d: '#a5e3f2', holoSpan3d: 0.75 }),
  fromPaperFilm('pearlescent-white', 'soft', { id: 'pearl-soft', name: 'Karton Mutiara Spesial' }),
  fromPaperFilm('metal-silver-card', 'gloss', { id: 'silver-card-cool', name: 'Karton Perak Nada Dingin' }),
  fromPaperFilm('ivory-uncoated', 'matte', { id: 'matte-ivory', name: 'Karton Ivory Laminasi Doff' }),
  fromPaperFilm('art-paper', 'gloss', { id: 'gloss-art', name: 'Art Paper Laminasi Glossy' })
];

export function materialPreset(id) {
  return normalizeMaterial(MATERIAL_PRESETS.find(x => x.id === id) || MATERIAL_PRESETS[0]);
}

// Bola material → bidang datar store (menghapus metadata id/name)
export function materialToStorePatch(material) {
  const m = normalizeMaterial(material), patch = {};
  for (const key of Object.keys(FIELDS)) patch[key] = m[key];
  return patch;
}

export function exportMaterialJson(material) {
  return JSON.stringify({ schema: 'box3d-material', version: MATERIAL_SCHEMA_VERSION, material: normalizeMaterial(material) }, null, 2);
}

export function importMaterialJson(text) {
  try {
    const doc = JSON.parse(text);
    if (!doc || doc.schema !== 'box3d-material' || doc.version !== MATERIAL_SCHEMA_VERSION || !doc.material) return { ok: false, error: 'Skema atau versi JSON tidak kompatibel.', material: null };
    return { ok: true, error: '', material: normalizeMaterial(doc.material) };
  } catch (_) { return { ok: false, error: 'Gagal mengurai JSON.', material: null }; }
}
