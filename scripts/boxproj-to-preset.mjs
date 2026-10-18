// Konversi berkas proyek .boxproj menjadi kotak contoh bawaan repositori ini:
//   node scripts/boxproj-to-preset.mjs /jalur/proyek.boxproj
// dataURL gambar diekstrak menjadi public/preset/layer-<id>.<ext>, proyek dipangkas lalu ditulis ke src/preset/preset-box.json.
// Penggunaan juga tercantum di package.json: npm run preset:from -- /jalur/proyek.boxproj
import fs from 'node:fs';
import path from 'node:path';

const src = process.argv[2];
if (!src) { console.error('Penggunaan: node scripts/boxproj-to-preset.mjs /jalur/proyek.boxproj'); process.exit(1); }

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const doc = JSON.parse(fs.readFileSync(src, 'utf8'));
if (doc.schema !== 'box3d-project' || doc.version !== 1 || !doc.box || !doc.design || !Array.isArray(doc.design.layers)) {
  console.error('Bukan berkas proyek Box3D yang valid (schema box3d-project v1).');
  process.exit(1);
}

const presetDir = path.join(root, 'public', 'preset');
fs.rmSync(presetDir, { recursive: true, force: true }); // Bersihkan materi kotak contoh generasi sebelumnya
fs.mkdirSync(presetDir, { recursive: true });

const EXT = { png: 'png', jpeg: 'jpg', webp: 'webp' };
let extracted = 0;
for (const layer of doc.design.layers) {
  const m = /^data:image\/(png|jpeg|webp);base64,(.+)$/.exec(layer.imgSrc || '');
  if (!m) continue;
  const file = 'layer-' + (layer.id != null ? layer.id : ++extracted) + '.' + EXT[m[1]];
  fs.writeFileSync(path.join(presetDir, file), Buffer.from(m[2], 'base64'));
  layer.imgSrc = '/preset/' + file;
  extracted++;
}

doc.meta = { id: 'preset', name: 'Kotak Contoh Bawaan', createdAt: doc.meta && doc.meta.createdAt, updatedAt: doc.meta && doc.meta.updatedAt, thumbnail: '' }; // Sampul diambil ulang secara otomatis saat startup, tidak masuk ke repositori
const out = path.join(root, 'src', 'preset', 'preset-box.json');
fs.writeFileSync(out, JSON.stringify(doc, null, 2));
console.log('Selesai: mengekstrak ' + extracted + ' gambar → public/preset/; proyek → src/preset/preset-box.json (' + Math.round(fs.statSync(out).size / 1024) + ' KB)');
