import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutTemplate, Plus, Play, Pencil, Trash2, FolderKanban } from 'lucide-react';
import { useAuthStore } from '@/features/auth';
import { useProjectStore } from '@/features/projects';
import { useDiscussionStore } from '@/features/discussions';
import { Template } from '@/shared/types';
import { useTemplateStore } from '../store';
import { CreateTemplateModal } from './CreateTemplateModal';
import './TemplatesPage.css';

export function TemplatesPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { templates, isLoading, fetchTemplates, deleteTemplate } = useTemplateStore();
  const { projects, fetchProjects, getProjectById } = useProjectStore();
  const { createDiscussion } = useDiscussionStore();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);

  useEffect(() => {
    if (user) {
      fetchTemplates();
      if (projects.length === 0) fetchProjects();
    }
  }, [user, fetchTemplates, fetchProjects, projects.length]);

  const handleUse = async (t: Template) => {
    // Launch a task from the starter, optionally pre-filed under a hubspace.
    if (t.hubspace_id) {
      const created = await createDiscussion({ project_id: t.hubspace_id });
      navigate(`/chat/${created.id}`, { state: { initialMessage: t.body } });
    } else {
      navigate('/chat', { state: { initialMessage: t.body } });
    }
  };

  return (
    <div className="templates-page">
      <div className="templates-header">
        <div>
          <h1 className="templates-title">Starters</h1>
          <p className="templates-subtitle">Saved task prompts — launch a factory run in one click.</p>
        </div>
        <button className="templates-new-btn" onClick={() => { setEditing(null); setShowCreate(true); }}>
          <Plus size={16} />
          <span>New starter</span>
        </button>
      </div>

      {isLoading && templates.length === 0 ? (
        <div className="templates-loading"><div className="spinner" /></div>
      ) : templates.length === 0 ? (
        <div className="templates-empty">
          <div className="templates-empty-icon"><LayoutTemplate size={32} /></div>
          <h2>No starters yet</h2>
          <p>Save a task prompt you use often and rerun it from here.</p>
          <button className="templates-new-btn" onClick={() => { setEditing(null); setShowCreate(true); }}>
            <Plus size={16} />
            <span>New starter</span>
          </button>
        </div>
      ) : (
        <div className="templates-grid">
          {templates.map(t => {
            const hub = t.hubspace_id ? getProjectById(t.hubspace_id) : undefined;
            return (
              <div key={t.id} className="template-card">
                <div className="template-card-icon"><LayoutTemplate size={20} /></div>
                <div className="template-card-body">
                  <h3 className="template-card-name">{t.name}</h3>
                  {t.description && <p className="template-card-desc">{t.description}</p>}
                  <p className="template-card-preview">{t.body}</p>
                  {hub && (
                    <span className="template-card-hub"><FolderKanban size={12} /> {hub.name}</span>
                  )}
                  <div className="template-card-actions">
                    <button className="template-use-btn" onClick={() => handleUse(t)}>
                      <Play size={14} /> Use
                    </button>
                    <button className="template-icon-btn" title="Edit" onClick={() => { setEditing(t); setShowCreate(true); }}>
                      <Pencil size={14} />
                    </button>
                    <button className="template-icon-btn danger" title="Delete" onClick={() => deleteTemplate(t.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateTemplateModal
        isOpen={showCreate}
        onClose={() => { setShowCreate(false); setEditing(null); }}
        template={editing ?? undefined}
      />
    </div>
  );
}
