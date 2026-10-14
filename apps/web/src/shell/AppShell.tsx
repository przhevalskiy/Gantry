import { Outlet } from "react-router-dom";
import { Atmosphere } from "./Atmosphere";
import { Sidebar } from "./Sidebar";

/** Wireframe geometry: sidebar + atmospheric stage. */
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
        <main
          style={{
            height: "100%",
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Outlet />
        </main>
      </Atmosphere>
    </div>
  );
}
