export function StubPage({
  title,
  blurb,
}: {
  title: string;
  blurb: string;
}) {
  return (
    <div style={{ padding: "40px 32px", maxWidth: 640 }}>
      <h1
        style={{
          margin: "0 0 8px",
          fontSize: 28,
          fontWeight: 650,
          letterSpacing: "-0.02em",
        }}
      >
        {title}
      </h1>
      <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: 1.5 }}>{blurb}</p>
      <p style={{ marginTop: 16, fontSize: 13, color: "var(--text-muted)" }}>
        Stub route — structure only. Wired in a later slice.
      </p>
    </div>
  );
}
