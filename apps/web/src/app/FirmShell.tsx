import { NavLink, Outlet } from 'react-router-dom';
import logo from '@/assets/logo.png';
import { useAuthStore } from '@/modules/kernel';
import './FirmShell.css';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/jobs', label: 'Matters', end: false },
  { to: '/practices', label: 'Practices', end: false },
  { to: '/briefs', label: 'Briefs', end: false },
  { to: '/people', label: 'People', end: false },
  { to: '/workspaces', label: 'Workspaces', end: false },
  { to: '/develop', label: 'Develop', end: false },
];

export function FirmShell() {
  const signOut = useAuthStore(s => s.signOut);

  return (
    <div className="firm-shell">
      <header className="firm-shell__nav">
        <NavLink to="/" className="firm-shell__brand" end>
          <img src={logo} alt="" />
          <span>Gantry</span>
        </NavLink>
        <nav className="firm-shell__links" aria-label="Firm">
          {NAV.map(item => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'is-active' : undefined)}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button type="button" className="firm-shell__signout" onClick={() => void signOut()}>
          Sign out
        </button>
      </header>
      <main className="firm-shell__main">
        <Outlet />
      </main>
    </div>
  );
}
