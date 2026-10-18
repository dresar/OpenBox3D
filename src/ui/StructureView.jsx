// Tampilan struktur: Galeri tipe kotak / Dimensi dalam / Material / Parameter proses / Edit tipe garis + Kanvas pisau potong tengah + Spesifikasi dan validasi kolom kanan
import React from 'react';
import { store, useStore } from '../state/store.js';
import { TPLS, MATS } from '../dieline/templates.js';
import { geomOf } from '../dieline/geom.js';
import { reflowLayersToContainers } from '../design/containers.js';
import { SheetCanvas } from './SheetCanvas.jsx';
import { ST, Block, Toggle, ToggleRow, NumField, Note, KV, selectSt, btnSt } from './widgets.jsx';

const setNum = (key, min, max) => e => {
  const v = parseFloat(e.target.value);
  if (!isNaN(v)) store.set(st => {
    const next = { ...st, [key]: Math.min(max, Math.max(min, v)) }, mat = store.mat();
    return { [key]: next[key], layers: reflowLayersToContainers(st.layers, geomOf(st, mat.t), geomOf(next, mat.t)) };
  });
};

export function StructureView() {
  const s = useStore();
  const m = store.mat();
  const g = geomOf(s, m.t);
  const fmt = v => Math.round(v * 10) / 10;
  const t = m.t;
  const sw = g.sbb[2] - g.sbb[0], sh = g.sbb[3] - g.sbb[1];
  const tkNow = Math.min(16, s.W * 0.55);
  const specTpl = {
    rte: [{ k: 'Urutan Lebar Panel', v: fmt(s.W + t) + '·' + fmt(s.L + t) + '·' + fmt(s.W + t) + '·' + fmt(s.L + 2 * t) }, { k: 'Kedalaman Tutup / Lidah Sisip', v: fmt(s.W + t) + ' / ' + fmt(tkNow) }],
    ste: [{ k: 'Urutan Lebar Panel', v: fmt(s.W + t) + '·' + fmt(s.L + t) + '·' + fmt(s.W + t) + '·' + fmt(s.L + 2 * t) }, { k: 'Kedalaman Tutup / Lidah Sisip', v: fmt(s.W + t) + ' / ' + fmt(tkNow) }],
    mailer: [{ k: 'Lebar Dinding Samping', v: fmt(s.H + t) }, { k: 'Kedalaman Lidah Sisip', v: fmt(Math.min(s.H * 0.7, 28)) }],
    lidbase: [{ k: 'Toleransi Tutup Dalam', v: '+1.0 mm/sisi' }, { k: 'Tinggi Tutup', v: fmt(Math.max(14, s.H * 0.45)) }],
    drawer: [{ k: 'Toleransi Sarung', v: '+2~4 × t' }, { k: 'Kedalaman Sarung', v: fmt(s.L + 2) }],
    cyl: [{ k: 'Diameter D', v: fmt(s.L) + ' mm' }, { k: 'Segmen', v: '24 × ' + fmt(Math.PI * s.L / 24) + ' mm' }],
    hex: [{ k: 'Panjang Sisi', v: fmt(s.W) + ' mm' }, { k: 'Diameter Luar', v: fmt(2 * s.W / (2 * Math.sin(Math.PI / 6))) + ' mm' }]
  };
  const specRows = [
    { k: 'Ukuran Bentang', v: fmt(sw) + ' × ' + fmt(sh) },
    { k: 'Termasuk Bleed', v: fmt(sw + 2 * s.bleed) + ' × ' + fmt(sh + 2 * s.bleed) },
    { k: 'Ketebalan Kertas t', v: t + ' mm' }
  ].concat(specTpl[s.tpl] || []);
  const checks = ['Kontur luar tertutup', 'Tanpa perpotongan mandiri / segmen terisolasi', 'Jarak pisau minimum ≥ 1.5 mm', 'Kedua sisi lipatan memiliki panel penghubung', 'Bleed ≥ ' + m.bleed + ' mm (' + m.note + ')'];
  const compNote = s.tpl === 'rte' || s.tpl === 'ste' ? 'Saat ini: W+t · L+t · W+t · L+2t, tinggi H+t' : s.tpl === 'mailer' ? 'Saat ini: tebal gelombang t=' + t + ', dinding samping H+t, lebar tutup W+3t' : s.tpl === 'cyl' ? 'Saat ini: diameter D=L, badan silinder 24 segmen tergulung, tutup bersegi 24' : s.tpl === 'hex' ? 'Saat ini: panjang sisi W, silinder heksagonal, tutup heksagon beraturan' : 'Saat ini: tutup/sarung toleransi +1mm/sisi';
  const editOn = s.editMode;
  const typeOvrCount = Object.keys(s.typeOvr).length;
  const selSegOk = editOn && s.selSeg != null && g.segs[s.selSeg];
  const curSegT = selSegOk ? g.segs[s.selSeg].t : '';

  return (<>
    <div style={{ width: 246, flex: 'none', background: '#faf7f0', borderRight: '1px solid #ded5c4', overflowY: 'auto' }}>
      <Block>
        <ST>Galeri Kotak</ST>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
          {TPLS.map(b => (
            <div key={b.id} onClick={() => store.set(st => { const mat = store.mat(), next = { ...st, tpl: b.id, ovr: {}, typeOvr: {} }; return { tpl: b.id, ovr: {}, typeOvr: {}, selSeg: null, fitNonce: st.fitNonce + 1, layers: reflowLayersToContainers(st.layers, geomOf(st, mat.t), geomOf(next, mat.t)) }; })}
              style={{ cursor: 'pointer', border: '1px solid ' + (s.tpl === b.id ? '#9a5b1f' : '#e2dac9'), background: s.tpl === b.id ? '#f7efe2' : '#fff', borderRadius: 6, padding: '7px 9px' }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, fontWeight: 700, color: s.tpl === b.id ? '#9a5b1f' : '#a59a85' }}>{b.code}</div>
              <div style={{ fontSize: 12, fontWeight: 600, marginTop: 1 }}>{b.name}</div>
              <div style={{ fontSize: 10, color: '#8a8071' }}>{b.sub}</div>
            </div>
          ))}
        </div>
      </Block>
      <Block>
        <ST>Dimensi Dalam · mm</ST>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 7 }}>
          <NumField label="Panjang L" value={s.L} onChange={setNum('L', 20, 600)} />
          <NumField label="Lebar W" value={s.W} onChange={setNum('W', 15, 600)} />
          <NumField label="Tinggi H" value={s.H} onChange={setNum('H', 15, 600)} />
        </div>
      </Block>
      <Block>
        <ST>Material</ST>
        <select value={s.matId} onChange={e => { const nm = MATS.find(x => x.id === e.target.value); store.set(st => { const om = MATS.find(x => x.id === st.matId) || MATS[0], next = { ...st, matId: nm.id, bleed: nm.bleed }; return { matId: nm.id, bleed: nm.bleed, layers: reflowLayersToContainers(st.layers, geomOf(st, om.t), geomOf(next, nm.t)) }; }); }} style={selectSt}>
          {MATS.map(mm => <option key={mm.id} value={mm.id}>{mm.name}</option>)}
        </select>
        <div style={{ fontSize: 11, color: '#8a8071', marginTop: 7 }}>Ketebalan t = <b style={{ color: '#9a5b1f', fontFamily: "'JetBrains Mono',monospace" }}>{t} mm</b> · {m.note}</div>
      </Block>
      <Block>
        <ST>Parameter Proses</ST>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
          <NumField label="Bleed mm" value={s.bleed} onChange={setNum('bleed', 0, 10)} />
          <NumField label="Lidah Lem mm" value={s.glue} onChange={setNum('glue', 8, 30)} />
        </div>
      </Block>
      <Block>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <ST style={{ marginBottom: 0 }}>Edit Tipe Garis</ST>
          <Toggle on={s.editMode} onClick={() => store.set(st => ({ editMode: !st.editMode, selSeg: null }))} />
        </div>
        {editOn && (<>
          <div style={{ fontSize: 11, color: '#8a8071', marginTop: 8, lineHeight: 1.6 }}>Klik segmen garis untuk beralih antara garis potong atau lipatan. Tipe garis diubah <b style={{ color: '#9a5b1f' }}>{typeOvrCount}</b> titik.</div>
          {selSegOk && (
            <div style={{ marginTop: 9, background: '#f0ebe0', border: '1px solid #e2dac9', borderRadius: 6, padding: '9px 11px' }}>
              <div style={{ fontSize: 11, color: '#6d6557', marginBottom: 7 }}>Segmen terpilih · Saat ini: {curSegT === 'cut' ? 'Garis Potong' : 'Garis Lipat'}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => store.set(st => ({ typeOvr: { ...st.typeOvr, [st.selSeg]: 'cut' } }))} style={{ ...btnSt, flex: 1, background: curSegT === 'cut' ? '#C8102E' : '#fff', color: curSegT === 'cut' ? '#fff' : '#5c554a' }}>Garis Potong</button>
                <button onClick={() => store.set(st => ({ typeOvr: { ...st.typeOvr, [st.selSeg]: 'crease' } }))} style={{ ...btnSt, flex: 1, background: curSegT === 'crease' ? '#2E7D46' : '#fff', color: curSegT === 'crease' ? '#fff' : '#5c554a' }}>Garis Lipat</button>
              </div>
            </div>
          )}
          <button onClick={() => store.set({ typeOvr: {}, selSeg: null })} style={{ ...btnSt, marginTop: 9, width: '100%', padding: '7px 0', color: '#5c554a' }}>Atur Ulang Edit Tipe Garis</button>
        </>)}
      </Block>
      <div style={{ padding: 14 }}>
        <Note><b style={{ color: '#211d18' }}>Kompensasi Ketebalan</b> — Dimensi Manufaktur = Dimensi Dalam + n × t<br />{compNote}</Note>
      </div>
    </div>

    <SheetCanvas view="structure" g={g} />

    <div style={{ width: 258, flex: 'none', background: '#faf7f0', borderLeft: '1px solid #ded5c4', overflowY: 'auto' }}>
      <Block><ST>Dimensi Manufaktur (Telah Dikompensasi)</ST>{specRows.map(r => <KV key={r.k} k={r.k} v={r.v} />)}</Block>
      <Block>
        <ST>Statistik Pisau Potong</ST>
        <KV k="Garis Potong" v={fmt(g.cutLen / 1000) + ' m · ' + g.cutN + ' segmen'} />
        <KV k="Garis Lipat" v={fmt(g.creaseLen / 1000) + ' m · ' + g.creaseN + ' segmen'} />
      </Block>
      <Block>
        <ST>Tampilan</ST>
        {[['bleed', 'Area Bleed'], ['safe', 'Area Aman'], ['dims', 'Dimensi'], ['labels', 'Nama Panel']].map(x => (
          <ToggleRow key={x[0]} label={x[1]} on={s.show[x[0]]} onClick={() => store.set(st => ({ show: { ...st.show, [x[0]]: !st.show[x[0]] } }))} />
        ))}
      </Block>
      <div style={{ padding: 14 }}>
        <ST>Validasi</ST>
        {checks.map(c => (
          <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12, color: '#3d3830' }}>
            <div style={{ width: 6, height: 6, borderRadius: 99, background: '#3f9e5f', flex: 'none' }} />{c}
          </div>
        ))}
      </div>
    </div>
  </>);
}
