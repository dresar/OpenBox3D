// Kubah prosedural dapat diedit bergaya Lightformer: gradien kubah 3 warna + daftar softbox (persegi panjang w×h / intensitas pendaran HDR energy / tint / azimuth / elevation, menghadap pusat bola) → PMREM
// Dipindahkan dari proceduralEnvironment/canvasGradient lama di lighting.js; DOME_PRESETS mereplikasi tiga grup CONFIG lama (termasuk tirai latar bg), memastikan visual lama dapat direproduksi
import * as THREE from 'three';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const isColor = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

export function canvasGradient(colors, radial = false) {
  const c = document.createElement('canvas'); c.width = radial ? 1024 : 4; c.height = radial ? 1024 : 128;
  const g = c.getContext('2d');
  const grad = radial ? g.createRadialGradient(512, 390, 90, 512, 500, 880) : g.createLinearGradient(0, 0, 0, 128);
  colors.forEach((color, i) => grad.addColorStop(i / (colors.length - 1), color));
  g.fillStyle = grad; g.fillRect(0, 0, c.width, c.height);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Geometri empat softbox CONFIG lama (posisi telah dikonversi menjadi azimuth/elevation/distance, mereproduksi bentuk sorotan lama)
const SOFTBOX_GEOMETRY = [
  { w: 72, h: 64, azimuth: 40.6, elevation: 68.2, distance: 49.6 },   // Kotak cahaya utama atas
  { w: 40, h: 28, azimuth: 143.7, elevation: 20.8, distance: 45.1 },  // Panel pengisi sisi kiri
  { w: 36, h: 18, azimuth: 19.4, elevation: 22.6, distance: 39.1 },   // Panel pengisi sisi kanan
  { w: 50, h: 3.2, azimuth: 162.1, elevation: 27.6, distance: 36.7 }  // Strip sempit sorotan UV
];
const softboxesOf = (energies, tint = '#fffbf2') => SOFTBOX_GEOMETRY.map((g, i) => ({ ...g, energy: energies[i], tint }));

export function defaultDomeSpec() {
  return { colors: ['#d9d6cf', '#89857e', '#373531'], bg: ['#e1dfda', '#cbc9c4', '#b5b3ae'], softboxes: softboxesOf([1.7, 0.65, 0.32, 3.6]) };
}

// Spesifikasi kubah dari tiga studio lama: colors = gradien kubah lingkungan, bg = tirai gradien radial latar (opsional, jika tidak ada lighting diturunkan dari warna latar)
export const DOME_PRESETS = {
  'neutral-proof': defaultDomeSpec(),
  'high-key': { colors: ['#d7d6d2', '#8f8d88', '#44423e'], bg: ['#f4f4f2', '#dcdddc', '#bfc0bf'], softboxes: softboxesOf([2.4, 1.1, 0.48, 10]) },
  'dark-craft': { colors: ['#77736b', '#292724', '#090908'], bg: ['#45433f', '#252421', '#11110f'], softboxes: softboxesOf([1.7, 0.42, 0.25, 8.5]) }
};

// Penggabungan toleran: kolom yang hilang kembali ke kubah default, nilai dijepit, maksimal 16 softbox
export function normalizeDomeSpec(spec) {
  const d = defaultDomeSpec();
  if (!spec || typeof spec !== 'object') return d;
  const src = Array.isArray(spec.softboxes) ? spec.softboxes : d.softboxes;
  return {
    colors: Array.isArray(spec.colors) && spec.colors.length >= 3 ? spec.colors.slice(0, 3).map((c, i) => isColor(c) ? c : d.colors[i]) : d.colors,
    bg: Array.isArray(spec.bg) && spec.bg.length >= 3 ? spec.bg.slice(0, 3).map((c, i) => isColor(c) ? c : d.bg[i]) : null,
    softboxes: src.slice(0, 16).map(raw => {
      const b = raw || {}, n = (v, d) => Number.isFinite(+v) ? +v : d;
      return {
        w: clamp(n(b.w, 40), 1, 200), h: clamp(n(b.h, 30), 1, 200),
        energy: clamp(n(b.energy, 0), 0, 40),
        tint: isColor(b.tint) ? b.tint : '#ffffff',
        azimuth: clamp(n(b.azimuth, 0), -180, 180),
        elevation: clamp(n(b.elevation, 45), -10, 89),
        distance: clamp(n(b.distance, 50), 20, 90)
      };
    })
  };
}

// Kubah spec → peta lingkungan PMREM (mengembalikan target, pemanggil bertanggung jawab melakukan dispose)
export function domeEnvironment(renderer, spec) {
  const dome = normalizeDomeSpec(spec);
  const pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene();
  const domeTex = canvasGradient(dome.colors);
  const domeGeo = new THREE.SphereGeometry(60, 32, 24), domeMat = new THREE.MeshBasicMaterial({ map: domeTex, side: THREE.BackSide });
  es.add(new THREE.Mesh(domeGeo, domeMat));
  for (const b of dome.softboxes) {
    const geo = new THREE.PlaneGeometry(b.w, b.h);
    // Nilai sRGB tint langsung dikalikan dengan energy sebagai koefisien linier (mereplikasi notasi HDR lama (e, e*0.985, e*0.95))
    const n = parseInt(b.tint.slice(1), 16);
    const mat = new THREE.MeshBasicMaterial();
    mat.color.setRGB((n >> 16 & 255) / 255 * b.energy, (n >> 8 & 255) / 255 * b.energy, (n & 255) / 255 * b.energy);
    const mesh = new THREE.Mesh(geo, mat);
    const a = b.azimuth * Math.PI / 180, e = b.elevation * Math.PI / 180;
    mesh.position.set(b.distance * Math.cos(e) * Math.cos(a), b.distance * Math.sin(e), b.distance * Math.cos(e) * Math.sin(a));
    mesh.lookAt(0, 0, 0); es.add(mesh);
  }
  const target = pm.fromScene(es);
  es.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  domeTex.dispose(); pm.dispose();
  return target;
}
