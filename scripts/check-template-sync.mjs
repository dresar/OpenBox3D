import assert from 'node:assert/strict';
import { geomOf } from '../src/dieline/geom.js';
import { heroPanelOf } from '../src/dieline/hero.js';
import { TPLS } from '../src/dieline/templates.js';
import { makePieces } from '../src/render3d/fold.js';

// Halaman struktur adalah garis potong produksi; 3D memisahkan lidah penutup kombinasi, membagi silinder, dan dapat menghilangkan sambungan lem internal produk jadi;
// Oleh karena itu di sini memeriksa inventaris semantik, bukan sekadar menyamakan jumlah fill 2D dengan jumlah mesh 3D.
const CONTRACTS = {
  rte:     { pieces: 1, main: 6, accessory: 6, glue: 1, panels: 6, asm: [] },
  ste:     { pieces: 1, main: 6, accessory: 6, glue: 1, panels: 6, asm: [] },
  mailer:  { pieces: 1, main: 6, accessory: 5, glue: 0, panels: 6, asm: [] },
  lidbase: { pieces: 2, main: 10, accessory: 8, glue: 0, panels: 10, asm: ['lid'] },
  drawer:  { pieces: 2, main: 9, accessory: 4, glue: 1, panels: 9, asm: ['drawer'] },
  // Garis potong produksi tabung mencakup sambungan lem; cangkang 3D tertutup menghilangkan sambungan lem internal yang tertutup badan tabung.
  cyl:     { pieces: 1, main: 26, accessory: 0, glue: 0, panels: 3, asm: [] },
  hex:     { pieces: 1, main: 8, accessory: 0, glue: 0, panels: 8, asm: [] }
};

const CASES = [
  { name: 'Kotak tegak standar', L: 80, W: 40, H: 120, t: 0.45, glue: 14 },
  { name: 'Kotak lebar rendah', L: 120, W: 75, H: 36, t: 0.5, glue: 18 },
  { name: 'Kotak kecil kertas tebal', L: 55, W: 32, H: 68, t: 1.5, glue: 10 }
];

const ACCESSORY = new Set(['dust', 'tuck', 'ear']);
const flatten = node => [node, ...(node.kids || []).flatMap(flatten)];
const bboxOf = pts => pts.reduce((b, p) => [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])], [Infinity, Infinity, -Infinity, -Infinity]);
const contains = (b, x, y) => x >= b[0] - 1e-6 && x <= b[2] + 1e-6 && y >= b[1] - 1e-6 && y <= b[3] + 1e-6;
const same = v => JSON.parse(JSON.stringify(v ?? null));

const ids = TPLS.map(t => t.id).sort();
assert.deepEqual(Object.keys(CONTRACTS).sort(), ids, 'Kontrak sinkronisasi TPLS dan 3D tidak konsisten; jenis kotak baru harus didaftarkan dan menyelesaikan penerimaan tiga tampilan');

