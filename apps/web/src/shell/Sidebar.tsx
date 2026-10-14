import { FolderPlus, Hexagon } from "lucide-react";
import { Link } from "react-router-dom";
import { paths } from "../lib/paths";
import { SidebarNav } from "./SidebarNav";
import { UserChip } from "./UserChip";

export function Sidebar() {
  return (
    <aside
      style={{
        width: "var(--sidebar-width)",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--sidebar-bg)",
        borderRight: "1px solid var(--sidebar-border)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "16px 16px 12px",
        }}
      >
        <Link
          to={paths.home}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontWeight: 700,
            fontSize: 18,
            letterSpacing: "-0.02em",
          }}
        >
          <span
            aria-hidden
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              background: "var(--cta-primary-bg)",
              display: "grid",
              placeItems: "center",
              color: "var(--accent-400)",
            }}
          >
            <Hexagon size={12} strokeWidth={2.25} />
          </span>
          Gantry
        </Link>
      </div>

      <SidebarNav />

      <div style={{ flex: 1 }} />

      <div
        style={{
          padding: "8px 14px",
          fontSize: 11,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        Projects
      </div>
      <div style={{ padding: "0 10px 12px" }}>
        <Link
          to={paths.projects}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 10,
            fontSize: 13,
            color: "var(--text-secondary)",
          }}
        >
          <FolderPlus size={16} strokeWidth={1.75} aria-hidden />
          New project
        </Link>
      </div>

      <UserChip />
    </aside>
  );
}
