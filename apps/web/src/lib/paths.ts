/** App route paths — firm IA (see docs/platform/frontend-structure.md). */
export const paths = {
  home: "/",
  runs: "/runs",
  engagement: (taskId: string) => `/runs/${taskId}`,
  practices: "/practices",
  team: "/team",
  briefs: "/briefs",
  projects: "/projects",
} as const;

export type NavId =
  | "new-run"
  | "runs"
  | "practices"
  | "team"
  | "briefs"
  | "projects";

export const primaryNav: { id: NavId; label: string; to: string }[] = [
  { id: "new-run", label: "New run", to: paths.home },
  { id: "runs", label: "Runs", to: paths.runs },
  { id: "practices", label: "Practices", to: paths.practices },
  { id: "team", label: "Team", to: paths.team },
  { id: "briefs", label: "Briefs", to: paths.briefs },
  { id: "projects", label: "Projects", to: paths.projects },
];
