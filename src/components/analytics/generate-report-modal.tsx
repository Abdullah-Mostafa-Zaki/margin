"use client";

import { useState } from "react";
import Papa from "papaparse";
import jsPDF from "jspdf";
import * as htmlToImage from "html-to-image";
import { generateReport, getTransactionsForExport } from "@/actions/reports.actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Loader2, FileText, Download, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { Badge } from "@/components/ui/badge";
import { formatCairoDate } from "@/lib/date-utils";
import { Plan } from "@prisma/client";
import { PLAN_LIMITS } from "@/lib/plans";
import Link from "next/link";
import { Lock } from "lucide-react";

export function GenerateReportModal({ orgSlug, plan }: { orgSlug: string; plan: Plan }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(new Date().setDate(new Date().getDate() - 7)),
    to: new Date()
  });
  
  const [generatedReport, setGeneratedReport] = useState<any>(null);

  const daysCount = date?.from && date?.to ? Math.max(1, Math.round((date.to.getTime() - date.from.getTime()) / (1000 * 60 * 60 * 24))) : 0;
  
  let dynamicType: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY" = "WEEKLY";
  let badgeLabel = "Tactical Pulse (Weekly)";
  if (daysCount >= 181) {
    dynamicType = "YEARLY";
    badgeLabel = "Executive Summary (Yearly)";
  } else if (daysCount >= 90) {
    dynamicType = "QUARTERLY";
    badgeLabel = "Strategic Pivot (Quarterly)";
  } else if (daysCount >= 15) {
    dynamicType = "MONTHLY";
    badgeLabel = "Boardroom Report (Monthly)";
  }

  const handleGenerate = async () => {
    if (!date?.from || !date?.to) {
      toast.error("Please select a date range");
      return;
    }
    
    setIsGenerating(true);
    try {
      const result = await generateReport(
        orgSlug,
        dynamicType,
        date.from.toISOString(),
        date.to.toISOString(),
        true
      );

      if (result.success && result.data) {
        if (result.data.status === "INSUFFICIENT_DATA") {
          toast.info("Not enough data to generate narrative");
        } else {
          toast.success("Report generated successfully!");
        }
        setGeneratedReport(result.data);
      } else {
        toast.error(result.message || result.error || "Failed to generate report");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsGenerating(false);
    }
  };

  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadReport = async () => {
    if (!generatedReport) return;
    
    setIsDownloading(true);
    try {
      const element = document.getElementById("branded-report-template");
      if (!element) throw new Error("Template not found");
      
      const imgData = await htmlToImage.toPng(element, { pixelRatio: 2 });
      
      const pdf = new jsPDF("p", "mm", "a4");
      
      // Calculate width and height while maintaining aspect ratio
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${orgSlug}-${generatedReport.type.toLowerCase()}-report.pdf`);
      
      toast.success("Branded PDF downloaded successfully!");
    } catch (error: any) {
      console.error("PDF Generation Error:", error);
      toast.error(error?.message || "Failed to download PDF report");
    } finally {
      setIsDownloading(false);
    }
  };

  // Extract metrics for easy access
  const metrics = generatedReport?.metrics as any || {};
  const actionItems = metrics.actionItems || [];
  const revenue = Number(generatedReport?.revenue || 0);
  const profit = Number(generatedReport?.profit || 0);
  const margin = Number(generatedReport?.marginPercent || 0);
  const isCompleted = generatedReport?.status === "COMPLETED";

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:text-emerald-800">
          <FileText className="h-4 w-4" />
          Generate Report
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[950px] max-h-[90vh] overflow-y-auto bg-slate-50">
        {!PLAN_LIMITS[plan].monthlyReports ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-zinc-100 border border-zinc-200">
              <Lock className="w-8 h-8 text-zinc-500" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-center">Upgrade to PLUS</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-zinc-600 text-center max-w-sm">
              Generate AI-powered board reports to get automated insights into your financial health.
            </p>
            <Link
              href={`/${orgSlug}/pricing`}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors mt-2"
            >
              Upgrade Plan
            </Link>
          </div>
        ) : !generatedReport ? (
          <>
            <DialogHeader>
              <DialogTitle>Generate AI Report</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 pt-4">
              <div className="grid grid-cols-1 gap-4 mb-2">
                <div className="space-y-2 flex flex-col items-center justify-center bg-emerald-50/50 border border-emerald-100 p-4 rounded-lg">
                  <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Analysis Style</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-white text-emerald-700 border-emerald-200 px-3 py-1 text-sm font-medium">
                      Dynamic Lens: {badgeLabel}
                    </Badge>
                  </div>
                  <p className="text-xs text-emerald-600/70 text-center max-w-xs mt-1">
                    Auto-detected based on your {daysCount}-day selection.
                  </p>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Date Range</label>
                <div className="border rounded-md p-2 flex justify-center bg-white shadow-sm">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={date?.from}
                    selected={date}
                    onSelect={setDate}
                    numberOfMonths={2}
                  />
                </div>
              </div>

              <Button onClick={handleGenerate} disabled={isGenerating || !date?.from || !date?.to} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                Generate AI Report
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-4 pt-2">
             {/* Header Controls */}
             <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white p-4 rounded-lg border shadow-sm">
                <div className="flex items-center gap-4">
                  <Button variant="outline" size="sm" onClick={() => setGeneratedReport(null)}>
                    Back
                  </Button>
                  <div className="flex items-center gap-2">
                    <Badge variant={generatedReport.type === "YEARLY" ? "default" : "outline"}>{generatedReport.type}</Badge>
                    <Badge variant={isCompleted ? "secondary" : "destructive"}>
                      {generatedReport.status.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
                <Button variant="default" size="sm" onClick={handleDownloadReport} disabled={isDownloading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {isDownloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                  Download Branded PDF
                </Button>
             </div>
             
             {/* The Branded Report View (Visible to User and to html-to-image) */}
             <div className="w-full overflow-x-auto bg-slate-200/50 p-4 sm:p-8 rounded-lg flex justify-center border shadow-inner">
               <div id="branded-report-template" className="w-[800px] bg-white p-12 text-slate-900 font-sans shadow-md shrink-0 border border-slate-100 relative">
                  
                  {/* Watermark for Insufficient Data */}
                  {!isCompleted && generatedReport.status === "INSUFFICIENT_DATA" && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                       <div className="text-4xl font-bold text-rose-500/10 rotate-[-30deg] border-4 border-rose-500/10 p-8 rounded-xl uppercase tracking-widest">
                         Insufficient Data
                       </div>
                    </div>
                  )}

                  {/* Header */}
                  <div className="flex justify-between items-start mb-6">
                    <img src="/logo.svg" alt="Margin" className="h-10" />
                    <div className="text-right">
                      <h1 className="text-2xl font-semibold text-slate-800">Margin {generatedReport.type === "WEEKLY" ? "Tactical Pulse" : generatedReport.type === "MONTHLY" ? "Boardroom Report" : "Executive Summary"}</h1>
                      <p className="text-sm text-slate-500 mt-1">Reporting Period: {formatCairoDate(new Date(generatedReport.startDate), "MMM d, yyyy")} – {formatCairoDate(new Date(generatedReport.endDate), "MMM d, yyyy")}</p>
                    </div>
                  </div>
                  
                  <div className="w-full h-[2px] bg-emerald-500 mb-8" />
                  
                  {/* Section 1 */}
                  <h2 className="text-sm font-bold text-emerald-600 tracking-wider uppercase mb-4">1. FINANCIAL HEALTH SNAPSHOT</h2>
                  <div className="grid grid-cols-3 gap-4 mb-8">
                    {generatedReport.type === "WEEKLY" && (
                      <>
                        <div className="bg-emerald-50/30 border-l-4 border-emerald-500 p-5">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">NET REVENUE</p>
                          <p className="text-3xl font-bold text-slate-900">{revenue.toLocaleString()} <span className="text-sm text-slate-500 font-normal">EGP</span></p>
                        </div>
                        <div className="bg-emerald-50/30 border-l-4 border-emerald-500 p-5">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">TRUE NET PROFIT</p>
                          <p className="text-3xl font-bold text-slate-900">{profit.toLocaleString()} <span className="text-sm text-slate-500 font-normal">EGP</span></p>
                        </div>
                        <div className="bg-emerald-50/30 border-l-4 border-emerald-500 p-5">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">AD SPEND (7D)</p>
                          <p className="text-3xl font-bold text-slate-900">{Number(metrics.adSpend || 0).toLocaleString()} <span className="text-sm text-slate-500 font-normal">EGP</span></p>
                        </div>
                      </>
                    )}
                    {generatedReport.type === "MONTHLY" && (
                      <>
                        <div className="bg-emerald-50/30 border-l-4 border-emerald-500 p-5">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">MONTHLY REVENUE</p>
                          <p className="text-3xl font-bold text-slate-900">{revenue.toLocaleString()} <span className="text-sm text-slate-500 font-normal">EGP</span></p>
                        </div>
                        <div className="bg-emerald-50/30 border-l-4 border-emerald-500 p-5">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">TRUE NET PROFIT</p>
                          <p className="text-3xl font-bold text-slate-900">{profit.toLocaleString()} <span className="text-sm text-slate-500 font-normal">EGP</span></p>
                        </div>
                        <div className="bg-emerald-50/30 border-l-4 border-emerald-500 p-5">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">NET MARGIN</p>
                          <p className="text-3xl font-bold text-slate-900">{(margin * 100).toFixed(1)}%</p>
                        </div>
                      </>
                    )}
                    {generatedReport.type === "QUARTERLY" && (
                      <>
                        <div className="bg-emerald-50/30 border-l-4 border-emerald-500 p-5">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">QUARTERLY REVENUE</p>
                          <p className="text-3xl font-bold text-slate-900">{revenue.toLocaleString()} <span className="text-sm text-slate-500 font-normal">EGP</span></p>
                        </div>
                        <div className="bg-emerald-50/30 border-l-4 border-emerald-500 p-5">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">NET PROFIT</p>
                          <p className="text-3xl font-bold text-slate-900">{profit.toLocaleString()} <span className="text-sm text-slate-500 font-normal">EGP</span></p>
                        </div>
                        <div className="bg-emerald-50/30 border-l-4 border-emerald-500 p-5">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">PRODUCT CONCENTRATION</p>
                          <p className="text-3xl font-bold text-slate-900">{(Number(metrics.productConcentrationPercent || 0)).toFixed(1)}%</p>
                        </div>
                      </>
                    )}
                    {generatedReport.type === "YEARLY" && (
                      <>
                        <div className="bg-emerald-50/30 border-l-4 border-emerald-500 p-5">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">ANNUAL REVENUE</p>
                          <p className="text-3xl font-bold text-slate-900">{revenue.toLocaleString()} <span className="text-sm text-slate-500 font-normal">EGP</span></p>
                        </div>
                        <div className="bg-emerald-50/30 border-l-4 border-emerald-500 p-5">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">ANNUAL PROFIT</p>
                          <p className="text-3xl font-bold text-slate-900">{profit.toLocaleString()} <span className="text-sm text-slate-500 font-normal">EGP</span></p>
                        </div>
                        <div className="bg-emerald-50/30 border-l-4 border-emerald-500 p-5">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">TOTAL EXPENSES</p>
                          <p className="text-3xl font-bold text-slate-900">{Number(metrics.expenses || 0).toLocaleString()} <span className="text-sm text-slate-500 font-normal">EGP</span></p>
                        </div>
                      </>
                    )}
                  </div>
                  
                  {/* Dynamic Specialized Section based on Report Type */}
                  {generatedReport.type === "WEEKLY" && metrics.dropRoi && metrics.dropRoi.length > 0 && (
                    <div className="mb-8">
                      <h2 className="text-sm font-bold tracking-wider uppercase mb-4 pt-4 border-t" style={{ color: "#059669", borderTopColor: "#f1f5f9" }}>2. DROP PERFORMANCE & ROI</h2>
                      <div className="w-full border rounded overflow-hidden" style={{ borderColor: "#f1f5f9" }}>
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 border-b" style={{ borderColor: "#f1f5f9" }}>
                            <tr>
                              <th className="p-3 font-semibold" style={{ color: "#475569" }}>Collection / Drop</th>
                              <th className="p-3 font-semibold" style={{ color: "#475569" }}>Revenue</th>
                              <th className="p-3 font-semibold" style={{ color: "#475569" }}>Net ROI</th>
                            </tr>
                          </thead>
                          <tbody>
                            {metrics.dropRoi.slice(0, 3).map((drop: any, i: number) => (
                              <tr key={i} className="border-b last:border-0" style={{ borderColor: "#f1f5f9" }}>
                                <td className="p-3 font-medium" style={{ color: "#0f172a" }}>{drop.name}</td>
                                <td className="p-3" style={{ color: "#334155" }}>{Number(drop.revenue).toLocaleString()} EGP</td>
                                <td className="p-3 font-bold" style={{ color: drop.roiPercent >= 0 ? "#10b981" : "#f43f5e" }}>
                                  {(Number(drop.roiPercent) * 100).toFixed(1)}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {generatedReport.type === "MONTHLY" && (
                    <div className="mb-8">
                      <h2 className="text-sm font-bold tracking-wider uppercase mb-4 pt-4 border-t" style={{ color: "#059669", borderTopColor: "#f1f5f9" }}>2. FULFILLMENT & LOGISTICS PULSE</h2>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 border rounded" style={{ borderColor: "#f1f5f9" }}>
                          <p className="text-xs font-semibold uppercase mb-1" style={{ color: "#64748b" }}>Avg. Fulfillment Time</p>
                          <p className="text-xl font-bold" style={{ color: "#0f172a" }}>{Number(metrics.avgFulfillmentDays || 0).toFixed(1)} Days</p>
                        </div>
                        <div className="p-4 bg-slate-50 border rounded" style={{ borderColor: "#f1f5f9" }}>
                          <p className="text-xs font-semibold uppercase mb-1" style={{ color: "#64748b" }}>Pending COD Escrow</p>
                          <p className="text-xl font-bold" style={{ color: "#f59e0b" }}>{Number(metrics.pendingCodBalance || 0).toLocaleString()} EGP</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {generatedReport.type === "QUARTERLY" && (
                    <div className="mb-8 space-y-8">
                      <div>
                        <h2 className="text-sm font-bold tracking-wider uppercase mb-4 pt-4 border-t" style={{ color: "#059669", borderTopColor: "#f1f5f9" }}>2A. COST STRUCTURE BREAKDOWN</h2>
                        <div className="flex flex-col gap-3">
                          <div className="flex justify-between items-center p-3 border-l-2 bg-slate-50" style={{ borderLeftColor: "#3b82f6" }}>
                            <span className="text-sm font-medium" style={{ color: "#334155" }}>Fixed Costs (Facilities, Salaries, Subs)</span>
                            <span className="text-sm font-bold" style={{ color: "#0f172a" }}>{Number(metrics.fixedCosts || 0).toLocaleString()} EGP</span>
                          </div>
                          <div className="flex justify-between items-center p-3 border-l-2 bg-slate-50" style={{ borderLeftColor: "#f59e0b" }}>
                            <span className="text-sm font-medium" style={{ color: "#334155" }}>Variable Costs (Ads, Logistics, Materials)</span>
                            <span className="text-sm font-bold" style={{ color: "#0f172a" }}>{Number(metrics.variableCosts || 0).toLocaleString()} EGP</span>
                          </div>
                        </div>
                      </div>

                      {metrics.topProducts && metrics.topProducts.length > 0 && (
                        <div>
                          <h2 className="text-sm font-bold tracking-wider uppercase mb-4 pt-4 border-t" style={{ color: "#059669", borderTopColor: "#f1f5f9" }}>2B. PARETO ANALYSIS (TOP PRODUCTS)</h2>
                          <div className="w-full border rounded overflow-hidden" style={{ borderColor: "#f1f5f9" }}>
                            <table className="w-full text-left text-sm">
                              <thead className="bg-slate-50 border-b" style={{ borderColor: "#f1f5f9" }}>
                                <tr>
                                  <th className="p-3 font-semibold" style={{ color: "#475569" }}>Product Name</th>
                                  <th className="p-3 font-semibold" style={{ color: "#475569" }}>Units Sold</th>
                                  <th className="p-3 font-semibold" style={{ color: "#475569" }}>Total Revenue</th>
                                </tr>
                              </thead>
                              <tbody>
                                {metrics.topProducts.slice(0, 3).map((prod: any, i: number) => (
                                  <tr key={i} className="border-b last:border-0" style={{ borderColor: "#f1f5f9" }}>
                                    <td className="p-3 font-medium" style={{ color: "#0f172a" }}>{prod.name}</td>
                                    <td className="p-3" style={{ color: "#334155" }}>{prod.quantity}</td>
                                    <td className="p-3 font-bold" style={{ color: "#10b981" }}>{Number(prod.revenue).toLocaleString()} EGP</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {generatedReport.type === "YEARLY" && (
                    <div className="mb-8">
                      <h2 className="text-sm font-bold tracking-wider uppercase mb-4 pt-4 border-t" style={{ color: "#059669", borderTopColor: "#f1f5f9" }}>2. EXPENSE HALL OF FAME</h2>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 border rounded" style={{ borderColor: "#f1f5f9" }}>
                          <p className="text-xs font-semibold uppercase mb-1" style={{ color: "#64748b" }}>Taxes & Legal Spend</p>
                          <p className="text-xl font-bold" style={{ color: "#ef4444" }}>{Number(metrics.taxesAndLegal || 0).toLocaleString()} EGP</p>
                        </div>
                        <div className="p-4 bg-slate-50 border rounded" style={{ borderColor: "#f1f5f9" }}>
                          <p className="text-xs font-semibold uppercase mb-1" style={{ color: "#64748b" }}>Total Expenses</p>
                          <p className="text-xl font-bold" style={{ color: "#ef4444" }}>{Number(metrics.expenses || 0).toLocaleString()} EGP</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Section 3 (Executive Story) */}
                  {generatedReport.oneParagraphStory && (
                    <>
                      <h2 className="text-sm font-bold tracking-wider uppercase mb-4 pt-4 border-t" style={{ color: "#059669", borderTopColor: "#f1f5f9" }}>
                        {generatedReport.type === "WEEKLY" ? "3" : "3"}. EXECUTIVE STORY
                      </h2>
                      <p className="text-sm leading-relaxed mb-8" style={{ color: "#334155" }}>{generatedReport.oneParagraphStory}</p>
                    </>
                  )}
                  
                  {/* Section 4 */}
                  {actionItems.length > 0 && (
                    <>
                      <h2 className="text-sm font-bold tracking-wider uppercase mb-4 pt-4 border-t" style={{ color: "#f43f5e", borderTopColor: "#f1f5f9" }}>
                        {generatedReport.type === "WEEKLY" ? "4" : "4"}. ANOMALIES & ACTION ITEMS
                      </h2>
                      <div className="space-y-4 mb-8">
                        {actionItems.map((item: any, idx: number) => (
                          <div key={idx} className="bg-rose-50/30 border-l-4 border-rose-500 p-5">
                            <p className="text-xs font-bold text-rose-600 uppercase mb-2">{item.title} <span className="text-[10px] ml-2 px-1.5 py-0.5 bg-rose-200 text-rose-800 rounded">{item.priority}</span></p>
                            <p className="text-sm leading-relaxed text-slate-800">{item.reason}</p>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Footer */}
                  <div className="text-center pt-8 border-t border-slate-100 mt-8">
                    <p className="text-xs text-slate-400">Generated securely by Margin's AI CFO Engine</p>
                  </div>
               </div>
             </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
