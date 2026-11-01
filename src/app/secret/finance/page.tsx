"use client";

import dynamic from "next/dynamic";
import "./finance.css";

// The ledger lives in IndexedDB. Its repositories must only initialize in a browser.
const FinanceDashboard = dynamic(() => import("@/components/finance/FinanceDashboard"), {
  ssr: false,
  loading: () => (
    <div className="finance-loading" role="status" aria-live="polite">
      <p>Preparing your finance workspace…</p>
      <div className="finance-loading-header" />
      <div className="finance-loading-grid"><div /><div /></div>
      <div className="finance-loading-row" />
    </div>
  ),
});

export default function FinancePage() { return <FinanceDashboard />; }
