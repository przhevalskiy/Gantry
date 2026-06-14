'use client';

import { useState, useEffect, useRef, useCallback, type MouseEvent } from 'react';

export interface Tab {
  relPath: string;
  content: string;
}

const MAX_TABS = 4;

export function useFileTabs({
  repoRoot,
  taskId,
  isRunning,
  buildBranch,
  githubOwner,
  githubRepo,
}: {
  repoRoot: string;
  taskId?: string;
  isRunning: boolean;
  buildBranch?: string;
  githubOwner?: string;
  githubRepo?: string;
}) {
  const tabsKey = `ks_fe_tabs:${repoRoot}`;
  const activeKey = `ks_fe_active:${repoRoot}`;
  const useGithub = !isRunning && !!buildBranch && !!githubOwner && !!githubRepo;

  const [tabs, setTabs] = useState<Tab[]>(() => {
    if (typeof window === 'undefined') return [];
    if (!repoRoot) return [];
    try {
      const saved = localStorage.getItem(`ks_fe_tabs:${repoRoot}`);
      return saved ? (JSON.parse(saved) as string[]).map(p => ({ relPath: p, content: '' })) : [];
    } catch { return []; }
  });

  const [activeTab, setActiveTab] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    if (!repoRoot) return null;
    return localStorage.getItem(`ks_fe_active:${repoRoot}`) ?? null;
  });

  // Restore from localStorage when repoRoot arrives after mount
  const prevRepoRootRef = useRef('');
  useEffect(() => {
    if (!repoRoot || prevRepoRootRef.current === repoRoot) return;
    prevRepoRootRef.current = repoRoot;
    try {
      const saved = localStorage.getItem(`ks_fe_tabs:${repoRoot}`);
      const restored = saved ? (JSON.parse(saved) as string[]).map(p => ({ relPath: p, content: '' })) : [];
      if (restored.length > 0) setTabs(restored);
    } catch {}
    const savedActive = localStorage.getItem(`ks_fe_active:${repoRoot}`);
    if (savedActive) setActiveTab(savedActive);
  }, [repoRoot]);

  // Load server tab state when taskId + repoRoot are both ready
  const serverStateLoadedRef = useRef(false);
  useEffect(() => {
    if (!taskId || !repoRoot || serverStateLoadedRef.current) return;
    serverStateLoadedRef.current = true;
    fetch(`/api/ui-state?taskId=${encodeURIComponent(taskId)}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: { open_tabs?: string[]; active_tab?: string | null } | null) => {
        if (!data?.open_tabs?.length) return;
        setTabs(data.open_tabs.map(p => ({ relPath: p, content: '' })));
        if (data.active_tab) setActiveTab(data.active_tab);
      })
      .catch(() => {});
  }, [taskId, repoRoot]);

  // Debounced save to server when tabs or activeTab change
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!taskId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      fetch('/api/ui-state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: taskId,
          open_tabs: tabs.map(t => t.relPath),
          active_tab: activeTab,
        }),
      }).catch(() => {});
    }, 1500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [tabs, activeTab, taskId]);

  // Persist tab list to localStorage
  useEffect(() => {
    localStorage.setItem(tabsKey, JSON.stringify(tabs.map(t => t.relPath)));
  }, [tabs, tabsKey]);

  // Persist active tab to localStorage
  useEffect(() => {
    if (activeTab) localStorage.setItem(activeKey, activeTab);
    else localStorage.removeItem(activeKey);
  }, [activeTab, activeKey]);

  const fetchContent = useCallback(async (rel: string): Promise<string | null> => {
    if (!rel || !repoRoot) return null;
    if (useGithub) {
      try {
        const res = await fetch(
          `/api/github/file?owner=${encodeURIComponent(githubOwner!)}&repo=${encodeURIComponent(githubRepo!)}&path=${encodeURIComponent(rel)}&branch=${encodeURIComponent(buildBranch!)}`,
        );
        if (!res.ok) return null;
        const data = await res.json();
        return (data as { content?: string }).content ?? null;
      } catch { return null; }
    }
    const abs = `${repoRoot}/${rel}`;
    try {
      const res = await fetch(`/api/files?path=${encodeURIComponent(abs)}`);
      if (!res.ok) return null;
      const data = await res.json();
      return (data as { content?: string }).content ?? null;
    } catch { return null; }
  }, [repoRoot, useGithub, buildBranch, githubOwner, githubRepo]);

  // Re-fetch content for tabs restored from localStorage
  useEffect(() => {
    if (!repoRoot) return;
    tabs.forEach(async (tab) => {
      if (tab.content !== '') return;
      const content = await fetchContent(tab.relPath);
      if (content !== null) {
        setTabs(prev => prev.map(t => t.relPath === tab.relPath ? { ...t, content } : t));
      }
    });
  }, [repoRoot, fetchContent]); // eslint-disable-line react-hooks/exhaustive-deps

  const openTab = useCallback(async (rel: string) => {
    setActiveTab(rel);
    setTabs(prev => {
      if (prev.some(t => t.relPath === rel)) return prev;
      let next = [...prev, { relPath: rel, content: '' }];
      if (next.length > MAX_TABS) {
        const evictIdx = next.findIndex(t => t.relPath !== rel);
        if (evictIdx !== -1) next.splice(evictIdx, 1);
      }
      return next;
    });
    const content = await fetchContent(rel);
    if (content !== null) {
      setTabs(prev => prev.map(t => t.relPath === rel ? { ...t, content } : t));
    }
  }, [fetchContent]);

  const closeTab = useCallback((rel: string, e: MouseEvent) => {
    e.stopPropagation();
    setTabs(prev => {
      const next = prev.filter(t => t.relPath !== rel);
      if (activeTab === rel) {
        const idx = prev.findIndex(t => t.relPath === rel);
        const fallback = next[Math.min(idx, next.length - 1)]?.relPath ?? null;
        setActiveTab(fallback);
      }
      return next;
    });
  }, [activeTab]);

  return {
    tabs,
    setTabs,
    activeTab,
    setActiveTab,
    openTab,
    closeTab,
    fetchContent,
    useGithub,
  };
}
