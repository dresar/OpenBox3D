<div align="center">

<img src="docs/screenshots/three.jpg" alt="OpenBox3D — Pratinjau Lipat 3D PBR" width="720">

# OpenBox3D · Meja Kerja Kemasan

**Meja kerja desain kemasan berbasis peramban — Garis Potong parametrik, desain artwork ber-Layer dengan finishing cetak, Pratinjau Lipat 3D PBR, dan ekspor PDF siap cetak.**

Ringkasan cepat lihat di bagian [Ringkasan Proyek](#ringkasan-proyek).

[Lisensi: MIT](#license) · [Mulai Cepat](#quick-start) · [Fitur](#features)

**[▶ Demo Langsung — yuyou-dev.github.io/OpenBox3D](https://yuyou-dev.github.io/OpenBox3D/)** (Murni sisi klien, langsung pakai di peramban)

</div>

---

<a id="features"></a>
## Fitur

- **Garis Potong parametrik** — 7 templat kotak (Tutup Sisip, Kotak Kirim, Baki/Tutup, Laci, Sarung, Tabung…), semua dimensi dalam milimeter dengan Kompensasi Ketebalan kertas, panduan Bleed (toleransi cetak) dan Area Aman, serta pengeditan simpul/tepi manual yang disimpan sebagai penimpaan (override) yang dapat diputar ulang.
- **Kanvas desain ber-Layer** — Layer teks, gambar, dan bentuk yang terikat pada Panel, dilengkapi perataan, rotasi, Opasitas, peringatan 300-dpi, serta **saluran finishing cetak** per Layer: Foil (emas/perak), Spot UV, Glossy (kilap), Holografis/Iridescent, Emboss/Deboss.
- **Pratinjau Lipat 3D PBR waktu nyata** — `MeshPhysicalMaterial` three.js dengan saluran albedo / normal / roughness / metalness / clearcoat / displacement yang di-bake. Saksikan lembaran datar Melipat menjadi kotak jadi; Serat Kertas, Film Laminasi, Foil, dan Emboss menumpuk secara alami dalam satu material.
- **Adegan Studio & material** — 8 Adegan Studio bawaan (HDRI + rig pencahayaan), 7 panggung lantai PBR CC0, serta preset kertas/film dengan kontrol Serat Kertas, kekasaran (roughness), Glossy (kilap), dan Emboss.
- **Ekspor PDF siap cetak** — PDF produksi 1:1 CMYK 300 dpi dengan TrimBox/BleedBox, overprint warna spot CutContour/Crease (kontur potong/lipat), ditambah Separasi warna finishing DeviceGray (Foil / Spot UV / Glossy / Emboss).
- **Berkas Proyek (.boxproj)** — simpan dan bagikan karya Anda sebagai satu berkas JSON lokal (murni sisi klien, tanpa server, tanpa akun).
- **Tanpa backend** — semuanya berjalan di peramban Anda. Tanpa kunci API, tanpa cloud, tanpa telemetri.

> Ini adalah edisi sumber terbuka dari meja kerja Box3D. Versi ini sengaja hadir **tanpa** pembuatan gambar AI, pratinjau AR/iOS, ekspor DXF, serta lab material/lingkungan eksperimental.

<a id="screenshots"></a>
## Tangkapan Layar

<div align="center">
<img src="docs/screenshots/structure.jpg" alt="Ruang Kerja Struktur — Garis Potong parametrik" width="700">
<br><sub>Struktur (Structure) — Garis Potong parametrik dengan Kompensasi Ketebalan, panduan Bleed/Area Aman, dan validasi</sub>
<br><br>
<img src="docs/screenshots/design.jpg" alt="Ruang Kerja Desain — Lembaran bentang ber-Layer" width="700">
<br><sub>Desain (Design) — artwork ber-Layer pada lembaran terbuka, dengan saluran Foil / Spot UV / Glossy / Emboss</sub>
<br><br>
<img src="docs/screenshots/three.jpg" alt="Pratinjau Lipat 3D" width="700">
<br><sub>3D — Pratinjau Lipat PBR waktu nyata dengan Adegan Studio dan mode inspeksi</sub>
</div>

<a id="quick-start"></a>
## Mulai Cepat

Persyaratan: **Node.js ≥ 18** dan npm. Tanpa instalasi? Coba **[demo langsung](https://yuyou-dev.github.io/OpenBox3D/)** terlebih dahulu — seluruh aplikasi bersifat statis dan berjalan sepenuhnya di peramban Anda.

```bash
git clone https://github.com/yuyou-dev/OpenBox3D.git
cd OpenBox3D
npm install
npm run dev
```

Buka <http://127.0.0.1:26847> — kotak sampel siap pakai akan menyambut Anda di tampilan 3D dalam keadaan sudah terlipat. Mulai mendesain seketika; tidak diperlukan konfigurasi apa pun.

Build produksi:

```bash
npm run build        # mencakup pemeriksaan konsistensi templat/UV (prebuild)
npm run preview      # jalankan bundel hasil build di alamat yang sama
npm run build:pages  # build dengan base=/OpenBox3D/ untuk hosting subpath GitHub Pages
```

Catatan: server pengembangan (dev server) hanya terikat pada `127.0.0.1` (tidak dapat diakses dari LAN) — ini adalah standar dasar keamanan yang disengaja.

### Penerapan demo langsung

Situs di <https://yuyou-dev.github.io/OpenBox3D/> dibangun dari repositori ini melalui [`.github/workflows/pages.yml`](.github/workflows/pages.yml) pada setiap push ke `main` (sumber GitHub Pages: *GitHub Actions*). Semua proses rendering, baking, dan pembuatan PDF berlangsung di sisi klien — demo ini murni merupakan hosting statis.

## Menggunakan meja kerja

Bilah atas beralih di antara empat ruang kerja:

1. **Struktur (Structure)** — pilih templat kotak, atur dimensi dalam (P×L×T mm), bahan karton, dan Bleed (toleransi cetak); edit simpul Garis Potong dan tipe garis (potong/lipat CutContour/Crease) secara langsung.
2. **Desain (Design)** — tambahkan Layer teks / gambar / bentuk ke lembaran bentang; tetapkan finishing cetak; pantau peringatan lintas-lipatan, Area Aman, dan dpi. Setiap pengeditan dapat dibatalkan — tombol Batal / Ulang atau ⌘Z / ⌘⇧Z (Ctrl+Z / Ctrl+Shift+Z).
3. **3D** — animasi Lipat, material kertas & Film Laminasi, sakelar finishing, Adegan Studio/panggung lantai, mode inspeksi (plat Foil, plat Spot UV, ketinggian Emboss, UV checker).
4. **Output (Keluaran)** — ringkasan preflight, lalu ekspor PDF siap cetak (produksi CMYK / profesional / pratinjau RGB) dan PDF Separasi warna finishing.

**Impor / ekspor proyek** — tombol bilah atas untuk membuka dan menyimpan Berkas Proyek (.boxproj) secara lokal. **Reset Kotak Sampel** mengembalikan kotak sampel bawaan.

### Menyesuaikan kotak sampel bawaan

Kotak sampel peluncuran pertama adalah Berkas Proyek (.boxproj) standar yang dibundel di [`src/preset/preset-box.json`](src/preset/preset-box.json) (dengan gambar Layer di bawah `public/preset/`). Untuk menggantinya dengan karya Anda sendiri: rancang kotak di meja kerja, gunakan **Ekspor Proyek** untuk menyimpan Berkas Proyek (.boxproj), lalu jalankan:

```bash
npm run preset:from -- /path/to/your-project.boxproj
```

Skrip akan mengekstrak gambar Layer ke dalam `public/preset/` dan menulis ulang JSON bawaan; lakukan build ulang / restart untuk melihat perubahannya.

<a id="tech-stack"></a>
## Tumpukan teknologi

- [React 18](https://react.dev) + [Vite 5](https://vitejs.dev) — UI dan perkakas
- [three.js 0.184](https://threejs.org) — Rendering PBR WebGL2, lingkungan PMREM
- Generator buatan mandiri — geometri Garis Potong (mm), pembuat PDF (CMYK/warna spot)
- Tanpa pustaka state pihak ketiga, tanpa framework CSS, tanpa kode server

```
OpenBox3D/
├── index.html
├── public/            # aset merek, lingkungan HDRI CC0, tekstur lantai PBR
├── scripts/
│   └── check-template-sync.mjs   # pemeriksaan konsistensi templat Garis Potong ↔ 3D (prebuild)
├── src/
│   ├── dieline/       # templat Garis Potong parametrik & otoritas geometri
│   ├── design/        # Layer, gambar, kontainer, Emboss
│   ├── render3d/      # hierarki Lipat, baking tekstur, material, pencahayaan, adegan
│   ├── export/        # PDF siap cetak + Separasi warna finishing
│   ├── projects/      # format Berkas Proyek (.boxproj) (hanya impor/ekspor lokal)
│   ├── preset/        # kotak sampel bawaan (ubah berkas ini untuk rebranding)
│   ├── state/         # state penyimpanan tunggal (single-store)
│   └── ui/            # empat ruang kerja
```

### Parameter URL debug

Sangat berguna selama pengembangan: `?view=structure|design|three|output`, `?tpl=rte|ste|mailer|lidbase|drawer|cyl|hex`, `?fold=0-100`, `?check=art|foil|suv|gloss|emb|checker`, `?studio=<scene-id>`, `?stage=<stage-id>`, `?expo=0.6-1.8`, `?shadow=0`.

<a id="credits"></a>
## Penghargaan

- Lingkungan HDRI dan tekstur lantai PBR: [Poly Haven](https://polyhaven.com) (CC0)
- Font: Noto Sans SC / Noto Serif SC / JetBrains Mono (Google Fonts, OFL)
- Merek: Suwa Workshop (OpenBox3D)

<a id="license"></a>
## Lisensi

[MIT](LICENSE) © 2026 yuyou-dev

---

<a id="ringkasan-proyek"></a>
## Ringkasan Proyek

**OpenBox3D** adalah meja kerja desain kemasan berbasis peramban murni: Garis Potong parametrik (Kompensasi Ketebalan kertas, Bleed (toleransi cetak)/Area Aman) → Desain grafis ber-Layer (saluran finishing Foil (emas/perak)/Spot UV/Glossy (kilap)/Emboss/Deboss/Holografis/Iridescent) → Pratinjau Lipat 3D PBR three.js → Ekspor PDF siap cetak 1:1 CMYK serta Separasi warna finishing. Tanpa backend, tanpa akun, tanpa kunci API.

- **Instalasi & Menjalankan**: Node.js ≥ 18, `npm install && npm run dev`, buka <http://127.0.0.1:26847>, layar awal langsung menampilkan kotak sampel bawaan (keadaan 3D tertutup), langsung mulai berkreasi. Anda juga dapat langsung mencoba **[Demo Langsung](https://yuyou-dev.github.io/OpenBox3D/)** (hosting statis murni di sisi klien, diterapkan secara otomatis via GitHub Actions).
- **Berkas Proyek**: Tombol bilah atas "Ekspor Proyek / Impor Proyek" untuk menyimpan dan membagikan Berkas Proyek (.boxproj) secara lokal; "Reset Kotak Sampel" untuk memulihkan keadaan awal.
- **Mengganti Kotak Sampel**: Rancang kotak di meja kerja → bilah atas "Ekspor Proyek" → `npm run preset:from -- /path/to/your-project.boxproj` (gambar diekstrak ke `public/preset/`, Berkas Proyek ditulis ke `src/preset/preset-box.json`).
- **Batasan Sumber Terbuka**: Versi sumber terbuka ini tidak mencakup pembuatan gambar AI, pratinjau AR/iOS, ekspor DXF, serta lab material dan lingkungan eksperimental.
- Server pengembangan hanya terikat pada `127.0.0.1` (tidak dapat dijangkau dari LAN), ini adalah standar keamanan yang sengaja diterapkan.
