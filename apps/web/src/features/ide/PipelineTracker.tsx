import type { PipelineStage } from './swarmUtils';
import './PipelineTracker.css';

export function PipelineTracker({
  stages,
  layout = 'horizontal',
}: {
  stages: PipelineStage[];
  layout?: 'horizontal' | 'vertical';
}) {
  if (stages.length === 0) return null;
  return (
    <div className={`pipeline-tracker layout-${layout}`}>
      {stages.map(stage => (
        <div key={stage.key} className={`pipeline-stage state-${stage.state}`}>
          <span className="pipeline-dot" />
          <span className="pipeline-label">{stage.label}</span>
        </div>
      ))}
    </div>
  );
}
