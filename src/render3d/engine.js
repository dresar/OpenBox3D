// Engine 3D (versi penuh P1): Atlas UV satu lembar penuh + set tekstur PBR lengkap + rakitan material tunggal
// Foil emas (metalnessMap) × emboss (normal+displacement) ditumpuk dalam MeshPhysicalMaterial yang sama
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Folder, makePieces } from './fold.js';
import { bakeAtlas, paintFilmChannels, paintFoilRoughness } from './bake.js';
import { makeAtlasTextures, disposeTextures, applyFaceMaterial, applyCoreMaterial } from './materials.js';
import { setupStudio } from './lighting.js';
import { makeStageGround } from './stage.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const STUDIO_CONTROL_KEYS = ['environmentIntensity', 'environmentRotation', 'backgroundShown', 'backgroundMode', 'backgroundColor', 'backgroundBlur', 'domeSpec', 'shadowSoftness', 'shadowOpacity'];
const FILM_CONTROL_KEYS = ['filmClearcoat', 'filmClearcoatRoughness', 'uvClearcoat', 'uvRoughness'];
const MATERIAL_CONTROL_KEYS = ['surfaceRoughness', 'filmRoughnessFactor', 'filmSheen', 'foilMetalness', 'iridescence', 'holoSpan', 'embNormalStrength', 'embDisplacementStrength'];
const cameraTypeOf = v => v === 'orthographic' ? 'orthographic' : 'perspective';

export class BoxEngine {
  constructor(container, props = {}) {
    this.el = container;
    this.props = { ...props };
    this.ready = false;
    this._disposed = false;
    this.faceMat = new THREE.MeshPhysicalMaterial({ color: 0xf4f1e8, roughness: 0.5 });
    this.coreMat = new THREE.MeshStandardMaterial({ color: 0xd8cdb2, roughness: 0.92 });
    this.init().catch(e => {
      if (this.el) this.el.innerHTML = '<div style="padding:20px;color:#a33;font:12px sans-serif">Inisialisasi 3D gagal: ' + e.message + '</div>';
      console.error(e);
    });
  }

  // Driver eksternal: props dikirim penuh, diff internal
  update(props) {
    const prev = this.props;
    this.props = { ...props };
    if (!this.ready) return;
    const p = this.props;
    if (prev.l !== p.l || prev.w !== p.w || prev.h !== p.h || prev.t !== p.t || prev.tpl !== p.tpl || prev.glue !== p.glue || prev.sbbKey !== p.sbbKey) {
      clearTimeout(this._bt);
      this._bt = setTimeout(() => { if (this._disposed) return; this.build(); this.rebake(); this.applyFold(); this.frame(); }, 150);
    } else if (prev.bakeKey !== p.bakeKey) {
      clearTimeout(this._at);
      this._at = setTimeout(() => { if (this._disposed) return; this.rebake(); }, 150);
    }
    if (prev.fold !== p.fold) {
      this.applyFold();
      clearTimeout(this._ft);
      const fv = this.num('fold', 0);
      if (p.fitFold === '1' || fv >= 99.5) this.frame(true);
      else if (fv <= 0.5) this.frame();
    }
    if (prev.fitFold === '1' && p.fitFold !== '1' && this.num('fold', 0) < 99.5) this._fitGoal = null;
    if (prev.film !== p.film || FILM_CONTROL_KEYS.some(k => prev[k] !== p[k])) this.updateFilm();
    if (prev.foilRoughness !== p.foilRoughness) this.updateFoilRoughness();
    if (prev.check !== p.check || prev.embOn !== p.embOn || prev.embBoost !== p.embBoost || prev.embDepth !== p.embDepth || prev.film !== p.film || MATERIAL_CONTROL_KEYS.some(k => prev[k] !== p[k])) this.applyFlags();
    if (prev.environment !== p.environment && this.studio) this.studio.setEnvironment(p.environment);
    if (prev.lightsSpec !== p.lightsSpec && this.studio) { this.studio.setLights(p.lightsSpec); this.studio.updateHelpers(); }
    if (prev.lightEdit !== p.lightEdit && this.studio) this.studio.setHelpersVisible(p.lightEdit === '1');
    if (prev.selLight !== p.selLight && this.studio) this.studio.setHelperSelected(p.selLight || null);
    if (STUDIO_CONTROL_KEYS.some(k => prev[k] !== p[k])) this.applyStudioControls();
    if (prev.stage !== p.stage) this.setStage(p.stage);
    if (prev.spin !== p.spin) this.syncTurnReset();
    if (prev.exposure !== p.exposure && this.renderer) this.renderer.toneMappingExposure = this.num('exposure', 1.05);
    if (prev.toneMapping !== p.toneMapping && this.renderer) this.applyToneMapping();
    if (prev.cameraType !== p.cameraType && this.camera) this.switchCamera(cameraTypeOf(p.cameraType));
    if (prev.fov !== p.fov && this.camera && this.camera.isPerspectiveCamera) {
      this.camera.fov = clamp(this.num('fov', 35), 16, 46);
      this.camera.updateProjectionMatrix();
    }
  }
  num(n, d) { const v = parseFloat(this.props[n]); return isNaN(v) ? d : v; }

