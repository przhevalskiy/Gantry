import { useState, FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore } from '../store';
import { getRememberMe, setRememberMe } from '@/shared/services/supabase';
import { AVATAR_ICONS, getAvatarIcon } from '@/shared/constants/avatarIcons';
import logo from '@/assets/logo.png';
import { GANTRY_PLATFORM } from '@/shared/services/gantry/config';
import './AuthModal.css';

interface AuthModalProps {
  isOpen: boolean;
}

export function AuthModal({ isOpen }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('user');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [rememberMe, setLocalRememberMe] = useState(getRememberMe);
  const [apiKey, setApiKey] = useState('');
  const { signIn, signUp, signInWithApiKey, error, isLoading, clearError } = useAuthStore();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (GANTRY_PLATFORM) {
      if (!apiKey.trim()) return;
      signInWithApiKey(apiKey.trim());
      return;
    }
    if (mode === 'login') {
      setRememberMe(rememberMe);
      await signIn(email, password);
    } else {
      await signUp(
        email,
        password,
        displayName || undefined,
        selectedAvatar,
        preferredName || undefined
      );
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    clearError();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}}
      title=""
      size="sm"
      hideCloseButton
    >
      <div className="auth-header">
        <img src={logo} alt="" className="auth-brand-logo" />
        <span className="auth-brand-name">Gantry</span>
        <p className="auth-title">
          {GANTRY_PLATFORM
            ? 'Connect with your Gantry API key'
            : mode === 'login'
              ? 'Login or signup below'
              : 'Create Account'}
        </p>
      </div>

      {GANTRY_PLATFORM ? (
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="apiKey">Gantry API key</label>
            <input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="gantry_..."
              required
              autoComplete="off"
            />
          </div>
          <p className="settings-hint">
            Create a key in Gantry Settings or via <code>POST /v1/keys</code>. Stored locally in this browser.
          </p>
          <button type="submit" className="auth-submit" disabled={isLoading || !apiKey.trim()}>
            Connect
          </button>
        </form>
      ) : (
      <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <>
              <div className="auth-field">
                <label htmlFor="displayName">Display Name</label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                />
              </div>

              {/* Avatar and Preferred Name Row - matching AccountSettingsModal */}
              <div className="auth-avatar-row">
                <div className="auth-avatar-section">
                  <div className="auth-avatar-header">
                    <label className="auth-avatar-label">Avatar</label>
                    <button
                      type="button"
                      className="auth-avatar-current"
                      onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                      title="Click to change avatar"
                    >
                      {(() => {
                        const CurrentIcon = getAvatarIcon(selectedAvatar);
                        return <CurrentIcon size={20} />;
                      })()}
                    </button>
                  </div>

                  {/* Avatar Picker Dropdown */}
                  {showAvatarPicker && (
                    <div className="auth-avatar-dropdown">
                      <div className="auth-avatar-dropdown-header">
                        <span>Choose an Avatar</span>
                        <button
                          type="button"
                          className="auth-avatar-dropdown-close"
                          onClick={() => setShowAvatarPicker(false)}
                        >
                          ✕
                        </button>
                      </div>
                      <div className="auth-avatar-grid">
                        {AVATAR_ICONS.map((avatar) => {
                          const Icon = avatar.icon;
                          return (
                            <button
                              key={avatar.id}
                              type="button"
                              className={`auth-avatar-option ${avatar.id === selectedAvatar ? 'active' : ''}`}
                              onClick={() => {
                                setSelectedAvatar(avatar.id);
                                setShowAvatarPicker(false);
                              }}
                              title={avatar.label}
                            >
                              <Icon size={16} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <div className="auth-preferred-section">
                  <label htmlFor="preferredName" className="auth-avatar-label">What should Gantry call you?</label>
                  <div className="auth-input-row">
                    <input
                      id="preferredName"
                      type="text"
                      className="auth-preferred-input"
                      value={preferredName}
                      onChange={(e) => setPreferredName(e.target.value)}
                      placeholder="e.g. Joe, Laura"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="auth-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {mode === 'login' && (
            <label className="auth-remember">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setLocalRememberMe(e.target.checked)}
              />
              Remember me when I login
            </label>
          )}

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="auth-submit" disabled={isLoading}>
            {isLoading
              ? 'Please wait...'
              : mode === 'login'
                ? 'Sign In'
                : 'Create Account'}
          </button>

          <div className="auth-toggle">
            {mode === 'login' ? (
              <>
                Don't have an account?{' '}
                <button type="button" onClick={toggleMode}>
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button type="button" onClick={toggleMode}>
                  Sign in
                </button>
              </>
            )}
          </div>
        </form>
      )}
    </Modal>
  );
}
