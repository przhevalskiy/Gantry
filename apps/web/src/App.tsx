import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./shell/AppShell";
import { Briefs } from "./routes/Briefs";
import { ComposeHome } from "./routes/ComposeHome";
import { Engagement } from "./routes/Engagement";
import { Practices } from "./routes/Practices";
import { Projects } from "./routes/Projects";
import { Runs } from "./routes/Runs";
import { Team } from "./routes/Team";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<ComposeHome />} />
          <Route path="runs" element={<Runs />} />
          <Route path="runs/:taskId" element={<Engagement />} />
          <Route path="practices" element={<Practices />} />
          <Route path="team" element={<Team />} />
          <Route path="briefs" element={<Briefs />} />
          <Route path="projects" element={<Projects />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
