import { useState } from "react";
import { z } from "zod";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, Building2, Car, Home, Plus, Trash2, Link } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import QuestionnaireForm from "./questionnaire-form";
import CurrencyInput from "./currency-input";

// Schema for liabilities form
const liabilitiesFormSchema = z.object({
  inputMethod: z.enum(["manual", "plaid"]),
  manualDebts: z.array(z.object({
    type: z.string(),
    creditor: z.string(),
    monthlyPayment: z.string(),
    remainingBalance: z.string().optional(),
  })).optional(),
  plaidConnected: z.boolean().optional(),
});

interface MortgageLiabilitiesFormProps {
  onSubmit: (data: z.infer<typeof liabilitiesFormSchema>) => void;
  onBack: () => void;
  defaultValues?: any;
}

const debtTypes = [
  { value: "credit_card", label: "Credit Card", icon: CreditCard },
  { value: "auto_loan", label: "Auto Loan", icon: Car },
  { value: "student_loan", label: "Student Loan", icon: Building2 },
  { value: "personal_loan", label: "Personal Loan", icon: Building2 },
  { value: "mortgage", label: "Other Mortgage", icon: Home },
  { value: "other", label: "Other Debt", icon: CreditCard },
];

export function MortgageLiabilitiesForm({ onSubmit, onBack, defaultValues }: MortgageLiabilitiesFormProps) {
  const [inputMethod, setInputMethod] = useState<"manual" | "plaid">("manual");
  const [manualDebts, setManualDebts] = useState([
    { type: "", creditor: "", monthlyPayment: "", remainingBalance: "" }
  ]);
  const [plaidConnected, setPlaidConnected] = useState(false);

  // Form default values
  const formDefaults = {
    inputMethod: "manual" as const,
    manualDebts: [{ type: "", creditor: "", monthlyPayment: "", remainingBalance: "" }],
    plaidConnected: false,
    ...defaultValues,
  };

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
    setManualDebts([...manualDebts, { type: "", creditor: "", monthlyPayment: "", remainingBalance: "" }]);
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

  const connectToPlaid = () => {
    // This would integrate with Plaid API
    // For now, we'll simulate the connection
    setPlaidConnected(true);
  };

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
        <div className="space-y-4">
          <h4 className="text-lg font-medium">How would you like to provide your debt information?</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Manual Input Option */}
            <Card 
              className={`cursor-pointer transition-all ${inputMethod === "manual" ? "ring-2 ring-primary" : ""}`}
              onClick={() => setInputMethod("manual")}
            >
              <CardHeader className="text-center">
                <CreditCard className="h-8 w-8 mx-auto mb-2 text-primary" />
                <CardTitle className="text-lg">Manual Input</CardTitle>
                <CardDescription>
                  Enter your debts manually for complete control
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Plaid Connection Option */}
            <Card 
              className={`cursor-pointer transition-all ${inputMethod === "plaid" ? "ring-2 ring-primary" : ""}`}
              onClick={() => setInputMethod("plaid")}
            >
              <CardHeader className="text-center">
                <Link className="h-8 w-8 mx-auto mb-2 text-primary" />
                <CardTitle className="text-lg">Connect with Plaid</CardTitle>
                <CardDescription>
                  Securely connect to Credit Karma and auto-import your debts
                </CardDescription>
              </CardHeader>
            </Card>
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

                    {/* Creditor Name */}
                    <div>
                      <label className="text-sm font-medium mb-2 block">Creditor/Lender Name</label>
                      <Input
                        value={debt.creditor}
                        onChange={(e) => updateDebt(index, "creditor", e.target.value)}
                        placeholder="e.g., Chase, Wells Fargo"
                      />
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

                    {/* Remaining Balance (Optional) */}
                    <div>
                      <label className="text-sm font-medium mb-2 block">Remaining Balance (Optional)</label>
                      <CurrencyInput
                        value={debt.remainingBalance}
                        onChange={(value) => updateDebt(index, "remainingBalance", value)}
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
                  <Button onClick={connectToPlaid} className="w-full">
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