import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, Loader2, CheckCircle2, AlertTriangle, Sparkles, ArrowRight, X, ListPlus } from "lucide-react";
import { formatCurrency } from "@/lib/refi-calculations";
import { cn } from "@/lib/utils";
import type { MortgageAnalysis } from "./loan-tracker";

interface StatementAnalyzerProps {
  onAnalysisComplete: (analysis: MortgageAnalysis) => void;
  onAnalyzed?: (analysis: MortgageAnalysis) => void;
  trackedLoanCount?: number;
  maxLoans?: number;
}

export function StatementAnalyzer({ onAnalysisComplete, onAnalyzed, trackedLoanCount = 0, maxLoans = 10 }: StatementAnalyzerProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<MortgageAnalysis | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleFile = (file: File) => {
    if (file.type === "application/pdf" || file.type.startsWith("text/")) {
      setUploadedFile(file); setError(null);
    } else {
      setError("Please upload a PDF or text file.");
    }
  };

  const analyzeStatement = async () => {
    if (!uploadedFile) { setError("Please upload a mortgage statement file."); return; }
    setIsAnalyzing(true); setError(null);
    try {
      const formData = new FormData();
      formData.append("file", uploadedFile);
      const response = await fetch("/api/analyze-statement", { method: "POST", body: formData });
      const result = await response.json();
      if (result.success && result.analysis) {
        setAnalysis(result.analysis);
        onAnalyzed?.(result.analysis);
      } else {
        setError(result.error || "Failed to analyze statement");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const clearAll = () => {
    setUploadedFile(null); setAnalysis(null); setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />AI Statement Analyzer</CardTitle>
        <CardDescription>Upload your mortgage statement (PDF) to automatically extract loan details and populate the calculator</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!analysis ? (
          <>
            <div
              className={cn("border-2 border-dashed rounded-md p-8 text-center transition-colors cursor-pointer",
                dragActive ? "border-primary bg-accent" : "border-border hover:border-primary/50 hover:bg-accent/30",
                uploadedFile && "border-green-500 bg-green-50")}
              onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
              onClick={() => !uploadedFile && fileInputRef.current?.click()}
            >
              <input ref={fileInputRef} type="file" accept=".pdf,.txt" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} className="hidden" />
              {uploadedFile ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText className="h-6 w-6 text-green-600" />
                  <span className="font-medium">{uploadedFile.name}</span>
                  <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); setUploadedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm font-medium mb-1">Drag and drop your mortgage statement here</p>
                  <p className="text-sm text-muted-foreground mb-3">or click to browse</p>
                  <p className="text-xs text-muted-foreground">Supports PDF and text files</p>
                </>
              )}
            </div>
            {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
            <Button onClick={analyzeStatement} disabled={isAnalyzing || !uploadedFile} className="w-full">
              {isAnalyzing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing...</> : <><Sparkles className="h-4 w-4 mr-2" />Analyze Statement</>}
            </Button>
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-600" /><span className="font-medium">Analysis Complete</span></div>
              <Badge variant={analysis.confidence === "high" ? "default" : analysis.confidence === "medium" ? "secondary" : "outline"}>{analysis.confidence} confidence</Badge>
            </div>
            <div className="space-y-3 p-4 bg-muted rounded-md">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted-foreground">Loan Balance</p><p className="font-semibold">{formatCurrency(analysis.loanBalance)}</p></div>
                <div><p className="text-muted-foreground">Interest Rate</p><p className="font-semibold">{analysis.interestRate}%</p></div>
                <div><p className="text-muted-foreground">Monthly P&I</p><p className="font-semibold">{formatCurrency(analysis.principalAndInterest)}</p></div>
                <div><p className="text-muted-foreground">Est. Remaining</p><p className="font-semibold">{analysis.estimatedRemainingYears} years</p></div>
                <div><p className="text-muted-foreground">Est. Home Value</p><p className="font-semibold">{formatCurrency(analysis.estimatedHomeValue)}</p><p className="text-xs text-amber-600">AI estimate · verify &amp; edit</p></div>
                <div><p className="text-muted-foreground">Lender</p><p className="font-semibold truncate">{analysis.lender}</p></div>
              </div>
            </div>
            <Alert className={analysis.potentialSavings > 0 ? "border-green-500" : "border-amber-500"}>
              <AlertDescription>
                <p className="font-medium mb-1">{analysis.potentialSavings > 0 ? "Refinancing Recommended" : "Keep Your Current Loan"}</p>
                <p className="text-sm">{analysis.recommendation}</p>
                {analysis.potentialSavings > 0 && <p className="text-sm font-semibold mt-2 text-green-600">Potential Monthly Savings: {formatCurrency(analysis.potentialSavings)}</p>}
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Button onClick={() => onAnalysisComplete(analysis)} variant="outline" className="flex-1">Apply to Calculator<ArrowRight className="h-4 w-4 ml-2" /></Button>
              <Button onClick={clearAll} className="flex-1"><ListPlus className="h-4 w-4 mr-2" />Analyze Another</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