for (const c of CASES) {
  for (const tpl of ids) {
    const state = { tpl, L: c.L, W: c.W, H: c.H, bleed: 3, glue: c.glue, ovr: {}, typeOvr: {} };
    const geom = geomOf(state, c.t);
    const pieces = makePieces(tpl, c.L, c.W, c.H, c.t, c.glue);
    const nodes = pieces.flatMap(p => flatten(p.tree));
    const contract = CONTRACTS[tpl];
    const counts = { main: 0, accessory: 0, glue: 0 };

    assert.ok(geom.fills.length && nodes.length, `${tpl}/${c.name} tidak menghasilkan data 2D atau 3D yang lengkap`);
    assert.equal(pieces.length, contract.pieces, `${tpl}/${c.name} jumlah komponen komposit menyimpang`);
    for (const node of nodes) {
      const shape = node.shape || 'rect';
      if (shape === 'glue') counts.glue++;
      else if (ACCESSORY.has(shape)) counts.accessory++;
      else counts.main++;
      assert.ok(Array.isArray(node.uv) && node.uv.length === 4 && node.uv.every(Number.isFinite), `${tpl}/${c.name} terdapat UV tidak valid`);
      assert.ok(node.uv[2] > 0 && node.uv[3] > 0, `${tpl}/${c.name} terdapat ukuran UV non-positif`);
    }
    assert.deepEqual(counts, { main: contract.main, accessory: contract.accessory, glue: contract.glue }, `${tpl}/${c.name} inventaris panel 3D tidak sesuai kontrak`);
    assert.deepEqual(pieces.map(p => p.asm?.type).filter(Boolean).sort(), contract.asm, `${tpl}/${c.name} jenis perakitan menyimpang`);

    assert.equal(geom.panels.length, contract.panels, `${tpl}/${c.name} jumlah kontainer yang dapat didesain menyimpang`);
    assert.equal(new Set(geom.panels.map(p => p.panelId)).size, geom.panels.length, `${tpl}/${c.name} panelId kontainer yang dapat didesain harus unik`);
    for (const panel of geom.panels) {
      assert.ok(panel.panelId, `${tpl}/${c.name} terdapat kontainer yang dapat didesain tanpa panelId`);
      assert.equal(panel.surface, 'outside', `${tpl}/${c.name}/${panel.panelId} kontainer yang dapat didesain harus berupa permukaan luar`);
      assert.ok(panel.up, `${tpl}/${c.name}/${panel.panelId} orientasi visual tidak ada`);
      assert.ok(Array.isArray(panel.pts) && panel.pts.length >= 3 && panel.pts.flat().every(Number.isFinite), `${tpl}/${c.name}/${panel.panelId} titik batas tidak valid`);
      const [x0, y0, x1, y1] = bboxOf(panel.pts);
      assert.ok(x1 > x0 && y1 > y0, `${tpl}/${c.name}/${panel.panelId} batas kontainer terdegenerasi`);
    }
    assert.equal(geom.panels.filter(p => p.role === 'hero' && p.surface === 'outside').length, 1, `${tpl}/${c.name} posisi utama 2D harus tepat satu`);
    if (tpl === 'cyl') assert.equal(geom.panels.filter(p => p.panelId.startsWith('tube-face-')).length, 0, `${tpl}/${c.name} badan tabung silinder harus digabungkan menjadi satu kontainer`);
    if (tpl === 'hex') assert.equal(geom.panels.filter(p => p.panelId === 'tube-body' || p.panelId.startsWith('tube-face-')).length, 6, `${tpl}/${c.name} badan tabung heksagonal harus mempertahankan enam kontainer independen`);

    const hero2d = heroPanelOf(geom);
    const heroes3d = nodes.filter(n => n.role === 'hero' && n.surface === 'outside');
    assert.ok(hero2d, `${tpl}/${c.name} semantik posisi utama 2D tidak ada`);
    assert.equal(heroes3d.length, 1, `${tpl}/${c.name} posisi utama 3D harus tepat satu`);
    const hero3d = heroes3d[0];
    assert.deepEqual(
      { panelId: hero3d.panelId, role: hero3d.role, surface: hero3d.surface, up: hero3d.up, heroRegion: same(hero3d.heroRegion) },
      { panelId: hero2d.panelId, role: hero2d.role, surface: hero2d.surface, up: hero2d.up, heroRegion: same(hero2d.heroRegion) },
      `${tpl}/${c.name} semantik posisi utama struktur, desain, dan 3D tidak konsisten`
    );

    const fillBoxes = geom.fills.map(bboxOf);
    for (const node of nodes) {
      const [x, y, w, h] = node.uv, cx = x + w / 2, cy = y + h / 2;
      assert.ok(fillBoxes.some(b => contains(b, cx, cy)), `${tpl}/${c.name} pusat UV 3D tidak berada di dalam panel 2D mana pun: ${node.panelId || node.shape || 'rect'}`);
      if (node.edge) assert.ok(['far', 'near', 'xmin', 'xmax'].includes(node.edge), `${tpl}/${c.name} terdapat tepi lipatan yang tidak dikenal`);
      if (node.attach) assert.ok(['t', 'b', 'l', 'r'].includes(node.attach), `${tpl}/${c.name} terdapat tepi sambungan garis potong yang tidak dikenal`);
    }

    if (tpl === 'rte' || tpl === 'ste') {
      const glueNode = nodes.find(n => n.shape === 'glue');
      assert.equal(glueNode.out, c.glue, `${tpl}/${c.name} lebar sambungan lem 3D tidak mengikuti parameter struktur`);
    }
  }
}

assert.throws(() => makePieces('__unknown__', 80, 40, 120, 0.45, 14), /__unknown__/, 'Jenis kotak tidak dikenal harus segera gagal, dilarang fallback diam-diam ke pohon lipatan lain');
console.log(`Pemeriksaan sinkronisasi struktur/desain/3D lolos: ${ids.length} jenis kotak × ${CASES.length} kelompok dimensi`);
