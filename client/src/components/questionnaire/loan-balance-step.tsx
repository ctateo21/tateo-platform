import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Upload, DollarSign, FileText } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface LoanBalanceStepProps {
  onSubmit: (data: { loanBalance: string; hasStatement?: boolean }) => void;
  onBack: () => void;
}

export function LoanBalanceStep({ onSubmit, onBack }: LoanBalanceStepProps) {
  const [inputMethod, setInputMethod] = useState<'type' | 'upload' | null>(null);
  const [loanBalance, setLoanBalance] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  const handleSubmit = () => {
    if (inputMethod === 'type' && !loanBalance.trim()) return;
    if (inputMethod === 'upload' && !uploadedFile) return;
    
    onSubmit({ 
      loanBalance: inputMethod === 'type' ? loanBalance : `Uploaded: ${uploadedFile?.name}`,
      hasStatement: inputMethod === 'upload'
    });
  };

  const formatCurrency = (value: string) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '');
    // Format with commas
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const handleBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrency(e.target.value);
    setLoanBalance(formatted);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-primary mb-2">
          Current Loan Balance
        </h2>
        <p className="text-gray-600">
          What is your current loan balance?
        </p>
      </div>

      <div className="space-y-4">
        {/* Input Method Selection */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card 
            className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
              inputMethod === 'type' 
                ? 'ring-2 ring-secondary shadow-lg border-secondary' 
                : 'hover:border-primary/50'
            }`}
            onClick={() => {
              setInputMethod('type');
              setUploadedFile(null);
            }}
          >
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-3">
                <div className={`p-3 rounded-full ${
                  inputMethod === 'type' 
                    ? 'bg-secondary/20' 
                    : 'bg-primary/10'
                }`}>
                  <DollarSign className="h-8 w-8 text-primary" />
                </div>
              </div>
              <CardTitle className="text-lg text-primary">Type Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 text-center">
                Enter your current loan balance manually
              </p>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
              inputMethod === 'upload' 
                ? 'ring-2 ring-secondary shadow-lg border-secondary' 
                : 'hover:border-primary/50'
            }`}
            onClick={() => {
              setInputMethod('upload');
              setLoanBalance('');
            }}
          >
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-3">
                <div className={`p-3 rounded-full ${
                  inputMethod === 'upload' 
                    ? 'bg-secondary/20' 
                    : 'bg-primary/10'
                }`}>
                  <Upload className="h-8 w-8 text-primary" />
                </div>
              </div>
              <CardTitle className="text-lg text-primary">Upload Statement</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 text-center">
                Upload your mortgage statement
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Type Balance Input */}
        {inputMethod === 'type' && (
          <Card className="p-6">
            <div className="space-y-4">
              <Label htmlFor="loanBalance" className="text-base font-semibold">
                Current Loan Balance
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  id="loanBalance"
                  type="text"
                  placeholder="250,000"
                  value={loanBalance}
                  onChange={handleBalanceChange}
                  className="pl-10 text-lg"
                />
              </div>
              <Alert className="border-blue-200 bg-blue-50">
                <AlertDescription className="text-blue-800">
                  Enter the current principal balance on your mortgage (not the original loan amount).
                </AlertDescription>
              </Alert>
            </div>
          </Card>
        )}

        {/* Upload Statement */}
        {inputMethod === 'upload' && (
          <Card className="p-6">
            <div className="space-y-4">
              <Label htmlFor="statement" className="text-base font-semibold">
                Upload Mortgage Statement
              </Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <div className="space-y-2">
                  <Label htmlFor="statement" className="cursor-pointer">
                    <span className="text-primary hover:text-primary/80 font-medium">
                      Click to upload
                    </span>
                    <span className="text-gray-600"> or drag and drop</span>
                  </Label>
                  <p className="text-sm text-gray-500">PDF, JPG, PNG up to 10MB</p>
                </div>
                <Input
                  id="statement"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
              {uploadedFile && (
                <Alert className="border-green-200 bg-green-50">
                  <AlertDescription className="text-green-800">
                    <strong>Uploaded:</strong> {uploadedFile.name}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </Card>
        )}
      </div>

      <div className="flex justify-between mt-8">
        <Button 
          variant="outline" 
          onClick={onBack}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        
        <Button 
          onClick={handleSubmit}
          disabled={
            !inputMethod || 
            (inputMethod === 'type' && !loanBalance.trim()) || 
            (inputMethod === 'upload' && !uploadedFile)
          }
          className="bg-secondary hover:bg-secondary/90 text-white"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}