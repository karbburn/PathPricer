"use client";

import React, { useState } from "react";
import { downloadCsv, downloadPdfReport } from "@/lib/export-helpers";
import { showToast } from "@/lib/components/Toast";
import { PricingFullResponse, PricingRequest } from "@/lib/types";

interface ExportControlsProps {
  fullResult: PricingFullResponse | null;
  request: PricingRequest;
}

export function ExportControls({ fullResult, request }: ExportControlsProps) {
  const [downloadingPdf, setDownloadingPdf] = useState<boolean>(false);

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      await downloadPdfReport(request);
    } catch {
      showToast("error", "Failed to generate PDF report. Make sure backend service is running.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadCsv = () => {
    if (!fullResult) return;
    downloadCsv(fullResult);
  };

  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 overflow-hidden">
      <div className="min-w-0 flex-1">
        <h4 className="text-xs font-extrabold text-[#58a6ff] uppercase tracking-wider">
          Export &amp; Reporting Suite
        </h4>
        <p className="text-xs text-[#8b949e] font-mono mt-1 leading-relaxed">
          Download PDF research report (backend streamed) or export client-side CSV
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 shrink-0 w-full lg:w-auto">
        {/* CSV Export Button */}
        <button
          type="button"
          disabled={!fullResult}
          onClick={handleDownloadCsv}
          className="flex-1 lg:flex-none bg-[#21262d] hover:bg-[#30363d] text-[#8b949e] border border-[#30363d] font-mono text-xs px-4 py-2.5 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
          <span>Export CSV</span>
        </button>

        {/* PDF Export Button */}
        <button
          type="button"
          disabled={downloadingPdf}
          onClick={handleDownloadPdf}
          className="flex-1 lg:flex-none bg-[#238636] hover:bg-[#2ea043] text-white font-mono text-xs font-bold px-5 py-2.5 rounded-md transition-all shadow-md shadow-[#0d1117]/50 disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          <span>{downloadingPdf ? "Generating PDF..." : "Download PDF Report"}</span>
        </button>
      </div>
    </div>
  );
}
