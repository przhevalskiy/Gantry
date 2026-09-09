import { Discussion } from '@/shared/types';
import { DiscussionItem } from './DiscussionItem';

interface DiscussionGroupProps {
  title: string;
  discussions: Discussion[];
  activeDiscussionId: string | null;
  onActivate: (id: string) => void;
  onDelete: (id: string) => void;
}

export function DiscussionGroup({
  title,
  discussions,
  activeDiscussionId,
  onActivate,
  onDelete,
}: DiscussionGroupProps) {
  if (discussions.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="px-3 py-2">
        <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
          {title}
        </span>
      </div>
      <div className="space-y-0.5">
        {discussions.map((discussion) => (
          <DiscussionItem
            key={discussion.id}
            discussion={discussion}
            isActive={discussion.id === activeDiscussionId}
            onActivate={() => onActivate(discussion.id)}
            onDelete={() => onDelete(discussion.id)}
          />
        ))}
      </div>
    </div>
  );
}

// Helper function to group discussions by date
export function groupDiscussionsByDate(discussions: Discussion[]): {
  today: Discussion[];
  yesterday: Discussion[];
  previousWeek: Discussion[];
  older: Discussion[];
} {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const groups = {
    today: [] as Discussion[],
    yesterday: [] as Discussion[],
    previousWeek: [] as Discussion[],
    older: [] as Discussion[],
  };

  discussions.forEach((discussion) => {
    const discussionDate = new Date(discussion.updated_at);
    const discussionDay = new Date(
      discussionDate.getFullYear(),
      discussionDate.getMonth(),
      discussionDate.getDate()
    );

    if (discussionDay.getTime() >= today.getTime()) {
      groups.today.push(discussion);
    } else if (discussionDay.getTime() >= yesterday.getTime()) {
      groups.yesterday.push(discussion);
    } else if (discussionDay.getTime() >= weekAgo.getTime()) {
      groups.previousWeek.push(discussion);
    } else {
      groups.older.push(discussion);
    }
  });

  return groups;
}
