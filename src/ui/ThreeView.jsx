// Tampilan 3D: Kontrol pelipatan / Substrat laminasi / Sampel finishing / Parameter emboss + Parameter PBR dan penjelasan saluran
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { store, useStore } from '../state/store.js';
import { TPLS } from '../dieline/templates.js';
import { embDirOf } from '../design/emboss.js';
import { BoxPreview, boxPreviewContextOf } from '../render3d/BoxPreview.jsx';
import { STAGES } from '../render3d/stage.js';
import { PAPER_PRESETS, FILM_PRESETS, paperPreset, filmPreset } from '../render3d/presets.js';
import { SCENE_PRESETS, scenePreset, rigToStorePatch } from '../render3d/rig.js';
import { ST, Block, Toggle, ToggleRow, Note, selectSt, btnSt, inputSt, captureThumb, Range, ColorRow } from './widgets.jsx';

export function ThreeView() {
  const s = useStore();
  const m = store.mat();
  const t = m.t;
  const pf = useRef(null);
  const engRef = useRef(null);
  const [foldPlaying, setFoldPlaying] = useState(false);
  const tplName = (TPLS.find(x => x.id === s.tpl) || TPLS[0]).name;
  const finCount = f => s.layers.filter(l => l.finish === f).length;
  const embCount = dir => s.layers.filter(l => l.finish === 'emboss' && embDirOf(l, s.embDir) === dir).length;
  const finSummary = 'Layer finishing: Foil×' + (finCount('foil') + finCount('silver')) + ' · Spot UV×' + finCount('uv') + ' · Glossy×' + finCount('gloss') + ' · Holografis×' + finCount('holo') + ' · Emboss×' + embCount('up') + ' · Deboss×' + embCount('down') + ' (dari halaman desain)';
  // Input pemanggangan (bake): bounding box seluruh lembar + semua layer (atlas mencakup semua panel, posisi layer menentukan tampilan 3D)
  const preview = boxPreviewContextOf(s, m);
  const coverKey = JSON.stringify({
    scene: [s.environment3d, s.stage3d, s.expo3d, s.lightsSpec3d, s.backgroundMode3d, s.backgroundColor3d],
    material: [s.paper3d, s.film3d, s.surfaceRoughness, s.grainStrength, s.grainScale, s.foilColor3d, s.silverColor3d, s.iridescence3d, s.holoSpan3d, s.holoRainbow3d, s.glossRoughness3d],
    camera: [s.cameraProjection3d, s.fov3d]
  });
  const clearFold = () => { clearInterval(pf.current); pf.current = null; };
  const stopFold = () => { clearFold(); setFoldPlaying(false); };
  const playFold = () => {
    clearFold(); setFoldPlaying(true); store.set({ fold: 0 });
    let v = 0;
    pf.current = setInterval(() => { v += 1.4; if (v >= 100) { v = 100; stopFold(); } store.set({ fold: v }); }, 28);
  };
  useLayoutEffect(() => { if (!s.foldFromQuery) playFold(); return clearFold; }, []);
  // Status tertutup 3D resmi sebagai sampul proyek: gunakan kembali perender saat ini, tanpa membuat adegan 3D kedua yang tersembunyi
  useEffect(() => {
    if (s.fold < 99.5 || s.check !== 'art') return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const eng = engRef.current;
      if (!eng || !eng.ready || eng._disposed) return;
      if (eng.studio && eng.studio.environmentReady) await eng.studio.environmentReady;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (cancelled) return;
      const thumbnail = captureThumb(engRef, 420);
      if (thumbnail && thumbnail !== store.get().projectThumbnail) store.set({ projectThumbnail: thumbnail });
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [s.fold, s.check, preview.bakeKey, coverKey]);
  // Handel debug: Regresi CDP langsung memeriksa mesin 3D resmi (digunakan untuk penegasan helper tidak terlihat/pemutaran kotak kembali normal)
  useEffect(() => { window.__threeEngine = engRef.current; return () => { if (window.__threeEngine === engRef.current) window.__threeEngine = null; }; }, []);
  const applyScenePreset = id => { store.set(rigToStorePatch(scenePreset(id))); };

  return (<>
    <div style={{ width: 246, flex: 'none', background: '#faf7f0', borderRight: '1px solid #ded5c4', overflowY: 'auto' }}>
      <Block>
        <ST>Tipe Kotak Saat Ini</ST>
        <div style={{ background: '#f0ebe0', border: '1px solid #e2dac9', borderRadius: 6, padding: '9px 11px', fontSize: 11.5, lineHeight: 1.6, color: '#3d3830', fontFamily: "'JetBrains Mono',monospace" }}>
          {tplName} · {m.name} t={t}<br />Dimensi Dalam {s.L} × {s.W} × {s.H}
        </div>
        <div style={{ fontSize: 10.5, color: '#8a8071', marginTop: 6 }}>Dimensi dan ketebalan kertas mengikuti pengaturan halaman "Struktur"</div>
        <div style={{ fontSize: 10.5, color: '#9a5b1f', marginTop: 4 }}>{finSummary}</div>
      </Block>
      <Block>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <ST style={{ marginBottom: 0 }}>Progres Pelipatan</ST>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, color: '#9a5b1f' }}>{Math.round(s.fold)}%</div>
        </div>
        <input type="range" min="0" max="100" value={s.fold} onPointerDown={stopFold} onKeyDown={stopFold} onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) { stopFold(); store.set({ fold: v }); } }} style={{ width: '100%', accentColor: '#9a5b1f', margin: '0 0 10px' }} />
        <div style={{ display: 'flex', gap: 7 }}>
          <button onClick={playFold} style={{ ...btnSt, flex: 1, padding: '7px 0', border: 'none', fontWeight: 700, background: '#9a5b1f', color: '#fff' }}>▶ Putar Pelipatan</button>
          <button onClick={() => { stopFold(); store.set({ fold: 0 }); }} style={{ ...btnSt, flex: 1, padding: '7px 0', color: '#5c554a' }}>Bentangkan</button>
        </div>
      </Block>
      <Block>
        <ST>Kertas / Laminasi</ST>
        <div style={{ fontSize: 10.5, color: '#8a8071', marginBottom: 3 }}>Kertas</div>
        <select aria-label="Kertas" value={s.paper3d} onChange={e => { const p = paperPreset(e.target.value); store.set({ paper3d: p.id, surfaceRoughness: p.roughness, grainStrength: p.grainStrength, grainScale: p.grainMm }); }} style={{ ...selectSt, marginBottom: 8 }}>
          {PAPER_PRESETS.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <div style={{ fontSize: 10.5, color: '#8a8071', marginBottom: 3 }}>Laminasi</div>
        <select aria-label="Laminasi" value={s.film3d} onChange={e => { const f = filmPreset(e.target.value); store.set({ film3d: f.id, filmClearcoat3d: f.clearcoat, filmClearcoatRoughness3d: f.clearcoatRoughness, filmRoughnessFactor3d: f.roughnessFactor, filmSheen3d: f.sheen }); }} style={{ ...selectSt, marginBottom: 9 }}>
          {FILM_PRESETS.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        {[["Kekasaran Permukaan", 'surfaceRoughness', 12, 100, Math.round(s.surfaceRoughness * 100)], ["Kekuatan Serat Kertas", 'grainStrength', 0, 120, Math.round(s.grainStrength * 100)], ["Skala Butiran", 'grainScale', 3, 20, s.grainScale]].map(row => <div key={row[1]} style={{ marginTop: 7 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: '#8a8071', marginBottom: 3 }}><span>{row[0]}</span><span style={{ fontFamily: "'JetBrains Mono',monospace", color: '#9a5b1f' }}>{row[1] === 'grainScale' ? row[4] + 'mm' : row[4] + '%'}</span></div>
          <input aria-label={row[0]} type="range" min={row[2]} max={row[3]} value={row[4]} onChange={e => store.set({ [row[1]]: row[1] === 'grainScale' ? +e.target.value : +e.target.value / 100 })} style={{ width: '100%', accentColor: '#9a5b1f', margin: 0 }} />
        </div>)}
        <div style={{ fontSize: 10.5, color: '#a59a85', lineHeight: 1.55, marginTop: 8 }}>Hanya mengubah tampilan 3D, tidak mengubah ketebalan kertas dan kompensasi pisau di halaman "Struktur".</div>
      </Block>
      <Block>
        <ST style={{ marginBottom: 6 }}>Sampel Finishing · Pemeriksaan</ST>
        {[['foil', 'Layer Foil Emas'], ['suv', 'Layer Spot UV'], ['gloss', 'Layer Glossy'], ['emb', 'Layer Emboss'], ['holo', 'Layer Holografis']].map(x => (
          <ToggleRow key={x[0]} label={x[1]} on={x[0] === 'gloss' || x[0] === 'holo' ? s.fx[x[0]] !== false : s.fx[x[0]]} onClick={() => store.set(st => ({ fx: { ...st.fx, [x[0]]: !(x[0] === 'gloss' || x[0] === 'holo' ? st.fx[x[0]] !== false : st.fx[x[0]]) } }))} />
        ))}
        <Range label="Kekasaran Glossy" value={s.glossRoughness3d} min={0.02} max={0.5} step={0.01} onChange={v => store.set({ glossRoughness3d: v })} />
        <div style={{ marginTop: 4, fontSize: 10, color: '#a59a85' }}>Semakin rendah nilainya, semakin terkonsentrasi dan jernih pantulan glossy.</div>
        <Range label="Intensitas Holografis" value={s.iridescence3d} min={0} max={1} step={0.01} onChange={v => store.set({ iridescence3d: v })} />
        <Range label="Rentang Warna Holografis" value={s.holoSpan3d} min={0} max={1} step={0.01} onChange={v => store.set({ holoSpan3d: v })} />
        <Range label="Pola Dasar Pelangi Holografis" value={s.holoRainbow3d} min={0} max={1} step={0.01} onChange={v => store.set({ holoRainbow3d: v })} />
        <ColorRow label="Warna Dasar Holografis (Polos=perak putih, ubah warna=foil holografis berwarna)" value={s.holoColor3d} onChange={v => store.set({ holoColor3d: v })} />
        <div style={{ marginTop: 4, fontSize: 10, color: '#a59a85' }}>Holografis (iridescent) berlaku pada layer holografis dan lapisan foil; warna interferensi pelangi yang berubah sesuai sudut pandang. Semakin lebar rentangnya, semakin luas sapuan rona; pola pelangi memanggang gradien spektrum penuh ke permukaan kertas (efek karton holografis polos).</div>
        <ToggleRow label="Putar Otomatis" on={s.spin} onClick={() => store.set(st => ({ spin: !st.spin }))} />
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 10.5, color: '#8a8071', marginBottom: 3 }}>Mode Pemeriksaan</div>
          <select value={s.check} onChange={e => store.set({ check: e.target.value })} style={selectSt}>
            <option value="art">Karya Berwarna (Efek Lengkap)</option>
            <option value="foil">Pelat Foil · Saluran R</option>
            <option value="suv">Pelat Spot UV · Saluran G</option>
            <option value="gloss">Saluran Pantulan Glossy</option>
            <option value="holo">Pelat Holografis · Saluran Iridescent</option>
            <option value="emb">Tinggi Emboss · Putih Timbul / Hitam Tenggelam</option>
            <option value="checker">Papan Catur UV · 20mm/kotak</option>
          </select>
        </div>
      </Block>
      <Block>
        <ST>Studio dan Lantai</ST>
        <div style={{ fontSize: 10.5, color: '#8a8071', marginBottom: 3 }}>Efek Studio</div>
        <select aria-label="Efek Studio" value={s.studio3d} onChange={e => applyScenePreset(e.target.value)} style={{ ...selectSt, marginBottom: 8 }}>
          {SCENE_PRESETS.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <div style={{ fontSize: 10.5, color: '#8a8071', marginBottom: 3 }}>Proyeksi Kamera</div>
        <select aria-label="Proyeksi Kamera" value={s.cameraProjection3d || 'perspective'} onChange={e => store.set({ cameraProjection3d: e.target.value })} style={{ ...selectSt, marginBottom: 8 }}>
          <option value="perspective">Lensa Perspektif</option>
          <option value="orthographic">Ortografi · Isometrik</option>
        </select>
        <div style={{ fontSize: 10.5, color: '#8a8071', marginBottom: 3 }}>Adegan Lantai</div>
        <select value={s.stage3d} onChange={e => store.set({ stage3d: e.target.value })} style={{ ...selectSt, marginBottom: 8 }}>
          {STAGES.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
        </select>
        <div style={{ fontSize: 10.5, color: '#a59a85', lineHeight: 1.6 }}>Efek studio digunakan untuk pemeriksaan cepat; adegan lantai dapat diubah secara independen. Parameter teknis hanya ditampilkan pada menu pengujian pengembang.</div>
      </Block>
      <Block>
        <ST>Parameter Emboss</ST>
        <div style={{ fontSize: 10.5, color: '#8a8071', lineHeight: 1.6, marginBottom: 7 }}>Arah di bawah hanya sebagai cadangan untuk layer lama tanpa embDir; untuk layer baru silakan atur secara terpisah di halaman "Desain".</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 9 }}>
          <button onClick={() => store.set({ embDir: 'up' })} style={{ ...btnSt, flex: 1, background: s.embDir === 'up' ? '#9a5b1f' : '#fff', color: s.embDir === 'up' ? '#fff' : '#5c554a' }}>Emboss ▲</button>
          <button onClick={() => store.set({ embDir: 'down' })} style={{ ...btnSt, flex: 1, background: s.embDir === 'down' ? '#9a5b1f' : '#fff', color: s.embDir === 'down' ? '#fff' : '#5c554a' }}>Deboss ▼</button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 8 }}>
          <div style={{ flex: 1 }}><div style={{ fontSize: 10.5, color: '#8a8071', marginBottom: 3 }}>Kedalaman mm</div><input type="number" step="0.05" min="0.05" max="1.5" value={s.embDepth} onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) store.set({ embDepth: Math.min(1.5, Math.max(0.05, Math.round(v * 100) / 100)) }); }} style={inputSt} /></div>
          <div style={{ flex: 1.3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6 }}>
            <span style={{ fontSize: 12, color: '#3d3830' }}>×3 Peningkatan Pratinjau</span>
            <Toggle on={s.embBoost} onClick={() => store.set(st => ({ embBoost: !st.embBoost }))} />
          </div>
        </div>
        <Range label="Ketajaman Detail" value={s.embSharpness3d} min={0} max={1} step={0.05} onChange={v => store.set({ embSharpness3d: v })} />
        <Range label="Detail Normal" value={s.embNormalStrength3d} min={0} max={3} step={0.05} onChange={v => store.set({ embNormalStrength3d: v })} />
        <Range label="Pergeseran Geometri" value={s.embDisplacementStrength3d} min={0} max={2} step={0.05} onChange={v => store.set({ embDisplacementStrength3d: v })} />
        <div style={{ marginTop: 9, fontSize: 10.5, lineHeight: 1.6, color: '#a59a85' }}>Saran emboss halus: ketajaman 0.8–1, normal 1–2, pergeseran 0–0.4; kedalaman karton biasanya 0.15–0.4mm. Separasi produksi tetap menjaga gambar asli, tidak terpengaruh oleh parameter 3D ini.</div>
      </Block>
      <div style={{ padding: 14 }}>
        <Note><b style={{ color: '#211d18' }}>Pemetaan UV</b> — Diagram bentang dipetakan 1:1 dengan 3D; kotak catur 20mm/kotak, digunakan untuk memeriksa kerapatan dan peregangan tekstur. Tekstur finishing dipanggang sesuai posisi layer di halaman desain.</Note>
      </div>
    </div>

    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 38%, #efe9db 0%, #ddd4c0 65%, #cfc4ab 100%)' }}>
      <BoxPreview s={s} m={m} context={preview} fitFold={foldPlaying} engineRef={engRef} />
      <div style={{ position: 'absolute', left: 12, bottom: 12, background: 'rgba(250,247,240,0.92)', border: '1px solid #ded5c4', borderRadius: 6, padding: '6px 12px', fontSize: 11, color: '#5c554a', whiteSpace: 'nowrap' }} title="Pilih mode di kiri atas lalu seret dengan klik kiri; roda gulir untuk zoom; klik dua kali untuk menyesuaikan">Roda gulir zoom · Klik dua kali sesuaikan</div>
    </div>
  </>);
}
