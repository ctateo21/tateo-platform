import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Shield, DollarSign, TrendingUp, Building2 } from "lucide-react";

interface PlaidIntegrationProps {
  onComplete: (data: any) => void;
  onBack: () => void;
  defaultValues?: any;
}

export function PlaidIntegration({ onComplete, onBack, defaultValues }: PlaidIntegrationProps) {
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);

  const handlePlaidConnection = async () => {
    setConnecting(true);
    
    // Simulate Plaid connection
    setTimeout(() => {
      setConnecting(false);
      setConnected(true);
    }, 2000);
  };

  const handleContinue = () => {
    onComplete({
      plaidConnected: connected,
      connectedAccounts: selectedAccounts,
      connectionDate: new Date().toISOString()
    });
  };

  const mockAccounts = [
    { id: 'checking-1', name: 'Chase Checking', type: 'checking', balance: '$5,247.83' },
    { id: 'savings-1', name: 'Chase Savings', type: 'savings', balance: '$12,450.00' },
    { id: 'investment-1', name: '401(k) Account', type: 'investment', balance: '$87,320.15' }
  ];

  const handleAccountToggle = (accountId: string) => {
    setSelectedAccounts(prev => 
      prev.includes(accountId) 
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Connect Your Accounts</CardTitle>
        <CardDescription>
          Securely connect your bank accounts to verify assets and income
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {!connected ? (
          <>
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-start space-x-3">
                <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900">Bank-Level Security</h4>
                  <p className="text-sm text-blue-800 mt-1">
                    We use Plaid's industry-leading security to connect to your accounts. 
                    Your login credentials are never stored on our servers.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <DollarSign className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <h4 className="font-medium">Bank Accounts</h4>
                <p className="text-sm text-gray-600">Checking & Savings</p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <TrendingUp className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <h4 className="font-medium">Investments</h4>
                <p className="text-sm text-gray-600">401(k), IRA, Stocks</p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <Building2 className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                <h4 className="font-medium">Assets</h4>
                <p className="text-sm text-gray-600">Real Estate, Other</p>
              </div>
            </div>

            <div className="text-center">
              <Button 
                onClick={handlePlaidConnection}
                disabled={connecting}
                className="w-full sm:w-auto"
              >
                {connecting ? 'Connecting...' : 'Connect with Plaid'}
              </Button>
              <p className="text-xs text-gray-500 mt-2">
                By connecting, you agree to Plaid's Terms of Service and Privacy Policy
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center space-x-2">
                <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                <span className="font-medium text-green-800">Successfully Connected</span>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium">Select accounts to include in your application:</h4>
              {mockAccounts.map((account) => (
                <div key={account.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                  <input
                    type="checkbox"
                    id={account.id}
                    checked={selectedAccounts.includes(account.id)}
                    onChange={() => handleAccountToggle(account.id)}
                    className="rounded"
                  />
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <div>
                        <label htmlFor={account.id} className="font-medium cursor-pointer">
                          {account.name}
                        </label>
                        <p className="text-sm text-gray-600 capitalize">{account.type}</p>
                      </div>
                      <span className="font-medium">{account.balance}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Button 
              onClick={handleContinue}
              disabled={selectedAccounts.length === 0}
              className="w-full"
            >
              Continue with Selected Accounts
            </Button>
          </>
        )}

        <div className="flex justify-between">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          {!connected && (
            <Button variant="outline" onClick={handleContinue}>
              Skip for Now
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}