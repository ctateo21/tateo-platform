import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ExternalLink, Building2, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TruvIntegrationProps {
  onComplete: (data: any) => void;
  onSkip: () => void;
}

export function TruvIntegration({ onComplete, onSkip }: TruvIntegrationProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const handleConnectTruv = () => {
    setIsConnecting(true);
    
    // Simulate API connection process
    setTimeout(() => {
      setIsConnecting(false);
      setIsConnected(true);
      
      // Simulate successful data retrieval
      setTimeout(() => {
        onComplete({
          provider: 'truv',
          employerName: 'Connected via Truv',
          verificationStatus: 'verified',
          connectedAt: new Date().toISOString()
        });
      }, 1000);
    }, 2000);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <div className="flex items-center justify-center mb-4">
          <Building2 className="h-12 w-12 text-blue-600" />
        </div>
        <CardTitle className="text-2xl">Connect Your Employment</CardTitle>
        <CardDescription className="text-lg">
          Securely connect your employer information through Truv to verify your income instantly
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <Alert>
          <ExternalLink className="h-4 w-4" />
          <AlertDescription>
            Truv securely connects to your employer's payroll system to verify your employment and income information. 
            This eliminates the need for manual document uploads and speeds up your application.
          </AlertDescription>
        </Alert>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-semibold mb-2">What Truv will verify:</h4>
          <ul className="space-y-1 text-sm text-gray-600">
            <li>• Current employer and employment status</li>
            <li>• Income and pay frequency</li>
            <li>• Employment history</li>
            <li>• Direct deposit information</li>
          </ul>
        </div>

        {isConnected ? (
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center space-x-2 text-green-600">
              <CheckCircle2 className="h-6 w-6" />
              <span className="font-semibold">Successfully Connected!</span>
            </div>
            <p className="text-sm text-gray-600">
              Your employment information has been verified through Truv.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <Button 
              onClick={handleConnectTruv}
              disabled={isConnecting}
              className="w-full bg-blue-600 hover:bg-blue-700"
              size="lg"
            >
              {isConnecting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Connecting to Truv...
                </>
              ) : (
                <>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Connect with Truv
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
          Powered by <a href="https://truv.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Truv</a> - 
          Bank-level security with 256-bit encryption
        </div>
      </CardContent>
    </Card>
  );
}