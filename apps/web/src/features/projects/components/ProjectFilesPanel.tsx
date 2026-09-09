import type { Project } from '@/shared/types';
import { IdeFileExplorer } from '@/features/ide';

interface ProjectFilesPanelProps {
  project: Project;
}

export function ProjectFilesPanel({ project }: ProjectFilesPanelProps) {
  return (
    <div className="pd-rail-card pd-files-card ide-rail-wrap">
      <IdeFileExplorer project={project} editable layout="stack" />
    </div>
  );
}
