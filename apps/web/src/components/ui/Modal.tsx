import { useEffect } from 'react';
import { X } from 'lucide-react';
import './Modal.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  hideCloseButton?: boolean;
}

export function Modal({ isOpen, onClose, title, children, size = 'md', hideCloseButton = false }: ModalProps) {
  // Close on escape key (unless close is hidden)
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !hideCloseButton) onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose, hideCloseButton]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      {/* Backdrop */}
      <div className="modal-backdrop" onClick={hideCloseButton ? undefined : onClose} />

      {/* Modal content */}
      <div className={`modal-container modal-${size}`}>
        {/* Header */}
        {(title || !hideCloseButton) && (
          <div className="modal-header">
            <h2 className="modal-title">{title}</h2>
            {!hideCloseButton && (
              <button onClick={onClose} className="modal-close-btn">
                <X size={20} />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="modal-content">
          {children}
        </div>
      </div>
    </div>
  );
}
