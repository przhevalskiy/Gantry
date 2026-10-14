import type { CSSProperties, ReactNode } from "react";

/** Scrollable page body inside the fixed viewport stage. */
export function PageScroll({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      className="scroll-pane"
      style={{
        flex: 1,
        minHeight: 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
