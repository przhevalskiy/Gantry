import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Briefcase,
  FolderKanban,
  ListTodo,
  PenSquare,
  Users,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { primaryNav, type NavId } from "../lib/paths";

const icons: Record<NavId, LucideIcon> = {
  "new-run": PenSquare,
  runs: ListTodo,
  practices: Briefcase,
  team: Users,
  briefs: BookOpen,
  projects: FolderKanban,
};

export function SidebarNav() {
  return (
    <nav
      aria-label="Primary"
      style={{ display: "flex", flexDirection: "column", gap: 2, padding: "8px 10px" }}
    >
      {primaryNav.map((item) => {
        const Icon = icons[item.id];
        return (
          <NavLink
            key={item.id}
            to={item.to}
            end={item.id === "new-run"}
            style={({ isActive }) => ({
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 12px",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: isActive ? 600 : 500,
              color: "var(--text-primary)",
              background: isActive ? "var(--nav-active-bg)" : "transparent",
            })}
          >
            <Icon
              aria-hidden
              size={16}
              strokeWidth={1.75}
              style={{ flexShrink: 0, opacity: 0.75, color: "var(--text-secondary)" }}
            />
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );
}
