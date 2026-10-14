export function UserChip() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderTop: "1px solid var(--sidebar-border)",
      }}
    >
      <div
        aria-hidden
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "linear-gradient(135deg, var(--accent-400), var(--accent-600))",
          color: "#fff",
          fontSize: 12,
          fontWeight: 600,
          display: "grid",
          placeItems: "center",
        }}
      >
        G
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Gantry</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Firm client</div>
      </div>
    </div>
  );
}
