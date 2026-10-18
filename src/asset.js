// Jalur aset situs: kompatibel dengan deployment subjalur GitHub Pages (vite base, mis. /OpenBox3D/).
// p disepakati sebagai jalur absolut situs yang diawali dengan / (/brand/…, /hdri/…, /textures/…, /preset/…);
// Pengembangan (base=/) sama seperti aslinya, build Pages (base=/OpenBox3D/) otomatis menambahkan awalan.
export const asset = p => import.meta.env.BASE_URL.replace(/\/$/, '') + p;
