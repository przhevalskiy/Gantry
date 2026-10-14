import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthGate, useAuthStore } from '@/modules/kernel';
import { MuseShell } from './MuseShell';
import { MessagingPage } from './pages/MessagingPage';
import './App.css';

export default function App() {
  const { user, isInitializing, initialize } = useAuthStore();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  if (isInitializing) {
    return (
      <div className="auth-loading">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MuseShell />}>
          {/* Single messaging surface — Muse / iMessage architecture */}
          <Route path="/" element={<MessagingPage />} />
          <Route path="/c/:jobId" element={<MessagingPage />} />
          <Route path="/jobs/:jobId" element={<MessagingPage />} />
          {/* Old tab IA → messaging */}
          <Route path="/jobs" element={<Navigate to="/" replace />} />
          <Route path="/practices" element={<Navigate to="/" replace />} />
          <Route path="/briefs" element={<Navigate to="/" replace />} />
          <Route path="/people" element={<Navigate to="/" replace />} />
          <Route path="/workspaces" element={<Navigate to="/" replace />} />
          <Route path="/develop" element={<Navigate to="/" replace />} />
          <Route path="/runs/*" element={<Navigate to="/" replace />} />
          <Route path="/packs" element={<Navigate to="/" replace />} />
          <Route path="/agents" element={<Navigate to="/" replace />} />
          <Route path="/starters" element={<Navigate to="/" replace />} />
          <Route path="/templates" element={<Navigate to="/" replace />} />
          <Route path="/chat/*" element={<Navigate to="/" replace />} />
          <Route path="/developer" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <AuthGate isOpen={!user} />
    </BrowserRouter>
  );
}
