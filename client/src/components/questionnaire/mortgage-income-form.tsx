import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { mortgageIncomeSchema, type MortgageIncomeData } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { ArrowLeft, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import CurrencyInput from "@/components/questionnaire/currency-input";
import NumberInput from "@/components/questionnaire/number-input";
import { IncomeTypeSelection } from "./income-type-selection";

interface MortgageIncomeFormProps {
  initialData?: {
    type: "purchase" | "refinance";
    ownershipType: "primary" | "secondary" | "investment";
    loanType?: string;
  };
  formData?: Partial<MortgageIncomeData>;
  onSubmit: (data: MortgageIncomeData) => void;
  onBack: () => void;
}

export function MortgageIncomeForm({
  initialData,
  formData,
  onSubmit,
  onBack
}: MortgageIncomeFormProps) {
  const [currentStep, setCurrentStep] = useState<'type-selection' | 'retired-details'>('type-selection');
  const [incomeSelectionData, setIncomeSelectionData] = useState<any>(null);
  const [selectedIncomeType, setSelectedIncomeType] = useState<string>("");
  const [selectedSalaryType, setSelectedSalaryType] = useState<string>("");
  const [selectedBusinessType, setSelectedBusinessType] = useState<string>("");
  const [selectedDisabilityType, setSelectedDisabilityType] = useState<string>("");
  const [retiredIncomeTypes, setRetiredIncomeTypes] = useState<string[]>([]);
  
  const form = useForm<MortgageIncomeData>({
    resolver: zodResolver(mortgageIncomeSchema),
    defaultValues: {
      incomeType: undefined,
      salaryType: undefined,
      baseSalary: undefined,
      commissionAverage: undefined,
      bonusAverage: undefined,
      vestedRsuBalance: undefined,
      hourlyRate: undefined,
      hoursPerWeek: undefined,
      businessType: undefined,
      grossAverage: undefined,
      netIncome: undefined,
      w2Income: undefined,
      k1Amount: undefined,
      cCorpNetProfit: undefined,
      businessOwnershipPercentage: undefined,
      socialSecurityIncome: undefined,
      disabilityIncome: undefined,
      disabilityType: undefined,
      pensionIncome: undefined,
      rmdIncome: undefined,
    }
  });
  
  const watchIncomeType = form.watch("incomeType");
  const watchSalaryType = form.watch("salaryType");
  const watchBusinessType = form.watch("businessType");
  const watchDisabilityType = form.watch("disabilityType");
  
  // Watch all monetary fields to trigger recalculation
  const watchBaseSalary = form.watch("baseSalary");
  const watchCommission = form.watch("commissionAverage");
  const watchBonus = form.watch("bonusAverage");
  const watchRSU = form.watch("vestedRsuBalance");
  const watchHourlyRate = form.watch("hourlyRate");
  const watchHoursPerWeek = form.watch("hoursPerWeek");
  const watchGrossAverage = form.watch("grossAverage");
  const watchNetIncome = form.watch("netIncome");
  const watchW2Income = form.watch("w2Income");
  const watchK1Amount = form.watch("k1Amount");
  const watchCCorpProfit = form.watch("cCorpNetProfit");
  const watchBusinessOwnership = form.watch("businessOwnershipPercentage");
  const watchSSIncome = form.watch("socialSecurityIncome");
  const watchDisabilityIncome = form.watch("disabilityIncome");
  const watchPensionIncome = form.watch("pensionIncome");
  const watchRMDIncome = form.watch("rmdIncome");
  
  useEffect(() => {
    setSelectedIncomeType(watchIncomeType);
  }, [watchIncomeType]);
  
  useEffect(() => {
    setSelectedSalaryType(watchSalaryType || "");
  }, [watchSalaryType]);
  
  useEffect(() => {
    setSelectedBusinessType(watchBusinessType || "");
  }, [watchBusinessType]);
  
  useEffect(() => {
    setSelectedDisabilityType(watchDisabilityType || "");
  }, [watchDisabilityType]);
  
  const handleIncomeTypeSelection = (data: any) => {
    setIncomeSelectionData(data);
    
    // If continuing to retired flow or API integrations handled everything, proceed
    if (data.continueToRetiredFlow || (data.apiIntegrations && !data.incomeTypes.includes('retired'))) {
      // For non-retired flows or when APIs handle everything, complete the step
      if (!data.incomeTypes.includes('retired')) {
        onSubmit({
          ...data,
          incomeType: 'api-verified'
        });
        return;
      }
      // For retired flow, continue to details
      setCurrentStep('retired-details');
    }
  };

  const handleSubmit = (data: MortgageIncomeData) => {
    // Combine with income selection data
    const finalData = {
      ...data,
      ...incomeSelectionData
    };
    onSubmit(finalData);
  };
  
  const getIncomeMultiplier = (incomeType: string) => {
    const loanType = initialData?.loanType?.toLowerCase();
    
    if (incomeType === "social-security" || incomeType === "disability") {
      if (loanType === "conventional" || loanType === "usda") {
        return "1.25x";
      } else if (loanType === "fha" || loanType === "va") {
        return "1.15x";
      } else {
        return "1.15x";
      }
    }
    return null;
  };
  
  // Calculate monthly income based on form data - automatically recalculates when any value changes
  const monthlyIncome = useMemo(() => {
    let income = 0;
    
    if (selectedIncomeType === "salary-w2") {
      // Base salary
      const baseSalary = parseFloat(watchBaseSalary?.replace(/[$,]/g, "") || "0");
      income += baseSalary / 12;
      
      // Additional income based on salary type
      if (selectedSalaryType === "salary-commission") {
        const commission = parseFloat(watchCommission?.replace(/[$,]/g, "") || "0");
        income += commission / 12;
      } else if (selectedSalaryType === "salary-bonus") {
        const bonus = parseFloat(watchBonus?.replace(/[$,]/g, "") || "0");
        income += bonus / 12;
      } else if (selectedSalaryType === "salary-rsu") {
        // RSUs are typically calculated differently for lending
        const rsu = parseFloat(watchRSU?.replace(/[$,]/g, "") || "0");
        income += (rsu * 0.25) / 12; // 25% of vested balance annually
      }
    } else if (selectedIncomeType === "hourly") {
      const hourlyRate = parseFloat(watchHourlyRate?.replace(/[$,]/g, "") || "0");
      const hoursPerWeek = parseFloat(watchHoursPerWeek || "0");
      income = (hourlyRate * hoursPerWeek * 52) / 12; // Annual to monthly
    } else if (selectedIncomeType === "self-employed") {
      const ownershipPercentage = parseFloat(watchBusinessOwnership || "100") / 100; // Convert to decimal
      
      if (selectedBusinessType === "1099-personal" || selectedBusinessType === "1099-business") {
        const netIncome = parseFloat(watchNetIncome?.replace(/[$,]/g, "") || "0");
        income = (netIncome * ownershipPercentage) / 12;
      } else if (selectedBusinessType === "s-corp") {
        const w2Income = parseFloat(watchW2Income?.replace(/[$,]/g, "") || "0");
        const k1Amount = parseFloat(watchK1Amount?.replace(/[$,]/g, "") || "0");
        // W2 income is not affected by ownership percentage, but K1 is
        income = (w2Income + (k1Amount * ownershipPercentage)) / 12;
      } else if (selectedBusinessType === "c-corp") {
        const w2Income = parseFloat(watchW2Income?.replace(/[$,]/g, "") || "0");
        const cCorpProfit = parseFloat(watchCCorpProfit?.replace(/[$,]/g, "") || "0");
        // W2 income is not affected by ownership percentage, but C Corp profit is
        income = (w2Income + (cCorpProfit * ownershipPercentage)) / 12;
      }
    } else if (selectedIncomeType === "retired") {
      // Social Security with multiplier
      if (retiredIncomeTypes.includes("social-security")) {
        const ssIncome = parseFloat(watchSSIncome?.replace(/[$,]/g, "") || "0");
        const multiplier = getIncomeMultiplier("social-security");
        const factor = multiplier === "1.25x" ? 1.25 : 1.15;
        income += ssIncome * factor;
      }
      
      // Disability with multiplier
      if (retiredIncomeTypes.includes("disability")) {
        const disabilityIncome = parseFloat(watchDisabilityIncome?.replace(/[$,]/g, "") || "0");
        const multiplier = getIncomeMultiplier("disability");
        const factor = multiplier === "1.25x" ? 1.25 : 1.15;
        income += disabilityIncome * factor;
      }
      
      // Pension income
      if (retiredIncomeTypes.includes("pension")) {
        const pensionIncome = parseFloat(watchPensionIncome?.replace(/[$,]/g, "") || "0");
        income += pensionIncome;
      }
      
      // RMD income
      if (retiredIncomeTypes.includes("rmd")) {
        const rmdIncome = parseFloat(watchRMDIncome?.replace(/[$,]/g, "") || "0");
        income += rmdIncome;
      }
    }
    
    return Math.round(income);
  }, [
    selectedIncomeType, selectedSalaryType, selectedBusinessType, retiredIncomeTypes,
    watchBaseSalary, watchCommission, watchBonus, watchRSU,
    watchHourlyRate, watchHoursPerWeek,
    watchGrossAverage, watchNetIncome, watchW2Income, watchK1Amount, watchCCorpProfit, watchBusinessOwnership,
    watchSSIncome, watchDisabilityIncome, watchPensionIncome, watchRMDIncome,
    initialData?.loanType
  ]);
  
  const getFormTitle = () => {
    const typeText = initialData?.type === "purchase" ? "Purchase" : "Refinance";
    let ownershipText = "Property";
    
    if (initialData?.ownershipType) {
      ownershipText = initialData.ownershipType.charAt(0).toUpperCase() + initialData.ownershipType.slice(1);
    }
    
    return `${ownershipText} ${typeText} - Income Information`;
  };
  
  const toggleRetiredIncomeType = (incomeType: string) => {
    setRetiredIncomeTypes(prev => {
      if (prev.includes(incomeType)) {
        return prev.filter(type => type !== incomeType);
      } else {
        return [...prev, incomeType];
      }
    });
  };
  
  // Show income type selection first
  if (currentStep === 'type-selection') {
    return (
      <IncomeTypeSelection
        onComplete={handleIncomeTypeSelection}
        onBack={onBack}
        defaultValues={formData}
      />
    );
  }

  // Show retired details form
  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">{getFormTitle()}</CardTitle>
        <CardDescription>
          Please provide details about your retirement income sources.
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="incomeType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What type of income do you receive?</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your income type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="salary-w2">Salary or W2</SelectItem>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="self-employed">Self Employed</SelectItem>
                      <SelectItem value="retired">Retired</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Salary/W2 Income Section */}
            {selectedIncomeType === "salary-w2" && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="salaryType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>What type of salary income?</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select salary type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="salary-only">Salary only</SelectItem>
                          <SelectItem value="salary-commission">Salary plus commission</SelectItem>
                          <SelectItem value="salary-bonus">Salary plus bonus</SelectItem>
                          <SelectItem value="salary-rsu">Salary plus Restricted Stock Units</SelectItem>
                        </SelectContent>
                      </Select>
                      {selectedSalaryType === "salary-rsu" && (
                        <Alert className="mt-2">
                          <Info className="h-4 w-4" />
                          <AlertDescription>
                            RSUs can only be used if the company is public. If it is private, please choose another income type.
                          </AlertDescription>
                        </Alert>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Base Salary Field - Always show for salary/W2 income */}
                <FormField
                  control={form.control}
                  name="baseSalary"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>What is your base salary amount?</FormLabel>
                      <FormControl>
                        <CurrencyInput 
                          value={field.value || ""}
                          onChange={field.onChange}
                          placeholder=""
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {selectedSalaryType === "salary-commission" && (
                  <FormField
                    control={form.control}
                    name="commissionAverage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>What is your 2-year average on your commission?</FormLabel>
                        <FormControl>
                          <CurrencyInput 
                            value={field.value || ""}
                            onChange={field.onChange}
                            placeholder=""
                          />
                        </FormControl>
                        <FormDescription>
                          If the last year is lower than 2 years ago, use only the monthly average for last year.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                {selectedSalaryType === "salary-bonus" && (
                  <FormField
                    control={form.control}
                    name="bonusAverage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>What is your 2-year average on your bonus?</FormLabel>
                        <FormControl>
                          <CurrencyInput 
                            value={field.value || ""}
                            onChange={field.onChange}
                            placeholder=""
                          />
                        </FormControl>
                        <FormDescription>
                          If the last year is lower than 2 years ago, use only the monthly average for last year.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                {selectedSalaryType === "salary-rsu" && (
                  <>
                    <FormField
                      control={form.control}
                      name="vestedRsuBalance"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>What is your total VESTED RSU balance?</FormLabel>
                          <FormControl>
                            <CurrencyInput 
                              value={field.value || ""}
                              onChange={field.onChange}
                              placeholder="$100,000"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="companyTickerSymbol"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>What is the company ticker symbol?</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="Enter company ticker symbol (e.g., AAPL, MSFT)"
                              type="text"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
              </div>
            )}
            
            {/* Hourly Income Section */}
            {selectedIncomeType === "hourly" && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="hourlyRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>What is your hourly rate?</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="Enter hourly rate"
                          type="text"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="hoursPerWeek"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>How many hours per week?</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="Enter hours per week"
                          type="text"
                        />
                      </FormControl>
                      <FormDescription>
                        Note: Less than 35 hours is part time. Over 35 is full time.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
            
            {/* Self-Employed Income Section */}
            {selectedIncomeType === "self-employed" && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="businessType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>What type of business structure?</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select business type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1099-personal">1099 or Schedule C in Personal name</SelectItem>
                          <SelectItem value="1099-business">1099 or Schedule C in Business name</SelectItem>
                          <SelectItem value="s-corp">S Corp</SelectItem>
                          <SelectItem value="c-corp">C Corp</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {(selectedBusinessType === "1099-personal" || selectedBusinessType === "1099-business") && (
                  <>
                    <FormField
                      control={form.control}
                      name="grossAverage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>What is your 2-year gross average?</FormLabel>
                          <FormControl>
                            <CurrencyInput 
                              value={field.value || ""}
                              onChange={field.onChange}
                              placeholder=""
                            />
                          </FormControl>
                          <FormDescription>
                            If the last year is lower than 2 years ago, use only the monthly average for last year.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="netIncome"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>What is the NET on your schedule C tax return (Schedule C line 31)?</FormLabel>
                          <FormControl>
                            <CurrencyInput 
                              value={field.value || ""}
                              onChange={field.onChange}
                              placeholder=""
                              showCents={false}
                            />
                          </FormControl>
                          <FormDescription>
                            If the last year is lower than 2 years ago, use only the monthly average for last year. We are using 100% ownership in the business.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
                
                {selectedBusinessType === "s-corp" && (
                  <>
                    <FormField
                      control={form.control}
                      name="w2Income"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>What is your W2 income from S Corp (line 7 from 1120-S tax form)?</FormLabel>
                          <FormControl>
                            <CurrencyInput 
                              value={field.value || ""}
                              onChange={field.onChange}
                              placeholder=""
                              showCents={false}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="k1Amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>What is your K1 amount?</FormLabel>
                          <FormControl>
                            <CurrencyInput 
                              value={field.value || ""}
                              onChange={field.onChange}
                              placeholder=""
                              showCents={false}
                            />
                          </FormControl>
                          <FormDescription>
                            We are using 100% ownership in the business.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
                
                {selectedBusinessType === "c-corp" && (
                  <>
                    <FormField
                      control={form.control}
                      name="w2Income"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>What is your W2 income from C Corp?</FormLabel>
                          <FormControl>
                            <CurrencyInput 
                              value={field.value || ""}
                              onChange={field.onChange}
                              placeholder=""
                              showCents={false}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="cCorpNetProfit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>What is the C Corp net profit (line 30 from 1120 tax form)?</FormLabel>
                          <FormControl>
                            <CurrencyInput 
                              value={field.value || ""}
                              onChange={field.onChange}
                              placeholder=""
                              showCents={false}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
                
                {/* Business Ownership Percentage - applies to all self-employed types */}
                {selectedBusinessType && (
                  <FormField
                    control={form.control}
                    name="businessOwnershipPercentage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>What percentage of the business do you own?</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="100"
                            type="number"
                            min="1"
                            max="100"
                          />
                        </FormControl>
                        <FormDescription>
                          Enter the percentage (1-100) of business ownership.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            )}
            
            {/* Retired Income Section */}
            {selectedIncomeType === "retired" && (
              <div className="space-y-4">
                <div className="space-y-3">
                  <FormLabel>Select all that apply (you can choose more than one):</FormLabel>
                  
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="social-security"
                        checked={retiredIncomeTypes.includes("social-security")}
                        onCheckedChange={() => toggleRetiredIncomeType("social-security")}
                      />
                      <label htmlFor="social-security" className="text-sm font-medium">
                        Social Security Income
                      </label>
                    </div>
                    
                    {retiredIncomeTypes.includes("social-security") && (
                      <FormField
                        control={form.control}
                        name="socialSecurityIncome"
                        render={({ field }) => (
                          <FormItem className="ml-6">
                            <FormLabel>Social Security Income Amount</FormLabel>
                            <FormControl>
                              <CurrencyInput 
                                value={field.value || ""}
                                onChange={field.onChange}
                                placeholder=""
                                showCents={false}
                              />
                            </FormControl>
                            <FormDescription>
                              {getIncomeMultiplier("social-security") && (
                                <>Income will be increased by {getIncomeMultiplier("social-security")} for loan qualification.</>
                              )}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="disability"
                        checked={retiredIncomeTypes.includes("disability")}
                        onCheckedChange={() => toggleRetiredIncomeType("disability")}
                      />
                      <label htmlFor="disability" className="text-sm font-medium">
                        Disability Income
                      </label>
                    </div>
                    
                    {retiredIncomeTypes.includes("disability") && (
                      <>
                        <FormField
                          control={form.control}
                          name="disabilityType"
                          render={({ field }) => (
                            <FormItem className="ml-6">
                              <FormLabel>What type of disability income?</FormLabel>
                              <Select 
                                onValueChange={field.onChange} 
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select disability type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="social-security">Social Security Disability</SelectItem>
                                  <SelectItem value="va">VA Disability</SelectItem>
                                  <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="disabilityIncome"
                          render={({ field }) => (
                            <FormItem className="ml-6">
                              <FormLabel>Disability Income Amount</FormLabel>
                              <FormControl>
                                <CurrencyInput 
                                  value={field.value || ""}
                                  onChange={field.onChange}
                                  placeholder=""
                                  showCents={false}
                                />
                              </FormControl>
                              <FormDescription>
                                {getIncomeMultiplier("disability") && (
                                  <>Income will be increased by {getIncomeMultiplier("disability")} for loan qualification.</>
                                )}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="pension"
                        checked={retiredIncomeTypes.includes("pension")}
                        onCheckedChange={() => toggleRetiredIncomeType("pension")}
                      />
                      <label htmlFor="pension" className="text-sm font-medium">
                        Pension Income
                      </label>
                    </div>
                    
                    {retiredIncomeTypes.includes("pension") && (
                      <FormField
                        control={form.control}
                        name="pensionIncome"
                        render={({ field }) => (
                          <FormItem className="ml-6">
                            <FormLabel>Pension Income Amount</FormLabel>
                            <FormControl>
                              <CurrencyInput 
                                value={field.value || ""}
                                onChange={field.onChange}
                                placeholder=""
                                showCents={false}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="rmd"
                        checked={retiredIncomeTypes.includes("rmd")}
                        onCheckedChange={() => toggleRetiredIncomeType("rmd")}
                      />
                      <label htmlFor="rmd" className="text-sm font-medium">
                        Required Minimum Distribution from Retirement Accounts
                      </label>
                    </div>
                    
                    {retiredIncomeTypes.includes("rmd") && (
                      <FormField
                        control={form.control}
                        name="rmdIncome"
                        render={({ field }) => (
                          <FormItem className="ml-6">
                            <FormLabel>RMD Income Amount</FormLabel>
                            <FormControl>
                              <CurrencyInput 
                                value={field.value || ""}
                                onChange={field.onChange}
                                placeholder=""
                                showCents={false}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
          </form>
        </Form>
        
        {/* Monthly Income Calculation Display */}
        {monthlyIncome > 0 && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-green-800 mb-2">
                Calculated Monthly Income
              </h3>
              <div className="text-3xl font-bold text-green-700">
                ${monthlyIncome.toLocaleString()}
              </div>
              <p className="text-sm text-green-600 mt-1">
                This is your qualifying monthly income for loan purposes
              </p>
            </div>
          </div>
        )}
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