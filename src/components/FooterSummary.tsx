'use client';

interface FooterSummaryProps {
  p2pAvgDaily: number;
  p2pAvgMonthly: number;
  seedlingAvgDaily: number;
  seedlingAvgMonthly: number;
}

export default function FooterSummary({
  p2pAvgDaily,
  p2pAvgMonthly,
  seedlingAvgDaily,
  seedlingAvgMonthly,
}: FooterSummaryProps) {
  return (
    <div className="footer-summary">
      <div className="footer-card">
        <span className="label">Average Daily</span>
        <span className="value daily">{p2pAvgDaily.toLocaleString()}</span>
      </div>
      <div className="footer-card">
        <span className="label">Average Month</span>
        <span className="value monthly">{p2pAvgMonthly.toLocaleString()}</span>
      </div>
      <div className="footer-card">
        <span className="label">Average Daily</span>
        <span className="value daily">{seedlingAvgDaily.toLocaleString()}</span>
      </div>
      <div className="footer-card">
        <span className="label">Average Month</span>
        <span className="value monthly">{seedlingAvgMonthly.toLocaleString()}</span>
      </div>
    </div>
  );
}
