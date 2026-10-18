// Pipeline bake atlas (inti): satu atlas lembar penuh, membakar enam saluran albedo/normal/roughness/metalness/clearcoat/displacement
// Sistem koordinat = bentangan garis potong 2D (mm), diperluas dengan bleed sebagai area bleed; UV = normalisasi koordinat bentangan (v dibalik)
import { drawLayer } from '../design/layers.js';
import { composeEmbossChannels } from '../design/emboss.js';
import { clipPtsOf } from '../design/containers.js';
import { paperHeightTile, normalFromHeight, kraftFiberTile } from './paper.js';
import { paperPreset, filmPreset } from './presets.js';

const mk = (W, H) => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };

// Menggambar overlay canvas ke base menggunakan mask canvas (putih = area kerja)
function maskDraw(base, overlay, mask) {
  const t = mk(base.width, base.height);
  const tg = t.getContext('2d');
  tg.drawImage(overlay, 0, 0);
  tg.globalCompositeOperation = 'destination-in';
  tg.drawImage(mask, 0, 0);
  base.getContext('2d').drawImage(t, 0, 0);
}

// Menggambar tile berulang (dimensi fisik tileMm)
function tileDraw(ctx, tile, S, tileMm, W, H, op) {
  const px = tileMm * S;
  ctx.save();
  if (op) ctx.globalCompositeOperation = op;
  for (let y = 0; y < H; y += px) for (let x = 0; x < W; x += px) ctx.drawImage(tile, x, y, px, px);
  ctx.restore();
}

// Tumpukan perkalian saluran G: mengalikan overlay ke area mask base (piksel lain tidak berubah)
function maskMultiply(base, overlay, mask) {
  const t = mk(base.width, base.height);
  const tg = t.getContext('2d');
  tg.drawImage(overlay, 0, 0);
  tg.globalCompositeOperation = 'destination-in';
  tg.drawImage(mask, 0, 0);
  const bg = base.getContext('2d');
  bg.globalCompositeOperation = 'multiply';
  bg.drawImage(t, 0, 0);
  bg.globalCompositeOperation = 'source-over';
}

// Derau nilai frekuensi rendah (gangguan ketebalan film laser): dua tingkat kisi acak diperbesar secara bilinear lalu dirata-rata berdasarkan bobot, rentang nilai sekitar [0, 0.76]
// (Nilai kisi harus memiliki batas bawah 0: menaikkan batas bawah akan memampatkan rentang ketebalan film sebenarnya, warna iridescent hanya menyisakan warna dasar ± warna sekitar)
function lowFreqNoise(W, H) {
  const grid = n => {
    const c = mk(n, n), g = c.getContext('2d'), d = g.createImageData(n, n);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.floor(Math.random() * 256); d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0);
    return c;
  };
  const out = mk(W, H), g = out.getContext('2d');
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.globalAlpha = 0.62; g.drawImage(grid(6), 0, 0, W, H);
  g.globalAlpha = 0.38; g.drawImage(grid(17), 0, 0, W, H);
  return out;
}

