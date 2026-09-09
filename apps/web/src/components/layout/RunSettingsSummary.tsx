import { Link } from 'react-router-dom';
import { Settings2 } from 'lucide-react';
import { getPipelineDefaults } from '@/shared/services/gantry/pipelineDefaults';
import {
  playbookHint,
  playbookLabel,
  runSizeHint,
  runSizeLabel,
} from '@/shared/constants/runConfig';
import './RunSettingsSummary.css';

type Props = {
  compact?: boolean;
};

export function RunSettingsSummary({ compact }: Props) {
  const defaults = getPipelineDefaults();
  const disabled = defaults.disable_agents.filter(Boolean);
  const playbook = defaults.playbook || null;

  if (compact) {
    return (
      <p className="run-settings-summary compact">
        <Settings2 size={14} aria-hidden />
        <span>
          {runSizeLabel(defaults.tier)}
          {playbook ? ` · ${playbookLabel(playbook)}` : ''}
          {disabled.length > 0 ? ` · ${disabled.length} roles off` : ''}
        </span>
        <Link to="/agents">Change</Link>
      </p>
    );
  }

  return (
    <div className="run-settings-summary">
      <div className="run-settings-summary-head">
        <Settings2 size={16} aria-hidden />
        <strong>Default run profile</strong>
        <Link to="/agents">Edit in Team →</Link>
      </div>
      <dl className="run-settings-summary-grid">
        <div>
          <dt>Run size</dt>
          <dd>{runSizeLabel(defaults.tier)}</dd>
          {runSizeHint(defaults.tier) && (
            <dd className="run-settings-hint">{runSizeHint(defaults.tier)}</dd>
          )}
        </div>
        <div>
          <dt>Playbook</dt>
          <dd>{playbookLabel(playbook)}</dd>
          {playbookHint(playbook) && (
            <dd className="run-settings-hint">{playbookHint(playbook)}</dd>
          )}
        </div>
        {disabled.length > 0 && (
          <div>
            <dt>Skipped roles</dt>
            <dd>{disabled.join(', ')}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
