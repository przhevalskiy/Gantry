import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Play, Power, PowerOff } from 'lucide-react';
import { gantryClient } from '@/shared/services/gantry/client';
import { useRunComposeStore } from '@/features/compose';
import './PacksPage.css';

export type FirmPack = {
  pack_id: string;
  ref: string;
  label: string;
  description: string;
  version: string;
  roles: string[];
  playbooks: string[];
  default_playbook: string;
  enabled: boolean;
  installed: boolean;
  auto_enabled?: boolean;
  max_tasks_per_day: number;
};

/**
 * Thin firm-pack catalog + run console (Phase E).
 * Not a chat product — install packs, then start a run with a default playbook.
 */
export function PacksPage() {
  const navigate = useNavigate();
  const setPlaybook = useRunComposeStore(s => s.setPlaybook);
  const [packs, setPacks] = useState<FirmPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const rows = await gantryClient.listPacks();
      setPacks(rows as FirmPack[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load packs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const install = async (packId: string) => {
    setBusyId(packId);
    setError(null);
    try {
      await gantryClient.installPack(packId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Install failed');
    } finally {
      setBusyId(null);
    }
  };

  const setEnabled = async (packId: string, enabled: boolean) => {
    setBusyId(packId);
    setError(null);
    try {
      await gantryClient.updatePack(packId, { enabled });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  const runWithPack = (pack: FirmPack) => {
    setPlaybook(pack.default_playbook);
    navigate('/runs/new');
  };

  return (
    <div className="packs-page">
      <header className="packs-header">
        <h1 className="packs-title">Firm packs</h1>
        <p className="packs-subtitle">
          Versioned role sets and default playbooks for the one Gantry factory. Install a pack,
          then run a job — not separately deployable chat bots.
        </p>
      </header>

      {error && <p className="packs-error">{error}</p>}
      {loading && <p className="packs-muted">Loading packs…</p>}

      <div className="packs-list">
        {packs.map(pack => {
          const busy = busyId === pack.pack_id;
          return (
            <article key={pack.pack_id} className="packs-item">
              <div className="packs-item-icon" aria-hidden>
                <Package size={22} />
              </div>
              <div className="packs-item-body">
                <div className="packs-item-title-row">
                  <h2 className="packs-item-title">{pack.label}</h2>
                  <code className="packs-item-ref">{pack.ref}</code>
                </div>
                <p className="packs-item-desc">{pack.description}</p>
                <p className="packs-item-meta">
                  Playbooks: {pack.playbooks.join(', ')}
                  {' · '}
                  Roles: {pack.roles.length}
                  {' · '}
                  Quota: {pack.max_tasks_per_day}/day
                  {' · '}
                  {pack.installed
                    ? pack.enabled
                      ? 'Installed · enabled'
                      : 'Installed · disabled'
                    : pack.auto_enabled
                      ? 'Built-in'
                      : 'Not installed'}
                </p>
                <div className="packs-item-actions">
                  {!pack.installed && !pack.auto_enabled && (
                    <button
                      type="button"
                      className="packs-btn packs-btn-primary"
                      disabled={busy}
                      onClick={() => void install(pack.pack_id)}
                    >
                      Install
                    </button>
                  )}
                  {!pack.installed && pack.auto_enabled && (
                    <button
                      type="button"
                      className="packs-btn"
                      disabled={busy}
                      onClick={() => void install(pack.pack_id)}
                    >
                      Track install
                    </button>
                  )}
                  {pack.installed && (
                    <button
                      type="button"
                      className="packs-btn"
                      disabled={busy}
                      onClick={() => void setEnabled(pack.pack_id, !pack.enabled)}
                    >
                      {pack.enabled ? (
                        <>
                          <PowerOff size={14} /> Disable
                        </>
                      ) : (
                        <>
                          <Power size={14} /> Enable
                        </>
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    className="packs-btn packs-btn-primary"
                    disabled={pack.installed && !pack.enabled}
                    onClick={() => runWithPack(pack)}
                  >
                    <Play size={14} /> Run {pack.default_playbook}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
