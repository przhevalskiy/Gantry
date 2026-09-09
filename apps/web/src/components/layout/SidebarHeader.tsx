import { Zap, PanelLeftClose, PanelLeft } from 'lucide-react';

interface SidebarHeaderProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function SidebarHeader({ isCollapsed, onToggleCollapse }: SidebarHeaderProps) {
  return (
    <div className="flex items-center justify-between h-16 px-4 border-b border-border-light">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-600">
          <Zap size={18} className="text-white" />
        </div>
        {!isCollapsed && (
          <span className="text-lg font-semibold text-text-primary">Gantry</span>
        )}
      </div>
      {onToggleCollapse && (
        <button
          onClick={onToggleCollapse}
          className="p-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
        </button>
      )}
    </div>
  );
}
