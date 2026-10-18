// Komponen kanvas 3D: Cangkang React + instans BoxEngine (didorong properti); engineRef dapat mengekstrak instans mesin (untuk ekspor AR)
import React, { useEffect, useRef } from 'react';
import { BoxEngine } from '../render3d/engine.js';

export function BoxCanvas(props) {
  const ref = useRef(null), engRef = useRef(null);
  useEffect(() => {
    const eng = new BoxEngine(ref.current, props);
    engRef.current = eng;
    if (props.engineRef) props.engineRef.current = eng;
    return () => { engRef.current = null; if (props.engineRef) props.engineRef.current = null; eng.dispose(); };
  }, []);
  useEffect(() => { if (engRef.current) engRef.current.update(props); });
  return <div ref={ref} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }} />;
}
