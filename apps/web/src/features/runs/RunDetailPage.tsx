import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Loader2 } from 'lucide-react';
import {
  CrewPanel,
  IdeFileExplorer,
  PreviewPane,
  RunActivityFeed,
  TracesPanel,
  extractAgentOnFiles,
  extractDevUrl,
  extractGoalFromMessages,
  extractHitlFromMessages,
  extractPrUrl,
  extractWrittenPaths,
  parsePipelineMeta,
  parsePipelineStages,
  type TaskMessage,
} from '@/features/ide';
import type { Project } from '@/shared/types';
import { playbookLabel, runSizeLabel } from '@/shared/constants/runConfig';
import { gantryClient, type GantryTask } from '@/shared/services/gantry/client';
import { toQodexProject } from '@/shared/services/gantry/projectMapper';
import './RunDetailPage.css';

const TERMINAL = new Set(['completed', 'failed', 'cancelled', 'terminated', 'timeout', 'canceled']);
const LEFT_TAB_KEY = 'gantry_run_left_tab';
const RIGHT_TAB_KEY = 'gantry_run_right_tab';

type LeftTab = 'explorer' | 'preview';
type RightTab = 'activity' | 'crew' | 'traces';

export function RunDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const [task, setTask] = useState<GantryTask | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<TaskMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pollTick, setPollTick] = useState(0);
  const [leftTab, setLeftTab] = useState<LeftTab>(() => {
    const saved = localStorage.getItem(LEFT_TAB_KEY);
    return saved === 'preview' ? 'preview' : 'explorer';
  });
  const [rightTab, setRightTab] = useState<RightTab>(() => {
    const saved = localStorage.getItem(RIGHT_TAB_KEY);
    return saved === 'crew' || saved === 'traces' ? saved : 'activity';
  });
  const [manualPreviewUrl, setManualPreviewUrl] = useState('');
  const previewAutoSwitchedRef = useRef(false);

  const loadRun = useCallback(async () => {
    if (!taskId) return;
    try {
      const row = await gantryClient.getTask(taskId);
      setTask(row);
      if (row.project_id) {
        try {
          const p = await gantryClient.getProject(row.project_id);
          setProject(toQodexProject(p));
        } catch {
          setProject(null);
        }
      }
      const msgResp = await gantryClient.getTaskMessages(taskId);
      setMessages(msgResp.messages as TaskMessage[]);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [taskId]);

  useEffect(() => {
    void loadRun();
  }, [loadRun, pollTick]);

  useEffect(() => {
    previewAutoSwitchedRef.current = false;
  }, [taskId]);

  useEffect(() => {
    if (!taskId || !task) return;
    if (TERMINAL.has(task.status.toLowerCase())) return;
    const id = setInterval(() => setPollTick(t => t + 1), 2500);
    return () => clearInterval(id);
  }, [taskId, task?.status]);

  const selectLeftTab = (tab: LeftTab) => {
    setLeftTab(tab);
    localStorage.setItem(LEFT_TAB_KEY, tab);
  };

  const selectRightTab = (tab: RightTab) => {
    setRightTab(tab);
    localStorage.setItem(RIGHT_TAB_KEY, tab);
  };

  const status = task?.status ?? 'running';
  const isRunning = !TERMINAL.has(status.toLowerCase());
  const buildBranch = task?.result?.branch ?? null;
  const repoRoot = project?.repo_path ?? '';
  const writtenPaths = useMemo(
    () => extractWrittenPaths(messages, repoRoot),
    [messages, repoRoot],
  );
  const agentOnFile = useMemo(
    () => extractAgentOnFiles(messages, repoRoot),
    [messages, repoRoot],
  );
  const stages = useMemo(() => parsePipelineStages(messages, status), [messages, status]);
  const pipelineMeta = useMemo(() => parsePipelineMeta(messages), [messages]);
  const goal = useMemo(() => extractGoalFromMessages(messages), [messages]);
  const messageHitl = useMemo(() => extractHitlFromMessages(messages), [messages]);
  const prUrl = task?.result?.pr_url ?? extractPrUrl(messages);
  const detectedPreviewUrl = useMemo(() => extractDevUrl(messages), [messages]);
  const activePreviewUrl = manualPreviewUrl.trim() || detectedPreviewUrl || '';
  const tierLabel = task?.tier != null && task.tier >= 0 ? runSizeLabel(task.tier) : null;
  const effectivelyDone = !isRunning || !!pipelineMeta.finalReport;

  useEffect(() => {
    if (!detectedPreviewUrl || previewAutoSwitchedRef.current) return;
    previewAutoSwitchedRef.current = true;
    selectLeftTab('preview');
  }, [detectedPreviewUrl]);

  if (!taskId) {
    return <p className="run-detail-error">Missing task id.</p>;
  }

  return (
    <div className="run-ide">
      <header className="run-ide-header">
        <Link to="/chat" className="run-ide-back">
          <ArrowLeft size={16} /> Tasks
        </Link>
        <div className="run-ide-title-wrap">
          <h1>{goal || 'Factory run'}</h1>
          <code>{taskId.slice(0, 8)}</code>
        </div>
        <div className="run-ide-header-meta">
          {isRunning && <Loader2 size={14} className="spinning" />}
          <span className={`run-status run-status-${status.toLowerCase()}`}>{status}</span>
          {task?.tier != null && task.tier >= 0 && (
            <span className="run-chip">{runSizeLabel(task.tier)}</span>
          )}
          {task?.playbook && <span className="run-chip">{playbookLabel(task.playbook)}</span>}
          {prUrl && (
            <a href={prUrl} target="_blank" rel="noopener noreferrer" className="run-pr-link">
              PR <ExternalLink size={12} />
            </a>
          )}
        </div>
      </header>

      {error && <p className="run-detail-error">{error}</p>}

      <div className="run-ide-split">
        <section className="run-ide-left">
          <div className="run-ide-left-tabs">
            <button
              type="button"
              className={leftTab === 'explorer' ? 'active' : ''}
              onClick={() => selectLeftTab('explorer')}
            >
              Explorer
            </button>
            <button
              type="button"
              className={leftTab === 'preview' ? 'active' : ''}
              onClick={() => selectLeftTab('preview')}
            >
              Preview
              {activePreviewUrl && <span className="run-ide-tab-dot" />}
            </button>
          </div>

          <div className="run-ide-left-panel">
            {leftTab === 'explorer' ? (
              project ? (
                <IdeFileExplorer
                  project={project}
                  isRunning={isRunning}
                  taskStatus={status}
                  buildBranch={buildBranch}
                  writtenPaths={writtenPaths}
                  agentOnFile={agentOnFile}
                  editable={false}
                  layout="split"
                />
              ) : (
                <div className="run-ide-loading">
                  {task ? 'Loading hubspace…' : <Loader2 size={20} className="spinning" />}
                </div>
              )
            ) : (
              <PreviewPane
                url={detectedPreviewUrl ?? ''}
                manualUrl={manualPreviewUrl}
                onUrlChange={setManualPreviewUrl}
              />
            )}
          </div>
        </section>

        <section className="run-ide-right">
          <div className="run-ide-right-tabs">
            {([
              ['activity', 'Activity'],
              ['crew', 'Crew'],
              ['traces', 'Traces'],
            ] as const).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                className={rightTab === tab ? 'active' : ''}
                onClick={() => selectRightTab(tab)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="run-ide-right-panel">
            {rightTab === 'activity' && (
              <RunActivityFeed
                messages={messages}
                pendingHitl={task?.pending_hitl ?? []}
                messageHitl={messageHitl}
                onHitlResolved={() => setPollTick(t => t + 1)}
                onFollowUpSent={() => setPollTick(t => t + 1)}
                onTerminated={() => setPollTick(t => t + 1)}
                taskId={taskId}
                status={status}
                effectivelyDone={effectivelyDone}
              />
            )}
            {rightTab === 'crew' && (
              <CrewPanel
                stages={stages}
                pipelineMeta={pipelineMeta}
                prUrl={prUrl}
                tierLabel={tierLabel}
              />
            )}
            {rightTab === 'traces' && <TracesPanel taskId={taskId} />}
          </div>
        </section>
      </div>
    </div>
  );
}
