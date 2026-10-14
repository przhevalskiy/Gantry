import { PanelLeftClose } from "lucide-react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { paths } from "../lib/paths";
import { SidebarNav } from "./SidebarNav";
import { UserChip } from "./UserChip";

export function Sidebar({
  style,
  onCollapse,
}: {
  style?: CSSProperties;
  onCollapse: () => void;
}) {
  return (
    <aside
      className="sidebar-pane"
      style={{
        width: "var(--sidebar-width)",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--sidebar-bg)",
        backdropFilter: "blur(12px)",
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "14px 12px 12px 16px",
        }}
      >
        <Link
          to={paths.home}
          style={{
            fontWeight: 700,
            fontSize: 18,
            letterSpacing: "-0.02em",
          }}
        >
          Gantry
        </Link>
        <button
          type="button"
          aria-label="Collapse sidebar"
          onClick={onCollapse}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            display: "grid",
            placeItems: "center",
            color: "var(--text-secondary)",
            flexShrink: 0,
          }}
        >
          <PanelLeftClose size={18} strokeWidth={1.75} aria-hidden />
        </button>
      </div>

      <SidebarNav />

      <div style={{ flex: 1 }} />

      <UserChip />
    </aside>
  );
}
