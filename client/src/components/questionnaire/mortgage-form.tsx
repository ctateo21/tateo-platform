import { useState, useEffect } from "react";
import { z } from "zod";
import { mortgageFormSchema } from "@shared/schema";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Building, MapPin, Home, DollarSign } from "lucide-react";
import QuestionnaireForm from "./questionnaire-form";
import AddressInput from "./address-input";
import CurrencyInput from "./currency-input";
import { getZestimate, getZipCodeAverage, formatPrice } from "@/lib/zillow";
import { ReviewsSection } from "./reviews-section";

interface MortgageFormProps {
  onSubmit: (data: z.infer<typeof mortgageFormSchema>) => void;
  onBack: () => void;
  defaultValues?: any;
}

export default function MortgageForm({ onSubmit, onBack, defaultValues: savedValues }: MortgageFormProps) {
  // State for address/zip results
  const [addressResult, setAddressResult] = useState<{
    zestimate?: number;
    averagePrice?: number;
    address?: any;
    loading: boolean;
    error?: string;
  }>({
    loading: false
  });
  
  // State for zip code results
  const [zipResult, setZipResult] = useState<{
    averagePrice?: number;
    loading: boolean;
    error?: string;
  }>({
    loading: false
  });
  
  // Selected place from Google Maps Places API
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  
  // Form default values - merge saved values with defaults
  const baseDefaults = {
    locationType: "address" as const,
    propertyAddress: "",
    zipCode: "",
    estimatedValue: "",
    purchasePrice: "",
    type: "purchase" as const,
    ownershipType: "primary" as const,
    propertyValue: "",
  };
  
  // Only use saved values that match our form fields
  const filteredSavedValues = savedValues ? {
    locationType: savedValues.locationType || baseDefaults.locationType,
    propertyAddress: savedValues.propertyAddress || baseDefaults.propertyAddress,
    zipCode: savedValues.zipCode || baseDefaults.zipCode,
    estimatedValue: savedValues.estimatedValue || baseDefaults.estimatedValue,
    purchasePrice: savedValues.purchasePrice || baseDefaults.purchasePrice,
    type: savedValues.type || baseDefaults.type,
    ownershipType: savedValues.ownershipType || baseDefaults.ownershipType,
    propertyValue: savedValues.propertyValue || baseDefaults.propertyValue,
  } : baseDefaults;
  
  const defaultValues = filteredSavedValues;
  
  // Handle place selection from address input
  const handlePlaceSelected = async (place: any) => {
    setSelectedPlace(place);
    
    if (place?.formatted_address) {
      setAddressResult({ loading: true });
      
      try {
        const estimate = await getZestimate(place.formatted_address);
        setAddressResult({
          ...estimate,
          address: place,
          loading: false
        });
      } catch (error) {
        setAddressResult({
          loading: false,
          error: "Could not fetch property estimate"
        });
      }
    }
  };
  
  // Handle ZIP code lookup
  const fetchZipCodeAverage = async (zipCode: string) => {
    if (zipCode.length >= 5) {
      setZipResult({ loading: true });
      
      try {
        const result = await getZipCodeAverage(zipCode);
        setZipResult({
          ...result,
          loading: false
        });
      } catch (error) {
        setZipResult({
          loading: false,
          error: "Could not fetch ZIP code average"
        });
      }
    }
  };

  return (
    <QuestionnaireForm
      schema={mortgageFormSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      onBack={onBack}
    >
      <h3 className="text-2xl font-semibold mb-2 text-primary">Mortgage Information</h3>
      <p className="text-muted-foreground mb-6">Tell us about your mortgage needs</p>
      
      <div className="space-y-6">
        {/* Mortgage Type - First Question */}
        <FormField
          name="type"
          render={({ field }) => (
            <FormItem className="space-y-3 mb-8">
              <FormLabel>I am interested in:</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  value={field.value}
                  className="flex flex-col space-y-2"
                >
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="purchase" />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer">Purchasing a new property</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="refinance" />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer">Refinancing my current mortgage</FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      
        {/* Location Type Selector */}
        <FormField
          name="locationType"
          render={({ field }) => (
            <FormItem className="space-y-4">
              <FormLabel>How would you like to enter the property location?</FormLabel>
              <FormControl>
                <Tabs
                  defaultValue={field.value}
                  onValueChange={field.onChange}
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="address" className="flex items-center gap-2">
                      <Building className="h-4 w-4" />
                      <span>Full Address</span>
                    </TabsTrigger>
                    <TabsTrigger value="zipcode" className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>ZIP Code</span>
                    </TabsTrigger>
                  </TabsList>
                  
                  {/* Address Input */}
                  <TabsContent value="address" className="mt-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Property Address</CardTitle>
                        <CardDescription>
                          Enter the full property address to get an estimated value
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <FormField
                            name="propertyAddress"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <AddressInput 
                                    value={field.value}
                                    onChange={(value) => {
                                      field.onChange(value);
                                      // Reset estimates when address changes
                                      if (!selectedPlace || value !== selectedPlace.formatted_address) {
                                        setAddressResult({ loading: false });
                                      }
                                    }}
                                    onPlaceSelected={(place) => {
                                      handlePlaceSelected(place);
                                      // Update the form field immediately
                                      if (place?.formatted_address) {
                                        field.onChange(place.formatted_address);
                                      }
                                    }}
                                    placeholder="Enter the property address"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          {addressResult.loading && (
                            <div className="flex items-center justify-center py-4">
                              <Loader2 className="h-6 w-6 animate-spin text-primary" />
                              <span className="ml-2">Fetching estimate...</span>
                            </div>
                          )}
                          
                          {!addressResult.loading && (
                            <div className="rounded-lg bg-muted/50 p-4">
                              {/* Show estimate if available */}
                              {(addressResult.zestimate || addressResult.averagePrice) && (
                                <>
                                  <h4 className="font-medium mb-2">Estimated Property Value</h4>
                                  <div className="text-xl font-bold text-primary">
                                    {formatPrice(addressResult.zestimate || addressResult.averagePrice)}
                                  </div>
                                </>
                              )}
                              
                              {/* Always show purchase price field */}
                              <div className={`${(addressResult.zestimate || addressResult.averagePrice) ? "mt-4" : "mt-1"}`}>
                                <FormField
                                  name="purchasePrice"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>
                                        {(addressResult.zestimate || addressResult.averagePrice) 
                                          ? "Purchase Price (you can adjust if needed)" 
                                          : "Enter Purchase Price"}
                                      </FormLabel>
                                      <FormControl>
                                        <CurrencyInput
                                          value={field.value || String(addressResult.zestimate || addressResult.averagePrice || '')}
                                          onChange={(value) => {
                                            field.onChange(value);
                                            // Also update estimatedValue for consistency
                                            if (addressResult.zestimate && !field.value) {
                                              // Auto-populate if no manual entry yet
                                              field.onChange(String(addressResult.zestimate));
                                            }
                                          }}
                                          placeholder="$"
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            </div>
                          )}
                          
                          {addressResult.error && !addressResult.loading && (
                            <div className="text-destructive text-sm">
                              {addressResult.error}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                  
                  {/* ZIP Code Input */}
                  <TabsContent value="zipcode" className="mt-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">ZIP Code</CardTitle>
                        <CardDescription>
                          Enter the ZIP code where you're looking to buy
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <FormField
                            name="zipCode"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input 
                                    placeholder="Enter ZIP code (e.g., 33602)" 
                                    {...field} 
                                    onChange={(e) => {
                                      field.onChange(e);
                                      // Only lookup if we have a 5+ digit zip code
                                      if (e.target.value.length >= 5) {
                                        fetchZipCodeAverage(e.target.value);
                                      } else {
                                        setZipResult({ loading: false });
                                      }
                                    }}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          {zipResult.loading && (
                            <div className="flex items-center justify-center py-4">
                              <Loader2 className="h-6 w-6 animate-spin text-primary" />
                              <span className="ml-2">Looking up area averages...</span>
                            </div>
                          )}
                          
                          {!zipResult.loading && (
                            <div className="rounded-lg bg-muted/50 p-4">
                              {/* Show estimate if available */}
                              {zipResult.averagePrice && (
                                <>
                                  <h4 className="font-medium mb-2">Average Home Price in This Area</h4>
                                  <div className="text-xl font-bold text-primary">
                                    {formatPrice(zipResult.averagePrice)}
                                  </div>
                                </>
                              )}
                              
                              {/* Always show purchase price field */}
                              <div className={`${zipResult.averagePrice ? "mt-4" : "mt-1"}`}>
                                <FormField
                                  name="purchasePrice"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>
                                        {zipResult.averagePrice 
                                          ? "Your Expected Purchase Price"
                                          : "Enter Purchase Price"}
                                      </FormLabel>
                                      <FormControl>
                                        <CurrencyInput
                                          value={field.value || String(zipResult.averagePrice || '')}
                                          onChange={field.onChange}
                                          placeholder="$"
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            </div>
                          )}
                          
                          {zipResult.error && !zipResult.loading && (
                            <div className="text-destructive text-sm">
                              {zipResult.error}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        
        {/* Ownership Type */}
        <FormField
          name="ownershipType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What type of ownership?</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select ownership type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="primary">Primary Residence</SelectItem>
                  <SelectItem value="secondary">Secondary/Vacation Home</SelectItem>
                  <SelectItem value="investment">Investment Property</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </QuestionnaireForm>
  );
}
