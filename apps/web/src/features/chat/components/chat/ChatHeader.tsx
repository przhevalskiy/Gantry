import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Paperclip, FolderKanban } from 'lucide-react';
import { AttachmentPanel } from '../attachments/AttachmentPanel';
import { FilePreviewModal } from '../attachments/FilePreviewModal';
import ExportDropdown from '../ui/ExportDropdown';
import { useChatStore } from '../../store';
import { useAttachmentStore } from '@/features/attachments/store';
import { useDiscussionStore } from '@/features/discussions';
import { useProjectStore } from '@/features/projects';
import './ChatHeader.css';

interface ChatHeaderProps {
  discussionId: string;
  discussionTitle: string;
}

export function ChatHeader({ discussionId, discussionTitle }: ChatHeaderProps) {
  const navigate = useNavigate();
  const [showAttachments, setShowAttachments] = useState(false);
  const { messages } = useChatStore();
  const { attachments, fetchAttachments, reset } = useAttachmentStore();
  const { discussions } = useDiscussionStore();
  const { getProjectById } = useProjectStore();

  const discussion = discussions.find((d) => d.id === discussionId);
  const project = discussion?.project_id ? getProjectById(discussion.project_id) : undefined;

  useEffect(() => {
    reset();
    if (discussionId) {
      fetchAttachments(discussionId);
    }
  }, [discussionId, fetchAttachments, reset]);

  return (
    <>
      <div className="chat-header">
        {project && (
          <button
            className="chat-header-breadcrumb"
            onClick={() => navigate(`/hubspaces/${project.id}`)}
            title="Back to hubspace"
          >
            <FolderKanban size={14} />
            <span>{project.name}</span>
          </button>
        )}
        <div className="chat-header-actions">
          <button
            className="chat-header-btn"
            onClick={() => setShowAttachments(!showAttachments)}
            title="Conversation attachments"
          >
            <Paperclip size={18} />
            <span className="visually-hidden">Attachments</span>
            {attachments.length > 0 && (
              <span className="chat-header-badge">{attachments.length}</span>
            )}
          </button>

          <ExportDropdown
            mode="conversation"
            messages={messages}
            title={discussionTitle || 'Gantry Conversation'}
          >
            {(_open, toggle) => (
              <button
                className="chat-header-btn"
                onClick={toggle}
                disabled={messages.length === 0}
                title="Download conversation"
              >
                <Download size={18} />
                <span className="visually-hidden">Download</span>
              </button>
            )}
          </ExportDropdown>
        </div>

        {showAttachments && (
          <AttachmentPanel
            discussionId={discussionId}
            isOpen={showAttachments}
            onClose={() => setShowAttachments(false)}
          />
        )}
      </div>

      <FilePreviewModal />
    </>
  );
}
