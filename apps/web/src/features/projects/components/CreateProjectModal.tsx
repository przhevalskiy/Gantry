import { useState, useEffect, useCallback, useMemo } from 'react';
import { Modal } from '@/components/ui';
import { Project } from '@/shared/types';
import { gantryClient, type GithubRepoSummary } from '@/shared/services/gantry/client';
import { getGithubToken } from '@/shared/services/gantry/userSettings';
import { useProjectStore } from '../store';
import './CreateProjectModal.css';

type RepoMode = 'greenfield' | 'link' | 'browse';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (project: Project) => void;
  project?: Project;
}

export function CreateProjectModal({ isOpen, onClose, onCreated, project }: CreateProjectModalProps) {
  const { createProject, updateProject } = useProjectStore();
  const isEdit = !!project;

  const [name, setName] = useState(project?.name ?? '');
  const [mode, setMode] = useState<RepoMode>(project?.github_url ? 'link' : 'greenfield');
  const [githubUrl, setGithubUrl] = useState(project?.github_url ?? '');
  const [notes, setNotes] = useState(project?.instructions ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repoSearch, setRepoSearch] = useState('');
  const [repos, setRepos] = useState<GithubRepoSummary[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [reposError, setReposError] = useState<string | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<GithubRepoSummary | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setName(project?.name ?? '');
    setGithubUrl(project?.github_url ?? '');
    setNotes(project?.instructions ?? '');
    setMode(project?.github_url ? 'link' : 'greenfield');
    setError(null);
    setSelectedRepo(null);
    setRepoSearch('');
  }, [isOpen, project]);

  const loadRepos = useCallback(async (q: string) => {
    setReposLoading(true);
    setReposError(null);
    try {
      const token = getGithubToken();
      const rows = token
        ? (await gantryClient.searchGithubRepos({ q, github_token: token })).repos
        : await gantryClient.listGithubRepos(q);
      setRepos(rows);
    } catch (err) {
      setRepos([]);
      setReposError((err as Error).message);
    } finally {
      setReposLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen || mode !== 'browse' || isEdit) return;
    const timer = setTimeout(() => { void loadRepos(repoSearch); }, 300);
    return () => clearTimeout(timer);
  }, [isOpen, mode, isEdit, repoSearch, loadRepos]);

  const resolvedGithubUrl = useMemo(() => {
    if (mode === 'greenfield') return null;
    if (mode === 'browse') return selectedRepo?.html_url ?? null;
    return githubUrl.trim() || null;
  }, [mode, githubUrl, selectedRepo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please give the hubspace a name.');
      return;
    }
    if (mode === 'link' && !githubUrl.trim()) {
      setError('Paste a GitHub repository URL, or switch to Greenfield / Browse.');
      return;
    }
    if (mode === 'browse' && !selectedRepo?.html_url) {
      setError('Pick a repository from the list.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const payload = {
      name: name.trim(),
      github_url: isEdit ? (githubUrl.trim() || null) : resolvedGithubUrl,
      instructions: notes.trim() || null,
    };
    try {
      if (isEdit && project) {
        await updateProject(project.id, payload);
        onClose();
      } else {
        const created = await createProject(payload);
        onCreated?.(created);
        onClose();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit hubspace' : 'New hubspace'} size="md">
      <form className="create-project-form" onSubmit={handleSubmit}>
        <label className="cp-field">
          <span className="cp-label">Name</span>
          <input
            className="cp-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Chess app, Platform API"
            autoFocus
          />
        </label>

        {!isEdit && (
          <div className="cp-field">
            <span className="cp-label">Repository</span>
            <div className="cp-mode-tabs">
              <button
                type="button"
                className={`cp-mode-tab ${mode === 'greenfield' ? 'active' : ''}`}
                onClick={() => setMode('greenfield')}
              >
                Greenfield
              </button>
              <button
                type="button"
                className={`cp-mode-tab ${mode === 'link' ? 'active' : ''}`}
                onClick={() => setMode('link')}
              >
                Link URL
              </button>
              <button
                type="button"
                className={`cp-mode-tab ${mode === 'browse' ? 'active' : ''}`}
                onClick={() => setMode('browse')}
              >
                Browse GitHub
              </button>
            </div>
            {mode === 'greenfield' && (
              <p className="cp-mode-hint">
                Starts with an empty workspace on the factory host. Your first run can scaffold the codebase
                and create a GitHub repo when a token is configured.
              </p>
            )}
            {mode === 'link' && (
              <input
                className="cp-input"
                value={githubUrl}
                onChange={e => setGithubUrl(e.target.value)}
                placeholder="https://github.com/org/repo"
              />
            )}
            {mode === 'browse' && (
              <div className="cp-repo-picker">
                <input
                  className="cp-input"
                  value={repoSearch}
                  onChange={e => setRepoSearch(e.target.value)}
                  placeholder="Search your GitHub repos…"
                />
                {reposError && <p className="cp-repo-picker-error">{reposError}</p>}
                <ul className="cp-repo-list">
                  {reposLoading && <li className="cp-repo-list-empty">Loading…</li>}
                  {!reposLoading && repos.length === 0 && (
                    <li className="cp-repo-list-empty">No repos found — check GH_TOKEN on the API.</li>
                  )}
                  {repos.map(repo => (
                    <li key={repo.id}>
                      <button
                        type="button"
                        className={`cp-repo-item ${selectedRepo?.id === repo.id ? 'selected' : ''}`}
                        onClick={() => setSelectedRepo(repo)}
                      >
                        <span className="cp-repo-name">{repo.full_name}</span>
                        {repo.description && (
                          <span className="cp-repo-desc">{repo.description}</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {isEdit && (
          <label className="cp-field">
            <span className="cp-label">GitHub repository URL</span>
            <input
              className="cp-input"
              value={githubUrl}
              onChange={e => setGithubUrl(e.target.value)}
              placeholder="Optional — leave empty for greenfield workspace"
            />
            <p className="cp-mode-hint">
              Leave blank to keep a local-only workspace until a run creates or links a remote.
            </p>
          </label>
        )}

        <label className="cp-field">
          <span className="cp-label">Notes <span className="cp-hint">(local to this browser)</span></span>
          <textarea
            className="cp-input cp-textarea"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Default goals, conventions, or context for runs in this hubspace."
            rows={4}
          />
        </label>

        {error && <p className="cp-error">{error}</p>}

        <div className="cp-actions">
          <button type="button" className="cp-btn cp-btn-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="cp-btn cp-btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create hubspace'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
