import { useState } from 'react';
import { MessageSquare, MoreHorizontal, Trash2, Edit3 } from 'lucide-react';
import { Discussion } from '@/shared/types';
import { Dropdown } from '@/components/ui';
import { Modal } from '@/components/ui';

interface DiscussionItemProps {
  discussion: Discussion;
  isActive: boolean;
  onActivate: () => void;
  onDelete: () => void;
}

export function DiscussionItem({
  discussion,
  isActive,
  onActivate,
  onDelete,
}: DiscussionItemProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const dropdownItems = [
    {
      label: 'Rename',
      icon: <Edit3 size={16} />,
      onClick: () => console.log('Rename clicked'),
    },
    {
      label: 'Delete',
      icon: <Trash2 size={16} />,
      onClick: () => setShowDeleteConfirm(true),
      danger: true,
    },
  ];

  return (
    <>
      <div
        className={`group flex cursor-pointer items-center gap-3 mx-2 px-3 py-2.5 rounded-lg transition-all duration-150 ${
          isActive
            ? 'bg-brand-50 text-brand-700 border border-brand-200'
            : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary border border-transparent'
        }`}
        onClick={onActivate}
      >
        <MessageSquare
          size={18}
          className={`flex-shrink-0 ${isActive ? 'text-brand-600' : 'text-text-tertiary'}`}
        />
        <span className="flex-1 truncate text-sm font-medium">{discussion.title}</span>

        <div
          className="opacity-0 transition-opacity group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <Dropdown
            trigger={
              <button
                className={`rounded-md p-1.5 transition-colors ${
                  isActive
                    ? 'hover:bg-brand-100 text-brand-600'
                    : 'hover:bg-bg-hover text-text-tertiary hover:text-text-primary'
                }`}
              >
                <MoreHorizontal size={16} />
              </button>
            }
            items={dropdownItems}
          />
        </div>
      </div>

      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Discussion"
      >
        <p className="mb-6 text-text-secondary">
          Are you sure you want to delete "<span className="font-medium text-text-primary">{discussion.title}</span>"? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="px-4 py-2 text-sm font-medium text-text-secondary bg-bg-tertiary hover:bg-bg-hover rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onDelete();
              setShowDeleteConfirm(false);
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
          >
            Delete
          </button>
        </div>
      </Modal>
    </>
  );
}
