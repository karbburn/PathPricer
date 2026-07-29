"use client";

import React, { useState } from "react";
import { downloadCsv, downloadPdfReport } from "@/lib/export-helpers";
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
      alert("Failed to generate PDF report. Make sure backend service is running.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadCsv = () => {
    if (!fullResult) return;
    downloadCsv(fullResult);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div>
        <h4 className="text-xs font-extrabold text-cyan-400 uppercase tracking-wider">
          Export &amp; Reporting Suite
        </h4>
        <p className="text-xs text-slate-400 font-mono mt-0.5">
          Download PDF research report (backend streamed) or export client-side CSV
        </p>
      </div>

      <div className="flex items-center gap-3 w-full sm:w-auto">
        {/* CSV Export Button */}
        <button
          type="button"
          disabled={!fullResult}
          onClick={handleDownloadCsv}
          className="flex-1 sm:flex-none bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-mono text-xs px-4 py-2.5 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
          <span>Export CSV</span>
        </button>

        {/* PDF Export Button (Primary Action - Hits Backend POST /report/pdf) */}
        <button
          type="button"
          disabled={downloadingPdf}
          onClick={handleDownloadPdf}
          className="flex-1 sm:flex-none bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold px-5 py-2.5 rounded-md transition-all shadow-md shadow-cyan-950/50 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          <span>{downloadingPdf ? "Generating PDF..." : "Download PDF Report"}</span>
        </button>
      </div>
    </div>
  );
}
