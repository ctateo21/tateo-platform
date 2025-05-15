import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { mortgageFinancingSchema, type MortgageFinancingData } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface MortgageFinancingFormProps {
  initialData?: {
    type: "purchase" | "refinance";
    ownershipType: "primary" | "secondary" | "investment";
    propertyType?: string;
  };
  onSubmit: (data: MortgageFinancingData) => void;
  onBack: () => void;
}

export function MortgageFinancingForm({
  initialData,
  onSubmit,
  onBack
}: MortgageFinancingFormProps) {
  const [selectedLoanType, setSelectedLoanType] = useState<string>("");
  const isPrimary = initialData?.ownershipType === "primary";
  
  const form = useForm<MortgageFinancingData>({
    resolver: zodResolver(mortgageFinancingSchema),
    defaultValues: {
      creditScore: undefined,
      loanType: "",
      nonQMType: undefined
    }
  });
  
  const watchLoanType = form.watch("loanType");
  
  useEffect(() => {
    setSelectedLoanType(watchLoanType);
  }, [watchLoanType]);
  
  const getFormTitle = () => {
    const typeText = initialData?.type === "purchase" ? "Purchase" : "Refinance";
    let ownershipText = "Property";
    
    if (initialData?.ownershipType) {
      ownershipText = initialData.ownershipType.charAt(0).toUpperCase() + initialData.ownershipType.slice(1);
    }
    
    return `${ownershipText} ${typeText} Financing`;
  };
  
  const handleSubmit = (data: MortgageFinancingData) => {
    onSubmit(data);
  };
  
  // Primary property loan types
  const primaryLoanTypes = [
    { value: "Conventional", label: "Conventional" },
    { value: "FHA", label: "FHA" },
    { value: "VA", label: "VA" },
    { value: "USDA", label: "USDA" },
    { value: "Jumbo", label: "Jumbo" },
    { value: "HELOC", label: "HELOC" },
    { value: "Non-QM", label: "Non-QM" },
  ];
  
  // Non-primary property loan types (secondary, investment)
  const nonPrimaryLoanTypes = [
    { value: "Conventional", label: "Conventional" },
    { value: "DSCR", label: "DSCR" },
    { value: "Jumbo", label: "Jumbo" },
    { value: "HELOC", label: "HELOC" },
    { value: "Commercial", label: "Commercial" },
    { value: "SBA", label: "SBA" },
    { value: "Mixed-Use", label: "Mixed-Use" },
    { value: "Non-QM", label: "Non-QM" },
  ];
  
  // Non-QM loan subtypes
  const nonQMTypes = [
    { value: "ITIN", label: "ITIN" },
    { value: "Bank Statement (Personal)", label: "Bank Statement (Personal)" },
    { value: "Bank Statement (Business)", label: "Bank Statement (Business)" },
    { value: "Asset Depletion", label: "Asset Depletion" },
    { value: "1099", label: "1099" },
    { value: "VOE only", label: "VOE only" },
    { value: "Bridge", label: "Bridge" },
    { value: "Reverse Mortgage", label: "Reverse Mortgage" },
    { value: "CPA P&L", label: "CPA P&L" },
    { value: "Foreign National", label: "Foreign National" },
  ];
  
  // Credit score ranges
  const creditScoreRanges = [
    { value: "780+", label: "780+" },
    { value: "760-779", label: "760-779" },
    { value: "740-759", label: "740-759" },
    { value: "720-739", label: "720-739" },
    { value: "700-719", label: "700-719" },
    { value: "680-699", label: "680-699" },
    { value: "660-679", label: "660-679" },
    { value: "640-659", label: "640-659" },
    { value: "620-639", label: "620-639" },
    { value: "600-619", label: "600-619" },
    { value: "580-599", label: "580-599" },
    { value: "580 and below", label: "580 and below" },
  ];
  
  // Get loan type recommendation based on credit score
  const getLoanTypeRecommendation = (loanType: string) => {
    const creditScore = form.getValues("creditScore");
    if (!creditScore) return null;
    
    if (loanType === "Conventional") {
      const scoreNum = creditScore === "780+" ? 780 : 
                      parseInt(creditScore.split("-")[0]);
      
      if (scoreNum >= 720) {
        return "Recommended for credit scores 720 and above.";
      }
    }
    
    if (loanType === "FHA") {
      const scoreNum = creditScore === "780+" ? 780 : 
                      parseInt(creditScore.split("-")[0]);
      
      if (scoreNum <= 720) {
        return "Recommended for credit scores 720 and below.";
      }
    }
    
    if (loanType === "USDA") {
      return "Check your location to ensure your property or ZIP code is USDA eligible, if not, pick a new loan product - https://eligibility.sc.egov.usda.gov/eligibility/welcomeAction.do";
    }
    
    return null;
  };
  
  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">{getFormTitle()}</CardTitle>
        <CardDescription>
          Let's find the right financing option for your {initialData?.ownershipType} property.
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="creditScore"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    What is your credit score range?
                  </FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your credit score range" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {creditScoreRanges.map((range) => (
                        <SelectItem key={range.value} value={range.value}>
                          {range.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="loanType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    What type of loan are you interested in?
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" type="button" className="h-4 w-4 ml-1">
                            <HelpCircle className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">
                            Different loan types have specific requirements and benefits. We'll help you find the best match for your situation.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select loan type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(isPrimary ? primaryLoanTypes : nonPrimaryLoanTypes).map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedLoanType && getLoanTypeRecommendation(selectedLoanType) && (
                    <FormDescription className="italic mt-1">
                      {getLoanTypeRecommendation(selectedLoanType)}
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {selectedLoanType === "Non-QM" && (
              <FormField
                control={form.control}
                name="nonQMType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      What type of Non-QM loan are you interested in?
                    </FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Non-QM type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {nonQMTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </form>
        </Form>
      </CardContent>
      
      <CardFooter className="flex flex-col sm:flex-row gap-4 sm:justify-between">
        <Button 
          variant="outline" 
          type="button"
          onClick={onBack}
          className="w-full sm:w-auto"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        
        <Button 
          type="button"
          onClick={form.handleSubmit(handleSubmit)}
          className="w-full sm:w-auto"
        >
          Continue
        </Button>
      </CardFooter>
    </Card>
  );
}