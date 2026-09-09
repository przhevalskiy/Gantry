import { useState } from 'react';
import { Modal } from '@/components/ui';
import { Template } from '@/shared/types';
import { useProjectStore } from '@/features/projects';
import { useTemplateStore } from '../store';
import './CreateTemplateModal.css';

interface CreateTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  template?: Template;
}

export function CreateTemplateModal({ isOpen, onClose, template }: CreateTemplateModalProps) {
  const { projects } = useProjectStore();
  const { createTemplate, updateTemplate } = useTemplateStore();
  const isEdit = !!template;

  const [name, setName] = useState(template?.name ?? '');
  const [description, setDescription] = useState(template?.description ?? '');
  const [body, setBody] = useState(template?.body ?? '');
  const [hubspaceId, setHubspaceId] = useState(template?.hubspace_id ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Please give the starter a name.'); return; }
    if (!body.trim()) { setError('Add the task prompt the starter should use.'); return; }
    setSubmitting(true);
    setError(null);
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      body: body.trim(),
      hubspace_id: hubspaceId || null,
    };
    try {
      if (isEdit && template) {
        await updateTemplate(template.id, payload);
      } else {
        await createTemplate(payload);
      }
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit starter' : 'New starter'} size="md">
      <form className="create-template-form" onSubmit={handleSubmit}>
        <label className="ct-field">
          <span className="ct-label">Name</span>
          <input
            className="ct-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. A11y remediation run"
            autoFocus
          />
        </label>

        <label className="ct-field">
          <span className="ct-label">Description <span className="ct-hint">(optional)</span></span>
          <input
            className="ct-input"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Short summary shown on the card"
          />
        </label>

        <label className="ct-field">
          <span className="ct-label">Request text <span className="ct-hint">(starts the task)</span></span>
          <textarea
            className="ct-input ct-textarea"
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Fix accessibility violations in the React app and open a PR"
            rows={5}
          />
        </label>

        <label className="ct-field">
          <span className="ct-label">Target hubspace <span className="ct-hint">(optional — files the task & locks its type)</span></span>
          <select className="ct-input" value={hubspaceId} onChange={e => setHubspaceId(e.target.value)}>
            <option value="">None</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>

        {error && <p className="ct-error">{error}</p>}

        <div className="ct-actions">
          <button type="button" className="ct-btn ct-btn-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="ct-btn ct-btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create starter'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
