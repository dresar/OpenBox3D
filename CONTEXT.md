# CONTEXT.md — OpenBox3D Lokalisasi Bahasa Indonesia

## Misi
Mengganti SELURUH teks berbahasa Mandarin (dan Inggris) menjadi Bahasa Indonesia
di seluruh proyek OpenBox3D. Dilarang ada bahasa lain selain Bahasa Indonesia
pada teks yang tampil ke pengguna dan dokumentasi.

## Aturan Mutlak Perubahan
1. HANYA ubah string/teks yang ditampilkan ke pengguna (label UI, tombol, judul,
   placeholder, tooltip, pesan error, alt text, teks dokumentasi, deskripsi package.json).
2. DILARANG mengubah: nama fungsi, nama variabel, nama class/CSS, ID HTML, atribut data-*,
   key JSON, nilai enum yang dipakai sebagai identifier, nama file, nama import,
   konfigurasi build, dan logika kode.
3. Patuhi standar NOKOMEN: tidak menambah komentar baru ke dalam kode.
4. Jangan jalankan git commit/push. Orchestrator yang mengintegrasikan.
5. Verifikasi akhir: tidak ada lagi karakter Unicode Mandarin (U+4E00-U+9FFF) di file scope Anda.

## Kamus Terminologi Wajib (Print/Packaging)
- dieline -> Garis Potong
- fold/lipat -> Lipat
- bleed -> Bleed (toleransi cetak)
- safe area -> Area Aman
- panel -> Panel
- tuck-end -> Tutup Sisip
- mailer -> Kotak Kirim
- tray/lid -> Baki/Tutup
- drawer -> Laci
- sleeve -> Sarung
- tube -> Tabung
- foil (gold/silver) -> Foil (emas/perak)
- spot UV -> Spot UV
- gloss -> Glossy (kilap)
- holographic/iridescent -> Holografis/Iridescent
- emboss/deboss -> Emboss/Deboss
- layer -> Layer
- opacity -> Opasitas
- thickness compensation -> Kompensasi Ketebalan
- paper grain -> Serat Kertas
- lamination film -> Film Laminasi
- studio scene -> Adegan Studio
- HDRI -> HDRI
- TrimBox/BleedBox -> TrimBox/BleedBox
- CutContour/Crease -> CutContour/Crease (kontur potong/lipat)
- press-ready PDF -> PDF siap cetak
- CMYK -> CMYK
- separation -> Separasi warna
- project file (.boxproj) -> Berkas Proyek (.boxproj)

## Pembagian File Antar Worker (ISOLASI KETAT)
- AGY02 (state/data): src/state/store.js, src/projects/projects.js, src/design/layers.js,
  src/design/containers.js, src/design/images.js, src/design/emboss.js
- AGY03 (export/scripts): src/export/pdf.js, src/export/separations.js, src/preset/presetBox.js,
  src/preset/preset-box.json, src/asset.js, scripts/boxproj-to-preset.mjs,
  scripts/check-template-sync.mjs
- AGY04 (UI utama): src/ui/ThreeView.jsx, src/ui/OutputView.jsx, src/ui/DesignView.jsx,
  src/ui/StructureView.jsx, src/ui/SheetCanvas.jsx, src/ui/widgets.jsx, src/App.jsx,
  src/main.jsx, index.html
- AGY05 (render3d A): src/render3d/fold.js, src/render3d/presets.js,
  src/render3d/materials.js, src/render3d/materialPresets.js
- AGY06 (render3d B + dieline): src/render3d/envDome.js, src/render3d/stage.js,
  src/render3d/paper.js, src/render3d/BoxPreview.jsx, src/render3d/BoxCanvas.jsx,
  src/dieline/templates.js, src/dieline/geom.js, src/dieline/hero.js
- AGY07 (docs + riset): README.md, package.json (description saja)
- AGY10 (render3d core): src/render3d/engine.js, src/render3d/rig.js,
  src/render3d/lighting.js, src/render3d/bake.js
- AGY08 (review, fase akhir): audit seluruh repo setelah batch 1
- AGY09 (integration, fase akhir): build, jalankan, smoke test

## Workspace
/opt/data/projects/openbox3d
