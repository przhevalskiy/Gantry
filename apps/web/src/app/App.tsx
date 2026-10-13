import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthGate, useAuthStore } from '@/modules/kernel';
import { FirmShell } from './FirmShell';
import { HomePage } from './pages/HomePage';
import { EngagementPage } from './pages/EngagementPage';
import { MattersPage } from './pages/MattersPage';
import { PracticesPage } from './pages/PracticesPage';
import { BriefsPage } from './pages/BriefsPage';
import { PeoplePage } from './pages/PeoplePage';
import { WorkspacesPage } from './pages/WorkspacesPage';
import { DevelopPage } from './pages/DevelopPage';
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
        <Route element={<FirmShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/jobs" element={<MattersPage />} />
          <Route path="/jobs/:jobId" element={<EngagementPage />} />
          <Route path="/practices" element={<PracticesPage />} />
          <Route path="/briefs" element={<BriefsPage />} />
          <Route path="/people" element={<PeoplePage />} />
          <Route path="/workspaces" element={<WorkspacesPage />} />
          <Route path="/develop" element={<DevelopPage />} />
          {/* Legacy redirects — old frontend dropped */}
          <Route path="/runs/*" element={<Navigate to="/jobs" replace />} />
          <Route path="/packs" element={<Navigate to="/practices" replace />} />
          <Route path="/agents" element={<Navigate to="/people" replace />} />
          <Route path="/starters" element={<Navigate to="/briefs" replace />} />
          <Route path="/templates" element={<Navigate to="/briefs" replace />} />
          <Route path="/chat/*" element={<Navigate to="/" replace />} />
          <Route path="/developer" element={<Navigate to="/develop" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <AuthGate isOpen={!user} />
    </BrowserRouter>
  );
}
