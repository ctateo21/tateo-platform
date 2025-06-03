import { useState, useEffect } from "react";
import { z } from "zod";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, MapPin, Home } from "lucide-react";
import QuestionnaireForm from "./questionnaire-form";
import SimpleAddressInput from "./simple-address-input";
import CurrencyInput from "./currency-input";
import { getZestimate, getZipCodeAverage, formatPrice } from "@/lib/zillow";

const propertyLocationSchema = z.object({
  locationType: z.enum(["address", "zipcode"], {
    required_error: "Please select how you'd like to provide property information"
  }),
  propertyAddress: z.string().optional(),
  zipCode: z.string().optional(),
  estimatedValue: z.string().optional(),
  purchasePrice: z.string().optional(),
  propertyValue: z.string().optional()
}).refine((data) => {
  if (data.locationType === "address" && !data.propertyAddress) {
    return false;
  }
  if (data.locationType === "zipcode" && !data.zipCode) {
    return false;
  }
  return true;
}, {
  message: "Please provide the required information for your selected option",
  path: ["locationType"]
});

interface PropertyLocationStepProps {
  onSubmit: (data: z.infer<typeof propertyLocationSchema>) => void;
  onBack: () => void;
  defaultValues?: any;
  mortgageType: 'purchase' | 'refinance';
}

