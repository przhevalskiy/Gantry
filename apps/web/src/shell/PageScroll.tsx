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
      style={{
        flex: 1,
        minHeight: 0,
        overflow: "auto",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
