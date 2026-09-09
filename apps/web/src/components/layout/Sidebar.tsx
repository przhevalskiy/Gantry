import { useEffect, useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { SquarePen, MessageCirclePlus, Settings, User, Trash2, PanelLeftClose, PanelLeft, MoreVertical, MoreHorizontal, ArrowUpDown, Check, Copy, LogOut, Sparkles, Globe, ChevronRight, Menu, X, FolderKanban, FolderInput, LayoutTemplate, Bot } from 'lucide-react';
import { getAvatarIcon } from '@/shared/constants/avatarIcons';
import { useDiscussionStore } from '@/features/discussions';
import { useProjectStore } from '@/features/projects';
import { useChatStore } from '@/features/chat';
import { useAuthStore } from '@/features/auth';
import { Discussion, Project } from '@/shared/types';
import logo from '../../assets/logo.png';
import { SampleQuestionsDropdown } from './SampleQuestionsDropdown';
import { AccountSettingsModal } from './AccountSettingsModal';
import { DeleteAllModal } from './DeleteAllModal';
import { TRACK_STARTERS } from '@/shared/constants/sampleQuestions';
import { useTaskList } from '@/shared/hooks/useTaskList';
import type { GantryTaskSummary } from '@/shared/services/gantry/client';
import './Sidebar.css';

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showSampleQuestions, setShowSampleQuestions] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [showConversationsMenu, setShowConversationsMenu] = useState(false);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const sampleQuestionsRef = useRef<HTMLDivElement>(null);
  const conversationsMenuRef = useRef<HTMLDivElement>(null);
  const {
    discussions,
    activeDiscussionId,
    isLoading,
    fetchDiscussions,
    createDiscussion,
    deleteDiscussion,
    deleteAllDiscussions,
    activateDiscussion,
    setActiveDiscussionId,
    moveDiscussionToProject,
  } = useDiscussionStore();
  const { projects, fetchProjects } = useProjectStore();
  const { clearMessages } = useChatStore();
  const { user, signOut } = useAuthStore();
  const { tasks, isLoading: tasksLoading, refresh: refreshTasks } = useTaskList(true);

  useEffect(() => {
    if (user) {
      fetchDiscussions();
      fetchProjects();
    }
  }, [fetchDiscussions, fetchProjects, user]);

  useEffect(() => {
    const onSubmitted = () => { void refreshTasks(); };
    window.addEventListener('gantry:task-submitted', onSubmitted);
    return () => window.removeEventListener('gantry:task-submitted', onSubmitted);
  }, [refreshTasks]);

  // Close settings menu when clicking outside
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

  // Close sample questions dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Check if click is inside the container OR inside the dropdown menu (which is position: fixed)
      const isInsideContainer = sampleQuestionsRef.current && sampleQuestionsRef.current.contains(target);
      const isInsideMenu = (target as Element).closest?.('.sample-questions-dropdown-menu');

      if (!isInsideContainer && !isInsideMenu) {
        setShowSampleQuestions(false);
      }
    };

    if (showSampleQuestions) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSampleQuestions]);

  // Close conversations menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (conversationsMenuRef.current && !conversationsMenuRef.current.contains(event.target as Node)) {
        setShowConversationsMenu(false);
      }
    };
    if (showConversationsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showConversationsMenu]);

  const handleOpenAgents = () => {
    navigate('/agents');
  };

  const handleNewChat = () => {
    // Navigate to empty chat - discussion will be created when user sends first message
    navigate('/chat');
  };

  const handleSampleQuestionSelect = (question: string) => {
    setShowSampleQuestions(false);
    console.log('Sample question selected:', question);
    // Clear any existing messages and discussion, then navigate with the question
    clearMessages();
    setActiveDiscussionId(null);
    setPendingQuestion(question);
    console.log('Navigating to /chat with initialMessage');
    navigate('/chat', { state: { initialMessage: question } });
  };

  const handleLogout = async () => {
    setShowSettingsMenu(false);
    await signOut();
  };

  const handleDeleteAll = async () => {
    try {
      await deleteAllDiscussions();
      clearMessages();
      setActiveDiscussionId(null);
      navigate('/chat');
    } catch (error) {
      console.error('Failed to delete all discussions:', error);
    }
  };

  const handleSelectDiscussion = (id: string) => {
    // Navigate to discussion URL - this will trigger the URL effect in ChatPage
    navigate(`/chat/${id}`);
    // Also call API to mark as active on backend (fire-and-forget)
    activateDiscussion(id);
    // Close mobile menu when selecting a discussion
    setIsMobileMenuOpen(false);
  };

  // Group discussions by date
  const groupByDate = (items: Discussion[]) => {
    const today: Discussion[] = [];
    const yesterday: Discussion[] = [];
    const previous7Days: Discussion[] = [];
    const older: Discussion[] = [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

    items.forEach((item) => {
      const itemDate = new Date(item.updated_at);
      if (itemDate >= todayStart) {
        today.push(item);
      } else if (itemDate >= yesterdayStart) {
        yesterday.push(item);
      } else if (itemDate >= weekStart) {
        previous7Days.push(item);
      } else {
        older.push(item);
      }
    });

    return { today, yesterday, previous7Days, older };
  };

  const sortedDiscussions = sortOrder === 'oldest' ? [...discussions].reverse() : discussions;
  const draftDiscussions = useMemo(
    () => sortedDiscussions.filter(d => !d.task_id),
    [sortedDiscussions],
  );
  const activeRunId = location.pathname.startsWith('/runs/')
    ? location.pathname.split('/')[2]
    : null;
  const listLoading = isLoading && discussions.length === 0 && tasks.length === 0 && tasksLoading;

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        className="mobile-menu-btn"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        aria-label="Toggle menu"
      >
        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay ${isMobileMenuOpen ? 'active' : ''}`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      <aside
        className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'mobile-menu-open' : ''}`}
        onClick={(e) => {
          if (!isCollapsed) return;
          if ((e.target as HTMLElement).closest('button, a, input, [role="button"]')) return;
          setIsCollapsed(false);
        }}
      >
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-logo">
          {!isCollapsed && <span className="sidebar-logo-wordmark">Gantry</span>}
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="sidebar-collapse-btn"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      {/* Navigation Links */}
      <div className="sidebar-nav-links">
        <button
          onClick={handleNewChat}
          disabled={isLoading}
          className="sidebar-nav-link"
        >
          <SquarePen size={18} />
          {!isCollapsed && <span>New Task</span>}
        </button>
        <button className="sidebar-nav-link" onClick={() => navigate('/hubspaces')}>
          <FolderKanban size={18} />
          {!isCollapsed && <span>Hubspaces</span>}
        </button>
        <button className="sidebar-nav-link" onClick={() => navigate('/starters')}>
          <LayoutTemplate size={18} />
          {!isCollapsed && <span>Starters</span>}
        </button>
        <button className="sidebar-nav-link" onClick={handleOpenAgents}>
          <Bot size={18} />
          {!isCollapsed && <span>Team</span>}
        </button>
      </div>

      {/* Conversations header — outside scroll container to avoid overflow clipping */}
      {!isCollapsed && (
        <div className="conversations-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start', gap: '6px', margin: '12px 0 4px', padding: '0 8px' }}>
          <h3 className="sidebar-section-title" style={{ margin: 0 }}>Tasks</h3>
          {discussions.length + tasks.length >= 4 && (
            <div className="conversations-menu-container" ref={conversationsMenuRef}>
              <button
                className="conversations-menu-btn"
                onClick={() => setShowConversationsMenu(!showConversationsMenu)}
                title="Conversation options"
              >
                <MoreHorizontal size={16} />
              </button>
              {showConversationsMenu && (
                <div className="conversations-menu-dropdown">
                  <button
                    className="conversations-menu-item"
                    onClick={() => { setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest'); setShowConversationsMenu(false); }}
                  >
                    <ArrowUpDown size={14} />
                    <span>{sortOrder === 'newest' ? 'Oldest first' : 'Newest first'}</span>
                  </button>
                  <button className="conversations-menu-item delete" onClick={() => { setShowConversationsMenu(false); setShowDeleteAllModal(true); }}>
                    <Trash2 size={14} />
                    <span>Delete all</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Conversations List */}
      <div className="sidebar-conversations">
        {listLoading ? (
          <div className="sidebar-loading">
            <div className="spinner" />
          </div>
        ) : (
          <>
            {/* Journey button - always visible */}
            <div className="sidebar-journey-section">
              {/* Normal state - full journey button */}
              <div className="sidebar-journey-normal">
                <div className="sidebar-start-journey-container" ref={sampleQuestionsRef}>
                  <button className="sidebar-start-journey-btn" onClick={() => setShowSampleQuestions(!showSampleQuestions)}>
                    <Sparkles size={16} />
                    <span>Quick start</span>
                  </button>
                  <SampleQuestionsDropdown
                    isOpen={showSampleQuestions}
                    onToggle={() => setShowSampleQuestions(!showSampleQuestions)}
                    onQuestionSelect={handleSampleQuestionSelect}
                    questions={TRACK_STARTERS}
                    isCollapsed={isCollapsed}
                  />
                </div>
              </div>

              {/* Collapsed state - just sparkle icon */}
              <div className="sidebar-journey-collapsed">
                <button
                  className="sidebar-collapsed-sparkle-btn"
                  onClick={() => setShowSampleQuestions(!showSampleQuestions)}
                >
                  <Sparkles size={20} />
                </button>
                <SampleQuestionsDropdown
                  isOpen={showSampleQuestions}
                  onToggle={() => setShowSampleQuestions(!showSampleQuestions)}
                  onQuestionSelect={handleSampleQuestionSelect}
                  questions={TRACK_STARTERS}
                  isCollapsed={isCollapsed}
                />
              </div>
            </div>

            <div className="conversation-group-list">
              {tasks.map(task => (
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

              {draftDiscussions.map(discussion => (
                <ConversationItem
                  key={discussion.id}
                  discussion={discussion}
                  isActive={discussion.id === activeDiscussionId}
                  onSelect={() => handleSelectDiscussion(discussion.id)}
                  onDelete={() => deleteDiscussion(discussion.id)}
                  onActivate={() => activateDiscussion(discussion.id)}
                  projects={projects}
                  onMoveToProject={(pid) => moveDiscussionToProject(discussion.id, pid)}
                  isCollapsed={isCollapsed}
                />
              ))}

              {!tasksLoading && tasks.length === 0 && draftDiscussions.length === 0 && !isCollapsed && (
                <p className="sidebar-empty-tasks">No tasks yet</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">
            {(() => { const AvatarIcon = getAvatarIcon(user?.user_metadata?.avatar_icon); return <AvatarIcon size={16} />; })()}
          </div>
          {!isCollapsed && (
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'User'}</span>
              <span className="sidebar-user-plan">{user?.email || 'Educator'}</span>
            </div>
          )}
          {!isCollapsed && (
            <div className="sidebar-user-settings-container" ref={settingsMenuRef}>
              <button
                className="sidebar-user-settings"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSettingsMenu(!showSettingsMenu);
                }}
              >
                <Settings size={18} />
              </button>
              {showSettingsMenu && (
                <div className="sidebar-settings-menu">
                  <button className="sidebar-settings-menu-item" onClick={() => { setShowSettingsMenu(false); setShowLanguageMenu(false); setShowAccountSettings(true); }}>
                    <User size={14} />
                    <span>Profile</span>
                  </button>
                  <div className="sidebar-settings-menu-item-wrapper">
                    <button
                      className="sidebar-settings-menu-item"
                      onClick={(e) => { e.stopPropagation(); setShowLanguageMenu(!showLanguageMenu); }}
                    >
                      <Globe size={14} />
                      <span>Language</span>
                      <ChevronRight size={12} className={`language-chevron ${showLanguageMenu ? 'open' : ''}`} />
                    </button>
                    {showLanguageMenu && (
                      <LanguageSubMenu onSelect={() => { setShowLanguageMenu(false); setShowSettingsMenu(false); }} />
                    )}
                  </div>
                  <button className="sidebar-settings-menu-item delete" onClick={handleLogout}>
                    <LogOut size={14} />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Account Settings Modal */}
      <AccountSettingsModal
        isOpen={showAccountSettings}
        onClose={() => setShowAccountSettings(false)}
      />

      {/* Delete All Modal */}
      <DeleteAllModal
        isOpen={showDeleteAllModal}
        onClose={() => setShowDeleteAllModal(false)}
        onConfirm={handleDeleteAll}
      />

      <div
        className="sidebar-resize-handle"
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      />
    </aside>
    </>
  );
}

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Espa\u00f1ol' },
  { code: 'fr', label: 'Fran\u00e7ais' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pt', label: 'Portugu\u00eas' },
  { code: 'zh-CN', label: '\u4e2d\u6587' },
  { code: 'ja', label: '\u65e5\u672c\u8a9e' },
  { code: 'ko', label: '\ud55c\uad6d\uc5b4' },
  { code: 'ar', label: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629' },
  { code: 'hi', label: '\u0939\u093f\u0928\u094d\u0926\u0940' },
  { code: 'ru', label: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439' },
  { code: 'it', label: 'Italiano' },
  { code: 'tr', label: 'T\u00fcrk\u00e7e' },
  { code: 'vi', label: 'Ti\u1ebfng Vi\u1ec7t' },
  { code: 'th', label: '\u0e44\u0e17\u0e22' },
];

function getActiveLanguage(): string {
  const match = document.cookie.match(/googtrans=\/en\/([^;]+)/);
  return match ? match[1] : 'en';
}

function LanguageSubMenu({ onSelect }: { onSelect: () => void }) {
  const activeLang = getActiveLanguage();

  const handleLanguageClick = (langCode: string) => {
    document.cookie = `googtrans=/en/${langCode};path=/;`;
    document.cookie = `googtrans=/en/${langCode};path=/;domain=${window.location.hostname}`;
    onSelect();
    window.location.reload();
  };

  return (
    <div className="language-submenu">
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          className={`language-submenu-item ${lang.code === activeLang ? 'active' : ''}`}
          onClick={(e) => { e.stopPropagation(); handleLanguageClick(lang.code); }}
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

interface ConversationGroupProps {
  title: string;
  discussions: Discussion[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onActivate: (id: string) => void;
  isCollapsed?: boolean;
}

function ConversationGroup({ title, discussions, activeId, onSelect, onDelete, onActivate, isCollapsed }: ConversationGroupProps) {
  if (discussions.length === 0) return null;

  return (
    <div className="conversation-group">
      {!isCollapsed && <h3 className="conversation-group-title">{title}</h3>}
      <div className="conversation-group-list">
        {discussions.map((discussion) => (
          <ConversationItem
            key={discussion.id}
            discussion={discussion}
            isActive={discussion.id === activeId}
            onSelect={() => onSelect(discussion.id)}
            onDelete={() => onDelete(discussion.id)}
            onActivate={() => onActivate(discussion.id)}
            isCollapsed={isCollapsed}
          />
        ))}
      </div>
    </div>
  );
}

interface ConversationItemProps {
  discussion: Discussion;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onActivate: () => void;
  projects?: Project[];
  onMoveToProject?: (projectId: string | null) => void;
  isCollapsed?: boolean;
}

function ConversationItem({ discussion, isActive, onSelect, onDelete, onActivate, projects = [], onMoveToProject, isCollapsed }: ConversationItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showProjectSubmenu, setShowProjectSubmenu] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const [copied, setCopied] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const title = discussion.title || discussion.messages[0]?.content.slice(0, 30) || 'New conversation';

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        btnRef.current && !btnRef.current.contains(event.target as Node) &&
        menuRef.current && !menuRef.current.contains(event.target as Node)
      ) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/chat/${discussion.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      setShowMenu(false);
    }, 1500);
  };

  const handleActivate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect();
    setShowMenu(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
    setShowMenu(false);
  };

  const handleMoveToProject = (e: React.MouseEvent, projectId: string | null) => {
    e.stopPropagation();
    onMoveToProject?.(projectId);
    setShowProjectSubmenu(false);
    setShowMenu(false);
  };

  const handleMenuToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setMenuStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
      zIndex: 9999,
    });
    setShowProjectSubmenu(false);
    setShowMenu(!showMenu);
  };

  return (
    <div
      className={`conversation-item ${isActive ? 'active' : ''}`}
      onClick={onSelect}
    >
      {isCollapsed ? (
        <MessageCirclePlus size={16} className="conversation-item-icon" />
      ) : (
        <>
          <span className="conversation-item-title">{title}</span>
          <div className="conversation-item-menu-container">
            <button
              ref={btnRef}
              className="conversation-item-menu-btn"
              onClick={handleMenuToggle}
            >
              <MoreVertical size={14} />
            </button>
            {showMenu && createPortal(
              <div ref={menuRef} className="conversation-menu" style={menuStyle}>
                <button className="conversation-menu-item" onClick={handleActivate}>
                  <Check size={14} />
                  <span>Activate</span>
                </button>
                <button className="conversation-menu-item" onClick={handleCopy}>
                  <Copy size={14} />
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
                {onMoveToProject && (
                  <div className="conversation-submenu-wrapper">
                    <button
                      className="conversation-menu-item"
                      onClick={(e) => { e.stopPropagation(); setShowProjectSubmenu(!showProjectSubmenu); }}
                    >
                      <FolderInput size={14} />
                      <span>Save to hubspace</span>
                      <ChevronRight size={12} className={`submenu-chevron ${showProjectSubmenu ? 'open' : ''}`} />
                    </button>
                    {showProjectSubmenu && (
                      <div className="conversation-submenu">
                        {projects.length === 0 && (
                          <span className="conversation-submenu-empty">No hubspaces yet</span>
                        )}
                        {projects.map((p) => (
                          <button
                            key={p.id}
                            className="conversation-menu-item"
                            onClick={(e) => handleMoveToProject(e, p.id)}
                          >
                            <span>{p.name}</span>
                            {discussion.project_id === p.id && <Check size={13} />}
                          </button>
                        ))}
                        {discussion.project_id && (
                          <button
                            className="conversation-menu-item"
                            onClick={(e) => handleMoveToProject(e, null)}
                          >
                            <span>Remove from hubspace</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <button className="conversation-menu-item delete" onClick={handleDelete}>
                  <Trash2 size={14} />
                  <span>Delete</span>
                </button>
              </div>,
              document.body
            )}
          </div>
        </>
      )}
    </div>
  );
}
