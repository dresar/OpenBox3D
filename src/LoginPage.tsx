import React, { useState } from 'react';
import { authConfig } from './auth.config';
import { LogoCat } from './ui/widgets.jsx';

export interface LoginPageProps {
  onLogin?: () => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === authConfig.username && password === authConfig.password) {
      sessionStorage.setItem('openbox3d_auth', 'true');
      if (onLogin) {
        onLogin();
      }
    } else {
      setError('Nama pengguna atau kata sandi salah');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f1e8', padding: 16, boxSizing: 'border-box' }}>
      <div style={{ width: '100%', maxWidth: 360, background: '#faf7f0', border: '1px solid #d8d0c2', borderRadius: 10, padding: '32px 28px', boxShadow: '0 8px 24px rgba(33,29,24,0.08)', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24, textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#211d18', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <LogoCat size={28} />
          </div>
          <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#211d18', letterSpacing: '0.02em' }}>Masuk</h1>
          <div style={{ fontSize: 12, color: '#8a8071' }}>Meja Kerja Suwa · OpenBox3D</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="login-username" style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#5c554a', marginBottom: 5 }}>Nama Pengguna</label>
            <input
              id="login-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={e => {
                setUsername(e.target.value);
                setError('');
              }}
              placeholder="Nama Pengguna"
              required
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #d8d0c2', borderRadius: 6, fontSize: 13, color: '#211d18', background: '#fff', outline: 'none' }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label htmlFor="login-password" style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#5c554a', marginBottom: 5 }}>Kata Sandi</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => {
                setPassword(e.target.value);
                setError('');
              }}
              placeholder="Kata Sandi"
              required
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #d8d0c2', borderRadius: 6, fontSize: 13, color: '#211d18', background: '#fff', outline: 'none' }}
            />
          </div>

          {error && (
            <div role="alert" style={{ marginBottom: 16, padding: '8px 10px', borderRadius: 5, background: '#fdf2f0', border: '1px solid #fadbd8', color: '#b33927', fontSize: 12, textAlign: 'center' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            style={{ width: '100%', padding: '9px 0', border: 'none', borderRadius: 6, background: '#9a5b1f', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}
          >
            Masuk
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
