import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BadgePlus, Paperclip, X, FileText, ImageIcon, Upload,
  FolderKanban, LayoutTemplate, ChevronRight, ArrowLeft,
} from 'lucide-react';
import { useAttachmentStore } from '@/features/attachments/store';
import { useDiscussionStore } from '@/features/discussions';
import { useProjectStore } from '@/features/projects';
import { useTemplateStore } from '@/features/templates';
import { useChatStore } from '@/features/chat';
import { Template } from '@/shared/types';
import './InputActionsDropdown.css';

const ALLOWED_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
];

const ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.md', '.docx', '.jpg', '.jpeg', '.png', '.webp'];

type MenuView = 'root' | 'hubspaces' | 'starters';

export function InputActionsDropdown() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<MenuView>('root');
  const [showAttachments, setShowAttachments] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { activeDiscussionId, createDiscussion, setActiveDiscussionId, moveDiscussionToProject } = useDiscussionStore();
  const { attachments, isUploading, uploadProgress, uploadAttachment, deleteAttachment } = useAttachmentStore();
  const { projects, fetchProjects } = useProjectStore();
  const { templates, fetchTemplates } = useTemplateStore();
  const { clearMessages } = useChatStore();

  // Reset to the root view and refresh hubspace/starter lists each time it opens.
  useEffect(() => {
    if (isOpen) {
      setView('root');
      if (projects.length === 0) fetchProjects();
      if (templates.length === 0) fetchTemplates();
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeMenu = () => { setIsOpen(false); setView('root'); };

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

  const ensureDiscussion = async (): Promise<string> => {
    if (activeDiscussionId) return activeDiscussionId;
    const newDiscussion = await createDiscussion();
    navigate(`/chat/${newDiscussion.id}`);
    return newDiscussion.id;
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    const file = files[0];
    if (!validateFile(file)) return;
    try {
      const discussionId = await ensureDiscussion();
      await uploadAttachment(discussionId, file);
      setShowAttachments(true);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleAttachFiles = () => {
    closeMenu();
    if (attachments.length > 0) {
      setShowAttachments(true);
    } else {
      fileInputRef.current?.click();
    }
  };

  const pickHubspace = async (hubId: string) => {
    closeMenu();
    // File the current conversation if one exists, otherwise start a task there.
    if (activeDiscussionId) {
      await moveDiscussionToProject(activeDiscussionId, hubId);
    } else {
      const d = await createDiscussion({ project_id: hubId });
      navigate(`/chat/${d.id}`);
    }
  };

  const pickTemplate = async (t: Template) => {
    closeMenu();
    if (t.hubspace_id) {
      const d = await createDiscussion({ project_id: t.hubspace_id });
      navigate(`/chat/${d.id}`, { state: { initialMessage: t.body } });
    } else {
      clearMessages();
      setActiveDiscussionId(null);
      navigate('/chat', { state: { initialMessage: t.body } });
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!activeDiscussionId) return;
    try {
      await deleteAttachment(activeDiscussionId, attachmentId);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="input-actions">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="input-actions-trigger"
        title="Actions"
      >
        <BadgePlus size={20} />
        {attachments.length > 0 && (
          <span className="input-actions-badge">{attachments.length}</span>
        )}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_EXTENSIONS.join(',')}
        onChange={(e) => handleFileSelect(e.target.files)}
        style={{ display: 'none' }}
      />

      {isOpen && (
        <>
          <div className="input-actions-backdrop" onClick={closeMenu} />
          <div className="input-actions-dropdown">
            {/* Root menu */}
            {view === 'root' && (
              <>
                <button type="button" className="input-actions-item" onClick={handleAttachFiles}>
                  <Paperclip size={18} />
                  <div className="input-actions-item-content">
                    <span className="input-actions-item-label">Attach a file</span>
                    <span className="input-actions-item-desc">Add context to this conversation</span>
                  </div>
                  {attachments.length > 0 && (
                    <span className="input-actions-item-count">{attachments.length}</span>
                  )}
                </button>

                <button type="button" className="input-actions-item" onClick={() => setView('hubspaces')}>
                  <FolderKanban size={18} />
                  <div className="input-actions-item-content">
                    <span className="input-actions-item-label">Work under a hubspace</span>
                    <span className="input-actions-item-desc">Organize this request</span>
                  </div>
                  {projects.length > 0
                    ? <span className="input-actions-item-count">{projects.length}</span>
                    : <ChevronRight size={16} className="input-actions-item-chevron" />}
                </button>

                <button type="button" className="input-actions-item" onClick={() => setView('starters')}>
                  <LayoutTemplate size={18} />
                  <div className="input-actions-item-content">
                    <span className="input-actions-item-label">Use a starter</span>
                    <span className="input-actions-item-desc">Start from a saved task prompt</span>
                  </div>
                  {templates.length > 0
                    ? <span className="input-actions-item-count">{templates.length}</span>
                    : <ChevronRight size={16} className="input-actions-item-chevron" />}
                </button>
              </>
            )}

            {/* Hubspaces submenu */}
            {view === 'hubspaces' && (
              <div className="input-actions-submenu">
                <button type="button" className="input-actions-back" onClick={() => setView('root')}>
                  <ArrowLeft size={15} /> Work under a hubspace
                </button>
                <div className="input-actions-sublist">
                  {projects.length === 0 ? (
                    <button type="button" className="input-actions-setup" onClick={() => { closeMenu(); navigate('/hubspaces'); }}>
                      No hubspaces yet — set one up →
                    </button>
                  ) : (
                    projects.map((p) => (
                      <button key={p.id} type="button" className="input-actions-subitem" onClick={() => pickHubspace(p.id)}>
                        <FolderKanban size={14} /> {p.name}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Starters submenu */}
            {view === 'starters' && (
              <div className="input-actions-submenu">
                <button type="button" className="input-actions-back" onClick={() => setView('root')}>
                  <ArrowLeft size={15} /> Use a starter
                </button>
                <div className="input-actions-sublist">
                  {templates.length === 0 ? (
                    <button type="button" className="input-actions-setup" onClick={() => { closeMenu(); navigate('/starters'); }}>
                      No starters yet — set one up →
                    </button>
                  ) : (
                    templates.map((t) => (
                      <button key={t.id} type="button" className="input-actions-subitem" onClick={() => pickTemplate(t)}>
                        <LayoutTemplate size={14} /> {t.name}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {showAttachments && attachments.length > 0 && (
        <>
          <div className="input-actions-backdrop" onClick={() => setShowAttachments(false)} />
          <div className="input-actions-documents">
            <div className="input-actions-documents-header">
              <span>Conversation Attachments</span>
              <button onClick={() => setShowAttachments(false)} type="button">
                <X size={16} />
              </button>
            </div>

            <div className="input-actions-documents-list">
              {attachments.map((att) => (
                <div key={att.id} className="input-actions-doc-item selected">
                  {att.is_image ? <ImageIcon size={16} /> : <FileText size={16} />}
                  <span className="input-actions-doc-name">{att.filename}</span>
                  <button onClick={() => handleDeleteAttachment(att.id)} type="button">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              className={`input-actions-dropzone ${isDragging ? 'dragging' : ''}`}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={18} />
              <span>Drop file or click to attach</span>
            </div>
          </div>
        </>
      )}

      {isUploading && uploadProgress > 0 && (
        <div className="input-actions-progress">
          <div className="input-actions-progress-bar">
            <div className="input-actions-progress-fill" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}

      {error && (
        <div className="input-actions-error">
          {error}
          <button onClick={() => setError(null)} type="button">Dismiss</button>
        </div>
      )}
    </div>
  );
}
