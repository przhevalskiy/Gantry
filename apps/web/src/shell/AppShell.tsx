import { Outlet } from "react-router-dom";
import { Atmosphere } from "./Atmosphere";
import { Sidebar } from "./Sidebar";

/** Wireframe geometry: sidebar + atmospheric stage with grooved center pane. */
export function AppShell() {
  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        minHeight: "100vh",
        background: "var(--shell-gradient)",
      }}
    >
      <Sidebar />
      <Atmosphere>
        <div
          style={{
            height: "100%",
            minHeight: "100vh",
            padding: "var(--stage-inset)",
            display: "flex",
          }}
        >
          <main
            className="stage-pane"
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              borderRadius: "var(--stage-radius)",
              background: "var(--stage-bg)",
              border: "1px solid var(--stage-border)",
              boxShadow: "var(--stage-groove)",
              backdropFilter: "blur(10px)",
              overflow: "hidden",
            }}
          >
            <Outlet />
          </main>
        </div>
      </Atmosphere>
    </div>
  );
}
