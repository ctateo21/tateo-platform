import { useState, useEffect } from "react";
import { z } from "zod";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, Building2, Car, Home, Plus, Trash2, Link, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import QuestionnaireForm from "./questionnaire-form";
import CurrencyInput from "./currency-input";
import { PlaidIntegration } from "./plaid-integration";

// Schema for liabilities form
const liabilitiesFormSchema = z.object({
  inputMethod: z.enum(["manual", "plaid"]),
  manualDebts: z.array(z.object({
    type: z.string(),
    monthlyPayment: z.string(),
  })).optional(),
  plaidConnected: z.boolean().optional(),
});

interface MortgageLiabilitiesFormProps {
  onSubmit: (data: z.infer<typeof liabilitiesFormSchema>) => void;
  onBack: () => void;
  defaultValues?: any;
  monthlyIncome?: number; // Pass monthly income from previous step
}

const debtTypes = [
  { value: "credit_card", label: "Credit Card", icon: CreditCard },
  { value: "auto_loan", label: "Auto Loan", icon: Car },
  { value: "student_loan", label: "Student Loan", icon: Building2 },
  { value: "personal_loan", label: "Personal Loan", icon: Building2 },
  { value: "mortgage", label: "Other Mortgage", icon: Home },
  { value: "other", label: "Other Debt", icon: CreditCard },
];

