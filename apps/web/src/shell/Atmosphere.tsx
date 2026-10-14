import type { CSSProperties, ReactNode } from "react";

const style: CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "var(--atmosphere-sky)",
  opacity: 0.55,
  pointerEvents: "none",
  zIndex: 0,
};

/** Wireframe sky mood behind the stage — atmosphere, not product identity. */
export function Atmosphere({ children }: { children?: ReactNode }) {
  return (
    <div className="atmosphere-root" style={{ position: "relative", flex: 1, minWidth: 0 }}>
      <div aria-hidden style={style} />
      <div style={{ position: "relative", zIndex: 1, height: "100%" }}>{children}</div>
    </div>
  );
}
