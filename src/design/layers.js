// Model layer: bbox, DPI, peringatan lintas lipatan/melebihi batas (migrasi logika prototipe)
export const FIN = { none: '', foil: 'Foil Emas', silver: 'Foil Perak', uv: 'Spot UV', gloss: 'Glossy', emboss: 'Emboss', holo: 'Holografis' };
export const FIN_NAMES = { foil: 'Foil Emas', silver: 'Foil Perak', uv: 'Spot UV', gloss: 'Glossy', emboss: 'Emboss', holo: 'Holografis' };
export const randomImageName = () => 'Gambar·' + Math.random().toString(36).slice(2, 6).toUpperCase();
export const layerNameOf = l => {
  if (l && typeof l.name === 'string' && l.name.trim()) return l.name.trim();
  if (l && l.kind === 'image') return 'Gambar·' + Number(l.id || 0).toString(36).toUpperCase().padStart(4, '0').slice(-4);
  return l && l.content || '(Kosong)';
};

export function bboxOf(l) {
  if (l.kind === 'text') {
    const wch = [...(l.content || '')].reduce((a, ch) => a + (ch.charCodeAt(0) > 255 ? 1 : 0.55), 0);
    const sx = l.scaleX == null ? 1 : l.scaleX, sy = l.scaleY == null ? 1 : l.scaleY;
    const w = Math.max(2, wch * l.size) * sx, h = l.size * 1.15 * sy, cy = l.y - l.size * 0.345;
    return [l.x - w / 2, cy - h / 2, w, h];
  }
  return [l.x, l.y, l.w, l.h];
}

export function dpiOf(l) {
  if (l.kind !== 'image' || !l.pxw) return 0;
  return Math.round(l.pxw / (l.w / 25.4));
}

