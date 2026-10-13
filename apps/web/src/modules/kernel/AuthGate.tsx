import { useState, type FormEvent } from 'react';
import logo from '@/assets/logo.png';
import { useAuthStore } from './auth';
import './AuthGate.css';

export function AuthGate({ isOpen }: { isOpen: boolean }) {
  const [apiKey, setApiKey] = useState('');
  const { signInWithApiKey, error, isLoading } = useAuthStore();

  if (!isOpen) return null;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;
    signInWithApiKey(apiKey.trim());
  };

  return (
    <div className="auth-gate">
      <div className="auth-gate__card">
        <img src={logo} alt="" className="auth-gate__logo" />
        <h1 className="auth-gate__brand">Gantry</h1>
        <p className="auth-gate__sub">Connect with your firm API key</p>
        <form className="auth-gate__form" onSubmit={onSubmit}>
          <label htmlFor="gantry-key">API key</label>
          <input
            id="gantry-key"
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="gantry_..."
            autoComplete="off"
            required
          />
          {error && <p className="auth-gate__error">{error}</p>}
          <button type="submit" disabled={isLoading || !apiKey.trim()}>
            Enter the firm
          </button>
        </form>
      </div>
    </div>
  );
}
