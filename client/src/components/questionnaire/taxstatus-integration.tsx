import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ExternalLink, FileText, CheckCircle2, Shield } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TaxStatusIntegrationProps {
  onComplete: (data: any) => void;
  onSkip: () => void;
}

export function TaxStatusIntegration({ onComplete, onSkip }: TaxStatusIntegrationProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const handleConnectTaxStatus = () => {
    setIsConnecting(true);
    
    // Simulate API connection process
    setTimeout(() => {
      setIsConnecting(false);
      setIsConnected(true);
      
      // Simulate successful data retrieval
      setTimeout(() => {
        onComplete({
          provider: 'taxstatus',
          taxReturnsVerified: true,
          businessReturnsVerified: true,
          verificationStatus: 'verified',
          connectedAt: new Date().toISOString()
        });
      }, 1000);
    }, 2500);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <div className="flex items-center justify-center mb-4">
          <FileText className="h-12 w-12 text-green-600" />
        </div>
        <CardTitle className="text-2xl">Connect Your Tax Returns</CardTitle>
        <CardDescription className="text-lg">
          Securely link your IRS.gov account through TaxStatus to verify your self-employment income
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            TaxStatus connects directly to your IRS.gov account to securely retrieve your tax returns. 
            This provides lenders with verified income documentation for faster loan processing.
          </AlertDescription>
        </Alert>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-semibold mb-2">What TaxStatus will retrieve:</h4>
          <ul className="space-y-1 text-sm text-gray-600">
            <li>• Personal tax returns (Form 1040)</li>
            <li>• Business tax returns (Schedule C, 1120, 1120S, 1065)</li>
            <li>• Income verification and calculations</li>
            <li>• Tax transcripts from IRS.gov</li>
          </ul>
        </div>

        {isConnected ? (
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center space-x-2 text-green-600">
              <CheckCircle2 className="h-6 w-6" />
              <span className="font-semibold">Successfully Connected!</span>
            </div>
            <p className="text-sm text-gray-600">
              Your tax returns have been verified through TaxStatus.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <Button 
              onClick={handleConnectTaxStatus}
              disabled={isConnecting}
              className="w-full bg-green-600 hover:bg-green-700"
              size="lg"
            >
              {isConnecting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Connecting to IRS.gov...
                </>
              ) : (
                <>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Connect with TaxStatus
                </>
              )}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={onSkip}
              className="w-full"
              disabled={isConnecting}
            >
              Skip and Enter Manually
            </Button>
          </div>
        )}

        <div className="text-xs text-gray-500 text-center">
          Powered by <a href="https://www.taxstatus.com/" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">TaxStatus</a> - 
          Secure IRS.gov integration with enterprise-grade security
        </div>
      </CardContent>
    </Card>
  );
}