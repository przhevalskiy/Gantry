/** Project display helpers for Gantry hubspaces. */

export function projectRepoLabel(project: {
  github_url?: string | null;
  github_owner?: string | null;
  github_repo?: string | null;
}): string {
  if (project.github_url) {
    try {
      const u = new URL(project.github_url);
      return u.pathname.replace(/^\//, '');
    } catch {
      return project.github_url;
    }
  }
  if (project.github_owner && project.github_repo) {
    return `${project.github_owner}/${project.github_repo}`;
  }
  return 'Greenfield workspace';
}

export function projectRepoHint(project: { github_url?: string | null }): string {
  if (project.github_url) {
    return 'Linked GitHub repo — runs clone this remote and open PRs there.';
  }
  return 'Empty workspace — first run can scaffold code and create a GitHub repo automatically.';
}
