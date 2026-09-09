import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowUp, Pencil, MessageSquare, FolderKanban, Puzzle, CalendarClock } from 'lucide-react';
import { Project, Discussion } from '@/shared/types';
import { projectRepoHint, projectRepoLabel } from '@/shared/constants/requestTypes';
import { api } from '@/shared/services/api';
import { useDiscussionStore } from '@/features/discussions';
import { useProjectStore } from '../store';
import { CreateProjectModal } from './CreateProjectModal';
import { ProjectFilesPanel } from './ProjectFilesPanel';
import './ProjectDetailPage.css';

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { createDiscussion } = useDiscussionStore();
  const { getProjectById } = useProjectStore();

  const [project, setProject] = useState<Project | null>(null);
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [taskInput, setTaskInput] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const loadProject = useCallback(async () => {
    if (!projectId) return;
    try {
      const cached = getProjectById(projectId);
      const p = cached ?? (await api.getProject(projectId));
      setProject(p);
      const ds = await api.getProjectDiscussions(projectId);
      setDiscussions(ds);
    } catch {
      setNotFound(true);
    }
  }, [projectId, getProjectById]);

  useEffect(() => { loadProject(); }, [loadProject]);

  const handleStartTask = async (message?: string) => {
    if (!projectId) return;
    const text = (message ?? taskInput).trim();
    const created = await createDiscussion({ project_id: projectId });
    navigate(`/chat/${created.id}`, text ? { state: { initialMessage: text } } : undefined);
  };

  if (notFound) {
    return (
      <div className="project-detail">
        <button className="pd-back" onClick={() => navigate('/hubspaces')}>
          <ArrowLeft size={16} /> <span>All hubspaces</span>
        </button>
        <p className="pd-missing">This hubspace could not be found.</p>
      </div>
    );
  }

  if (!project) {
    return <div className="project-detail"><div className="projects-loading"><div className="spinner" /></div></div>;
  }

  return (
    <div className="project-detail">
      <button className="pd-back" onClick={() => navigate('/hubspaces')}>
        <ArrowLeft size={16} /> <span>All hubspaces</span>
      </button>

      <div className="pd-layout">
        {/* Main column */}
        <div className="pd-main">
          <div className="pd-header">
            <div className="pd-header-icon"><FolderKanban size={22} /></div>
            <div className="pd-header-text">
              <h1 className="pd-name">{project.name}</h1>
              <span className="pd-type-chip">
                {projectRepoLabel(project)}
              </span>
              <p className="pd-repo-hint">{projectRepoHint(project)}</p>
            </div>
            <button className="pd-edit-btn" onClick={() => setShowEdit(true)} title="Edit hubspace">
              <Pencil size={16} />
            </button>
          </div>

          {/* Start a task */}
          <form
            className="pd-task-input"
            onSubmit={e => { e.preventDefault(); handleStartTask(); }}
          >
            <input
              className="pd-task-field"
              placeholder="Start a task in this hubspace"
              value={taskInput}
              onChange={e => setTaskInput(e.target.value)}
            />
            <button type="submit" className="pd-task-send" title="Start task">
              <ArrowUp size={18} />
            </button>
          </form>

          {/* Tasks list */}
          <div className="pd-tasks">
            <h2 className="pd-section-title">Tasks</h2>
            <p className="pd-section-hint">Factory runs started from this hubspace.</p>
            {discussions.length === 0 ? (
              <p className="pd-tasks-empty">No tasks yet — start one above.</p>
            ) : (
              <div className="pd-task-list">
                {discussions.map(d => (
                  <button
                    key={d.id}
                    className="pd-task-item"
                    onClick={() => {
                      if (d.task_id) navigate(`/runs/${d.task_id}`);
                      else navigate(`/chat/${d.id}`);
                    }}
                  >
                    <MessageSquare size={15} className="pd-task-item-icon" />
                    <span className="pd-task-item-title">
                      {d.title || d.messages?.[0]?.content?.slice(0, 40) || 'New task'}
                    </span>
                    <span className="pd-task-item-date">
                      {new Date(d.updated_at).toLocaleDateString()}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right rail */}
        <aside className="pd-rail">
          <div className="pd-rail-card">
            <h3 className="pd-rail-title">Instructions</h3>
            <p className="pd-rail-body">
              {project.instructions || 'No instructions yet. Edit the hubspace to add a theme/brief.'}
            </p>
          </div>

          <ProjectFilesPanel project={project} />

          <div className="pd-rail-card pd-rail-disabled">
            <h3 className="pd-rail-title"><Puzzle size={15} /> Skills</h3>
            <p className="pd-rail-body">Reusable workflows — coming soon.</p>
          </div>

          <div className="pd-rail-card pd-rail-disabled">
            <h3 className="pd-rail-title"><CalendarClock size={15} /> Scheduled tasks</h3>
            <p className="pd-rail-body">Run tasks on a schedule — coming soon.</p>
          </div>
        </aside>
      </div>

      <CreateProjectModal
        isOpen={showEdit}
        onClose={() => setShowEdit(false)}
        project={project}
      />
    </div>
  );
}
