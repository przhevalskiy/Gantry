import { useRef, useState } from 'react';
import { Paperclip, X, FileText, Upload, Eye, Trash2 } from 'lucide-react';
import { useAttachmentStore } from '@/features/attachments/store';
import './AttachmentPanel.css';

const ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.md', '.docx'];
const ALLOWED_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

interface AttachmentPanelProps {
  discussionId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function AttachmentPanel({ discussionId, isOpen, onClose }: AttachmentPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    attachments,
    isUploading,
    uploadProgress,
    uploadAttachment,
    deleteAttachment,
    loadPreview,
  } = useAttachmentStore();

  if (!isOpen) return null;

  const validateFile = (file: File): boolean => {
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.includes(extension)) {
      setError(`Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum size is 10MB');
      return false;
    }
    return true;
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    const file = files[0];
    if (!validateFile(file)) return;

    try {
      await uploadAttachment(discussionId, file);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDelete = async (attachmentId: string) => {
    try {
      await deleteAttachment(discussionId, attachmentId);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <>
      <div className="attachment-panel-backdrop" onClick={onClose} />
      <div className="attachment-panel">
        <div className="attachment-panel-header">
          <div className="attachment-panel-title">
            <Paperclip size={16} />
            <span>Conversation Attachments</span>
          </div>
          <button onClick={onClose} className="attachment-panel-close" type="button">
            <X size={16} />
          </button>
        </div>

        <p className="attachment-panel-desc">
          Attached files provide context for this conversation. They are not indexed into the knowledge base.
        </p>

        {attachments.length > 0 && (
          <div className="attachment-panel-list">
            {attachments.map((att) => (
              <div key={att.id} className="attachment-panel-item">
                <FileText size={16} className="attachment-panel-item-icon" />
                <div className="attachment-panel-item-info">
                  <span className="attachment-panel-item-name">{att.filename}</span>
                  <span className="attachment-panel-item-meta">
                    {formatSize(att.file_size)} &middot; {att.chunk_count} chunks
                  </span>
                </div>
                <button
                  onClick={() => loadPreview(discussionId, att.id)}
                  className="attachment-panel-action-btn"
                  title="Preview"
                  type="button"
                >
                  <Eye size={14} />
                </button>
                <button
                  onClick={() => handleDelete(att.id)}
                  className="attachment-panel-action-btn delete"
                  title="Remove"
                  type="button"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          className={`attachment-panel-dropzone ${isDragging ? 'dragging' : ''}`}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={20} />
          <span>Drop file or click to attach</span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS.join(',')}
          onChange={(e) => handleFileSelect(e.target.files)}
          style={{ display: 'none' }}
        />

        {isUploading && uploadProgress > 0 && (
          <div className="attachment-panel-progress">
            <div className="attachment-panel-progress-bar">
              <div
                className="attachment-panel-progress-fill"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="attachment-panel-error">
            {error}
            <button onClick={() => setError(null)} type="button">Dismiss</button>
          </div>
        )}
      </div>
    </>
  );
}
