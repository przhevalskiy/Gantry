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
          <Sidebar style={groovePane} />
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
