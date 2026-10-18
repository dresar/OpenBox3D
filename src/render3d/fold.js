// Pohon lipat: geometri panel (panel persegi panjang = BoxGeometry subdivisi tinggi, panel bentuk khusus = ExtrudeGeometry) + pemetaan ulang UV atlas bentangan
// Setiap panel ditandai dengan uvRect (koordinat garis potong 2D mm) + attach (tepi bersebelahan dengan panel induk di 2D),
// buildNode mengakumulasi rotZ (0/90/180/270), otomatis menghitung flip sesuai aturan - orientasi manual nol untuk panel utama
import * as THREE from 'three';
import { discBbox } from '../dieline/templates.js';

const deg = d => d * Math.PI / 180;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Normalisasi: (up,vp) = f(un,vn, rotZ)
function normUV(un, vn, rotZ) {
  if (rotZ === 0) return [un, vn];
  if (rotZ === 90) return [1 - vn, un];
  if (rotZ === 180) return [1 - un, 1 - vn];
  return [vn, 1 - un]; // 270
}
// Arah pertumbuhan keluar panel di bawah rotZ akumulatif (dalam sistem ternormalisasi): far tetap, near +180, xmin +90, xmax +270
// Catatan: sistem pg +y = sistem 2D -y (tutup sisip atas 2D berada di atas panel induk, sayap far 3D di sisi +y panel induk), maka v dipetakan menjadi (1-vp)
const OUT = { 0: '+v', 90: '-u', 180: '-v', 270: '+u' };
function flipOf(rotZ, attach) {
  if (!attach) return '';
  const d = OUT[rotZ];
  let f = '';
  if ((d === '+v' && attach === 'b') || (d === '-v' && attach === 't')) f += 'v';
  if ((d === '+u' && attach === 'l') || (d === '-u' && attach === 'r')) f += 'u';
  return f;
}
const ROTADD = { far: 0, near: 180, xmin: 90, xmax: 270 };
const rectPt = (uvRect, up, vp) => [uvRect[0] + up * uvRect[2], uvRect[1] + (1 - vp) * uvRect[3]];

// Penulisan ulang UV permukaan atas panel: vertex (lokal x,y) → ternormalisasi (rotZ) → flip → uvRect → UV atlas; permukaan dalam → sudut warna kertas
function retopUV(geo, lx, ly, rotZ, flip, uvRect, sbb, innerUV, faceZ) {
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  const sw = sbb[2] - sbb[0], sh = sbb[3] - sbb[1];
  const map = i => {
    let [up, vp] = normUV(pos.getX(i) / lx, pos.getY(i) / ly, rotZ);
    if (flip.includes('u')) up = 1 - up;
    if (flip.includes('v')) vp = 1 - vp;
    const [x2, y2] = rectPt(uvRect, up, vp);
    uv.setXY(i, (x2 - sbb[0]) / sw, 1 - (y2 - sbb[1]) / sh);
  };
  if (geo.groups && geo.groups.length) {
    // ExtrudeGeometry: group0 = permukaan atas/bawah (z=faceZ adalah sisi luar), group1 = sisi samping (tetap)
    const g0 = geo.groups[0];
    for (let i = g0.start; i < g0.start + g0.count; i++) {
      if (Math.abs(pos.getZ(i) - faceZ) < 1e-6) map(i);
      else uv.setXY(i, innerUV[0], innerUV[1]);
    }
  }
  uv.needsUpdate = true;
}

// BoxGeometry (panel persegi panjang): permukaan pz = sisi luar (pemetaan ulang + subdivisi tinggi untuk pergeseran emboss), nz/sisi samping = warna kertas/inti kertas
function boxUV(geo, lx, ly, t, rotZ, flip, uvRect, sbb, innerUV) {
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  const sw = sbb[2] - sbb[0], sh = sbb[3] - sbb[1];
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    if (Math.abs(z - t) < 1e-6) {
      let [up, vp] = normUV(pos.getX(i) / lx, pos.getY(i) / ly, rotZ);
      if (flip.includes('u')) up = 1 - up;
      if (flip.includes('v')) vp = 1 - vp;
      const [x2, y2] = rectPt(uvRect, up, vp);
      uv.setXY(i, (x2 - sbb[0]) / sw, 1 - (y2 - sbb[1]) / sh);
    } else uv.setXY(i, innerUV[0], innerUV[1]);
  }
  uv.needsUpdate = true;
  // Grup material: sisi samping px,nx,py,ny=1(core); pz,nz=0(face)
  geo.groups.forEach((g, gi) => { g.materialIndex = gi >= 4 ? 0 : 1; });
}

