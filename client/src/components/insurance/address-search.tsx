import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Home, Loader2, SearchIcon, CheckIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useGooglePlaces } from "@/hooks/use-google-places";

interface InsuranceType {
  id: string;
  label: string;
  showPropertyType?: boolean;
  showOtherOptions?: boolean;
}

interface OtherInsuranceOption {
  id: string;
  label: string;
}

interface AddressSearchProps {
  onAddressSelected: (address: string, insuranceTypes: string[], propertyType: string, otherOptions: string[], placeId?: string) => void;
}

export default function AddressSearch({ onAddressSelected }: AddressSearchProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [selectedAddress, setSelectedAddress] = useState<{address: string, placeId?: string} | null>(null);
  const [propertyType, setPropertyType] = useState<string>('');
  const [selectedInsuranceTypes, setSelectedInsuranceTypes] = useState<string[]>([]);
  const [selectedOtherOptions, setSelectedOtherOptions] = useState<string[]>([]);
  const { bindInputRef } = useGooglePlaces({
    onPlaceSelected: place => {
      setAddress(place.formatted_address);
      setSelectedAddress({
        address: place.formatted_address,
        placeId: place.place_id,
      });
    },
  });
  
  // Insurance types
  const insuranceTypes: InsuranceType[] = [
    { id: 'auto', label: 'Auto' },
    { id: 'property', label: 'Property', showPropertyType: true },
    { id: 'flood', label: 'Flood', showPropertyType: true },
    { id: 'other', label: 'Other', showOtherOptions: true }
  ];

  // Other insurance options
  const otherOptions: OtherInsuranceOption[] = [
    { id: 'commercial', label: 'Commercial Property' },
    { id: 'umbrella', label: 'Umbrella' },
    { id: 'liability', label: 'General Liability' },
    { id: 'workers-comp', label: 'Worker\'s Comp' },
    { id: 'boat', label: 'Boat' }
  ];

  // Determine if property type selection should be shown
  const showPropertyTypeSelection = selectedInsuranceTypes.some(type => 
    insuranceTypes.find(it => it.id === type)?.showPropertyType
  );

  // Determine if other options should be shown
  const showOtherOptions = selectedInsuranceTypes.includes('other');

  // Handle insurance type selection
  const handleInsuranceTypeChange = (type: string, checked: boolean) => {
    if (checked) {
      setSelectedInsuranceTypes(prev => [...prev, type]);
    } else {
      setSelectedInsuranceTypes(prev => prev.filter(t => t !== type));
    }
  };

  // Handle other options selection
  const handleOtherOptionChange = (option: string, checked: boolean) => {
    if (checked) {
      setSelectedOtherOptions(prev => [...prev, option]);
    } else {
      setSelectedOtherOptions(prev => prev.filter(o => o !== option));
    }
  };

  // Check if form can be submitted
  const canSubmit = selectedInsuranceTypes.length > 0 && 
    (!showPropertyTypeSelection || propertyType !== '') &&
    (!showOtherOptions || selectedOtherOptions.length > 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedAddress && selectedInsuranceTypes.length > 0) {
      // Property type is required only if property/flood is selected
      if (showPropertyTypeSelection && !propertyType) {
        return;
      }
      
      // At least one other option is required if 'other' is selected
      if (showOtherOptions && selectedOtherOptions.length === 0) {
        return;
      }
      
      setLoading(true);
      onAddressSelected(
        selectedAddress.address, 
        selectedInsuranceTypes, 
        propertyType, 
        selectedOtherOptions, 
        selectedAddress.placeId
      );
      setLoading(false);
    }
  };

  // Handle manual address entry without autocomplete
  const handleManualSubmit = () => {
    if (address) {
      setSelectedAddress({ address });
    }
  };

  return (
    <Card className="w-full bg-white shadow-sm border-0">
      <CardContent className="p-6">
        <div className="mb-4">
          <h3 className="text-xl font-semibold text-primary flex items-center">
            <Home className="mr-2 h-5 w-5" /> 
            Enter Your Address
          </h3>
          <p className="text-gray-600 mt-1">
            We'll help you find insurance coverage options tailored for you.
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Address input - always show it */}
          <div className="relative">
            <Input
              ref={bindInputRef}
              type="text"
              placeholder="Enter your address"
              className="pr-10 h-12 border-gray-300"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              autoComplete="off"
              disabled={!!selectedAddress} /* Disable when address is selected */
            />
          </div>
          
          {/* Insurance type selection */}
          {selectedAddress && (
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Type of Insurance (Select all that apply)
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  {insuranceTypes.map(type => (
                    <div key={type.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`insurance-${type.id}`} 
                        checked={selectedInsuranceTypes.includes(type.id)}
                        onCheckedChange={(checked) => 
                          handleInsuranceTypeChange(type.id, checked === true)
                        }
                      />
                      <Label 
                        htmlFor={`insurance-${type.id}`}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {type.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {/* Property type dropdown that appears when property or flood is selected */}
          {selectedAddress && showPropertyTypeSelection && (
            <div className="space-y-2">
              <Label htmlFor="property-type" className="text-sm font-medium">
                Property Type
              </Label>
              <Select value={propertyType} onValueChange={setPropertyType}>
                <SelectTrigger id="property-type" className="w-full h-12">
                  <SelectValue placeholder="Select property type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="secondary">Secondary</SelectItem>
                  <SelectItem value="seasonal">Seasonal</SelectItem>
                  <SelectItem value="short-term-rental">Short Term Rental</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          
          {/* Other insurance options */}
          {selectedAddress && showOtherOptions && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Other Insurance Options (Select all that apply)
              </Label>
              <div className="grid grid-cols-2 gap-3">
                {otherOptions.map(option => (
                  <div key={option.id} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`option-${option.id}`} 
                      checked={selectedOtherOptions.includes(option.id)}
                      onCheckedChange={(checked) => 
                        handleOtherOptionChange(option.id, checked === true)
                      }
                    />
                    <Label 
                      htmlFor={`option-${option.id}`}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Show the action buttons */}
          <div className={`${selectedAddress ? 'flex gap-3' : ''} mt-4`}>
            {selectedAddress && (
              <Button 
                type="button"
                variant="outline"
                className="flex-1 h-12"
                onClick={() => {
                  setSelectedAddress(null);
                  setPropertyType('');
                  setSelectedInsuranceTypes([]);
                  setSelectedOtherOptions([]);
                }}
              >
                Change Address
              </Button>
            )}
            
            <Button 
              type={selectedAddress ? "submit" : "button"}
              onClick={selectedAddress ? undefined : handleManualSubmit}
              className="bg-primary hover:bg-primary/90 text-white w-full h-12"
              disabled={selectedAddress ? (loading || !canSubmit) : !address}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <SearchIcon className="mr-2 h-4 w-4" />
                  {selectedAddress ? "Find Insurance Options" : "Continue"}
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
