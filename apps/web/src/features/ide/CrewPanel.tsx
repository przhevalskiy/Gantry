import { ExternalLink } from 'lucide-react';
import { PipelineTracker } from './PipelineTracker';
import { RunReportCard } from './RunReportCard';
import type { PipelineMeta, PipelineStage } from './swarmUtils';
import './CrewPanel.css';

type Props = {
  stages: PipelineStage[];
  pipelineMeta: PipelineMeta;
  prUrl?: string | null;
  tierLabel?: string | null;
};

export function CrewPanel({ stages, pipelineMeta, prUrl, tierLabel }: Props) {
  const { tierMeta, isReplanning, finalReport, coveragePct } = pipelineMeta;
  const deployed = stages.filter(s => s.state !== 'pending').length;

  return (
    <div className="crew-panel">
      {(tierMeta || tierLabel) && (
        <div className="crew-tier-card">
          <strong>
            Tier {tierMeta?.tier ?? '—'}
            {tierMeta?.label ? ` · ${tierMeta.label}` : tierLabel ? ` · ${tierLabel}` : ''}
          </strong>
          {tierMeta?.estimatedFiles != null && (
            <span>~{tierMeta.estimatedFiles} files</span>
          )}
          {tierMeta?.estimatedMinutes != null && (
            <span>~{tierMeta.estimatedMinutes} min</span>
          )}
          {tierMeta?.riskFlags && tierMeta.riskFlags.length > 0 && (
            <span className="crew-risk">⚠ {tierMeta.riskFlags.slice(0, 3).join(', ')}</span>
          )}
        </div>
      )}

      {isReplanning && (
        <div className="crew-replan-banner">
          <span className="crew-replan-dot" />
          Architect re-planning after build failure…
        </div>
      )}

      <p className="crew-deployed">
        {deployed} of {stages.length} agents deployed
      </p>

      <PipelineTracker stages={stages} layout="vertical" />

      {prUrl && (
        <a href={prUrl} target="_blank" rel="noopener noreferrer" className="crew-pr-link">
          Pull Request <ExternalLink size={12} />
        </a>
      )}

      {finalReport && (
        <>
          <p className="crew-section-label">Report</p>
          <RunReportCard report={finalReport} coveragePct={coveragePct} />
        </>
      )}
    </div>
  );
}
