import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Shield, Building2, CreditCard, Banknote, ExternalLink } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PlaidIntegrationProps {
  onComplete: (data: any) => void;
  onCancel: () => void;
}

export function PlaidIntegration({ onComplete, onCancel }: PlaidIntegrationProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedAccounts, setConnectedAccounts] = useState<any[]>([]);

  const handleConnectPlaid = () => {
    setIsConnecting(true);
    
    // Simulate Plaid Link flow
    setTimeout(() => {
      setIsConnecting(false);
      setIsConnected(true);
      
      // Simulate retrieved financial data
      const mockData = {
        debts: [
          { type: "Credit Card", institution: "Chase Freedom", balance: 2750, monthlyPayment: 275 },
          { type: "Auto Loan", institution: "Toyota Financial", balance: 18500, monthlyPayment: 385 },
          { type: "Student Loan", institution: "Federal Student Aid", balance: 12300, monthlyPayment: 150 }
        ],
        assets: [
          { type: "Checking", institution: "Chase Bank", balance: 8500 },
          { type: "Savings", institution: "Chase Bank", balance: 25000 },
          { type: "Investment", institution: "Fidelity 401k", balance: 85000 }
        ],
        totalMonthlyDebts: 810,
        totalAssets: 118500
      };
      
      setConnectedAccounts([
        "Chase Bank",
        "Toyota Financial Services", 
        "Federal Student Aid",
        "Fidelity Investments"
      ]);
      
      // Complete after showing results
      setTimeout(() => {
        onComplete(mockData);
      }, 2000);
    }, 3000);
  };

  if (isConnected) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl text-green-700">Successfully Connected!</CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">
              We've securely retrieved your financial information from the following accounts:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {connectedAccounts.map((account, index) => (
              <div key={index} className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="font-medium">{account}</span>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-800 mb-2">What we collected:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium text-blue-700">Monthly Debts:</p>
                <ul className="text-blue-600 space-y-1">
                  <li>• Credit Card: $275/month</li>
                  <li>• Auto Loan: $385/month</li>
                  <li>• Student Loan: $150/month</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-blue-700">Assets:</p>
                <ul className="text-blue-600 space-y-1">
                  <li>• Checking: $8,500</li>
                  <li>• Savings: $25,000</li>
                  <li>• 401(k): $85,000</li>
                </ul>
              </div>
            </div>
          </div>

          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Your financial data is protected with bank-level security. We only access the information needed for your loan application.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
          <Building2 className="h-8 w-8 text-blue-600" />
        </div>
        <CardTitle className="text-2xl">Connect Your Financial Accounts</CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Plaid uses bank-level security to safely connect your accounts. We'll collect both your debts and assets to provide the most accurate loan terms.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div className="p-4 bg-gray-50 rounded-lg">
            <CreditCard className="h-8 w-8 mx-auto mb-2 text-blue-600" />
            <h4 className="font-semibold">Credit Cards</h4>
            <p className="text-sm text-muted-foreground">Balances & payments</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <Building2 className="h-8 w-8 mx-auto mb-2 text-blue-600" />
            <h4 className="font-semibold">Loans</h4>
            <p className="text-sm text-muted-foreground">Auto, student, personal</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <Banknote className="h-8 w-8 mx-auto mb-2 text-blue-600" />
            <h4 className="font-semibold">Assets</h4>
            <p className="text-sm text-muted-foreground">Checking, savings, investments</p>
          </div>
        </div>

        <div className="space-y-4">
          <Button 
            onClick={handleConnectPlaid}
            disabled={isConnecting}
            className="w-full bg-blue-600 hover:bg-blue-700"
            size="lg"
          >
            {isConnecting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Connecting to your accounts...
              </>
            ) : (
              <>
                <ExternalLink className="h-4 w-4 mr-2" />
                Connect with Plaid
              </>
            )}
          </Button>
          
          <Button 
            variant="ghost" 
            onClick={onCancel}
            className="w-full"
            disabled={isConnecting}
          >
            Cancel
          </Button>
        </div>

        <div className="text-xs text-gray-500 text-center">
          Powered by <a href="https://plaid.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Plaid</a> - 
          Trusted by thousands of financial institutions
        </div>
      </CardContent>
    </Card>
  );
}