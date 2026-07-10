"use client";

import { useState } from "react";
import { generateReport } from "@/actions/reports.actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileText, Download, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Report } from "@prisma/client";
import { format } from "date-fns";
import { formatCairoDate } from "@/lib/date-utils";

export default function ReportsClient({ orgSlug, initialReports }: { orgSlug: string, initialReports: Report[] }) {
  const [reports, setReports] = useState(initialReports);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedType, setSelectedType] = useState<"WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY">("WEEKLY");

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const now = new Date();
      let start = new Date(now);
      
      switch (selectedType) {
        case "WEEKLY": start.setDate(start.getDate() - 7); break;
        case "MONTHLY": start.setMonth(start.getMonth() - 1); break;
        case "QUARTERLY": start.setMonth(start.getMonth() - 3); break;
        case "YEARLY": start.setFullYear(start.getFullYear() - 1); break;
      }

      const result = await generateReport(
        orgSlug,
        selectedType,
        start.toISOString(),
        now.toISOString()
      );

      if (result.success && result.data) {
        if (result.data.status === "INSUFFICIENT_DATA") {
          toast.info("Not enough data to generate narrative", {
            description: "A report was generated but skipped the AI narrative due to low activity."
          });
        } else {
          toast.success("Report generated successfully!");
        }
        
        // Optimistic update
        setReports(prev => [result.data as Report, ...prev.filter(r => r.id !== result.data.id)]);
      } else {
        toast.error(result.message || result.error || "Failed to generate report");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadCsv = (report: Report) => {
    // A real implementation would fetch transactions and convert to CSV.
    // For now, we mock the download for demonstration.
    toast.success("Preparing CSV download...", {
      description: "In a full environment, this would export all 12 months of transactions."
    });
  };

  return (
    <div className="space-y-6">
      <Card className="border-primary/10 shadow-sm">
        <CardHeader className="bg-primary/5 pb-4">
          <CardTitle>Generate New Report</CardTitle>
          <CardDescription>Select the type of report you want the AI CFO to analyze.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6 flex flex-col sm:flex-row gap-4 items-center">
          <Select value={selectedType} onValueChange={(v: any) => setSelectedType(v)}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="WEEKLY">Weekly Pulse</SelectItem>
              <SelectItem value="MONTHLY">Monthly Boardroom</SelectItem>
              <SelectItem value="QUARTERLY">Quarterly Pivot</SelectItem>
              <SelectItem value="YEARLY">Yearly Tax & Bookkeeping</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleGenerate} disabled={isGenerating} className="w-full sm:w-auto">
            {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
            Generate Report
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6">
        {reports.map((report) => (
          <ReportCard key={report.id} report={report} onDownload={() => handleDownloadCsv(report)} />
        ))}
        {reports.length === 0 && (
          <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
            No reports generated yet. Click generate above to create your first one.
          </div>
        )}
      </div>
    </div>
  );
}

function ReportCard({ report, onDownload }: { report: Report; onDownload: () => void }) {
  const isCompleted = report.status === "COMPLETED";
  const metrics = report.metrics as any || {};
  const actionItems = metrics.actionItems || [];
  const revenue = Number(report.revenue || 0);
  const profit = Number(report.profit || 0);
  const margin = Number(report.marginPercent || 0);

  return (
    <Card>
      <CardHeader className="border-b bg-muted/20">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Badge variant={report.type === "YEARLY" ? "default" : "outline"}>{report.type}</Badge>
              <Badge variant={isCompleted ? "secondary" : "destructive"}>
                {report.status.replace("_", " ")}
              </Badge>
            </div>
            <CardDescription>
              {formatCairoDate(new Date(report.startDate), "MMM d, yyyy")} - {formatCairoDate(new Date(report.endDate), "MMM d, yyyy")}
            </CardDescription>
          </div>
          {report.type === "YEARLY" && (
            <Button variant="outline" size="sm" onClick={onDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download CSV for Accountant
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pt-6">
        {report.oneParagraphStory && (
          <div className="mb-6 p-4 bg-primary/5 rounded-lg border border-primary/10">
            <p className="text-sm font-medium leading-relaxed">
              {report.oneParagraphStory}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 border rounded-lg">
            <div className="text-xs text-muted-foreground uppercase mb-1">Realized Revenue</div>
            <div className="text-2xl font-bold">{revenue.toLocaleString()} EGP</div>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="text-xs text-muted-foreground uppercase mb-1">True Net Profit</div>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">{profit.toLocaleString()} EGP</div>
              {profit > 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : profit < 0 ? (
                <TrendingDown className="h-4 w-4 text-red-500" />
              ) : null}
            </div>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="text-xs text-muted-foreground uppercase mb-1">Net Margin</div>
            <div className="text-2xl font-bold">{(margin * 100).toFixed(1)}%</div>
          </div>
        </div>

        {actionItems.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-3">Recommended Actions</h4>
            <div className="space-y-3">
              {actionItems.map((item: any, idx: number) => (
                <div key={idx} className="flex gap-3 items-start text-sm">
                  <ArrowRight className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <div>
                    <span className="font-semibold">{item.title}</span>{" "}
                    <Badge variant={item.priority === "HIGH" ? "destructive" : "secondary"} className="text-[10px] ml-1 h-4 px-1">
                      {item.priority}
                    </Badge>
                    <p className="text-muted-foreground mt-1">{item.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {!isCompleted && report.status === "INSUFFICIENT_DATA" && (
          <div className="text-sm text-muted-foreground italic">
            Not enough transaction data during this period to generate AI insights.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
