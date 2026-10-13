import { useEffect, useState, type FormEvent } from 'react';
import { gantryClient } from '@/modules/kernel';
import { listWorkspaces, type GantryWorkspace } from '@/modules/workspaces';
import './ListPages.css';

export function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<GantryWorkspace[]>([]);
  const [name, setName] = useState('');
  const [github, setGithub] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refresh = () =>
    listWorkspaces()
      .then(setWorkspaces)
      .catch(e => setError((e as Error).message));

  useEffect(() => {
    void refresh();
  }, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    try {
      await gantryClient.createWorkspace(name.trim(), {
        github_url: github.trim() || undefined,
      });
      setName('');
      setGithub('');
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="list-page">
      <header>
        <h1>Workspaces</h1>
        <p>Repos the firm works in.</p>
      </header>
      <form className="list-page__form" onSubmit={e => void create(e)}>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Workspace name"
          required
        />
        <input
          value={github}
          onChange={e => setGithub(e.target.value)}
          placeholder="GitHub URL (optional)"
        />
        <button type="submit">Add</button>
      </form>
      {error && <p className="list-page__error">{error}</p>}
      <ul className="list-page__rows">
        {workspaces.map(w => (
          <li key={w.id}>
            <span className="list-page__title">{w.name}</span>
            <span className="list-page__meta">{w.github_url || w.id}</span>
          </li>
        ))}
        {!error && workspaces.length === 0 && (
          <li className="list-page__empty">No workspaces yet — add one to file jobs.</li>
        )}
      </ul>
    </div>
  );
}