export function MortgageLiabilitiesForm({ onSubmit, onBack, defaultValues, monthlyIncome = 0 }: MortgageLiabilitiesFormProps) {
  const [inputMethod, setInputMethod] = useState<"manual" | "plaid">("plaid");
  const [showPlaidFlow, setShowPlaidFlow] = useState(false);
  const [manualDebts, setManualDebts] = useState([
    { type: "", monthlyPayment: "" }
  ]);
  const [plaidConnected, setPlaidConnected] = useState(false);
  const [plaidData, setPlaidData] = useState<any>(null);
  const [totalMonthlyDebts, setTotalMonthlyDebts] = useState(0);

  // Calculate total monthly debts
  useEffect(() => {
    if (inputMethod === "manual") {
      const total = manualDebts.reduce((sum, debt) => {
        const payment = parseFloat(debt.monthlyPayment.replace(/[$,]/g, '')) || 0;
        return sum + payment;
      }, 0);
      setTotalMonthlyDebts(total);
    } else if (plaidConnected) {
      // Simulated Plaid data
      setTotalMonthlyDebts(810); // $275 + $385 + $150
    }
  }, [manualDebts, inputMethod, plaidConnected]);

  // Form default values
  const formDefaults = {
    inputMethod: "plaid" as const,
    manualDebts: [{ type: "", monthlyPayment: "" }],
    plaidConnected: false,
    ...defaultValues,
  };

  // Calculate debt-to-income ratio
  const debtToIncomeRatio = monthlyIncome > 0 ? (totalMonthlyDebts / monthlyIncome) * 100 : 0;

  const handleSubmit = (data: any) => {
    const submissionData = {
      ...data,
      inputMethod,
      ...(inputMethod === "manual" && { manualDebts }),
      ...(inputMethod === "plaid" && { plaidConnected }),
    };
    onSubmit(submissionData);
  };

  const addDebt = () => {
    setManualDebts([...manualDebts, { type: "", monthlyPayment: "" }]);
  };

  const removeDebt = (index: number) => {
    if (manualDebts.length > 1) {
      setManualDebts(manualDebts.filter((_, i) => i !== index));
    }
  };

  const updateDebt = (index: number, field: string, value: string) => {
    const updated = [...manualDebts];
    updated[index] = { ...updated[index], [field]: value };
    setManualDebts(updated);
  };

  const handlePlaidConnect = () => {
    setShowPlaidFlow(true);
  };

  const handlePlaidComplete = (data: any) => {
    setPlaidData(data);
    setPlaidConnected(true);
    setTotalMonthlyDebts(data.totalMonthlyDebts);
    setShowPlaidFlow(false);
    
    // Submit the form with Plaid data
    onSubmit({
      inputMethod: 'plaid',
      plaidConnected: true,
      plaidData: data,
      totalMonthlyDebts: data.totalMonthlyDebts,
      totalAssets: data.totalAssets
    });
  };

  const handlePlaidCancel = () => {
    setShowPlaidFlow(false);
    setInputMethod('manual');
  };

  // Show Plaid integration flow
  if (showPlaidFlow) {
    return (
      <div className="space-y-6">
        <Button 
          variant="ghost" 
          onClick={handlePlaidCancel}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Selection
        </Button>
        <PlaidIntegration onComplete={handlePlaidComplete} onCancel={handlePlaidCancel} />
      </div>
    );
  }

  return (
    <QuestionnaireForm
      schema={liabilitiesFormSchema}
      defaultValues={formDefaults}
      onSubmit={handleSubmit}
      onBack={onBack}
    >
      <h3 className="text-2xl font-semibold mb-2 text-primary">Monthly Liabilities</h3>
      <p className="text-muted-foreground mb-6">Help us understand your monthly debt obligations</p>
      
      <div className="space-y-6">
        {/* Input Method Selection */}
        <div className="space-y-6">
          <div className="text-center">
            <h4 className="text-lg font-medium mb-2">Connect Your Financial Accounts</h4>
            <p className="text-muted-foreground">We'll securely collect your debts AND assets for a complete financial picture</p>
          </div>
          
          {/* Plaid Connection Option - Dominant */}
          <Card 
            className={`cursor-pointer transition-all border-2 ${inputMethod === "plaid" ? "ring-4 ring-blue-200 border-blue-500 bg-blue-50" : "border-blue-300 hover:border-blue-400"}`}
            onClick={() => {
              setInputMethod("plaid");
              handlePlaidConnect();
            }}
          >
            <CardHeader className="text-center py-8">
              <div className="mx-auto mb-4 w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <Link className="h-8 w-8 text-blue-600" />
              </div>
              <CardTitle className="text-2xl text-blue-700 mb-2">Connect with Plaid</CardTitle>
              <CardDescription className="text-lg mb-4">
                <strong>Recommended:</strong> Securely connect your bank accounts and credit cards
              </CardDescription>
              <div className="bg-white/80 p-4 rounded-lg text-sm text-left space-y-2">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Automatically imports all debts and monthly payments</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Collects asset information (savings, checking, investments)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Faster processing and more accurate loan terms</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Bank-level security with 256-bit encryption</span>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Manual Input Option - Smaller, Less Prominent */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setInputMethod("manual")}
              className={`text-sm px-4 py-2 rounded-md transition-all ${
                inputMethod === "manual" 
                  ? "bg-gray-200 text-gray-800" 
                  : "text-gray-600 hover:text-gray-800 hover:bg-gray-100"
              }`}
            >
              Or enter debts manually instead
            </button>
          </div>
        </div>

        {/* Manual Input Section */}
        {inputMethod === "manual" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-medium">Your Monthly Debts</h4>
              <Button type="button" onClick={addDebt} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Debt
              </Button>
            </div>
            
            {manualDebts.map((debt, index) => (
              <Card key={index}>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Debt Type */}
                    <div>
                      <label className="text-sm font-medium mb-2 block">Type of Debt</label>
                      <Select
                        value={debt.type}
                        onValueChange={(value) => updateDebt(index, "type", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select debt type" />
                        </SelectTrigger>
                        <SelectContent>
                          {debtTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              <div className="flex items-center">
                                <type.icon className="h-4 w-4 mr-2" />
                                {type.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Monthly Payment */}
                    <div>
                      <label className="text-sm font-medium mb-2 block">Monthly Payment *</label>
                      <CurrencyInput
                        value={debt.monthlyPayment}
                        onChange={(value) => updateDebt(index, "monthlyPayment", value)}
                        placeholder="$0"
                      />
                    </div>
                  </div>

                  {/* Remove Button */}
                  {manualDebts.length > 1 && (
                    <div className="mt-4 text-right">
                      <Button 
                        type="button" 
                        onClick={() => removeDebt(index)} 
                        variant="outline" 
                        size="sm"
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            <div className="text-sm text-muted-foreground">
              <p>* Only include debts that will show on your credit report</p>
              <p>* Don't include utilities, insurance, or monthly subscriptions</p>
            </div>
          </div>
        )}

        {/* Income and Debt Summary */}
        {(inputMethod === "manual" || plaidConnected) && (
          <div className="space-y-4 mt-8 pt-6 border-t">
            <h4 className="text-lg font-medium">Financial Summary</h4>
            
            {/* Monthly Income */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-green-800 font-medium">Monthly Income</span>
                <span className="text-green-900 font-bold text-xl">
                  ${monthlyIncome.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Monthly Debts */}
            {totalMonthlyDebts > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-red-800 font-medium">Monthly Debts</span>
                  <span className="text-red-900 font-bold text-xl">
                    ${totalMonthlyDebts.toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {/* Debt-to-Income Ratio */}
            {monthlyIncome > 0 && totalMonthlyDebts > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-blue-800 font-medium">
                    Debt-to-Income Ratio (without housing payment)
                  </span>
                  <span className="text-blue-900 font-bold text-xl">
                    {debtToIncomeRatio.toFixed(1)}%
                  </span>
                </div>
                <div className="mt-2 text-sm text-blue-700">
                  {debtToIncomeRatio <= 36 ? (
                    <span className="text-green-700">✓ Excellent - Most lenders prefer this ratio</span>
                  ) : debtToIncomeRatio <= 43 ? (
                    <span className="text-yellow-700">⚠ Good - Some loan programs may apply</span>
                  ) : (
                    <span className="text-red-700">⚠ High - May limit loan options</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Plaid Connection Section */}
        {inputMethod === "plaid" && (
          <div className="space-y-4">
            {!plaidConnected ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Link className="h-5 w-5 mr-2" />
                    Connect to Your Financial Accounts
                  </CardTitle>
                  <CardDescription>
                    Securely connect to Credit Karma or other financial accounts to automatically import your debt information.
                    This uses bank-level security and we never store your login credentials.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={handlePlaidConnect} className="w-full">
                    <Link className="h-4 w-4 mr-2" />
                    Connect with Plaid
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Powered by Plaid - trusted by millions of users
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-green-200 bg-green-50">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Link className="h-6 w-6 text-green-600" />
                    </div>
                    <h4 className="font-medium text-green-900 mb-2">Successfully Connected!</h4>
                    <p className="text-sm text-green-700 mb-4">
                      We've imported your debt information from your connected accounts.
                      You can review and modify this information before proceeding.
                    </p>
                    <div className="space-y-2 text-left bg-white p-4 rounded border">
                      <div className="flex justify-between">
                        <span>Chase Credit Card</span>
                        <span className="font-medium">$275/month</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Auto Loan - Honda</span>
                        <span className="font-medium">$385/month</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Student Loan</span>
                        <span className="font-medium">$150/month</span>
                      </div>
                      <hr />
                      <div className="flex justify-between font-semibold">
                        <span>Total Monthly Debt</span>
                        <span>$810/month</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </QuestionnaireForm>
  );
}