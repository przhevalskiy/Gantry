import { CheckCircle2 } from 'lucide-react';
import './ChecklistMessage.css';

const KEY_LABELS: Record<string, string> = {
  checkpoint: 'Checkpoint',
  workflow_id: 'Workflow',
  description: 'Details',
};

interface ChecklistMessageProps {
  content: string;
  intent?: string;
  onConfirm: (msg: string) => void;
  onEdit: (msg: string) => void;
  onHitlDecision?: (approved: boolean) => void;
}

function parseChecklist(content: string): Array<{ key: string; value: string }> {
  const lines = content.split('\n').slice(1);
  return lines
    .map(line => {
      const match = line.match(/^\*\*(.+?)\*\*:\s*(.+)$/);
      if (!match) return null;
      const rawKey = match[1];
      const rawValue = match[2];
      const label = KEY_LABELS[rawKey] || rawKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      return { key: label, value: rawValue };
    })
    .filter((item): item is { key: string; value: string } => item !== null);
}

export function ChecklistMessage({
  content,
  intent,
  onConfirm,
  onEdit,
  onHitlDecision,
}: ChecklistMessageProps) {
  const fields = parseChecklist(content);
  const isFactoryHitl = intent === 'factory_hitl';

  return (
    <div className="checklist-card">
      <div className="checklist-header">
        <CheckCircle2 size={16} className="checklist-icon" />
        <span className="checklist-title">
          {isFactoryHitl ? 'Approval required' : 'Ready to submit'}
        </span>
      </div>

      <div className="checklist-fields">
        {fields.map(({ key, value }) => (
          <div key={key} className="checklist-field">
            <span className="checklist-field-key">{key}</span>
            <span className="checklist-field-value">{value}</span>
          </div>
        ))}
      </div>

      <div className="checklist-actions">
        {isFactoryHitl ? (
          <>
            <button
              className="checklist-btn-edit"
              type="button"
              onClick={() => onHitlDecision?.(false)}
            >
              Reject
            </button>
            <button
              className="checklist-btn-submit"
              type="button"
              onClick={() => onHitlDecision?.(true)}
            >
              Approve
            </button>
          </>
        ) : (
          <>
            <button
              className="checklist-btn-edit"
              type="button"
              onClick={() => onEdit("I'd like to make some changes")}
            >
              Edit
            </button>
            <button
              className="checklist-btn-submit"
              type="button"
              onClick={() => onConfirm('Yes, proceed')}
            >
              Confirm
            </button>
          </>
        )}
      </div>
    </div>
  );
}