function shapeOf(T, kind, len, out, n) {
  const S = new T.Shape();
  const q = (cx, cy, x, y) => S.quadraticCurveTo(cx, cy, x, y);
  if (kind === 'disc') {
    // Tutup poligon beraturan N sisi: tepi sambungan (0,0)-(len,0), busur cembung +y
    const N = n || 24, e = 2 * Math.PI / N;
    const a = len / (2 * Math.tan(Math.PI / N)), Rp = len / (2 * Math.sin(Math.PI / N));
    const cx = len / 2, cy = a, base = Math.atan2(-a, -len / 2);
    S.moveTo(0, 0); S.lineTo(len, 0);
    for (let k = 2; k < N; k++) S.lineTo(cx + Rp * Math.cos(base + k * e), cy + Rp * Math.sin(base + k * e));
    S.closePath();
  } else if (kind === 'dust') {
    const i = Math.min(6, len * 0.12), d5 = Math.min(5, out * 0.3);
    S.moveTo(i * 0.25, 0); S.lineTo(i * 0.6, out - d5); S.lineTo(i * 1.5, out);
    S.lineTo(len - i * 1.5, out); S.lineTo(len - i * 0.6, d5); S.lineTo(len - i * 0.25, 0);
  } else if (kind === 'tuck') {
    const sh = Math.min(5, len * 0.12), rr = Math.min(3.5, out * 0.4);
    S.moveTo(1, 0); S.lineTo(sh, 2); S.lineTo(sh, out - rr); q(sh, out, sh + rr, out);
    S.lineTo(len - sh - rr, out); q(len - sh, out, len - sh, out - rr); S.lineTo(len - sh, 2); S.lineTo(len - 1, 0);
  } else if (kind === 'glue') {
    S.moveTo(0, 0); S.lineTo(len, 0); S.lineTo(len - 5, out); S.lineTo(5, out);
  } else if (kind === 'ear') {
    const rr = Math.min(6, out * 0.4);
    S.moveTo(0.5, 0); S.lineTo(len - 0.5, 0); S.lineTo(len - 0.5, out - rr);
    q(len - 0.5, out, len - 0.5 - rr, out); S.lineTo(2, out); S.lineTo(0.5, out - 2);
  } else if (kind === 'lid') {
    S.moveTo(0, 0); S.lineTo(len, 0); S.lineTo(len, out); S.lineTo(0, out); // Tutup persegi (sejak 2026-08, sinkron dengan flapLid 2D tanpa lekukan 1mm)
  } else {
    S.moveTo(0, 0); S.lineTo(len, 0); S.lineTo(len, out); S.lineTo(0, out);
  }
  return S;
}

