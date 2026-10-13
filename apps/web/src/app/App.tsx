import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { AppPanel } from '@/components/shell/AppPanel';
import { WorkspacesPage, WorkspaceDetailPage } from '@/features/projects';
import { TemplatesPage } from '@/features/templates';
import { AgentsPage } from '@/features/agents';
import { PacksPage } from '@/features/packs';
import { DeveloperPage } from '@/features/developer';
import { RunIdePage, RunsPage } from '@/features/runs';
import { useAuthStore, AuthModal } from '@/features/auth';
import './App.css';

function RedirectLegacyWorkspace() {
  const { workspaceId, projectId } = useParams<{ workspaceId?: string; projectId?: string }>();
  const id = workspaceId ?? projectId ?? '';
  return <Navigate to={`/workspaces/${id}`} replace />;
}

function AppLayout() {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="app-main">
        <AppPanel>
          <Routes>
          <Route path="/" element={<Navigate to="/runs/new" replace />} />
          <Route path="/runs/new" element={<RunIdePage />} />
          <Route path="/runs/:taskId" element={<RunIdePage />} />
          <Route path="/workspaces" element={<WorkspacesPage />} />
          <Route path="/workspaces/:workspaceId" element={<WorkspaceDetailPage />} />
          <Route path="/hubspaces" element={<Navigate to="/workspaces" replace />} />
          <Route path="/hubspaces/:projectId" element={<RedirectLegacyWorkspace />} />
          <Route path="/projects/:projectId" element={<RedirectLegacyWorkspace />} />
          <Route path="/chat" element={<Navigate to="/runs/new" replace />} />
          <Route path="/chat/:discussionId" element={<Navigate to="/runs/new" replace />} />
          <Route path="/starters" element={<TemplatesPage />} />
          <Route path="/templates" element={<Navigate to="/starters" replace />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/packs" element={<PacksPage />} />
          <Route path="/developer" element={<DeveloperPage />} />
          <Route path="/runs" element={<RunsPage />} />
          </Routes>
        </AppPanel>
      </main>
    </div>
  );
}

function App() {
  const { user, isInitializing, initialize } = useAuthStore();
  const [isProcessingAuth, setIsProcessingAuth] = useState(false);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (user && isProcessingAuth) {
      setIsProcessingAuth(false);
    }
  }, [user, isProcessingAuth]);

  if (isInitializing || isProcessingAuth) {
    return (
      <div className="auth-loading">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<AppLayout />} />
      </Routes>
      <AuthModal isOpen={!user} />
    </BrowserRouter>
  );
}

export default App;
