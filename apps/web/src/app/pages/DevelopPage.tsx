import { gantryBaseUrl } from '@/deploy';
import './ListPages.css';

export function DevelopPage() {
  const base = gantryBaseUrl();

  return (
    <div className="list-page">
      <header>
        <h1>Develop</h1>
        <p>API-first firm — the UI is an optional theater over `/v1/*`.</p>
      </header>
      <div className="develop-block">
        <h2>Base URL</h2>
        <code>{base || '(same origin / proxy)'}</code>
        <h2>Primary surfaces</h2>
        <ul>
          <li>
            <code>POST /v1/tasks</code> — file a job
          </li>
          <li>
            <code>GET /v1/tasks/:id/events</code> — SSE engagement stream
          </li>
          <li>
            <code>POST /v1/tasks/:id/hitl</code> — partner approval
          </li>
          <li>
            <code>GET /v1/playbooks</code> · <code>POST /v1/playbooks/run</code> — briefs
          </li>
          <li>
            <code>GET /v1/packs</code> — practices
          </li>
          <li>
            <code>GET /v1/agents</code> — Operator catalog
          </li>
        </ul>
        <p className="list-page__desc">
          One ACP citizen: <strong>swarm-factory</strong>. No bot marketplace.
        </p>
      </div>
    </div>
  );
}
