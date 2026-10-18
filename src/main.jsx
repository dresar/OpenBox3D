import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import { store } from './state/store.js';
import { loadPresetBox } from './preset/presetBox.js';

// Masukkan kotak contoh preset sebelum memasang, untuk menghindari kedipan kotak kosong; jika pemuatan aset gagal, aplikasi tetap dipastikan dapat dibuka.
// Adegan debug ?heroTest/?embTest/?surfaceTest memiliki layer pengujian sendiri, lewati injeksi preset.
const debugScene = ['heroTest', 'embTest', 'surfaceTest'].some(k => new URLSearchParams(location.search).has(k));
loadPresetBox().catch(() => null).then(preset => {
  if (preset && !debugScene) store.reset(preset);
  createRoot(document.getElementById('root')).render(<App />);
});