// Untuk atlas UV: kotak pembatas setiap panel (poligon fill), untuk penyelarasan 3D dan ekspor
export function panelBoxes(g) {
  return g.fills.map(pts => {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    pts.forEach(p => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
    return [x0, y0, x1, y1];
  });
}

export function warnsOf(l, creaseSegs, sbb) {
  const b = bboxOf(l), out = [];
  // Layer yang terikat ke kontainer akan dipotong secara seragam di seluruh alur render/ekspor; melewati batas kontainer bukan lagi peringatan produksi.
  if (l.panelId == null) {
    for (const seg2 of creaseSegs) {
      const p1 = seg2[0], p2 = seg2[1];
      if (Math.abs(p1[0] - p2[0]) < 0.01) {
        const cx = p1[0], y0 = Math.min(p1[1], p2[1]), y1 = Math.max(p1[1], p2[1]);
        if (cx > b[0] && cx < b[0] + b[2] && y0 < b[1] + b[3] && y1 > b[1]) { out.push('Melintasi garis lipat: pola pada sudut lipatan akan terputus/terdistorsi'); break; }
      } else if (Math.abs(p1[1] - p2[1]) < 0.01) {
        const cy = p1[1], x0 = Math.min(p1[0], p2[0]), x1 = Math.max(p1[0], p2[0]);
        if (cy > b[1] && cy < b[1] + b[3] && x0 < b[0] + b[2] && x1 > b[0]) { out.push('Melintasi garis lipat: pola pada sudut lipatan akan terputus/terdistorsi'); break; }
      }
    }
    if (b[0] < sbb[0] - 0.5 || b[1] < sbb[1] - 0.5 || b[0] + b[2] > sbb[2] + 0.5 || b[1] + b[3] > sbb[3] + 0.5) out.push('Melebihi tata letak: sudah masuk area bleed/buangan');
  }
  if (l.kind === 'image') { const dpi = dpiOf(l); if (dpi < 300) out.push('Resolusi tidak memadai: ' + dpi + ' dpi < 300 dpi'); }
  return out;
}

// Mask efektif untuk gambar finishing: RGB diatur ke putih, alpha = kecerahan × alpha asli.
// Gambar finishing grayscale PBR standar (hitam=tanpa efek, putih=efek penuh, abu-abu=transisi) dikonversi menjadi bobot cutout;
// Kliping RGBA versi lama (warna asli+alpha) juga kompatibel (kecerahan×alpha≈intensitas). Di-cache berdasarkan objek img.
const craftMaskCache = new WeakMap();
function craftMaskOf(img) {
  let m = craftMaskCache.get(img);
  if (m) return m;
  m = document.createElement('canvas');
  m.width = img.naturalWidth; m.height = img.naturalHeight;
  const mg = m.getContext('2d');
  mg.drawImage(img, 0, 0);
  const d = mg.getImageData(0, 0, m.width, m.height);
  const px = d.data;
  for (let i = 0; i < px.length; i += 4) {
    const lum = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
    px[i] = px[i + 1] = px[i + 2] = 255;
    px[i + 3] = Math.round(lum * (px[i + 3] / 255));
  }
  mg.putImageData(d, 0, 0);
  craftMaskCache.set(img, m);
  return m;
}

// Gambar layer secara seragam ke kanvas 2D (digunakan bersama untuk ekspor PDF / bake 3D)
// sc = skala px/mm; fill = warna pengganti (mask finishing menggunakan '#fff', dll.)
export function drawLayer(ctx, l, sc, fill, clipPts) {
  ctx.save();
  if (clipPts && clipPts.length > 2) {
    ctx.beginPath();
    clipPts.forEach((p, i) => i ? ctx.lineTo(p[0] * sc, p[1] * sc) : ctx.moveTo(p[0] * sc, p[1] * sc));
    ctx.closePath(); ctx.clip();
  }
  ctx.globalAlpha = l.opacity == null ? 1 : l.opacity;
  if (l.rot) {
    const b = bboxOf(l), rcx = (b[0] + b[2] / 2) * sc, rcy = (b[1] + b[3] / 2) * sc;
    ctx.translate(rcx, rcy); ctx.rotate(l.rot * Math.PI / 180); ctx.translate(-rcx, -rcy);
  }
  if (l.kind === 'text') {
    const sx = l.scaleX == null ? 1 : l.scaleX, sy = l.scaleY == null ? 1 : l.scaleY;
    if (sx !== 1 || sy !== 1) {
      const b = bboxOf(l), cx = (b[0] + b[2] / 2) * sc, cy = (b[1] + b[3] / 2) * sc;
      ctx.translate(cx, cy); ctx.scale(sx, sy); ctx.translate(-cx, -cy);
    }
    ctx.font = (l.weight || 400) + ' ' + (l.size * sc) + 'px "' + (l.font || 'Noto Sans SC') + '"';
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    if (fill) { ctx.fillStyle = fill; ctx.fillText(l.content || '', l.x * sc, l.y * sc); }
    else if (l.finish === 'emboss') { ctx.strokeStyle = '#b8b0a0'; ctx.lineWidth = sc * 0.15; ctx.strokeText(l.content || '', l.x * sc, l.y * sc); }
    else { ctx.fillStyle = l.finish === 'foil' ? '#C9A227' : l.finish === 'silver' ? '#B8BAC4' : (l.color || '#211d18'); ctx.fillText(l.content || '', l.x * sc, l.y * sc); }
  } else if (l.kind === 'shape') {
    ctx.fillStyle = fill || (l.finish === 'emboss' ? 'rgba(33,29,24,0.12)' : l.finish === 'foil' ? '#C9A227' : l.finish === 'silver' ? '#B8BAC4' : (l.color || '#211d18'));
    ctx.fillRect(l.x * sc, l.y * sc, l.w * sc, l.h * sc);
  } else if (l.img) {
    // Gambar sebenarnya (mendukung pemotongan)
    const cr = l.crop || [0, 0, 1, 1];
    const iw = l.img.naturalWidth, ih = l.img.naturalHeight;
    const sx = cr[0] * iw, sy = cr[1] * ih, sw = cr[2] * iw, sh = cr[3] * ih;
    const dx = l.x * sc, dy = l.y * sc, dw = l.w * sc, dh = l.h * sc;
    if (fill || (l.finish && l.finish !== 'none')) {
      // Layer finishing (mask atau tint warna dasar): lubangi di kanvas independen sesuai mask efektif (kecerahan×alpha), lalu gabungkan secara normal
      // —— Menghindari destination-in langsung bekerja pada kanvas utama dan menghapus konten lain
      const t = document.createElement('canvas');
      t.width = Math.max(1, Math.ceil(dw)); t.height = Math.max(1, Math.ceil(dh));
      const tg = t.getContext('2d');
      tg.fillStyle = fill || (l.finish === 'foil' ? '#C9A227' : l.finish === 'silver' ? '#B8BAC4'
        : l.finish === 'uv' ? 'rgba(33,29,24,0.08)' : 'rgba(33,29,24,0.12)');
      tg.fillRect(0, 0, t.width, t.height);
      tg.globalCompositeOperation = 'destination-in';
      tg.drawImage(craftMaskOf(l.img), sx, sy, sw, sh, 0, 0, t.width, t.height);
      ctx.drawImage(t, dx, dy, dw, dh);
    } else {
      ctx.drawImage(l.img, sx, sy, sw, sh, dx, dy, dw, dh);
    }
  } else if (fill) {
    // Mode mask finishing: isi solid area placeholder gambar
    ctx.fillStyle = fill; ctx.fillRect(l.x * sc, l.y * sc, l.w * sc, l.h * sc);
  } else {
    // Kotak placeholder gambar
    ctx.strokeStyle = fill || '#b3a88f'; ctx.lineWidth = fill ? 2 : sc * 0.3;
    if (!fill) ctx.setLineDash([sc * 2, sc * 1.4]);
    ctx.strokeRect(l.x * sc, l.y * sc, l.w * sc, l.h * sc); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(l.x * sc, l.y * sc); ctx.lineTo((l.x + l.w) * sc, (l.y + l.h) * sc);
    ctx.moveTo((l.x + l.w) * sc, l.y * sc); ctx.lineTo(l.x * sc, (l.y + l.h) * sc);
    ctx.lineWidth = fill ? 2 : sc * 0.2; ctx.stroke();
    if (!fill) { ctx.font = '500 ' + (3.4 * sc) + 'px "Noto Sans SC"'; ctx.textAlign = 'center'; ctx.fillStyle = '#8a8071'; ctx.fillText(l.content || '', (l.x + l.w / 2) * sc, (l.y + l.h / 2) * sc); }
  }
  ctx.restore();
}
