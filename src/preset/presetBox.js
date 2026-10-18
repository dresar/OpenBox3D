// Kotak contoh bawaan: dimuat saat peluncuran awal dan saat "Atur Ulang Kotak Contoh" di bilah atas, agar pengguna baru langsung memiliki kotak jadi yang lengkap.
//
// —— Cara mengganti dengan kotak bawaan Anda sendiri ——
// 1. Desain kotak di ruang kerja, simpan berkas .boxproj lewat "Ekspor Proyek" di bilah atas;
// 2. Jalankan di direktori root repositori: npm run preset:from -- /jalur/proyek-anda.boxproj
//    (Gambar layer akan diekstrak ke public/preset/, proyek dipangkas lalu ditulis ke src/preset/preset-box.json);
// 3. Jalankan ulang npm run dev / npm run build agar berlaku.
//
// preset-box.json adalah standar .boxproj (box3d-project v1), logika pemuatan konsisten dengan "Impor Proyek".
import { projectStateOf } from '../projects/projects.js';
import presetDoc from './preset-box.json';

let cache = null;

// Mengembalikan patch yang dapat langsung diteruskan ke store.reset; hasil disimpan dalam cache untuk digunakan ulang oleh "Atur Ulang Kotak Contoh".
export async function loadPresetBox() {
  if (cache) return cache;
  const qp = new URLSearchParams(location.search); // Prioritas deep link debug: ?view=/?fold= tidak ditimpa oleh preset
  const patch = await projectStateOf(presetDoc, 'three'); // Layar pertama langsung tampilan 3D
  cache = {
    ...patch,
    view: qp.get('view') || 'three',
    fold: qp.has('fold') ? +qp.get('fold') : 100 // Kotak jadi dalam keadaan tertutup
  };
  return cache;
}
