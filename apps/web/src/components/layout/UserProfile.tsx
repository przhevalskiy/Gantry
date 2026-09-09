import { User, Settings, LogOut } from 'lucide-react';
import { Dropdown } from '@/components/ui';

interface UserProfileProps {
  isCollapsed?: boolean;
}

export function UserProfile({ isCollapsed }: UserProfileProps) {
  const dropdownItems = [
    {
      label: 'Settings',
      icon: <Settings size={16} />,
      onClick: () => console.log('Settings clicked'),
    },
    {
      label: 'Sign out',
      icon: <LogOut size={16} />,
      onClick: () => console.log('Sign out clicked'),
      danger: true,
    },
  ];

  if (isCollapsed) {
    return (
      <div className="p-3 border-t border-border-light">
        <button className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-bg-tertiary transition-colors">
          <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center">
            <User size={16} className="text-brand-600" />
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="p-3 border-t border-border-light">
      <Dropdown
        trigger={
          <button className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-bg-tertiary transition-colors">
            <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
              <User size={18} className="text-brand-600" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <div className="text-sm font-medium text-text-primary truncate">
                User
              </div>
              <div className="text-xs text-text-tertiary">
                Educator
              </div>
            </div>
          </button>
        }
        items={dropdownItems}
        align="left"
      />
    </div>
  );
}
