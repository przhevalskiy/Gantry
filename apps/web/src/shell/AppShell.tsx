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
        height: "100dvh",
        maxHeight: "100dvh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        background: "var(--shell-gradient)",
      }}
    >
      <Atmosphere>
        <div
          style={{
            height: "100%",
            minHeight: 0,
            padding: "var(--stage-inset)",
            display: "flex",
            gap: 0,
            boxSizing: "border-box",
            overflow: "hidden",
          }}
        >
          <div
            aria-hidden={!sidebarOpen}
            style={{
              width: sidebarOpen
                ? "calc(var(--sidebar-width) + var(--stage-inset))"
                : 0,
              flexShrink: 0,
              overflow: "hidden",
              transition: "width 280ms cubic-bezier(0.22, 1, 0.36, 1)",
              pointerEvents: sidebarOpen ? "auto" : "none",
              minHeight: 0,
              height: "100%",
            }}
          >
            <div
              style={{
                width: "calc(var(--sidebar-width) + var(--stage-inset))",
                height: "100%",
                minHeight: 0,
                paddingRight: "var(--stage-inset)",
                boxSizing: "border-box",
                opacity: sidebarOpen ? 1 : 0,
                transform: sidebarOpen ? "translateX(0)" : "translateX(-12px)",
                transition:
                  "opacity 220ms ease, transform 280ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              <Sidebar
                style={{ ...groovePane, height: "100%", minHeight: 0 }}
                onCollapse={() => setSidebarOpen(false)}
              />
            </div>
          </div>

          <main
            className="stage-pane"
            style={{
              ...groovePane,
              flex: 1,
              minWidth: 0,
              minHeight: 0,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {!sidebarOpen ? (
              <button
                type="button"
                aria-label="Open sidebar"
                onClick={() => setSidebarOpen(true)}
                style={{
                  position: "absolute",
                  top: 14,
                  left: 14,
                  zIndex: 2,
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  display: "grid",
                  placeItems: "center",
                  color: "var(--text-secondary)",
                  background: "rgba(255,255,255,0.72)",
                  border: "1px solid var(--border-subtle)",
                  boxShadow: "0 2px 8px rgba(60, 40, 100, 0.08)",
                  backdropFilter: "blur(8px)",
                }}
              >
                <PanelLeftOpen size={18} strokeWidth={1.75} aria-hidden />
              </button>
            ) : null}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <Outlet />
            </div>
          </main>
        </div>
      </Atmosphere>
    </div>
  );
}