export default function PropertyLocationStep({ onSubmit, onBack, defaultValues, mortgageType }: PropertyLocationStepProps) {
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
  
  // Form default values
  const formDefaults = {
    locationType: defaultValues?.locationType || "address",
    propertyAddress: defaultValues?.propertyAddress || "",
    zipCode: defaultValues?.zipCode || "",
    estimatedValue: defaultValues?.estimatedValue || "",
    purchasePrice: defaultValues?.purchasePrice || "",
    propertyValue: defaultValues?.propertyValue || ""
  };

  // Handle address selection from Google Maps
  const handleAddressSelect = async (place: any, form: any) => {
    console.log('Address selected:', place);
    setSelectedPlace(place);
    
    if (place?.formatted_address) {
      // Force update the form field value
      form.setValue('propertyAddress', place.formatted_address, { 
        shouldValidate: true, 
        shouldDirty: true,
        shouldTouch: true 
      });
      
      // Trigger form validation and re-render
      form.trigger('propertyAddress');
      
      setAddressResult(prev => ({ ...prev, loading: true, error: undefined }));
      
      try {
        const result = await getZestimate(place.formatted_address);
        console.log('Zestimate result:', result);
        
        if (result) {
          setAddressResult({
            zestimate: result.zestimate,
            averagePrice: result.averagePrice,
            address: place,
            loading: false
          });
          
          // Auto-populate property value based on mortgage type
          if (mortgageType === 'purchase' && result.averagePrice) {
            form.setValue('purchasePrice', result.averagePrice.toString());
          } else if (mortgageType === 'refinance' && result.zestimate) {
            form.setValue('estimatedValue', result.zestimate.toString());
          }
        } else {
          setAddressResult(prev => ({ 
            ...prev, 
            loading: false, 
            error: 'Unable to get property estimate for this address'
          }));
        }
      } catch (error) {
        console.error('Error getting zestimate:', error);
        setAddressResult(prev => ({ 
          ...prev, 
          loading: false, 
          error: 'Error retrieving property information'
        }));
      }
    }
  };

  // Handle zip code lookup
  const handleZipCodeLookup = async (zipCode: string, form: any) => {
    if (zipCode.length === 5) {
      setZipResult(prev => ({ ...prev, loading: true, error: undefined }));
      
      try {
        const result = await getZipCodeAverage(zipCode);
        console.log('Zip code result:', result);
        
        if (result?.averagePrice) {
          setZipResult({
            averagePrice: result.averagePrice,
            loading: false
          });
          
          // Auto-populate based on mortgage type
          if (mortgageType === 'purchase') {
            form.setValue('purchasePrice', result.averagePrice.toString());
          } else {
            form.setValue('estimatedValue', result.averagePrice.toString());
          }
        } else {
          setZipResult(prev => ({
            ...prev,
            loading: false,
            error: 'Unable to get average price for this zip code'
          }));
        }
      } catch (error) {
        console.error('Error getting zip code average:', error);
        setZipResult(prev => ({
          ...prev,
          loading: false,
          error: 'Error retrieving zip code information'
        }));
      }
    }
  };

  return (
    <QuestionnaireForm
      title="Property Location"
      description="Tell us about the property location"
      schema={propertyLocationSchema}
      defaultValues={formDefaults}
      onSubmit={onSubmit}
      onBack={onBack}
      submitText="Continue"
    >
      {(form) => (
        <Card>
          <CardHeader className="text-center">
            <MapPin className="h-12 w-12 mx-auto text-blue-600" />
            <CardTitle>
              {mortgageType === 'purchase' ? 'Property You\'re Buying' : 'Your Current Property'}
            </CardTitle>
            <CardDescription>
              {mortgageType === 'purchase' 
                ? 'Provide details about the property you want to purchase'
                : 'Provide details about the property you want to refinance'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="locationType"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>How would you like to provide property information?</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={(value) => {
                        field.onChange(value);
                        // Clear previous results when switching
                        setAddressResult({ loading: false });
                        setZipResult({ loading: false });
                        form.setValue('propertyAddress', '');
                        form.setValue('zipCode', '');
                        form.setValue('estimatedValue', '');
                        form.setValue('purchasePrice', '');
                      }}
                      value={field.value}
                      className="grid grid-cols-1 gap-4"
                    >
                      <div className="flex items-center space-x-3 border rounded-lg p-4 hover:bg-gray-50">
                        <RadioGroupItem value="address" id="address" />
                        <FormLabel htmlFor="address" className="flex-1 cursor-pointer">
                          <div>
                            <div className="font-medium">Full Address</div>
                            <div className="text-sm text-gray-500">
                              Get accurate property estimates with the full address
                            </div>
                          </div>
                        </FormLabel>
                      </div>
                      <div className="flex items-center space-x-3 border rounded-lg p-4 hover:bg-gray-50">
                        <RadioGroupItem value="zipcode" id="zipcode" />
                        <FormLabel htmlFor="zipcode" className="flex-1 cursor-pointer">
                          <div>
                            <div className="font-medium">Zip Code Only</div>
                            <div className="text-sm text-gray-500">
                              Get area averages with just the zip code
                            </div>
                          </div>
                        </FormLabel>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Tabs value={form.watch("locationType")} className="w-full">
              <TabsContent value="address" className="space-y-4">
                <FormField
                  control={form.control}
                  name="propertyAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Property Address</FormLabel>
                      <FormControl>
                        <SimpleAddressInput
                          value={field.value}
                          onChange={field.onChange}
                          onPlaceSelected={(place) => handleAddressSelect(place, form)}
                          placeholder="Enter the full property address"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {addressResult.loading && (
                  <div className="flex items-center gap-2 text-blue-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Getting property information...</span>
                  </div>
                )}

                {addressResult.error && (
                  <div className="text-red-600 text-sm">
                    {addressResult.error}
                  </div>
                )}

                {(addressResult.zestimate || addressResult.averagePrice) && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Home className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-blue-900">Property Information</span>
                    </div>
                    <div className="space-y-1 text-sm">
                      {addressResult.zestimate && (
                        <div>Estimated Value: <span className="font-medium">{formatPrice(addressResult.zestimate)}</span></div>
                      )}
                      {addressResult.averagePrice && (
                        <div>Area Average: <span className="font-medium">{formatPrice(addressResult.averagePrice)}</span></div>
                      )}
                    </div>
                  </div>
                )}

                {mortgageType === 'purchase' ? (
                  <FormField
                    control={form.control}
                    name="purchasePrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purchase Price</FormLabel>
                        <FormControl>
                          <CurrencyInput
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Enter purchase price"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <FormField
                    control={form.control}
                    name="estimatedValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Property Value</FormLabel>
                        <FormControl>
                          <CurrencyInput
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Enter current property value"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </TabsContent>

              <TabsContent value="zipcode" className="space-y-4">
                <FormField
                  control={form.control}
                  name="zipCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zip Code</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Enter 5-digit zip code"
                          maxLength={5}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '');
                            field.onChange(value);
                            if (value.length === 5) {
                              handleZipCodeLookup(value, form);
                            }
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {zipResult.loading && (
                  <div className="flex items-center gap-2 text-blue-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Getting area information...</span>
                  </div>
                )}

                {zipResult.error && (
                  <div className="text-red-600 text-sm">
                    {zipResult.error}
                  </div>
                )}

                {zipResult.averagePrice && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Home className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-blue-900">Area Information</span>
                    </div>
                    <div className="text-sm">
                      Average Price: <span className="font-medium">{formatPrice(zipResult.averagePrice)}</span>
                    </div>
                  </div>
                )}

                {mortgageType === 'purchase' ? (
                  <FormField
                    control={form.control}
                    name="purchasePrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purchase Price</FormLabel>
                        <FormControl>
                          <CurrencyInput
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Enter purchase price"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <FormField
                    control={form.control}
                    name="estimatedValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Property Value</FormLabel>
                        <FormControl>
                          <CurrencyInput
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Enter current property value"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </QuestionnaireForm>
  );
}