// Pergantian laminasi film hanya menggambar ulang dua peta skalar ringan, tanpa menjalankan ulang pembakaran layer, serat kertas, dan normal.
export function paintFilmChannels(baked, filmId, controls = {}) {
  if (!baked || !baked.ccC || !baked.ccRC) return;
  const film = filmPreset(filmId), cg = baked.ccC.getContext('2d'), crg = baked.ccRC.getContext('2d');
  const clamp01 = v => Math.min(1, Math.max(0, v));
  const clearcoat = Number.isFinite(+controls.filmClearcoat) ? clamp01(+controls.filmClearcoat) : film.clearcoat;
  const clearcoatRoughness = Number.isFinite(+controls.filmClearcoatRoughness) ? clamp01(+controls.filmClearcoatRoughness) : film.clearcoatRoughness;
  const uvClearcoat = Number.isFinite(+controls.uvClearcoat) ? clamp01(+controls.uvClearcoat) : 1;
  const uvRoughness = Number.isFinite(+controls.uvRoughness) ? clamp01(+controls.uvRoughness) : 0.05;
  const cv = Math.round(clearcoat * 255), crv = Math.round(clearcoatRoughness * 255);
  cg.globalCompositeOperation = 'source-over'; cg.globalAlpha = 1; cg.fillStyle = 'rgb(' + cv + ',' + cv + ',' + cv + ')'; cg.fillRect(0, 0, baked.ccC.width, baked.ccC.height);
  crg.globalCompositeOperation = 'source-over'; crg.globalAlpha = 1; crg.fillStyle = 'rgb(' + crv + ',' + crv + ',' + crv + ')'; crg.fillRect(0, 0, baked.ccRC.width, baked.ccRC.height);
  if (baked.hasSuv && baked.maskUv) {
    const uvHi = mk(baked.ccC.width, baked.ccC.height), ug = uvHi.getContext('2d'), uvv = Math.round(uvClearcoat * 255); ug.fillStyle = 'rgb(' + uvv + ',' + uvv + ',' + uvv + ')'; ug.fillRect(0, 0, uvHi.width, uvHi.height); maskDraw(baked.ccC, uvHi, baked.maskUv);
    const uvLo = mk(baked.ccC.width, baked.ccC.height), ul = uvLo.getContext('2d'), urv = Math.round(uvRoughness * 255); ul.fillStyle = 'rgb(' + urv + ',' + urv + ',' + urv + ')'; ul.fillRect(0, 0, uvLo.width, uvLo.height); maskDraw(baked.ccRC, uvLo, baked.maskUv);
  }
}

// Hanya menggambar ulang kekasaran area foil (menyatukan mask emas/perak), tanpa mengulang pembakaran layer, serat kertas, dan normal.
export function paintFoilRoughness(baked, value) {
  if (!baked || !baked.hasFoil || !baked.roughC) return;
  const roughness = Math.min(1, Math.max(0, Number.isFinite(+value) ? +value : 0.22));
  const foilR = mk(baked.roughC.width, baked.roughC.height), fg = foilR.getContext('2d'), rv = Math.round(roughness * 255);
  fg.fillStyle = 'rgb(' + rv + ',' + rv + ',' + rv + ')'; fg.fillRect(0, 0, foilR.width, foilR.height);
  if (baked.maskFoil) maskDraw(baked.roughC, foilR, baked.maskFoil);
  if (baked.maskSilver) maskDraw(baked.roughC, foilR, baked.maskSilver);
}

