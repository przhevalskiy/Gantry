import { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Settings,
  User,
  LogOut,
  PanelLeftClose,
  PanelLeft,
  ChevronRight,
  Menu,
  X,
  FolderKanban,
  LayoutTemplate,
  Bot,
  Package,
  PlayCircle,
  Globe,
  Check,
  MessageCirclePlus,
  Plus,
  BookOpen,
} from 'lucide-react';
import { getAvatarIcon } from '@/shared/constants/avatarIcons';
import { ChibiAvatar } from '@/components/chibi/ChibiAvatar';
import { useDiscussionStore } from '@/features/discussions';
import { useWorkspaceCatalogStore } from '@/features/projects';
import { useChatStore } from '@/features/chat';
import { useRunLaunchStore } from '@/features/runs/runLaunchStore';
import { useAuthStore } from '@/features/auth';
import { AccountSettingsModal } from './AccountSettingsModal';
import { useTaskList } from '@/shared/hooks/useTaskList';
import type { GantryTaskSummary } from '@/shared/services/gantry/client';
import { useWorkspaceStore, tasksForWorkspace } from '@/features/workspace';
import './Sidebar.css';

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  const { linkTaskToDiscussion, setActiveDiscussionId } = useDiscussionStore();
  const { fetchWorkspaces, workspaces } = useWorkspaceCatalogStore();
  const { clearMessages } = useChatStore();
  const { user, signOut } = useAuthStore();
  const { tasks, isLoading: tasksLoading, refresh: refreshTasks } = useTaskList(true);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const hydrateWorkspace = useWorkspaceStore((s) => s.hydrate);
  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === activeWorkspaceId),
    [workspaces, activeWorkspaceId],
  );
  const runsSectionTitle = activeWorkspace?.name ?? 'Recent runs';
  const workspaceTasks = useMemo(
    () => tasksForWorkspace(tasks, activeWorkspaceId),
    [tasks, activeWorkspaceId],
  );

  useEffect(() => {
    if (user) fetchWorkspaces();
  }, [fetchWorkspaces, user]);

  useEffect(() => {
    const onSubmitted = (event: Event) => {
      void refreshTasks();
      const detail = (event as CustomEvent<{ task_id?: string; discussion_id?: string }>).detail;
      if (detail?.discussion_id && detail?.task_id) {
        linkTaskToDiscussion(detail.discussion_id, detail.task_id);
      }
    };
    const onWorkspace = () => {
      hydrateWorkspace();
      void fetchWorkspaces();
    };
    window.addEventListener('gantry:task-submitted', onSubmitted);
    window.addEventListener('gantry:workspace-changed', onWorkspace);
    return () => {
      window.removeEventListener('gantry:task-submitted', onSubmitted);
      window.removeEventListener('gantry:workspace-changed', onWorkspace);
    };
  }, [refreshTasks, linkTaskToDiscussion, hydrateWorkspace, fetchWorkspaces]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target as Node)) {
        setShowSettingsMenu(false);
        setShowLanguageMenu(false);
      }
    };
    if (showSettingsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSettingsMenu]);

  const handleNewRun = () => {
    clearMessages();
    setActiveDiscussionId(null);
    useRunLaunchStore.getState().reset();
    navigate('/runs/new');
  };

  const handleLogout = async () => {
    setShowSettingsMenu(false);
    await signOut();
  };

  const activeRunId = location.pathname.startsWith('/runs/')
    ? location.pathname.split('/')[2]
    : null;
  const isComposeActive = location.pathname === '/runs/new';

  const toggleCollapsed = () => setIsCollapsed((prev) => !prev);

  return (
    <>
      <button
        className="mobile-menu-btn"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        aria-label="Toggle menu"
      >
        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <div
        className={`sidebar-overlay ${isMobileMenuOpen ? 'active' : ''}`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      <aside
        className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'mobile-menu-open' : ''}`}
      >
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <ChibiAvatar role="foreman" size={32} motion="still" />
            {!isCollapsed && <span className="sidebar-logo-wordmark">Gantry</span>}
          </div>
          <button
            type="button"
            onClick={toggleCollapsed}
            className="sidebar-collapse-btn"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        <button
          type="button"
          className="sidebar-resize-handle"
          onClick={toggleCollapsed}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        />

        <div className="sidebar-actions">
          <button
            type="button"
            className={`sidebar-new-run-btn ${isComposeActive ? 'active' : ''}`}
            onClick={handleNewRun}
          >
            <Plus size={18} strokeWidth={2.5} />
            {!isCollapsed && <span>New run</span>}
          </button>
        </div>

        <div className="sidebar-nav-links">
          <button
            className={`sidebar-nav-link ${location.pathname.startsWith('/workspaces') ? 'active' : ''}`}
            onClick={() => navigate('/workspaces')}
          >
            <FolderKanban size={18} />
            {!isCollapsed && <span>Workspaces</span>}
          </button>
          <button
            className={`sidebar-nav-link ${
              location.pathname === '/runs' ||
              (location.pathname.startsWith('/runs/') && !isComposeActive)
                ? 'active'
                : ''
            }`}
            onClick={() => navigate('/runs')}
          >
            <PlayCircle size={18} />
            {!isCollapsed && <span>Runs</span>}
          </button>
          <button className="sidebar-nav-link" onClick={() => navigate('/starters')}>
            <LayoutTemplate size={18} />
            {!isCollapsed && <span>Starters</span>}
          </button>
          <button className="sidebar-nav-link" onClick={() => navigate('/agents')}>
            <Bot size={18} />
            {!isCollapsed && <span>Team</span>}
          </button>
          <button
            className={`sidebar-nav-link ${location.pathname.startsWith('/packs') ? 'active' : ''}`}
            onClick={() => navigate('/packs')}
          >
            <Package size={18} />
            {!isCollapsed && <span>Packs</span>}
          </button>
        </div>

        {!isCollapsed && (
          <div className="conversations-header" style={{ margin: '12px 0 4px', padding: '0 8px' }}>
            <h3
              className="sidebar-section-title sidebar-section-title--runs"
              style={{ margin: 0 }}
              title={runsSectionTitle}
            >
              {runsSectionTitle}
            </h3>
          </div>
        )}

        <div className="sidebar-conversations">
          {tasksLoading && tasks.length === 0 ? (
            <div className="sidebar-loading">
              <div className="spinner" />
            </div>
          ) : (
            <div className="conversation-group-list">
                {workspaceTasks.map((task) => (
                  <TaskSidebarItem
                    key={task.task_id}
                    task={task}
                    isActive={task.task_id === activeRunId}
                    isCollapsed={isCollapsed}
                    onSelect={() => {
                      navigate(`/runs/${task.task_id}`);
                      setIsMobileMenuOpen(false);
                    }}
                  />
                ))}
              {!tasksLoading && workspaceTasks.length === 0 && !isCollapsed && (
                <p className="sidebar-empty-tasks">No runs in this workspace yet</p>
              )}
            </div>
          )}
        </div>

        <div className="sidebar-footer">
          <button
            type="button"
            className={`sidebar-api-docs-link ${location.pathname === '/developer' ? 'active' : ''}`}
            onClick={() => navigate('/developer')}
            title="Gantry API overview"
          >
            <BookOpen size={18} />
            {!isCollapsed && <span>API Docs</span>}
          </button>

          <div className="sidebar-user">
            <div className="sidebar-user-avatar">
              {(() => {
                const AvatarIcon = getAvatarIcon(user?.user_metadata?.avatar_icon);
                return <AvatarIcon size={16} />;
              })()}
            </div>
            {!isCollapsed && (
              <>
                <div className="sidebar-user-info">
                  <span className="sidebar-user-name">
                    {user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'User'}
                  </span>
                  <span className="sidebar-user-plan">{user?.email || 'Gantry'}</span>
                </div>
                <div className="sidebar-user-settings-container" ref={settingsMenuRef}>
                  <button
                    className="sidebar-user-settings"
                    onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                  >
                    <Settings size={18} />
                  </button>
                  {showSettingsMenu && (
                    <div className="sidebar-settings-menu">
                      <button
                        className="sidebar-settings-menu-item"
                        onClick={() => {
                          setShowSettingsMenu(false);
                          setShowAccountSettings(true);
                        }}
                      >
                        <User size={14} />
                        <span>Profile</span>
                      </button>
                      <div className="sidebar-settings-menu-item-wrapper">
                        <button
                          className="sidebar-settings-menu-item"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowLanguageMenu(!showLanguageMenu);
                          }}
                        >
                          <Globe size={14} />
                          <span>Language</span>
                          <ChevronRight size={12} className={`language-chevron ${showLanguageMenu ? 'open' : ''}`} />
                        </button>
                        {showLanguageMenu && (
                          <LanguageSubMenu
                            onSelect={() => {
                              setShowLanguageMenu(false);
                              setShowSettingsMenu(false);
                            }}
                          />
                        )}
                      </div>
                      <button className="sidebar-settings-menu-item delete" onClick={handleLogout}>
                        <LogOut size={14} />
                        <span>Logout</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <AccountSettingsModal
          isOpen={showAccountSettings}
          onClose={() => setShowAccountSettings(false)}
        />
      </aside>
    </>
  );
}

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Espa\u00f1ol' },
  { code: 'fr', label: 'Fran\u00e7ais' },
];

function getActiveLanguage(): string {
  const match = document.cookie.match(/googtrans=\/en\/([^;]+)/);
  return match ? match[1] : 'en';
}

function LanguageSubMenu({ onSelect }: { onSelect: () => void }) {
  const activeLang = getActiveLanguage();
  const handleLanguageClick = (langCode: string) => {
    document.cookie = `googtrans=/en/${langCode};path=/;`;
    onSelect();
    window.location.reload();
  };
  return (
    <div className="language-submenu">
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          className={`language-submenu-item ${lang.code === activeLang ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            handleLanguageClick(lang.code);
          }}
        >
          <span>{lang.label}</span>
          {lang.code === activeLang && <Check size={14} className="language-check" />}
        </button>
      ))}
    </div>
  );
}

function TaskSidebarItem({
  task,
  isActive,
  isCollapsed,
  onSelect,
}: {
  task: GantryTaskSummary;
  isActive: boolean;
  isCollapsed?: boolean;
  onSelect: () => void;
}) {
  const status = task.status.toLowerCase();
  const isRunning = !['completed', 'failed', 'cancelled', 'terminated', 'timeout', 'canceled'].includes(status);
  const title = task.goal?.trim() || task.task_id.slice(0, 12);

  return (
    <button
      type="button"
      className={`conversation-item task-sidebar-item ${isActive ? 'active' : ''}`}
      onClick={onSelect}
      title={title}
    >
      {isCollapsed ? (
        <MessageCirclePlus size={16} className="conversation-item-icon" />
      ) : (
        <>
          <span className={`task-status-dot status-${status}${isRunning ? ' pulsing' : ''}`} />
          <span className="conversation-item-title">{title}</span>
        </>
      )}
    </button>
  );
}