  async init() {
    const T = this.T = THREE;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, logarithmicDepthBuffer: true });
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMappingExposure = this.num('exposure', 1.02); this.applyToneMapping();
    r.shadowMap.enabled = new URLSearchParams(location.search).get('shadow') !== '0'; // ?shadow=0 debug (untuk tangkapan layar headless render perangkat lunak)
    r.shadowMap.type = THREE.PCFShadowMap; // PCF radius rendah hanya untuk antialiasing tepi; penumbra terkait jarak dihasilkan oleh sampel cahaya utama sudut terbatas
    r.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
    this.el.appendChild(r.domElement);
    this.scene = new THREE.Scene();
    this.setStudio();
    this.setStage(this.props.stage);
    this.camera = new THREE.PerspectiveCamera(clamp(this.num('fov', 35), 16, 46), 1, 1, 9000);
    this.controls = new OrbitControls(this.camera, r.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI;
    this.controls.minDistance = 15; this.controls.maxDistance = 5000;
    this.controls.screenSpacePanning = true;
    this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    this.controls.addEventListener('start', () => { this._pauseSpin = Date.now() + 4000; this._fitGoal = null; }); // Intervensi pengguna menghentikan transisi penyesuaian otomatis
    r.domElement.addEventListener('dblclick', () => this.frame());
    // Tombol sudut pandang
    const tb = document.createElement('div');
    tb.style.cssText = 'position:absolute;bottom:10px;right:10px;display:flex;gap:4px;z-index:2';
    const mkBtn = (label, fn) => {
      const b = document.createElement('button'); b.textContent = label;
      b.style.cssText = 'background:rgba(250,247,240,.92);border:1px solid #ded5c4;border-radius:5px;font:12px "Noto Sans SC",sans-serif;color:#5c554a;padding:4px 9px;cursor:pointer;white-space:nowrap';
      b.onmouseenter = () => b.style.background = '#f0e8d8';
      b.onmouseleave = () => b.style.background = 'rgba(250,247,240,.92)';
      b.onclick = fn; tb.appendChild(b);
    };
    mkBtn('Depan', () => this.setView('front')); mkBtn('Samping', () => this.setView('side'));
    mkBtn('Atas', () => this.setView('top')); mkBtn('Isometrik', () => this.setView('iso'));
    mkBtn('Paskan', () => this.frame());
    this.el.appendChild(tb);
    // Mode seret gaya C4D: Rotasi / Geser / Pindah Kotak / Putar Kotak
    const mb = document.createElement('div');
    mb.style.cssText = 'position:absolute;top:10px;left:10px;display:flex;align-items:center;z-index:2;border:1px solid #ded5c4;border-radius:6px;overflow:hidden;background:rgba(250,247,240,.92)';
    this._modeBtns = {};
    [['rotate', '○ Rotasi'], ['pan', '✚ Geser'], ['move', '▣ Pindah Kotak'], ['turn', '⟳ Putar Kotak']].forEach(pair => {
      const b = document.createElement('button'); b.textContent = pair[1];
      b.style.cssText = 'border:none;font:12px "Noto Sans SC",sans-serif;padding:5px 11px;cursor:pointer;white-space:nowrap;background:transparent;color:#5c554a';
      b.onclick = () => this.setMode(pair[0]);
      this._modeBtns[pair[0]] = b; mb.appendChild(b);
    });
    // Tegakkan: reset rotasi boxRoot ke nol setelah putar kotak; saat putar otomatis (spin), rotation.y terus digerakkan sehingga tombol dinonaktifkan
    const rb = document.createElement('button'); rb.textContent = 'Tegakkan'; rb.title = 'Kembalikan rotasi kotak ke nol (digunakan setelah mode putar kotak)';
    rb.style.cssText = 'border:none;border-left:1px solid #ded5c4;font:12px "Noto Sans SC",sans-serif;padding:5px 10px;cursor:pointer;white-space:nowrap;background:transparent;color:#5c554a';
    rb.onclick = () => { if (this.props.spin === '1' || !this.boxRoot) return; this.boxRoot.rotation.set(0, 0, 0); };
    this._turnResetBtn = rb; mb.appendChild(rb);
    this.el.appendChild(mb);
    this.syncTurnReset();
    this.setMode('rotate');
    const pick = e => {
      const rc = r.domElement.getBoundingClientRect();
      const nd = new THREE.Vector2(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
      this._ray = this._ray || new THREE.Raycaster();
      this._ray.setFromCamera(nd, this.camera);
      const pt = new THREE.Vector3();
      return this._ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), pt) ? pt : null;
    };
    r.domElement.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      this._fitGoal = null; // Intervensi pengguna (pindah kotak/putar kotak lewat cabang kustom, tidak masuk OrbitControls start): hentikan transisi penyesuaian otomatis
      if (this._mode === 'move') {
        const p = pick(e); if (!p) return;
        this._mvDrag = { p0: p, box0: this.boxRoot.position.clone(), tg0: this.controls.target.clone() };
        try { r.domElement.setPointerCapture(e.pointerId); } catch (_) { /* Pertahanan lingkungan event sintetis/CDP */ }
        this._pauseSpin = Date.now() + 4000;
      } else if (this._mode === 'turn' && this.boxRoot) {
        // Putar kotak: hanya rotasi horizontal di sekitar pusat kotak (menempel di meja, tanpa miring), hanya memutar boxRoot tanpa mempengaruhi lipatan
        this._tnDrag = { x0: e.clientX, done: 0 };
        try { r.domElement.setPointerCapture(e.pointerId); } catch (_) { /* Pertahanan lingkungan event sintetis/CDP */ }
        this._pauseSpin = Date.now() + 4000;
      }
    });
    r.domElement.addEventListener('pointermove', e => {
      if (this._tnDrag) {
        const d = this._tnDrag, total = (e.clientX - d.x0) * 0.01;
        this.turnBox(total - d.done); d.done = total; // Rotasi inkremental di sekitar pusat kotak, pivot tidak bergeser
        this._pauseSpin = Date.now() + 4000;
        return;
      }
      if (!this._mvDrag) return;
      const p = pick(e); if (!p) return;
      const d = this._mvDrag;
      const dx = p.x - d.p0.x, dz = p.z - d.p0.z;
      this.boxRoot.position.set(d.box0.x + dx, d.box0.y, d.box0.z + dz);
      this.controls.target.set(d.tg0.x + dx, d.tg0.y, d.tg0.z + dz);
      this.controls.update();
      this._pauseSpin = Date.now() + 4000;
    });
    const endMv = () => { this._mvDrag = null; this._tnDrag = null; };
    r.domElement.addEventListener('pointerup', endMv);
    r.domElement.addEventListener('pointercancel', endMv);
    // Edit visual pencahayaan P3: tahap penangkapan terpasang pada kontainer, mendahului OrbitControls - mengenai helper masuk ke seret lampu (stopPropagation menahan kamera),
    // jika meleset catat klik kandidat, pergeseran pointerup <4px dianggap klik area kosong → onLightSelect(null)
    const ndcOf = e => {
      const rc = r.domElement.getBoundingClientRect();
      return new THREE.Vector2(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
    };
    const helperAt = e => {
      if (!this.studio) return null;
      this._ray = this._ray || new THREE.Raycaster();
      this._ray.setFromCamera(ndcOf(e), this.camera);
      return this.studio.pickHelper(this._ray);
    };
    this._ndcOf = ndcOf;
    this._ltDown = e => {
      if (this._disposed || this.props.lightEdit !== '1' || e.button !== 0 || e.target !== r.domElement) return;
      const id = helperAt(e);
      if (!id) { this._ltClick = { x: e.clientX, y: e.clientY }; return; }
      e.stopPropagation(); e.preventDefault(); // Jeda OrbitControls selama seret lampu (kamera diam)
      const ang = this.studio.lightAnglesOf(id) || { azimuth: 0, elevation: 45 };
      this._ltDrag = { id, x0: e.clientX, y0: e.clientY, moved: false };
      try { r.domElement.setPointerCapture(e.pointerId); } catch (_) { /* Lingkungan event sintetis/CDP mungkin memunculkan error, seret dialihkan ke listener window */ }
      this._pauseSpin = Date.now() + 4000;
      const move = ev => this.lightDragMove(ev);
      const up = ev => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); this.lightDragEnd(); };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    };
    this._ltUp = e => {
      if (this._disposed || !this._ltClick) { this._ltClick = null; return; }
      const c = this._ltClick; this._ltClick = null;
      if (this.props.lightEdit !== '1' || e.button !== 0 || e.target !== r.domElement) return;
      if (Math.hypot(e.clientX - c.x, e.clientY - c.y) < 4 && this.props.onLightSelect) this.props.onLightSelect(null);
    };
    this.el.addEventListener('pointerdown', this._ltDown, true);
    this.el.addEventListener('pointerup', this._ltUp, true);
    this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(this.el);
    this.ready = true;
    this.resize(); this.build(); this.rebake(); this.applyFold(); this.frame();
    if (cameraTypeOf(this.props.cameraType) === 'orthographic') this.switchCamera('orthographic');
    const loop = () => {
      if (this._disposed) return;
      this._raf = requestAnimationFrame(loop);
      const now = performance.now(), dt = this._loopAt ? Math.min((now - this._loopAt) / 1000, 0.05) : 1 / 60;
      this._loopAt = now; this.stepFrame(dt);
      if (this.props.spin === '1' && this.boxRoot && Date.now() > (this._pauseSpin || 0)) this.turnBox(0.0045);
      this.controls.update(); r.render(this.scene, this.camera);
    };
    loop();
  }
  // Seret lampu: sinar kamera ∩ permukaan bola berpusat di pusat kotak dengan radius = distance lampu (lampu paralel tetap 400), ambil titik potong terdekat dari posisi lampu saat ini untuk konversi az/el;
  // studio menggunakan setLights untuk pembaruan parameter langsung (id dan peran yang sama tidak membangun ulang lampu), lalu mengembalikan kandidat via onLightEdit
  lightDragMove(e) {
    const d = this._ltDrag;
    if (!d || !this.studio) return;
    if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 3) d.moved = true;
    let list;
    try { list = JSON.parse(this.props.lightsSpec); } catch (_) { return; }
    if (!Array.isArray(list)) return;
    const light = list.find(l => l.id === d.id);
    if (!light) return;
    this._ray = this._ray || new THREE.Raycaster();
    this._ray.setFromCamera(this._ndcOf(e), this.camera);
    const center = new THREE.Vector3(...this.studio.helperCenter());
    const radius = light.type === 'point' ? (Number.isFinite(+light.distance) ? +light.distance : 350) : 400;
    const oc = this._ray.ray.origin.clone().sub(center), dir = this._ray.ray.direction;
    const b = oc.dot(dir), disc = b * b - (oc.lengthSq() - radius * radius);
    if (disc < 0) return;
    const sq = Math.sqrt(disc), cur = this.studio.lightPositionOf(d.id) || [0, radius, 0];
    let bestPt = null, bestD = Infinity;
    for (const t of [-b - sq, -b + sq]) {
      if (t <= 0) continue;
      const pt = this._ray.ray.origin.clone().addScaledVector(dir, t);
      const dd = (pt.x - cur[0]) * (pt.x - cur[0]) + (pt.y - cur[1]) * (pt.y - cur[1]) + (pt.z - cur[2]) * (pt.z - cur[2]);
      if (dd < bestD) { bestD = dd; bestPt = pt; }
    }
    if (!bestPt) return;
    const n = bestPt.sub(center).normalize();
    const az = Math.round(Math.atan2(n.z, n.x) * 1800 / Math.PI) / 10;
    const el = Math.round(Math.min(85, Math.max(5, Math.asin(Math.min(1, Math.max(-1, n.y))) * 180 / Math.PI)) * 10) / 10;
    const next = list.map(l => l.id === d.id ? { ...l, azimuth: az, elevation: el } : l);
    this.studio.setLights(JSON.stringify(next)); this.studio.updateHelpers();
    if (this.props.onLightEdit) this.props.onLightEdit(d.id, { azimuth: az, elevation: el });
    this._pauseSpin = Date.now() + 4000;
  }
  lightDragEnd() {
    const d = this._ltDrag; this._ltDrag = null;
    if (d && !d.moved && this.props.onLightSelect) this.props.onLightSelect(d.id); // Pergeseran <4px dianggap sebagai klik pilih
  }
  resize() {
    const w = this.el.clientWidth || 10, h = this.el.clientHeight || 10;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    if (this.camera.isOrthographicCamera) {
      const halfH = Math.max(1, this._orthoHeight || 100) / 2;
      this.camera.left = -halfH * aspect; this.camera.right = halfH * aspect;
      this.camera.top = halfH; this.camera.bottom = -halfH;
    } else this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
  syncOrthoFrustum() {
    if (!this.camera || !this.camera.isOrthographicCamera) return;
    const w = this.el.clientWidth || 10, h = this.el.clientHeight || 10, halfH = Math.max(1, this._orthoHeight || 100) / 2;
    this.camera.left = -halfH * w / h; this.camera.right = halfH * w / h;
    this.camera.top = halfH; this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();
  }

  // Perspektif ↔ Ortografis: konversi berdasarkan tinggi vertikal terlihat yang sesuai dengan jarak target saat ini, menghindari lompatan skala komposisi saat beralih.
  switchCamera(type) {
    const next = cameraTypeOf(type);
    if (!this.camera || (next === 'orthographic') === !!this.camera.isOrthographicCamera) return;
    const T = this.T, old = this.camera, target = this.controls.target.clone();
    const dir = old.position.clone().sub(target);
    if (dir.lengthSq() < 1e-8) dir.set(1, 0.7, 1);
    const distance = Math.max(1, dir.length()), unit = dir.normalize();
    const fov = clamp(this.num('fov', 35), 16, 46);
    const visibleH = old.isOrthographicCamera
      ? Math.max(1, (old.top - old.bottom) / Math.max(1e-6, old.zoom))
      : Math.max(1, 2 * distance * Math.tan(T.MathUtils.degToRad(old.fov) / 2));
    let camera;
    if (next === 'orthographic') {
      this._orthoHeight = visibleH;
      camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 9000);
      camera.position.copy(target).addScaledVector(unit, distance);
      camera.zoom = 1;
    } else {
      camera = new T.PerspectiveCamera(fov, 1, 1, 9000);
      const d = visibleH / (2 * Math.tan(T.MathUtils.degToRad(fov) / 2));
      camera.position.copy(target).addScaledVector(unit, d);
    }
    camera.up.copy(old.up);
    this.camera = camera;
    this.controls.object = camera;
    this.controls.minDistance = 15; this.controls.maxDistance = 5000;
    this.controls.minZoom = 0.05; this.controls.maxZoom = 40;
    this.resize();
    this.controls.update();
  }

  // Putar kotak horizontal di sekitar pusat kotak (menempel di meja): pivot = pusat kotak, kompensasi posisi mengikuti agar pusat kotak tidak bergeser; d adalah radian inkremental
  turnBox(d) {
    if (!this.boxRoot || !d) return;
    this.boxRoot.updateWorldMatrix(true, false);
    const c = this._centerL ? this.boxRoot.localToWorld(this._centerL.clone()) : new this.T.Vector3();
    const p = this.boxRoot.position, dx = p.x - c.x, dz = p.z - c.z;
    const cos = Math.cos(d), sin = Math.sin(d);
    p.x = c.x + dx * cos + dz * sin; p.z = c.z - dx * sin + dz * cos; // Matriks rotasi sumbu Y [cos,sin;-sin,cos]
    this.boxRoot.rotation.y += d;
  }

  build() {
    const T = this.T;
    if (this.boxRoot) {
      this.scene.remove(this.boxRoot);
      this.boxRoot.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    }
    const L = this.num('l', 80), W = this.num('w', 40), H = this.num('h', 120);
    const t = Math.max(0.2, this.num('t', 0.45)); // Batas bawah 0.2: kertas tipis art200 (t=0.22) mempertahankan ketebalan realistis dalam 3D
    this._dims = { L, W, H, t };
    const sbb = (this.baked && this.baked.atlasSbb) || this.props.sbb || [0, 0, 100, 100];
    this.folder = new Folder(T, sbb, (this.baked || {}).innerUV);
    this.folder.hasEmb = !!(this.props.embOn === '1' && (this.baked || this._lastBakeInput || {}).hasEmb !== false);
    this.folder._dims = this._dims;
    this.pieces = makePieces(this.props.tpl || 'rte', L, W, H, t, this.num('glue', 14));
    this.boxRoot = this.folder.build(this.pieces, t, this.faceMat, this.coreMat);
    this.scene.add(this.boxRoot);
    if (this.studio) {
      this.studio.setHelperTarget(0, H * 0.35, 0); // Arah helper lampu / pusat bola seret mengikuti tinggi kotak
      this.studio.setShadowBounds(L, W, H); // Kencangkan kamera bayangan sesuai dimensi kotak, menjaga resolusi titik kontak
    }
  }

  // Bake atlas: bake ulang saat layer/finishing/substrat berubah (debounce dikendalikan oleh update)
  rebake() {
    const p = this.props;
    if (!p.layers || !p.sbb) return;
    const input = {
      layers: p.layers, panels: p.panels, sbb: p.sbb, bleed: +p.bleed || 0, paperId: p.paper || 'coated-white', filmId: p.film || 'none',
      grainStrength: this.num('grainStrength', 0.45), grainScale: this.num('grainScale', 8),
      filmClearcoat: this.num('filmClearcoat', NaN), filmClearcoatRoughness: this.num('filmClearcoatRoughness', NaN),
      uvClearcoat: this.num('uvClearcoat', 1), uvRoughness: this.num('uvRoughness', 0.05), foilRoughness: this.num('foilRoughness', 0.22),
      foilColor: p.foilColor || '#ffdb91', silverColor: p.silverColor || '#faf7f2', holoColor: p.holoColor || '#edf1f6', paperTint: p.paperTint || '', holoRainbow: this.num('holoRainbow', 0),
      foilOn: p.foilOn === '1', suvOn: p.suvOn === '1', glossOn: p.glossOn === '1', embOn: p.embOn === '1', holoOn: p.holoOn === '1',
      glossRoughness: this.num('glossRoughness', 0.08),
      embDepth: this.num('embDepth', 0.3), embSharpness: this.num('embSharpness', 0.85), embDir: p.embDir || 'up', embBoost: p.embBoost === '1'
    };
    this._lastBakeInput = input;
    const baked = bakeAtlas(input);
    this.baked = baked;
    const old = this._tex;
    this._tex = makeAtlasTextures(baked);
    disposeTextures(old);
    applyCoreMaterial(this.coreMat, p.paper || 'coated-white');
    // Perubahan keberadaan emboss → mungkin perlu membangun ulang mesh subdivisi tinggi
    const needEmb = p.embOn === '1' && baked.hasEmb;
    const atlasChanged = !this.folder || baked.atlasSbb.some((v, i) => Math.abs(v - this.folder.sbb[i]) > 1e-7);
    if (atlasChanged || (this.folder && !!this.folder.hasEmb !== !!needEmb)) {
      this.build();
      this.applyFold();
    }
    this.applyFlags();
  }
  applyFlags() {
    if (!this._tex) return;
    applyFaceMaterial(this.faceMat, {
      paperId: this.props.paper || 'coated-white', filmId: this.props.film || 'none',
      roughness: this.num('surfaceRoughness', 0.48), filmRoughnessFactor: this.num('filmRoughnessFactor', 1), filmSheen: this.num('filmSheen', 0),
      foilMetalness: this.num('foilMetalness', 1), iridescence: this.num('iridescence', 0), holoSpan: this.num('holoSpan', 0.5), embNormalStrength: this.num('embNormalStrength', 1), embDisplacementStrength: this.num('embDisplacementStrength', 1)
    }, this._tex, {
      check: this.props.check || 'art',
      embOn: this.props.embOn === '1', hasEmb: (this.baked || {}).hasEmb,
      embDepth: this.num('embDepth', 0.3), embBoost: this.props.embBoost === '1', embDir: this.props.embDir || 'up'
    });
  }
  updateFilm() {
    if (!this.baked || !this._tex) return;
    paintFilmChannels(this.baked, this.props.film || 'none', {
      filmClearcoat: this.num('filmClearcoat', NaN), filmClearcoatRoughness: this.num('filmClearcoatRoughness', NaN),
      uvClearcoat: this.num('uvClearcoat', 1), uvRoughness: this.num('uvRoughness', 0.05)
    });
    this._tex.cc.needsUpdate = true; this._tex.ccR.needsUpdate = true;
  }
  updateFoilRoughness() { if (this.baked && this._tex) { paintFoilRoughness(this.baked, this.num('foilRoughness', 0.22)); this._tex.rough.needsUpdate = true; } }
  applyToneMapping() {
    if (!this.renderer) return;
    this.renderer.toneMapping = { agx: THREE.AgXToneMapping, neutral: THREE.NeutralToneMapping, linear: THREE.LinearToneMapping }[this.props.toneMapping] || THREE.ACESFilmicToneMapping;
    if (this.faceMat) this.faceMat.needsUpdate = true;
    if (this.coreMat) this.coreMat.needsUpdate = true;
  }
  applyFold() { if (this.folder) { this.folder._dims = this._dims; this.folder.applyFold(this.pieces, this.num('fold', 0)); } }

  applyStudioControls() {
    if (!this.studio) return;
    const p = this.props;
    this.studio.setControls({
      environmentIntensity: p.environmentIntensity, environmentRotation: p.environmentRotation,
      backgroundMode: p.backgroundShown === '1' ? 'hdri' : (p.backgroundMode === 'color' ? 'color' : 'gradient'),
      backgroundColor: p.backgroundColor, backgroundBlur: p.backgroundBlur, domeSpec: p.domeSpec,
      shadowSoftness: p.shadowSoftness, shadowOpacity: p.shadowOpacity
    });
  }

  // Studio tidak lagi dibangun ulang berdasarkan id: lampu direkonsiliasi berdasarkan id oleh setLights dari lightsSpec (string JSON), parameter lain dikirim via setControls
  setStudio() {
    if (this.studio) this.studio.dispose();
    const shadowQuery = new URLSearchParams(location.search);
    const requestedSamples = shadowQuery.get('dev3d') === '1' ? +shadowQuery.get('shadowSamples') : this.num('shadowSamples', 5);
    const shadowSamples = [3, 5, 7].includes(requestedSamples) ? requestedSamples : 5; // ?shadowSamples=3|5|7 hanya untuk perbandingan performa/visual Dev3D; default 5: 7 lampu sampel + 8 tekstur + env tepat memenuhi 16 unit tekstur, iridescence tidak memiliki tempat
    this.studio = setupStudio(this.renderer, this.scene, shadowSamples);
    this.studio.setEnvironment(this.props.environment || 'studio_small_08');
    this.studio.setLights(this.props.lightsSpec);
    this.studio.setHelpersVisible(this.props.lightEdit === '1');
    this.studio.setHelperSelected(this.props.selLight || null);
    this.studio.updateHelpers();
    this.applyStudioControls();
    this.applyFlags();
  }

  // Peralihan panggung lantai: saat 'none' hanya ada jaring penerima bayangan transparan lighting.js
  setStage(id) {
    if (this.stageGround) {
      this.scene.remove(this.stageGround);
      if (this.stageGround.userData.dispose) this.stageGround.userData.dispose();
      this.stageGround = null;
    }
    const g = makeStageGround(id || 'none', this.renderer);
    if (g) { this.stageGround = g; this.scene.add(g); }
  }

  setMode(m) {
    this._mode = m;
    const T = this.T;
    this.controls.mouseButtons.LEFT = m === 'rotate' ? T.MOUSE.ROTATE : m === 'pan' ? T.MOUSE.PAN : -1;
    this.renderer.domElement.style.cursor = m === 'move' || m === 'turn' ? 'grab' : m === 'pan' ? 'all-scroll' : 'default';
    Object.entries(this._modeBtns).forEach(pair => {
      const on = pair[0] === m;
      pair[1].style.background = on ? '#9a5b1f' : 'transparent';
      pair[1].style.color = on ? '#fff' : '#5c554a';
      pair[1].style.fontWeight = on ? '700' : '400';
    });
  }
  // Saat spin aktif, boxRoot.rotation.y terus digerakkan, tombol tegakkan dinonaktifkan
  syncTurnReset() {
    if (!this._turnResetBtn) return;
    const off = this.props.spin === '1';
    this._turnResetBtn.style.opacity = off ? '0.4' : '1';
    this._turnResetBtn.style.cursor = off ? 'default' : 'pointer';
  }
  setView(v) {
    this._fitGoal = null;
    const rr = this._fitR || 300, hh = this._fitH || 60, t2 = this.controls.target;
    const iso = rr * 1.2 / Math.sqrt(3);
    const p = { front: [0, hh * 0.1, rr], side: [rr, hh * 0.1, 0], top: [0, rr, 0.01], iso: [iso, iso, iso] }[v];
    if (!p) return;
    this.camera.position.set(t2.x + p[0], t2.y + p[1], t2.z + p[2]);
    this.controls.update();
  }
  frame(smooth = false) {
    const T = this.T;
    const bb = new T.Box3().setFromObject(this.boxRoot);
    const c = bb.getCenter(new T.Vector3()), sz = bb.getSize(new T.Vector3());
    this.boxRoot.updateWorldMatrix(true, true);
    this._centerL = this.boxRoot.worldToLocal(c.clone()); // Pusat kotak (koordinat lokal) - pivot rotasi untuk putar kotak/spin, diperbarui dengan frame setelah lipat atau ganti model
    const boxX = this.boxRoot.position.x - c.x, boxZ = this.boxRoot.position.z - c.z;
    const rr = Math.max(sz.x, sz.z, sz.y * 2, 60);
    const tubeHero = this.props.tpl === 'cyl' || this.props.tpl === 'hex';
    const topHero = this.props.tpl === 'mailer' || this.props.tpl === 'lidbase' || this.props.tpl === 'drawer';
    const lowTopHero = topHero && sz.y <= Math.max(sz.x, sz.z) * 0.65;
    const FIT = 2; // Bingkai diperluas dua kali: kotak memakan sekitar setengah tinggi layar (memenuhi layar terlalu besar, umpan balik penerimaan 2026-08)
    const fitR = rr * (lowTopHero ? 1.85 : 1.1) * FIT;
    this._fitR = fitR; this._fitH = sz.y;
    const camera = lowTopHero
      ? new T.Vector3(fitR * 0.9, fitR * 0.54, fitR * 0.9)
      : new T.Vector3(rr * 0.95 * FIT * (tubeHero ? -1 : 1), rr * (topHero ? 1.05 : 0.7) * FIT, rr * 0.95 * FIT * (tubeHero ? -1 : 1));
    const target = new T.Vector3(0, Math.max(sz.y * (lowTopHero ? 0.3 : 0.4), lowTopHero ? 10 : 15), 0);
    const orthoHeight = this.camera.isOrthographicCamera
      ? Math.max(60, 2 * camera.distanceTo(target) * Math.tan(T.MathUtils.degToRad(clamp(this.num('fov', 35), 16, 46)) / 2))
      : null;
    if (smooth) { this._fitGoal = { boxX, boxZ, camera, target, orthoHeight }; return; }
    this._fitGoal = null;
    this.boxRoot.position.x = boxX; this.boxRoot.position.z = boxZ;
    this.camera.position.copy(camera); this.controls.target.copy(target);
    if (orthoHeight != null) {
      this._orthoHeight = orthoHeight;
      this.camera.zoom = 1;
      this.syncOrthoFrustum();
    }
    this.controls.update();
  }
  stepFrame(dt) {
    const g = this._fitGoal;
    if (!g || !this.boxRoot) return;
    const a = 1 - Math.exp(-dt * 9);
    this.boxRoot.position.x += (g.boxX - this.boxRoot.position.x) * a;
    this.boxRoot.position.z += (g.boxZ - this.boxRoot.position.z) * a;
    this.camera.position.lerp(g.camera, a); this.controls.target.lerp(g.target, a);
    if (g.orthoHeight != null && this.camera.isOrthographicCamera) {
      this._orthoHeight += (g.orthoHeight - this._orthoHeight) * a;
      this.camera.zoom = 1;
      this.syncOrthoFrustum();
    }
    const left = Math.max(
      Math.abs(g.boxX - this.boxRoot.position.x), Math.abs(g.boxZ - this.boxRoot.position.z),
      this.camera.position.distanceTo(g.camera), this.controls.target.distanceTo(g.target)
    );
    if (left < 0.02) {
      this.boxRoot.position.x = g.boxX; this.boxRoot.position.z = g.boxZ;
      this.camera.position.copy(g.camera); this.controls.target.copy(g.target);
      if (g.orthoHeight != null && this.camera.isOrthographicCamera) { this._orthoHeight = g.orthoHeight; this.syncOrthoFrustum(); }
      this._fitGoal = null;
    }
  }
  dispose() {
    this._disposed = true;
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this._ro) this._ro.disconnect();
    if (this._ltDown) this.el.removeEventListener('pointerdown', this._ltDown, true);
    if (this._ltUp) this.el.removeEventListener('pointerup', this._ltUp, true);
    this._ltDrag = null; this._ltClick = null;
    clearTimeout(this._bt); clearTimeout(this._at); clearTimeout(this._ft);
    this.setStage('none');
    if (this.studio) { this.studio.dispose(); this.studio = null; }
    disposeTextures(this._tex);
    if (this.controls) this.controls.dispose();
    this.faceMat.dispose(); this.coreMat.dispose();
    if (this.boxRoot) this.boxRoot.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    if (this.renderer) { this.renderer.dispose(); this.renderer.forceContextLoss(); if (this.renderer.domElement.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement); }
  }
}
