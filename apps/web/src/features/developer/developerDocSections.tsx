import type { ReactNode } from 'react';

export type DocNavItem = { id: string; label: string };

export const DOC_NAV: DocNavItem[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'quickstart', label: 'Quick start' },
  { id: 'auth', label: 'Authentication' },
  { id: 'workspaces', label: 'Workspaces' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'streaming', label: 'Streaming' },
  { id: 'hitl', label: 'Human-in-the-loop' },
  { id: 'playbooks', label: 'Playbooks' },
  { id: 'packs', label: 'Firm packs' },
  { id: 'agents', label: 'Agents' },
  { id: 'secrets', label: 'Secrets' },
  { id: 'webhooks', label: 'Webhooks' },
  { id: 'files', label: 'Workspace files' },
  { id: 'errors', label: 'Errors & limits' },
];

export function DocSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="developer-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function DocLead({ children }: { children: ReactNode }) {
  return <p className="developer-lead">{children}</p>;
}

export function DocPre({ children }: { children: string }) {
  return <pre className="developer-code">{children}</pre>;
}

export function DocSubhead({ children }: { children: ReactNode }) {
  return <h3 className="developer-subhead">{children}</h3>;
}

export function DocList({ items }: { items: string[] }) {
  return (
    <ul className="developer-list">
      {items.map(item => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function DocEndpoint({
  method,
  path,
  summary,
  scope,
}: {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  summary: string;
  scope?: string;
}) {
  return (
    <div className="developer-endpoint">
      <div className="developer-endpoint-line">
        <span className={`developer-method developer-method--${method.toLowerCase()}`}>{method}</span>
        <code className="developer-path">{path}</code>
      </div>
      <p>{summary}</p>
      {scope && <span className="developer-scope">Scope: {scope}</span>}
    </div>
  );
}

export function DocTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="developer-table-wrap">
      <table className="developer-table">
        <thead>
          <tr>
            {headers.map(h => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DocCallout({ children }: { children: ReactNode }) {
  return <div className="developer-callout">{children}</div>;
}
