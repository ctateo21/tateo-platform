import { useState, useEffect } from "react";
import { z } from "zod";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Building, Loader2, DollarSign } from "lucide-react";
import QuestionnaireForm from "./questionnaire-form";
import AddressInput from "./address-input";
import CurrencyInput from "./currency-input";
import { getZestimate, getZipCodeAverage, formatPrice } from "@/lib/zillow";

const propertyLocationSchema = z.object({
  locationType: z.enum(["address", "zipcode"]),
  propertyAddress: z.string().optional(),
  zipCode: z.string().optional(),
  estimatedValue: z.string().optional(),
  purchasePrice: z.string().optional(),
}).refine((data) => {
  if (data.locationType === "address") {
    return data.propertyAddress && data.propertyAddress.length > 0;
  }
  if (data.locationType === "zipcode") {
    return data.zipCode && data.zipCode.length > 0;
  }
  return false;
}, {
  message: "Please provide either an address or ZIP code",
  path: ["propertyAddress"]
});

interface PropertyLocationFormProps {
  onSubmit: (data: z.infer<typeof propertyLocationSchema>) => void;
  onBack: () => void;
  defaultValues?: any;
  mortgageType: string;
}

export default function PropertyLocationForm({ onSubmit, onBack, defaultValues, mortgageType }: PropertyLocationFormProps) {
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

  const defaults = {
    locationType: "address" as const,
    propertyAddress: "",
    zipCode: "",
    estimatedValue: "",
    purchasePrice: "",
    ...defaultValues,
  };

  // Handle address selection from Google Places
  const handleAddressSelected = async (place: any, form: any) => {
    if (!place?.formatted_address) return;

    setSelectedPlace(place);
    setAddressResult({ loading: true });

    try {
      const zestimate = await getZestimate(place.formatted_address);
      
      if (zestimate) {
        const formattedPrice = formatPrice(zestimate);
        
        setAddressResult({
          zestimate,
          address: place,
          loading: false
        });

        // Auto-populate the appropriate field based on mortgage type
        if (mortgageType === "purchase") {
          form.setValue("purchasePrice", formattedPrice);
        } else {
          form.setValue("estimatedValue", formattedPrice);
        }
      } else {
        setAddressResult({
          loading: false,
          error: "Could not retrieve property value estimate"
        });
      }
    } catch (error) {
      console.error("Error fetching address data:", error);
      setAddressResult({
        loading: false,
        error: "Error retrieving property data"
      });
    }
  };

  // Handle ZIP code lookup
  const handleZipCodeLookup = async (zipCode: string, form: any) => {
    if (!zipCode || zipCode.length < 5) return;

    setZipResult({ loading: true });

    try {
      const averagePrice = await getZipCodeAverage(zipCode);
      
      if (averagePrice) {
        const formattedPrice = formatPrice(averagePrice);
        
        setZipResult({
          averagePrice,
          loading: false
        });

        // Auto-populate the appropriate field based on mortgage type
        if (mortgageType === "purchase") {
          form.setValue("purchasePrice", formattedPrice);
        } else {
          form.setValue("estimatedValue", formattedPrice);
        }
      } else {
        setZipResult({
          loading: false,
          error: "Could not retrieve average price for this ZIP code"
        });
      }
    } catch (error) {
      console.error("Error fetching ZIP code data:", error);
      setZipResult({
        loading: false,
        error: "Error retrieving ZIP code data"
      });
    }
  };

  return (
    <QuestionnaireForm
      schema={propertyLocationSchema}
      onSubmit={onSubmit}
      onBack={onBack}
      defaultValues={defaults}
      title="Property Location"
      description="How would you like to enter the property information?"
    >
      {(form) => (
        <div className="space-y-6">
          {/* Location Type Selection */}
          <FormField
            control={form.control}
            name="locationType"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    value={field.value}
                    className="grid grid-cols-1 gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <Card className={`cursor-pointer border-2 transition-colors flex-1 ${
                        field.value === "address" ? "border-primary bg-primary/5" : "border-muted hover:border-primary/50"
                      }`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center space-x-3">
                            <RadioGroupItem value="address" id="address" />
                            <MapPin className="h-5 w-5 text-primary" />
                            <div>
                              <CardTitle className="text-base">Enter Address</CardTitle>
                              <CardDescription>
                                Get accurate property value estimates
                              </CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Card className={`cursor-pointer border-2 transition-colors flex-1 ${
                        field.value === "zipcode" ? "border-primary bg-primary/5" : "border-muted hover:border-primary/50"
                      }`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center space-x-3">
                            <RadioGroupItem value="zipcode" id="zipcode" />
                            <Building className="h-5 w-5 text-primary" />
                            <div>
                              <CardTitle className="text-base">Enter ZIP Code</CardTitle>
                              <CardDescription>
                                Get area average property values
                              </CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    </div>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Address Input */}
          {form.watch("locationType") === "address" && (
            <FormField
              control={form.control}
              name="propertyAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Property Address</FormLabel>
                  <FormControl>
                    <AddressInput
                      value={field.value || ""}
                      onChange={field.onChange}
                      onPlaceSelected={(place) => handleAddressSelected(place, form)}
                      placeholder="Enter the property address"
                    />
                  </FormControl>
                  <FormMessage />
                  
                  {addressResult.loading && (
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Getting property value estimate...</span>
                    </div>
                  )}
                  
                  {addressResult.zestimate && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                      <div className="flex items-center space-x-2">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800">
                          Estimated Property Value: {formatPrice(addressResult.zestimate)}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {addressResult.error && (
                    <div className="text-sm text-destructive">{addressResult.error}</div>
                  )}
                </FormItem>
              )}
            />
          )}

          {/* ZIP Code Input */}
          {form.watch("locationType") === "zipcode" && (
            <FormField
              control={form.control}
              name="zipCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ZIP Code</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Enter ZIP code (e.g., 33609)"
                      onChange={(e) => {
                        field.onChange(e);
                        const zipCode = e.target.value;
                        if (zipCode.length === 5) {
                          handleZipCodeLookup(zipCode, form);
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                  
                  {zipResult.loading && (
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Getting area average price...</span>
                    </div>
                  )}
                  
                  {zipResult.averagePrice && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <div className="flex items-center space-x-2">
                        <Building className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-800">
                          Area Average Price: {formatPrice(zipResult.averagePrice)}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {zipResult.error && (
                    <div className="text-sm text-destructive">{zipResult.error}</div>
                  )}
                </FormItem>
              )}
            />
          )}

          {/* Purchase Price or Estimated Value */}
          {mortgageType === "purchase" && (
            <FormField
              control={form.control}
              name="purchasePrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purchase Price</FormLabel>
                  <FormControl>
                    <CurrencyInput
                      value={field.value || ""}
                      onChange={field.onChange}
                      placeholder="Enter purchase price"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {mortgageType === "refinance" && (
            <FormField
              control={form.control}
              name="estimatedValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estimated Property Value</FormLabel>
                  <FormControl>
                    <CurrencyInput
                      value={field.value || ""}
                      onChange={field.onChange}
                      placeholder="Enter estimated value"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>
      )}
    </QuestionnaireForm>
  );
}