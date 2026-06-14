'use client';

import { useEffect, useRef } from 'react';
import { useProjectStore } from '@/lib/project-store';

export function useServerPreferences() {
  const { activeProjectId, setActiveProjectId } = useProjectStore();

  // Sync active project from server on first load (cross-device persistence)
  const preferencesSyncedRef = useRef(false);
  useEffect(() => {
    if (preferencesSyncedRef.current) return;
    preferencesSyncedRef.current = true;
    fetch('/api/preferences')
      .then(r => r.ok ? r.json() : null)
      .then((data: { active_project_id?: string | null } | null) => {
        if (data?.active_project_id && !activeProjectId) {
          setActiveProjectId(data.active_project_id);
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line

  // Push active project changes to server (cross-device persistence)
  const prevActiveRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevActiveRef.current === activeProjectId) return;
    prevActiveRef.current = activeProjectId;
    if (!preferencesSyncedRef.current) return;
    fetch('/api/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active_project_id: activeProjectId }),
    }).catch(() => {});
  }, [activeProjectId]);
}
