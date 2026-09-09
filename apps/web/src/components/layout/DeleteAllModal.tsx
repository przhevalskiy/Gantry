import './DeleteAllModal.css';

interface DeleteAllModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteAllModal({ isOpen, onClose, onConfirm }: DeleteAllModalProps) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <div className="delete-all-modal-overlay" onClick={onClose}>
      <div className="delete-all-modal" onClick={(e) => e.stopPropagation()}>
        <div className="delete-all-modal-content">
          <h2 className="delete-all-modal-title">Delete All Conversations</h2>
          <p className="delete-all-modal-message">
            Doing this will delete all conversations
          </p>
          <div className="delete-all-modal-actions">
            <button className="delete-all-modal-btn delete-all-modal-btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button className="delete-all-modal-btn delete-all-modal-btn-proceed" onClick={handleConfirm}>
              Proceed
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