export class Folder {
  constructor(T, sbb, innerUV) {
    this.T = T; this.sbb = sbb; this.innerUV = innerUV || [0.0002, 0.9998];
    this.hasEmb = false; // Diatur oleh engine sebelum build: subdivisi tinggi untuk panel emboss
  }
  edgeFrame(lx, ly, edge) {
    if (edge === 'far') return { px: 0, py: ly, rz: 0, len: lx };
    if (edge === 'near') return { px: lx, py: 0, rz: Math.PI, len: lx };
    if (edge === 'xmax') return { px: lx, py: ly, rz: -Math.PI / 2, len: ly };
    return { px: 0, py: 0, rz: Math.PI / 2, len: ly }; // xmin
  }
  panelMesh(kind, len, out, rotZ, flip, uvRect) {
    const T = this.T, t = this._t;
    let geo;
    if (kind === 'rect') {
      // Subdivisi tinggi saat emboss (permukaan atas memuat perpindahan); segmen mengikuti ukuran panel
      const seg = this.hasEmb ? Math.max(40, Math.min(240, Math.round(len * 2.2))) : 1;
      const segY = this.hasEmb ? Math.max(40, Math.min(240, Math.round(out * 2.2))) : 1;
      geo = new T.BoxGeometry(len, out, t, seg, segY, 1);
      geo.translate(len / 2, out / 2, t / 2);
      boxUV(geo, len, out, t, rotZ, flip, uvRect, this.sbb, this.innerUV);
    } else {
      geo = new T.ExtrudeGeometry(shapeOf(T, kind, len, out, this._shapeN), { depth: t, bevelEnabled: false, curveSegments: 6 });
      retopUV(geo, len, out, rotZ, flip, uvRect, this.sbb, this.innerUV, t);
    }
    const m = new T.Mesh(geo, [this.faceMat, this.coreMat]);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  buildNode(parentGroup, parentDims, spec, depth, pc, rotZ) {
    const T = this.T;
    if (depth === 0) {
      const rz = spec.uvRot || 0;
      const rootMesh = this.panelMesh('rect', spec.lx, spec.ly, rz, flipOf(rz, spec.attach), spec.uv);
      rootMesh.userData.panel = { panelId: spec.panelId, role: spec.role, surface: spec.surface, up: spec.up, heroRegion: spec.heroRegion };
      parentGroup.add(rootMesh);
      for (const kid of (spec.kids || [])) this.buildNode(parentGroup, spec, kid, 1, pc, rz);
      return;
    }
    const f = this.edgeFrame(parentDims.lx, parentDims.ly, spec.edge);
    const rz = (rotZ + ROTADD[spec.edge]) % 360;
    const g = new T.Group(); g.position.set(f.px, f.py, 0); g.rotation.z = f.rz;
    const fg = new T.Group(); g.add(fg);
    this._shapeN = spec.n || null;
    const mesh = this.panelMesh(spec.shape || 'rect', f.len, spec.out, rz, flipOf(rz, spec.attach), spec.uv);
    mesh.userData.panel = { panelId: spec.panelId, role: spec.role, surface: spec.surface, up: spec.up, heroRegion: spec.heroRegion };
    this._shapeN = null;
    // Penumpukan lapisan kertas: panel sayap menyusut ke dalam sepanjang normal untuk menghilangkan z-fighting koplanar setelah ditutup
    const zoff = { glue: -1.05, dust: -0.62, ear: -0.62, tuck: -0.55 }[spec.shape] || 0;
    if (zoff) mesh.position.z = zoff * this._t;
    fg.add(mesh);
    parentGroup.add(g);
    this.nodes.push({ fg, depth, angle: deg(spec.angle == null ? 90 : spec.angle), sign: pc.sign });
    const dims = { lx: f.len, ly: spec.out };
    for (const kid of (spec.kids || [])) this.buildNode(fg, dims, kid, depth + 1, pc, rz);
  }

  build(pieces, t, faceMat, coreMat) {
    const T = this.T;
    this._t = t; this.faceMat = faceMat; this.coreMat = coreMat;
    this.nodes = [];
    const root = new T.Group();
    for (const pc of pieces) {
      const pg = new T.Group();
      pg.rotation.x = -Math.PI / 2;           // Bentangan XY → lantai, +z → atas dunia
      pg.position.set(0, 0.5, 0);
      pc.pg = pg;
      const pv = new T.Group();
      pv.position.set(pc.off[0], 0, pc.off[1]);
      pv.add(pg); pc.pivot = pv;
      this.buildNode(pg, null, pc.tree, 0, pc, 0);
      root.add(pv);
    }
    this.maxDepth = Math.max(1, ...this.nodes.map(n => n.depth));
    return root;
  }

  applyFold(pieces, fold) {
    const k = clamp(fold / 100, 0, 1);
    const hasAsm = (pieces || []).some(pc => pc.asm);
    const ss = v => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
    const kF = hasAsm ? clamp(k / 0.68, 0, 1) : k;
    const kA = hasAsm ? clamp((k - 0.7) / 0.3, 0, 1) : 0;
    const ke = ss(kF);
    // Pembalikan (flip): pola kotak yang selalu melipat ke sisi warna kertas (sign=-1) akan menggantung di bawah bidang setelah terlipat,
    // diputar 180° mengelilingi sumbu x dunia hingga tegak - setara dengan stand pada rte; jeda menghindari akhir pelipatan dan perakitan
    const flipWin = hasAsm ? [0.7, 0.85] : [0.85, 1];
    const kFlip = ss(clamp((k - flipWin[0]) / (flipWin[1] - flipWin[0]), 0, 1));
    const D = this.maxDepth || 1;
    for (const n of this.nodes) {
      const kd = clamp(kF * D - (D - n.depth), 0, 1);
      const e = kd * kd * (3 - 2 * kd);
      n.fg.rotation.x = n.sign * e * n.angle;
    }
    for (const pc of (pieces || [])) {
      // Gaya angkat: mengangkat bidang dari lantai selama periode pelipatan (kotak yang menggantung tidak menembus lantai), ditarik kembali pada tahap pembalikan/perakitan
      const liftK = pc.flip ? ke * (1 - kFlip) : pc.asm && pc.sign < 0 ? ke * (1 - kA) : ke;
      pc.pg.position.y = 0.5 + (pc.sign < 0 ? liftK * (pc.lift || 0) : 0);
      // Pembalikan (flip): memutar tegak kotak yang menggantung di sekitar sumbu x dunia - pg.rotation.x berputar mulus dari -π/2 ke +π/2,
      // setara dengan melipat sisi cetak ke bawah (fisika pelipatan nyata: panel dinding yang berlawanan berorientasi terbalik), tanpa pembalikan sumbu y (agar teks panel dinding tidak terbalik)
      pc.pg.rotation.x = -Math.PI / 2 + (pc.flip ? Math.PI * kFlip : 0);
      const pv = pc.pivot; if (!pv) continue;
      // Setelah pembalikan di sumbu x, jejak z dunia bergeser ly, dikembalikan ke posisi semula
      pv.position.set(pc.off[0], 0, pc.off[1] - (pc.flip ? pc.tree.ly * kFlip : 0)); pv.rotation.set(0, 0, 0);
      if (pc.stand) {
        const kS2 = ss(clamp((k - 0.85) / 0.15, 0, 1));
        pv.rotation.x = Math.PI / 2 * kS2;
      }
      if (!pc.asm || kA <= 0) continue;
      const { L, W, H, t } = this._dims;
      // Pasangan dua bagian: beri celah perakitan 0.35mm di mana tutup/sarung koplanar dengan badan kotak
      if (pc.asm.type === 'lid') {
        const hh = pc.asm.hh, L2 = pc.asm.lx, W2 = pc.asm.ly;
        const kH = ss(kA / 0.6), kV = ss((kA - 0.6) / 0.4);
        const tx = -(L2 - L) / 2;
        const hover = H + hh + 16;
        // sign=-1 setelah pelipatan bukaan tutup sudah menghadap ke bawah, langsung digeser ke atas badan kotak lalu turun (tanpa pembalikan: jejak z tidak lagi dicerminkan,
        // rentang z tutup [z−W2, z], perataan tengah ke badan kotak [−W,0] memerlukan z=(W2−W)/2)
        pv.position.x = pc.off[0] + (tx - pc.off[0]) * kH;
        pv.position.z = ((W2 - W) / 2) * kH;
        pv.position.y = hover * kH - (hover - (H + t - 0.05)) * kV;
      } else if (pc.asm.type === 'drawer') {
        const kS = ss(kA);
        const target = pc.asm.d - L * 0.15;               // Kondisi akhir menyisakan 15% terbuka
        pv.position.x = pc.off[0] + (target - pc.off[0]) * kS;
        pv.position.y = (t + 0.55) * kS;
        pv.position.z = -(t + 0.35) * kS;
      }
    }
  }
}

// -- Pohon lipat pola kotak (berbagi rumus dimensi dengan gen* 2D; uv = persegi panjang koordinat garis potong 2D, attach = sisi panel induk di 2D) --
export function makePieces(tpl, L, W, H, t, glue) {
  const dh = Math.min(W * 0.75, 32), tk = Math.min(16, W * 0.55);
  if (tpl === 'rte' || tpl === 'ste') {
    const bh = H + t, lidH = W + t;
    const xs1 = W + t, xs2 = W + t + L + t, xs3 = xs2 + W + t;
    const kids = [
      {
        edge: 'xmin', out: W, uv: [0, 0, W + t, bh], attach: 'l', kids: [
          { edge: 'xmax', out: dh, shape: 'dust', uv: [0, bh, W + t, dh], attach: 'b' },
          { edge: 'xmin', out: dh, shape: 'dust', uv: [0, -dh, W + t, dh], attach: 't' },
          { edge: 'far', out: glue, shape: 'glue', uv: [-glue, 0, glue, bh], attach: 'l' }]
      },
      {
        edge: 'xmax', out: W, uv: [xs2, 0, W + t, bh], attach: 'r', kids: [
          { edge: 'xmin', out: dh, shape: 'dust', uv: [xs2, bh, W + t, dh], attach: 'b' },
          { edge: 'xmax', out: dh, shape: 'dust', uv: [xs2, -dh, W + t, dh], attach: 't' },
          {
            edge: 'far', out: L, uv: [xs3, 0, L + 2 * t, bh], attach: 'r', kids: [
              ...(tpl === 'rte' ? [{
                edge: 'xmin', out: W, shape: 'lid', uv: [xs3, -lidH, L + 2 * t, lidH], attach: 't', kids: [
                  { edge: 'far', out: tk, shape: 'tuck', angle: 100, uv: [xs3, -lidH - tk, L + 2 * t, tk], attach: 't' }]
              }] : [])
            ]
          }]
      },
      ...(tpl === 'ste' ? [{
        edge: 'far', out: W, shape: 'lid', uv: [xs1, -lidH, L + t, lidH], attach: 't', kids: [
          { edge: 'far', out: tk, shape: 'tuck', angle: 100, uv: [xs1, -lidH - tk, L + t, tk], attach: 't' }]
      }] : []),
      {
        edge: 'near', out: W, shape: 'lid', uv: [xs1, bh, L + t, lidH], attach: 'b', kids: [
          { edge: 'far', out: tk, shape: 'tuck', angle: 100, uv: [xs1, bh + lidH, L + t, tk], attach: 'b' }]
      }
    ];
    return [{ tree: { lx: L, ly: H, uv: [xs1, 0, L + t, bh], panelId: 'front', role: 'hero', surface: 'outside', up: 'top', kids }, sign: -1, lift: W, off: [0, 0], stand: true }];
  }
  if (tpl === 'mailer') {
    const tk2 = Math.min(H * 0.7, 28), dw = Math.min(H * 0.8, 26);
    const Lc = L + 2 * t, Wl = W + 3 * t, Hb = H + t, Wb = W + t, Hf = H, Sw = H + t;
    const y1 = Wl, y2 = y1 + Hb, y3 = y2 + Wb;
    const eh = Math.min(Hf - 1, Sw * 0.95);
    const tree = {
      lx: L, ly: W, uv: [0, y2, Lc, Wb], kids: [
        {
          edge: 'far', out: H, uv: [0, y1, Lc, Hb], attach: 't', kids: [{
            edge: 'far', out: W, uv: [0, 0, Lc, Wl], panelId: 'mailer-lid', role: 'hero', surface: 'outside', up: 'top', attach: 't', kids: [
              { edge: 'far', out: tk2, shape: 'tuck', angle: 100, uv: [0, -tk2, Lc, tk2], attach: 't' },
              { edge: 'xmin', out: dw, shape: 'dust', uv: [-dw, 0, dw, y1], attach: 'l' },
              { edge: 'xmax', out: dw, shape: 'dust', uv: [Lc, 0, dw, y1], attach: 'r' }]
          }]
        },
        { edge: 'near', out: H, uv: [0, y3, Lc, Hf], attach: 'b' },
        {
          edge: 'xmin', out: H, uv: [-Sw, y2, Sw, Wb], attach: 'l', kids: [
            { edge: 'xmin', out: Math.min(H * 0.9, L * 0.45), shape: 'ear', uv: [-Sw, y3, Sw, eh], attach: 'b' }]
        },
        {
          edge: 'xmax', out: H, uv: [Lc, y2, Sw, Wb], attach: 'r', kids: [
            { edge: 'xmax', out: Math.min(H * 0.9, L * 0.45), shape: 'ear', uv: [Lc, y3, Sw, eh], attach: 'b' }]
        }
      ]
    };
    return [{ tree, sign: -1, lift: H, off: [0, 0], flip: 1 }];
  }
  const tray = (Lt, Wt, hh, ox) => {
    const eo = Math.min(hh, Wt * 0.85);
    const cx1 = ox + hh, cx2 = cx1 + Lt, cy2 = hh + Wt;
    return {
      lx: Lt, ly: Wt, uv: [cx1, hh, Lt, Wt], kids: [
        {
          edge: 'far', out: hh, uv: [cx1, cy2, Lt, hh], attach: 'b', kids: [
            { edge: 'xmin', out: eo, shape: 'ear', uv: [ox, cy2, hh, hh], attach: 'l' },
            { edge: 'xmax', out: eo, shape: 'ear', uv: [cx2, cy2, hh, hh], attach: 'r' }]
        },
        {
          edge: 'near', out: hh, uv: [cx1, 0, Lt, hh], attach: 't', kids: [
            { edge: 'xmin', out: eo, shape: 'ear', uv: [ox, 0, hh, hh], attach: 'l' },
            { edge: 'xmax', out: eo, shape: 'ear', uv: [cx2, 0, hh, hh], attach: 'r' }]
        },
        { edge: 'xmin', out: hh, uv: [ox, hh, hh, Wt], attach: 'l' },
        { edge: 'xmax', out: hh, uv: [cx2, hh, hh, Wt], attach: 'r' }
      ]
    };
  };
  if (tpl === 'lidbase') {
    const hh2 = Math.max(14, H * 0.45);
    const L2 = L + 2 * t + 1, W2 = W + 2 * t + 1, D = L + 2 * H + 45;
    const ox2 = 2 * H + L + 28;
    return [
      { tree: tray(L, W, H, 0), sign: -1, lift: H, off: [0, 0], flip: 1 },
      { tree: { ...tray(L2, W2, hh2, ox2), panelId: 'lid-top', role: 'hero', surface: 'outside', up: 'top' }, sign: -1, lift: hh2, off: [D, 0], asm: { type: 'lid', hh: hh2, lx: L2, ly: W2 } }
    ];
  }
  // Kotak tabung (silinder 24 sisi / heksagonal 6 sisi): segmen dasar p0 → xmax ke p1 → far tergulung segmen demi segmen; tutup atas/bawah poligon beraturan N sisi
  if (tpl === 'cyl' || tpl === 'hex') {
    const N = tpl === 'cyl' ? 24 : 6;
    const wSeg = tpl === 'cyl' ? Math.PI * L / 24 : W;
    const bh = H + t;
    const { a, Rp, h } = discBbox(N, wSeg);
    let chain = null;
    for (let i = N - 1; i >= 1; i--) {
      chain = { edge: i === 1 ? 'xmax' : 'far', out: wSeg, angle: 360 / N, uv: [i * wSeg, 0, wSeg, bh], attach: 'r', kids: chain ? [chain] : [] };
    }
    const kids = [
      chain,
      { edge: 'far', out: h, shape: 'disc', n: N, uv: [wSeg / 2 - Rp, -(a + Rp), 2 * Rp, a + Rp], attach: 't' },
      { edge: 'near', out: h, shape: 'disc', n: N, uv: [wSeg / 2 - Rp, bh, 2 * Rp, a + Rp], attach: 'b' }
    ].filter(Boolean);
    return [{ tree: { lx: wSeg, ly: bh, uv: [0, 0, wSeg, bh], panelId: 'tube-body', role: 'hero', surface: 'outside', up: 'top', heroRegion: N === 24 ? [9 / 24, 0, 6 / 24, 1] : [3 / 6, 0, 1 / 6, 1], kids }, sign: -1, lift: Rp, off: [0, 0], stand: true }];
  }
  if (tpl !== 'drawer') throw new Error(`Model kotak tidak dikenal: ${tpl}; harap lengkapi kontrak sinkronisasi struktur dan 3D terlebih dahulu`);
  // drawer: baki kotak dalam + sarung (root uvRot=90: lx 3D membujur sepanjang pita 2D)
  const D2 = L + 2 * H + 45;
  const oxS = 2 * H + L + 28;
  const sxs1 = oxS + H + 2 * t, sxs2 = sxs1 + W + 3 * t, sxs3 = sxs2 + H + 3 * t;
  const band = L + 2;
  const sleeve = {
    lx: L, ly: W + 2 * t, uvRot: 90, uv: [sxs1, 0, W + 3 * t, band], panelId: 'sleeve-top', role: 'hero', surface: 'outside', up: 'left', kids: [{
      edge: 'far', out: H + 2 * t, uv: [oxS, 0, H + 2 * t, band], attach: 'l', kids: [{
        edge: 'far', out: W + 3 * t, uv: [sxs3, 0, W + 4 * t, band], attach: 'l', kids: [{
          edge: 'far', out: H + 3 * t, uv: [sxs2, 0, H + 3 * t, band], attach: 'l', kids: [
            { edge: 'far', out: 12, shape: 'glue', uv: [oxS - 12, 0, 12, band], attach: 'l' }]
        }]
      }]
    }]
  };
  return [
    { tree: tray(L, W, H, 0), sign: 1, lift: 0, off: [0, 0], asm: { type: 'drawer', d: D2 } },
    { tree: sleeve, sign: -1, lift: H, off: [D2, 0] }
  ];
}
