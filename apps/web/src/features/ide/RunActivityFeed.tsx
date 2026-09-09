import { Check, X } from 'lucide-react';
import { useMemo } from 'react';
import { gantryClient } from '@/shared/services/gantry/client';
import { RunFollowUpComposer } from './RunFollowUpComposer';
import type { HitlPrompt, TaskMessage } from './swarmUtils';
import { getTextContent } from './swarmUtils';
import './RunActivityFeed.css';

type PendingHitl = {
  checkpoint: string;
  workflow_id: string;
  description?: string;
};

export function RunActivityFeed({
  taskId,
  messages,
  status = 'running',
  effectivelyDone = false,
  pendingHitl = [],
  messageHitl = [],
  onHitlResolved,
  onFollowUpSent,
  onTerminated,
}: {
  taskId: string;
  messages: TaskMessage[];
  status?: string;
  effectivelyDone?: boolean;
  pendingHitl?: PendingHitl[];
  messageHitl?: HitlPrompt[];
  onHitlResolved?: () => void;
  onFollowUpSent?: () => void;
  onTerminated?: () => void;
}) {
  const hitlItems = useMemo(() => {
    const seen = new Set<string>();
    const items: PendingHitl[] = [];
    for (const p of [...pendingHitl, ...messageHitl]) {
      if (seen.has(p.workflow_id)) continue;
      seen.add(p.workflow_id);
      items.push(p);
    }
    return items;
  }, [pendingHitl, messageHitl]);

  const handleHitl = async (item: PendingHitl, approved: boolean) => {
    await gantryClient.hitl(taskId, {
      checkpoint: item.checkpoint,
      workflow_id: item.workflow_id,
      approved,
    });
    onHitlResolved?.();
  };

  return (
    <div className="run-activity-feed">
      {hitlItems.map(item => (
        <div key={item.workflow_id} className="run-hitl-card">
          <strong>Approval required</strong>
          <p>{item.description ?? item.checkpoint}</p>
          <div className="run-hitl-actions">
            <button type="button" onClick={() => void handleHitl(item, true)}>
              <Check size={14} /> Approve
            </button>
            <button type="button" className="reject" onClick={() => void handleHitl(item, false)}>
              <X size={14} /> Reject
            </button>
          </div>
        </div>
      ))}

      <div className="run-activity-log">
        {messages.map((msg, i) => {
          const text = getTextContent(msg);
          if (!text || text.startsWith('__')) return null;
          return (
            <div key={i} className="run-activity-line">
              {text}
            </div>
          );
        })}
      </div>

      <RunFollowUpComposer
        taskId={taskId}
        status={status}
        effectivelyDone={effectivelyDone}
        onSent={onFollowUpSent}
        onTerminated={onTerminated}
      />
    </div>
  );
}
