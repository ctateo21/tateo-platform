import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, Loader2, CheckCircle2, AlertTriangle, Sparkles, X, UserCheck, Lock } from "lucide-react";
import { formatCurrency } from "@/lib/refi-calculations";
import { cn } from "@/lib/utils";
import type { MortgageAnalysis } from "./loan-tracker";

interface StatementAnalyzerProps {
  onAnalysisComplete: (analysis: MortgageAnalysis) => void;
  onAnalyzed?: (analysis: MortgageAnalysis) => void;
  trackedLoanCount?: number;
  maxLoans?: number;
  onSavePromptAnswer?: (accepted: boolean, analysis: MortgageAnalysis) => void;
  locked?: boolean;
}

const SAVE_DELAY_MS = 15_000;

export function StatementAnalyzer({
  onAnalysisComplete,
  onAnalyzed,
  trackedLoanCount = 0,
  maxLoans = 10,
  onSavePromptAnswer,
  locked = false,
}: StatementAnalyzerProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<MortgageAnalysis | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [savePromptVisible, setSavePromptVisible] = useState(false);
  const [saveCountdown, setSaveCountdown] = useState(0);
  const [saveAnswered, setSaveAnswered] = useState(false);
  const [isLocked, setIsLocked] = useState(locked);

  // If already authenticated, never lock or prompt again
  const alreadyAuthenticated = Boolean(localStorage.getItem("tateo_auth"));

  useEffect(() => { setIsLocked(locked); }, [locked]);

  useEffect(() => {
    // Skip save prompt entirely if user already has an account
    if (!analysis || saveAnswered || alreadyAuthenticated) return;
    setSaveCountdown(SAVE_DELAY_MS / 1000);
    const tick = setInterval(() => {
      setSaveCountdown(prev => {
        if (prev <= 1) {
          clearInterval(tick);
          setSavePromptVisible(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [analysis, saveAnswered, alreadyAuthenticated]);

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
        onAnalysisComplete(result.analysis);
        onAnalyzed?.(result.analysis);
        setUploadedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        // Reset prompt state for the new analysis
        setSavePromptVisible(false);
        setSaveAnswered(alreadyAuthenticated); // already auth'd → mark as answered so no prompt
        setSaveCountdown(0);
      } else {
        setError(result.error || "Failed to analyze statement");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveAnswer = (accepted: boolean) => {
    setSaveAnswered(true);
    setSavePromptVisible(false);
    if (!accepted) setIsLocked(true);
    if (analysis) onSavePromptAnswer?.(accepted, analysis);
  };

  const uploadZone = (
    <div
      className={cn(
        "border-2 border-dashed rounded-md p-6 text-center transition-colors",
        isLocked
          ? "opacity-50 cursor-not-allowed border-border"
          : "cursor-pointer " + (dragActive ? "border-primary bg-accent" : "border-border hover:border-primary/50 hover:bg-accent/30"),
        uploadedFile && !isLocked && "border-green-500 bg-green-50"
      )}
      onDragEnter={isLocked ? undefined : handleDrag}
      onDragLeave={isLocked ? undefined : handleDrag}
      onDragOver={isLocked ? undefined : handleDrag}
      onDrop={isLocked ? undefined : handleDrop}
      onClick={() => !uploadedFile && !isLocked && fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt"
        onChange={e => e.target.files?.[0] && !isLocked && handleFile(e.target.files[0])}
        className="hidden"
        disabled={isLocked}
      />
      {uploadedFile ? (
        <div className="flex items-center justify-center gap-2">
          <FileText className="h-5 w-5 text-green-600" />
          <span className="font-medium text-sm">{uploadedFile.name}</span>
          {!isLocked && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => { e.stopPropagation(); setUploadedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      ) : isLocked ? (
        <>
          <Lock className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium">Additional uploads disabled</p>
          <p className="text-xs text-muted-foreground mt-1">Save to your profile to analyze more statements</p>
        </>
      ) : (
        <>
          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium mb-1">
            {analysis ? "Upload a new mortgage statement" : "Drag and drop your mortgage statement here"}
          </p>
          <p className="text-xs text-muted-foreground">{analysis ? "or click to browse" : "or click to browse · PDF or text files"}</p>
        </>
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />AI Statement Analyzer
        </CardTitle>
        <CardDescription>Upload your mortgage statement (PDF) to automatically extract loan details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload zone — always visible */}
        {uploadZone}

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button onClick={analyzeStatement} disabled={isAnalyzing || !uploadedFile || isLocked} className="w-full">
          {isAnalyzing
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing...</>
            : <><Sparkles className="h-4 w-4 mr-2" />Analyze Statement</>}
        </Button>

        {/* Results — shown below upload once analysis is done */}
        {analysis && (
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="font-medium text-sm">Analysis Complete</span>
              </div>
              <Badge variant={analysis.confidence === "high" ? "default" : analysis.confidence === "medium" ? "secondary" : "outline"}>
                {analysis.confidence} confidence
              </Badge>
            </div>

            <div className="p-3 bg-muted rounded-md">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><p className="text-muted-foreground text-xs">Loan Balance</p><p className="font-semibold">{formatCurrency(analysis.loanBalance)}</p></div>
                <div><p className="text-muted-foreground text-xs">Interest Rate</p><p className="font-semibold">{analysis.interestRate}%</p></div>
                <div><p className="text-muted-foreground text-xs">Monthly P&I</p><p className="font-semibold">{formatCurrency(analysis.principalAndInterest)}</p></div>
                <div><p className="text-muted-foreground text-xs">Est. Remaining</p><p className="font-semibold">{analysis.estimatedRemainingYears} years</p></div>
                <div>
                  <p className="text-muted-foreground text-xs">Est. Home Value</p>
                  <p className="font-semibold">{formatCurrency(analysis.estimatedHomeValue)}</p>
                  <p className="text-xs text-amber-600">AI estimate · verify &amp; edit</p>
                </div>
                <div><p className="text-muted-foreground text-xs">Lender</p><p className="font-semibold truncate">{analysis.lender}</p></div>
              </div>
            </div>

            {/* 15-second countdown bar — only for non-authenticated users */}
            {!alreadyAuthenticated && !saveAnswered && !savePromptVisible && saveCountdown > 0 && (
              <Progress value={((SAVE_DELAY_MS / 1000 - saveCountdown) / (SAVE_DELAY_MS / 1000)) * 100} className="h-1" />
            )}

            {/* Save-to-profile prompt — only for non-authenticated users */}
            {!alreadyAuthenticated && savePromptVisible && !saveAnswered && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
                <div className="flex items-start gap-2">
                  <UserCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-sm">Save this to your profile?</p>
                    <p className="text-xs text-muted-foreground mt-0.5">We'll store your loan details so you can track refinance opportunities over time.</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => handleSaveAnswer(true)}>Yes, save it</Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => handleSaveAnswer(false)}>No thanks</Button>
                </div>
              </div>
            )}

            {!alreadyAuthenticated && saveAnswered && !isLocked && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Saving your profile — complete the form below.
              </p>
            )}

            {alreadyAuthenticated && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Saved to your account automatically.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