export function bakeAtlas(o) {
  const { layers, panels, sbb, bleed, paperId, filmId, embDepth, embDir, embBoost } = o;
  const paper = paperPreset(paperId);
  const foilEnabled = o.foilOn !== false && o.foilOn !== '0', suvEnabled = o.suvOn !== false && o.suvOn !== '0', glossEnabled = o.glossOn !== false && o.glossOn !== '0', holoEnabled = o.holoOn !== false && o.holoOn !== '0';
  const grainStrength = Math.max(0, Math.min(1.5, o.grainStrength == null ? paper.grainStrength : o.grainStrength));
  const grainScale = Math.max(3, Math.min(20, o.grainScale || paper.grainMm));
  const pad = Math.max(2, bleed || 0);
  const Wmm = (sbb[2] - sbb[0]) + 2 * pad, Hmm = (sbb[3] - sbb[1]) + 2 * pad;
  const S = Math.min(8, 4096 / Math.max(Wmm, Hmm));
  const W = Math.round(Wmm * S), H = Math.round(Hmm * S);
  const ox = sbb[0] - pad, oy = sbb[1] - pad;
  const X = v => (v - ox) * S, Y = v => (v - oy) * S;
  const vis = layers.filter(l => l.visible);

  // —— albedo: warna dasar kertas → (perkalian serat kraft) → layer ——
  const colorC = mk(W, H), cc0 = colorC.getContext('2d');
  cc0.fillStyle = o.paperTint || paper.color; cc0.fillRect(0, 0, W, H); // Warna dasar kertas (menimpa warna dasar preset jenis kertas saat diatur pengguna)
  if (paper.grain === 'kraft') { cc0.save(); cc0.globalAlpha = Math.min(0.3, grainStrength * 0.28); tileDraw(cc0, kraftFiberTile(), S, grainScale, W, H, 'multiply'); cc0.restore(); }
  cc0.save(); cc0.translate(-ox * S, -oy * S);
  for (const l of vis) drawLayer(cc0, l, S, undefined, clipPtsOf(panels, l));
  cc0.restore();

  // —— mask finishing: pemisahan saluran foil emas / foil perak (albedo diwarnai terpisah foilColor / silverColor, tidak lagi diseragamkan emas) ——
  const foilC = mk(W, H), silverC = mk(W, H), uvC = mk(W, H), glossC = mk(W, H), holoC = mk(W, H);
  const fc = foilC.getContext('2d'), sc = silverC.getContext('2d'), uc = uvC.getContext('2d'), gc = glossC.getContext('2d'), hc = holoC.getContext('2d');
  fc.save(); fc.translate(-ox * S, -oy * S);
  sc.save(); sc.translate(-ox * S, -oy * S);
  uc.save(); uc.translate(-ox * S, -oy * S);
  gc.save(); gc.translate(-ox * S, -oy * S);
  hc.save(); hc.translate(-ox * S, -oy * S);
  let hasFoil = false, hasSilver = false, hasSuv = false, hasGloss = false, hasHolo = false;
  for (const l of vis) {
    if (l.finish === 'foil' && foilEnabled) { drawLayer(fc, l, S, '#fff', clipPtsOf(panels, l)); hasFoil = true; }
    else if (l.finish === 'silver' && foilEnabled) { drawLayer(sc, l, S, '#fff', clipPtsOf(panels, l)); hasSilver = true; }
    else if (l.finish === 'uv' && suvEnabled) { drawLayer(uc, l, S, '#fff', clipPtsOf(panels, l)); hasSuv = true; }
    else if (l.finish === 'gloss' && glossEnabled) { drawLayer(gc, l, S, '#fff', clipPtsOf(panels, l)); hasGloss = true; }
    else if (l.finish === 'holo' && holoEnabled) { drawLayer(hc, l, S, '#fff', clipPtsOf(panels, l)); hasHolo = true; }
  }
  fc.restore(); sc.restore(); uc.restore(); gc.restore(); hc.restore();
  const anyFoil = hasFoil || hasSilver;
  const foilColor = typeof o.foilColor === 'string' ? o.foilColor : '#ffdb91', silverColor = typeof o.silverColor === 'string' ? o.silverColor : '#faf7f2';
  if (hasFoil) {
    const foilTone = mk(W, H), ft = foilTone.getContext('2d');
    ft.fillStyle = foilColor; ft.fillRect(0, 0, W, H);
    maskDraw(colorC, foilTone, foilC);
  }
  if (hasSilver) {
    const silverTone = mk(W, H), st = silverTone.getContext('2d');
    st.fillStyle = silverColor; st.fillRect(0, 0, W, H);
    maskDraw(colorC, silverTone, silverC);
  }
  // Area laser diwarnai warna dasar (default perak putih #edf1f6 = laser polos; holoColor warna apa pun = foil laser warna; warna-warni dihasilkan oleh iridescence sesuai sudut)
  if (hasHolo) {
    const holoTone = mk(W, H), ht = holoTone.getContext('2d');
    ht.fillStyle = typeof o.holoColor === 'string' ? o.holoColor : '#edf1f6'; ht.fillRect(0, 0, W, H);
    const rb = Math.max(0, Math.min(1, +o.holoRainbow || 0));
    if (rb > 0) { // Pola pelangi: gradien spektrum diagonal dilapisi ke warna dasar sesuai intensitas (sapuan spektrum penuh kertas laser polos adalah komponen difraksi, tidak dapat dihasilkan oleh interferensi film tipis, dibakar ke albedo)
      const grad = ht.createLinearGradient(0, 0, W, H);
      const cols = ['#ff5f6d', '#ffb35c', '#f7f95c', '#5cf28a', '#5cc8f7', '#7a6df7', '#c95cf2', '#ff5f9e'];
      const CYC = 3; // Seluruh atlas dilapisi 3 putaran spektrum secara diagonal: satu panel juga dapat mencakup sekitar satu putaran warna lengkap
      for (let k = 0; k < CYC; k++) cols.forEach((c, i) => grad.addColorStop((k + i / (cols.length - 1)) / CYC, c));
      ht.globalAlpha = rb; ht.fillStyle = grad; ht.fillRect(0, 0, W, H); ht.globalAlpha = 1;
    }
    maskDraw(colorC, holoTone, holoC);
  }

  // —— metalness: R=mask iridescence, G=ketebalan film (255=batas atas Range, sama dengan perilaku tanpa peta ketebalan), B=metalness ——
  // Tiga saluran dikemas dalam satu tekstur (three.js mengambil sampel per saluran), menghemat satu unit tekstur untuk iridescence (batas perangkat keras nyata 16)
  const metalBase = Math.max(0, Math.min(1, paper.metalBase || 0));
  const metalC = mk(W, H), mc = metalC.getContext('2d');
  const mv = Math.round(metalBase * 255);
  mc.fillStyle = 'rgb(' + mv + ',255,' + mv + ')'; mc.fillRect(0, 0, W, H);
  if (anyFoil) {
    const full = mk(W, H), fg0 = full.getContext('2d');
    fg0.fillStyle = '#fff'; fg0.fillRect(0, 0, W, H);
    if (hasFoil) maskDraw(metalC, full, foilC);
    if (hasSilver) maskDraw(metalC, full, silverC);
  }
  if (hasHolo) {
    const hb = mk(W, H), hg = hb.getContext('2d');
    hg.fillStyle = 'rgb(255,255,216)'; hg.fillRect(0, 0, W, H); // R=255 iridescence penuh, B=0.85 metal (menyisakan pantulan difus untuk mencegah hitam mati)
    maskDraw(metalC, hb, holoC);
    const noiseG = mk(W, H), ng = noiseG.getContext('2d'); // Hanya saluran G yang disuntikkan derau ketebalan film: R/B dipertahankan
    ng.fillStyle = 'rgb(255,0,255)'; ng.fillRect(0, 0, W, H);
    ng.globalCompositeOperation = 'lighten'; ng.drawImage(lowFreqNoise(W, H), 0, 0);
    maskMultiply(metalC, noiseG, holoC);
  }

  // —— Tinggi emboss: abu-abu netral adalah nol, putih timbul hitam cekung; lapisan atas menutupi area yang tumpang tindih ——
  const embSharpness = Math.max(0, Math.min(1, Number.isFinite(+o.embSharpness) ? +o.embSharpness : 0.85));
  const emb = composeEmbossChannels({ layers: vis.filter(l => l.finish === 'emboss'), panels, W, H, S, ox, oy, fallbackDir: embDir, blurPx: (1 - embSharpness) * Math.max(2, S * 0.4) });
  const dispC = emb.signed, embBlur = emb.any, hasEmb = emb.hasEmb;

  // —— Bidang tinggi: serat kertas (overlay mikro) + emboss ——
  const paperH = mk(W, H), ph = paperH.getContext('2d');
  ph.fillStyle = '#808080'; ph.fillRect(0, 0, W, H);
  ph.save(); ph.globalAlpha = Math.min(1, grainStrength); tileDraw(ph, paperHeightTile(paper.grain), S, grainScale, W, H, 'overlay'); ph.restore();
  const fullH = mk(W, H), fh = fullH.getContext('2d');
  fh.drawImage(paperH, 0, 0);
  if (hasEmb) {
    fh.save();
    fh.globalCompositeOperation = 'overlay'; fh.globalAlpha = 0.9; fh.drawImage(dispC, 0, 0);
    fh.restore();
  }
  const boost = embBoost ? 3 : 1;
  const paperNormalStrength = 0.45 + grainStrength * 1.2;
  const normalPaper = normalFromHeight(paperH, paperNormalStrength);
  const normalFull = normalFromHeight(fullH, paperNormalStrength + (hasEmb ? embDepth * 9 * boost : 0));

  // —— roughness: nilai dasar substrat; area pemolesan emboss dikurangi; area foil (emas/perak disatukan) foilRoughness ——
  const roughC = mk(W, H), rc = roughC.getContext('2d');
  const rv = 255;
  rc.fillStyle = 'rgb(' + rv + ',' + rv + ',' + rv + ')'; rc.fillRect(0, 0, W, H);
  if (hasEmb) {
    const smooth = mk(W, H), sg = smooth.getContext('2d');
    const sv = 190;
    sg.fillStyle = 'rgb(' + sv + ',' + sv + ',' + sv + ')'; sg.fillRect(0, 0, W, H);
    maskDraw(roughC, smooth, embBlur);
  }
  if (hasGloss) {
    const glossR = mk(W, H), gg = glossR.getContext('2d');
    const gv = Math.round(Math.min(0.5, Math.max(0.02, Number.isFinite(+o.glossRoughness) ? +o.glossRoughness : 0.08)) * 255);
    gg.fillStyle = 'rgb(' + gv + ',' + gv + ',' + gv + ')'; gg.fillRect(0, 0, W, H);
    maskDraw(roughC, glossR, glossC);
  }
  if (anyFoil) {
    const foilR = mk(W, H), fg = foilR.getContext('2d');
    const fv = Math.round(Math.min(1, Math.max(0, Number.isFinite(+o.foilRoughness) ? +o.foilRoughness : 0.22)) * 255);
    fg.fillStyle = 'rgb(' + fv + ',' + fv + ',' + fv + ')'; fg.fillRect(0, 0, W, H);
    if (hasFoil) maskDraw(roughC, foilR, foilC);
    if (hasSilver) maskDraw(roughC, foilR, silverC);
  }
  if (hasHolo) { // Area laser dengan kekasaran rendah (foil iridescent mendekati cermin)
    const holoR = mk(W, H), hg = holoR.getContext('2d');
    hg.fillStyle = 'rgb(38,38,38)'; hg.fillRect(0, 0, W, H); // 0.15
    maskDraw(roughC, holoR, holoC);
  }

  // —— clearcoat: nilai dasar laminasi film (didorong map) + area UV parsial ——
  const ccC = mk(W, H), ccRC = mk(W, H);
  paintFilmChannels({ ccC, ccRC, maskUv: uvC, hasSuv }, filmId, o);

  // —— Papan catur UV (20mm/kotak, memeriksa kepadatan dan peregangan tekstur) ——
  const checkerC = mk(W, H), ch = checkerC.getContext('2d');
  ch.fillStyle = '#efeadd'; ch.fillRect(0, 0, W, H);
  ch.fillStyle = '#cfc8b8';
  const step = 20 * S;
  for (let y = 0, r = 0; y < H; y += step, r++) for (let x = (r % 2) * step; x < W; x += 2 * step) ch.fillRect(x, y, step, step);
  ch.strokeStyle = '#c9542e'; ch.lineWidth = Math.max(2, S * 0.5); ch.strokeRect(0, 0, W, H);

  return {
    colorC, normalPaper, normalFull, roughC, metalC, ccC, ccRC, dispC, checkerC,
    maskFoil: foilC, maskSilver: silverC, maskUv: uvC, maskGloss: glossC, maskHolo: holoC, maskEmbUp: emb.up, maskEmbDown: emb.down,
    hasFoil: anyFoil, hasSilver, hasSuv, hasGloss, hasEmb, hasHolo, hasEmbUp: emb.hasUp, hasEmbDown: emb.hasDown, S, W, H,
    // UV harus dinormalisasi sesuai kanvas bake sebenarnya (termasuk perluasan bleed dan pembulatan piksel); jika masih menggunakan sbb asli,
    // tepi panel 3D akan mengambil warna dasar kertas di dalam kanvas bleed, tampak sebagai kebocoran putih/hitam di satu atau tiga sisi.
    atlasSbb: [ox, oy, ox + W / S, oy + H / S],
    innerUV: [0.5 / W, 1 - 0.5 / H]   // Sudut atlas (di luar area bleed) = warna kertas bersih, untuk dinding bagian dalam panel
  };
}
