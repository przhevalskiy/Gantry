import { Outlet } from 'react-router-dom';
import './MuseShell.css';

/**
 * Muse / iMessage architecture:
 * - No product tab bar
 * - Full-height messaging canvas (threads + conversation)
 * - Secondary surfaces open as sheets inside chat, not destinations
 */
export function MuseShell() {
  return (
    <div className="muse-shell">
      <Outlet />
    </div>
  );
}
