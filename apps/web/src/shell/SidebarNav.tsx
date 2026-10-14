import { NavLink } from "react-router-dom";
import { primaryNav, type NavId } from "../lib/paths";

const icons: Record<NavId, string> = {
  "new-run": "✏️",
  runs: "☰",
  practices: "◆",
  team: "◎",
  briefs: "▤",
  projects: "▢",
};

export function SidebarNav() {
  return (
    <nav aria-label="Primary" style={{ display: "flex", flexDirection: "column", gap: 2, padding: "8px 10px" }}>
      {primaryNav.map((item) => (
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
          <span aria-hidden style={{ width: 18, textAlign: "center", opacity: 0.7 }}>
            {icons[item.id]}
          </span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
