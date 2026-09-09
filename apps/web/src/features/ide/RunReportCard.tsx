import './RunReportCard.css';

export function RunReportCard({
  report,
  coveragePct,
}: {
  report: string;
  coveragePct: number | null;
}) {
  const covColor = coveragePct == null
    ? 'var(--gray-500)'
    : coveragePct >= 80
      ? '#166534'
      : coveragePct >= 60
        ? '#b45309'
        : '#b42318';

  return (
    <div className="run-report-card">
      {coveragePct != null && (
        <div className="run-report-coverage" style={{ color: covColor, borderColor: `${covColor}40`, background: `${covColor}10` }}>
          <strong>Test coverage: {coveragePct.toFixed(1)}%</strong>
          <span>
            {coveragePct >= 80 ? 'Good' : coveragePct >= 60 ? 'Acceptable' : 'Low — add more tests'}
          </span>
        </div>
      )}
      <pre className="run-report-body">{report}</pre>
    </div>
  );
}
