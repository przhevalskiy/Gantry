import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderKanban, Plus } from 'lucide-react';
import { useAuthStore } from '@/features/auth';
import { projectRepoHint, projectRepoLabel } from '@/shared/constants/requestTypes';
import { Project } from '@/shared/types';
import { useProjectStore } from '../store';
import { CreateProjectModal } from './CreateProjectModal';
import './ProjectsPage.css';

export function ProjectsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { projects, isLoading, fetchProjects } = useProjectStore();
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (user) fetchProjects();
  }, [fetchProjects, user]);

  const topLevel = useMemo(
    () => projects.filter(p => !p.parent_project_id),
    [projects],
  );

  return (
    <div className="projects-page">
      <div className="projects-header">
        <div>
          <h1 className="projects-title">Hubspaces</h1>
          <p className="projects-subtitle">
            Greenfield workspaces or linked GitHub repos — browse files, run the factory, get PRs.
          </p>
        </div>
        <button className="projects-new-btn" onClick={() => setShowCreate(true)}>
          <Plus size={16} />
          <span>New hubspace</span>
        </button>
      </div>

      {isLoading && projects.length === 0 ? (
        <div className="projects-loading"><div className="spinner" /></div>
      ) : projects.length === 0 ? (
        <div className="projects-empty">
          <div className="projects-empty-icon"><FolderKanban size={32} /></div>
          <h2>No hubspaces yet</h2>
          <p>Create a hubspace — start empty or link an existing GitHub repository.</p>
          <button className="projects-new-btn" onClick={() => setShowCreate(true)}>
            <Plus size={16} />
            <span>New hubspace</span>
          </button>
        </div>
      ) : (
        <div className="projects-grid">
          {topLevel.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              onOpen={id => navigate(`/hubspaces/${id}`)}
            />
          ))}
        </div>
      )}

      <CreateProjectModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={p => navigate(`/hubspaces/${p.id}`)}
      />
    </div>
  );
}

function ProjectCard({ project, onOpen }: { project: Project; onOpen: (id: string) => void }) {
  return (
    <div className="project-card" onClick={() => onOpen(project.id)} role="button" tabIndex={0}>
      <div className="project-card-icon"><FolderKanban size={20} /></div>
      <div className="project-card-body">
        <h3 className="project-card-name">{project.name}</h3>
        {project.instructions && (
          <p className="project-card-instructions">{project.instructions}</p>
        )}
        <span className="project-card-type">{projectRepoLabel(project)}</span>
      </div>
    </div>
  );
}
