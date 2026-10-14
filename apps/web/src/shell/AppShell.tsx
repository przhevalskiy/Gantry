import { PanelLeftOpen } from "lucide-react";
import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Atmosphere } from "./Atmosphere";
import { Sidebar } from "./Sidebar";

const groovePane = {
  borderRadius: "var(--stage-radius)",
  background: "var(--stage-bg)",
  border: "1px solid var(--stage-border)",
  boxShadow: "var(--stage-groove)",
  backdropFilter: "blur(10px)",
  overflow: "hidden" as const,
};

/** Wireframe geometry: atmosphere with grooved sidebar + center stage. */
export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div
      style={{
        height: "100%",
        minHeight: "100vh",
        background: "var(--shell-gradient)",
      }}
    >
      <Atmosphere>
        <div
          style={{
            height: "100%",
            minHeight: "100vh",
            padding: "var(--stage-inset)",
            display: "flex",
            gap: "var(--stage-inset)",
          }}
        >
          {sidebarOpen ? (
            <Sidebar style={groovePane} onCollapse={() => setSidebarOpen(false)} />
          ) : (
            <button
              type="button"
              aria-label="Open sidebar"
              onClick={() => setSidebarOpen(true)}
              style={{
                ...groovePane,
                width: 48,
                flexShrink: 0,
                display: "grid",
                placeItems: "center",
                alignSelf: "stretch",
                background: "var(--sidebar-bg)",
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              <PanelLeftOpen size={18} strokeWidth={1.75} aria-hidden />
            </button>
          )}
          <main
            className="stage-pane"
            style={{
              ...groovePane,
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Outlet />
          </main>
        </div>
      </Atmosphere>
    </div>
  );
}
