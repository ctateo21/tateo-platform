import { Helmet } from "react-helmet";
import { Link } from "wouter";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Download, ArrowRight, DollarSign, Percent, Calculator, Home, ExternalLink, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { loadGoogleMapsApi } from "@/lib/script-loader";

interface ZillowProperty {
  id: string;
  address: {
    streetAddress: string;
    city: string;
    state: string;
    zipcode: string;
  };
  price: number;
  zestimate?: number;
  listPrice?: number;
  bedrooms: number;
  bathrooms: number;
  livingArea: number;
  lotSize: number;
  yearBuilt: number;
  description: string;
  photos: string[];
  listingStatus: 'forSale' | 'sold' | 'offMarket';
  listingDate?: string;
  latitude: number;
  longitude: number;
  priceSource?: string;
  priceType?: string;
  zillow_url?: string;
}

interface TaxEstimateResult {
  annualTaxAmount: number;
  monthlyTaxAmount: number;
  taxRate: number;
  homesteadExemption: boolean;
  countyName: string;
}

interface AddressQualificationResults {
  qualification: boolean;
  maximumLoanAmount: number;
  requiredIncome: number;
  estimatedMonthlyPayment: number;
  interestRate: number;
  downPaymentAmount: number;
  principalAndInterest: number;
  propertyTax: number;
  homeownersInsurance: number;
  customTaxEstimate?: boolean;
}

export default function Mortgage() {  
  // State for income-based calculator
  const [yearlyIncome, setYearlyIncome] = useState<string>('');
  const [monthlyDebts, setMonthlyDebts] = useState<string>('');
  const [formattedIncome, setFormattedIncome] = useState<string>('');
  const [formattedDebts, setFormattedDebts] = useState<string>('');
  const [creditScore, setCreditScore] = useState<string>('');
  const [selectedState, setSelectedState] = useState<string>('');
  const [loanType, setLoanType] = useState<string>('');
  const [propertyType, setPropertyType] = useState<string>('primary');
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState({
    loanAmount: 0,
    principalAndInterest: 0,
    propertyTax: 0,
    insurance: 0,
    totalMonthlyPayment: 0,
    dtiRatio: 0,
    interestRate: 0
  });
  
  // Property qualification states
  const [showPropertyQualifier, setShowPropertyQualifier] = useState(false);
  const [propertyAddress, setPropertyAddress] = useState<string>('');
  const [propertyPrice, setPropertyPrice] = useState<number>(0);
  const [manualPropertyPrice, setManualPropertyPrice] = useState<string>('');
  const [showManualPriceInput, setShowManualPriceInput] = useState(false);
  const [propertyData, setPropertyData] = useState<ZillowProperty | null>(null);
  const [downPaymentPercent, setDownPaymentPercent] = useState<number>(20);
  const [addressCreditScore, setAddressCreditScore] = useState<string>('');
  const [monthlyIncome, setMonthlyIncome] = useState<string>('');
  const [addressMonthlyDebts, setAddressMonthlyDebts] = useState<string>('');
  const [addressLoanType, setAddressLoanType] = useState<string>('');
  const [showAddressResults, setShowAddressResults] = useState(false);
  const [showPropertyResult, setShowPropertyResult] = useState(false);
  const [addressResults, setAddressResults] = useState<AddressQualificationResults>({
    qualification: true,
    maximumLoanAmount: 0,
    requiredIncome: 0,
    estimatedMonthlyPayment: 0,
    interestRate: 0,
    downPaymentAmount: 0,
    principalAndInterest: 0,
    propertyTax: 0,
    homeownersInsurance: 0
  });
  
  // Google Maps states
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string>('');
  const [placeDetails, setPlaceDetails] = useState<any | null>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const [autocomplete, setAutocomplete] = useState<any>(null);
  
  // Current mortgage rates from MortgageNewsDaily.com (as of latest data)
  // These would ideally be fetched from an API in a production environment
  const mortgageRates = {
    conventional: 0.0690, // 6.90% - 30-Year Fixed
    fha: 0.0660, // 6.60% - 30-Year FHA
    va: 0.0668, // 6.68% - 30-Year VA
    usda: 0.0660, // 6.60% - Same as FHA
    unique: 0.0730 // 7.30% - Conventional + 0.4%
  };

  // List of US states
  const usStates = [
    { value: 'AL', label: 'Alabama' },
    { value: 'AK', label: 'Alaska' },
    { value: 'AZ', label: 'Arizona' },
    { value: 'AR', label: 'Arkansas' },
    { value: 'CA', label: 'California' },
    { value: 'CO', label: 'Colorado' },
    { value: 'CT', label: 'Connecticut' },
    { value: 'DE', label: 'Delaware' },
    { value: 'FL', label: 'Florida' },
    { value: 'GA', label: 'Georgia' },
    { value: 'HI', label: 'Hawaii' },
    { value: 'ID', label: 'Idaho' },
    { value: 'IL', label: 'Illinois' },
    { value: 'IN', label: 'Indiana' },
    { value: 'IA', label: 'Iowa' },
    { value: 'KS', label: 'Kansas' },
    { value: 'KY', label: 'Kentucky' },
    { value: 'LA', label: 'Louisiana' },
    { value: 'ME', label: 'Maine' },
    { value: 'MD', label: 'Maryland' },
    { value: 'MA', label: 'Massachusetts' },
    { value: 'MI', label: 'Michigan' },
    { value: 'MN', label: 'Minnesota' },
    { value: 'MS', label: 'Mississippi' },
    { value: 'MO', label: 'Missouri' },
    { value: 'MT', label: 'Montana' },
    { value: 'NE', label: 'Nebraska' },
    { value: 'NV', label: 'Nevada' },
    { value: 'NH', label: 'New Hampshire' },
    { value: 'NJ', label: 'New Jersey' },
    { value: 'NM', label: 'New Mexico' },
    { value: 'NY', label: 'New York' },
    { value: 'NC', label: 'North Carolina' },
    { value: 'ND', label: 'North Dakota' },
    { value: 'OH', label: 'Ohio' },
    { value: 'OK', label: 'Oklahoma' },
    { value: 'OR', label: 'Oregon' },
    { value: 'PA', label: 'Pennsylvania' },
    { value: 'RI', label: 'Rhode Island' },
    { value: 'SC', label: 'South Carolina' },
    { value: 'SD', label: 'South Dakota' },
    { value: 'TN', label: 'Tennessee' },
    { value: 'TX', label: 'Texas' },
    { value: 'UT', label: 'Utah' },
    { value: 'VT', label: 'Vermont' },
    { value: 'VA', label: 'Virginia' },
    { value: 'WA', label: 'Washington' },
    { value: 'WV', label: 'West Virginia' },
    { value: 'WI', label: 'Wisconsin' },
    { value: 'WY', label: 'Wyoming' },
    { value: 'DC', label: 'District of Columbia' }
  ];

  // Calculate mortgage qualification based on income
  const handleCalculate = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    
    // Validate required fields
    if (!yearlyIncome || !monthlyDebts || !creditScore || !selectedState || !loanType) {
      alert("Please fill in all fields to calculate your qualification.");
      return;
    }
    
    const income = parseFloat(yearlyIncome) || 0;
    const debts = parseFloat(monthlyDebts) || 0;
    
    // Calculate monthly income - yearly income is already provided
    const monthlyIncomeVal = income / 12; // $120,000/12 = $10,000 per month
    
    // Determine max DTI based on credit score - highest credit scores get highest DTI
    let maxDti = 0.43; // Default DTI ratio
    
    // Credit scores 740+ get max DTI of 45%
    if (parseInt(creditScore) >= 740) {
      maxDti = 0.45;
    }
    // Credit scores 700-739 get max DTI of 43%
    else if (parseInt(creditScore) >= 700) {
      maxDti = 0.43;
    }
    // Credit scores 660-699 get max DTI of 41%
    else if (parseInt(creditScore) >= 660) {
      maxDti = 0.41;
    }
    // Credit scores 640-659 get max DTI of 38%
    else if (parseInt(creditScore) >= 640) {
      maxDti = 0.38;
    }
    // Below 640 get max DTI of 36%
    else if (parseInt(creditScore) > 0) {
      maxDti = 0.36;
    }
    
    // Get base interest rate based on loan type from current rates
    let baseInterestRate = mortgageRates[loanType as keyof typeof mortgageRates];
    
    // Apply credit score adjustments - add 0.1% for each tier below 780+
    const scoreTiers = [780, 760, 740, 720, 700, 680, 660, 640, 620, 600];
    if (creditScore) {
      const creditScoreNum = parseInt(creditScore);
      const tierIndex = scoreTiers.findIndex(score => score <= creditScoreNum);
      
      // Calculate adjustment based on tier difference
      // Example: 780+ is tier 0, 700-719 is tier 4, so add 0.4%
      if (tierIndex > 0) {
        const rateAdjustment = tierIndex * 0.001; // 0.1% per tier
        baseInterestRate += rateAdjustment;
        console.log(`Credit score adjustment: +${(rateAdjustment * 100).toFixed(1)}% (tier ${tierIndex})`);
      } else if (tierIndex === 0) {
        console.log('No credit score adjustment for top tier (780+)');
      }
    }
    
    // Calculate max monthly payment available (total PITI - principal, interest, taxes, insurance)
    // Example: $10,000 × 45% - $1,250 = $4,500 - $1,250 = $3,250 max monthly payment
    const maxMonthlyPayment = (monthlyIncomeVal * maxDti) - debts;
    
    // Calculate tax and insurance rates (monthly percentages of loan amount)
    // Default rates for most states
    let propertyTaxRate = 0.01 / 12; // 1% annual property tax / 12 months
    let insuranceRate = 0.005 / 12; // 0.5% annual insurance / 12 months
    
    // Florida-specific rates
    if (selectedState === 'FL') {
      propertyTaxRate = 0.015 / 12; // 1.5% annual property tax / 12 months
      insuranceRate = 0.0075 / 12; // 0.75% annual insurance / 12 months
    }
    
    // Calculate how much of the monthly payment is available for principal and interest
    // Using an algebraic transformation of the standard mortgage formula that accounts for taxes and insurance
    const monthlyInterestRate = baseInterestRate / 12;
    const term = 30 * 12; // 30-year mortgage in months
    
    // This factor accounts for taxes and insurance proportional to loan amount
    const taxInsuranceFactor = propertyTaxRate + insuranceRate;
    
    // Calculate loan amount using mortgage formula adjusted for insurance and taxes
    // Formula derivation: Payment = L × [r(1+r)^n/((1+r)^n-1) + tax + ins]
    // Where L = loan amount, r = monthly interest rate, n = term in months, tax = monthly tax rate, ins = monthly insurance rate
    const piRatio = monthlyInterestRate * Math.pow(1 + monthlyInterestRate, term) / (Math.pow(1 + monthlyInterestRate, term) - 1);
    const loanAmount = maxMonthlyPayment / (piRatio + taxInsuranceFactor);
    
    // Calculate the components of the payment
    const principalAndInterest = loanAmount * piRatio;
    const propertyTax = loanAmount * propertyTaxRate;
    const insurance = loanAmount * insuranceRate;
    
    // Round to nearest whole numbers for display
    const roundedLoanAmount = Math.round(loanAmount);
    const roundedPrincipalAndInterest = Math.round(principalAndInterest);
    const roundedPropertyTax = Math.round(propertyTax);
    const roundedInsurance = Math.round(insurance);
    const roundedTotalPayment = Math.round(principalAndInterest + propertyTax + insurance);
    
    // Debug output to console for verification
    console.log('==== Mortgage Qualification Calculator ====');
    console.log(`Yearly Income: $${income}`);
    console.log(`Monthly Income: $${monthlyIncomeVal.toFixed(2)}`);
    console.log(`Monthly Debts: $${debts}`);
    console.log(`Max DTI: ${(maxDti * 100).toFixed(2)}%`);
    console.log(`Available Monthly Payment: $${maxMonthlyPayment.toFixed(2)}`);
    console.log(`Interest Rate: ${(baseInterestRate * 100).toFixed(2)}%`);
    console.log(`Monthly Interest Rate: ${(monthlyInterestRate * 100).toFixed(4)}%`);
    console.log(`P&I Ratio: ${piRatio.toFixed(6)}`);
    console.log(`Tax+Insurance Factor: ${taxInsuranceFactor.toFixed(6)}`);
    console.log(`Loan Amount: $${loanAmount.toFixed(2)}`);
    console.log(`Principal & Interest: $${principalAndInterest.toFixed(2)}`);
    console.log(`Property Tax: $${propertyTax.toFixed(2)}`);
    console.log(`Insurance: $${insurance.toFixed(2)}`);
    console.log(`Total Monthly Payment: $${(principalAndInterest + propertyTax + insurance).toFixed(2)}`);
    console.log('=======================================');
    
    // Update results
    setResults({
      loanAmount: roundedLoanAmount,
      principalAndInterest: roundedPrincipalAndInterest,
      propertyTax: roundedPropertyTax,
      insurance: roundedInsurance,
      totalMonthlyPayment: roundedTotalPayment,
      dtiRatio: Math.round(maxDti * 100),
      interestRate: baseInterestRate * 100 // Convert to percentage
    });
    
    setShowResults(true);
  };
  
  // Load Google Maps API script
  useEffect(() => {
    // For Vite environment variables, they must be prefixed with VITE_
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
    
    // If we can't find the key in import.meta.env, try a server-side fetch
    if (!apiKey) {
      console.log('Trying to fetch Google Maps API key from server...');
      // Fetch the key from server
      fetch('/api/config/google-maps-api-key')
        .then(response => response.json())
        .then(data => {
          if (data.apiKey) {
            console.log('Successfully retrieved Google Maps API key from server');
            loadGoogleMapsApi(data.apiKey)
              .then(() => {
                setGoogleMapsLoaded(true);
              })
              .catch(err => {
                console.error('Failed to load Google Maps API:', err);
              });
          } else {
            console.error('Google Maps API key not provided by server');
          }
        })
        .catch(error => {
          console.error('Error fetching Google Maps API key:', error);
        });
      return;
    }
    
    // Load the Google Maps API script
    loadGoogleMapsApi(apiKey)
      .then(() => {
        console.log('Google Maps API loaded successfully');
        setGoogleMapsLoaded(true);
      })
      .catch(err => {
        console.error('Failed to load Google Maps API:', err);
      });
  }, []);
  
  // Track when the property qualifier section becomes visible
  useEffect(() => {
    // When the property qualifier becomes visible, reset autocomplete to ensure it reinitializes
    if (showPropertyQualifier) {
      setAutocomplete(null);
    }
  }, [showPropertyQualifier]);
  
  // Initialize Google Places Autocomplete when API is loaded
  useEffect(() => {
    // Skip if API not loaded or input not available
    if (!googleMapsLoaded || !addressInputRef.current) {
      return;
    }
    
    // Only initialize if property qualifier is showing
    if (!showPropertyQualifier) {
      return;
    }
    
    try {
      // Check if Google Maps API is fully loaded
      if (!window.google?.maps?.places?.Autocomplete) {
        console.warn('Google Maps Places API not fully loaded yet');
        return;
      }
      
      console.log('Initializing Google Places Autocomplete...');
      
      // Options for the autocomplete - restrict to addresses in the US
      const options = {
        types: ['address'],
        componentRestrictions: { country: 'us' },
        fields: ['address_components', 'formatted_address', 'geometry', 'place_id']
      };
      
      try {
        // Clean up any existing autocomplete first
        if (autocomplete) {
          // Google doesn't provide a clean way to remove the autocomplete, so we just make a new one
          setAutocomplete(null);
        }
        
        // Create the autocomplete instance
        // @ts-ignore - TypeScript doesn't know about window.google
        const autoCompleteInstance = new window.google.maps.places.Autocomplete(
          addressInputRef.current,
          options
        );
        
        // Add event listener for place selection
        // @ts-ignore - TypeScript doesn't know about addListener
        const listener = autoCompleteInstance.addListener('place_changed', () => {
          // @ts-ignore - TypeScript doesn't know about getPlace
          const place = autoCompleteInstance.getPlace();
          if (place && place.formatted_address) {
            setPlaceDetails(place);
            setPropertyAddress(place.formatted_address);
            console.log('Selected place:', place.formatted_address);
            
            // Extract state for Florida-specific handling
            const addressComponents = place.address_components || [];
            const stateComponent = addressComponents.find(
              (component: any) => component.types.includes('administrative_area_level_1')
            );
            
            if (stateComponent) {
              const stateCode = stateComponent.short_name;
              console.log('State detected:', stateCode);
              setSelectedState(stateCode);
              
              // Also set the addressCreditScore to match the self-qualify score if available
              if (creditScore) {
                setAddressCreditScore(creditScore);
              }
              
              // Set loan type to match if available
              if (loanType) {
                setAddressLoanType(loanType);
              }
              
              // Set income to match if available
              if (yearlyIncome) {
                setMonthlyIncome(yearlyIncome);
              }
              
              // Set monthly debts to match if available
              if (monthlyDebts) {
                setAddressMonthlyDebts(monthlyDebts);
              }
            }
          }
        });
        
        // Store the autocomplete instance
        setAutocomplete(autoCompleteInstance);
        console.log('Google Places Autocomplete initialized successfully');
        
        // Prevent form submission on Enter key
        const keydownListener = (e: KeyboardEvent) => {
          if (e.key === 'Enter') {
            e.preventDefault();
          }
        };
        
        addressInputRef.current.addEventListener('keydown', keydownListener);
        
        // Clean up function
        return () => {
          // @ts-ignore - TypeScript doesn't know about google.maps
          if (listener && window.google?.maps?.event) {
            // @ts-ignore
            window.google.maps.event.removeListener(listener);
          }
          
          if (addressInputRef.current) {
            addressInputRef.current.removeEventListener('keydown', keydownListener);
          }
        };
      } catch (autocompleteError) {
        console.error('Error creating autocomplete instance:', autocompleteError);
        // If we can't initialize the autocomplete, make sure the input is still usable
        if (addressInputRef.current) {
          // Make sure the input is enabled
          addressInputRef.current.disabled = false;
          setGoogleMapsLoaded(false);
        }
      }
    } catch (error) {
      console.error('Error initializing Google Places Autocomplete:', error);
      // Make sure the input is still usable even if Google Maps fails
      if (addressInputRef.current) {
        addressInputRef.current.disabled = false;
      }
    }
  }, [googleMapsLoaded, showPropertyQualifier, creditScore, loanType, yearlyIncome, monthlyDebts, addressInputRef]);

  // Search for address and get property price
  const handleSearchAddress = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    
    if (!propertyAddress) {
      alert("Please enter a property address to search.");
      return;
    }
    
    setIsSearching(true);
    setSearchError('');
    
    try {
      // Call our server endpoint to get property details
      const response = await fetch('/api/properties/lookup-by-address', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          address: propertyAddress,
          placeId: placeDetails?.place_id
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch property data: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.property) {
        // Store the property data and price
        setPropertyData(data.property);
        setPropertyPrice(data.property.price);
        setShowPropertyResult(true);
        
        // Log the property details
        console.log(`Found property:`, data.property);
        
        // Try to extract state from the address for Florida-specific calculations
        if (data.property.address.state === 'FL') {
          setSelectedState('FL');
        }
        
        // If we didn't get full place details from Google Maps, extract from Zillow data
        if (!placeDetails || !placeDetails.formatted_address) {
          const fullAddress = `${data.property.address.streetAddress}, ${data.property.address.city}, ${data.property.address.state} ${data.property.address.zipcode}`;
          setPropertyAddress(fullAddress);
        }

        // Auto-populate fields from self-qualify section if available
        if (creditScore && !addressCreditScore) {
          setAddressCreditScore(creditScore);
        }
        
        if (loanType && !addressLoanType) {
          setAddressLoanType(loanType);
        }
        
        if (yearlyIncome && !monthlyIncome) {
          setMonthlyIncome(yearlyIncome);
        }
        
        if (monthlyDebts && !addressMonthlyDebts) {
          setAddressMonthlyDebts(monthlyDebts);
        }

        // Determine price type for display
        let priceMessage = "";
        if (data.property.listingStatus === "forSale") {
          priceMessage = "Listed for sale at";
        } else if (data.property.zestimate) {
          priceMessage = "Estimated value";
        } else {
          priceMessage = "Approximate value";
        }
        
        console.log(`${priceMessage}: $${data.property.price.toLocaleString()}`);
        
      } else {
        setSearchError("No property data found for this address.");
        setShowPropertyResult(false);
      }
    } catch (error) {
      console.error('Error fetching property data:', error);
      setSearchError("Error searching for property. Please try again.");
      setShowPropertyResult(false);
    } finally {
      setIsSearching(false);
    }
  };

  // Calculate qualification based on property address
  const handleAddressCalculate = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    
    if (!showPropertyResult) {
      alert("Please search for a property address first.");
      return;
    }
    
    if (!downPaymentPercent || !creditScore || !yearlyIncome || !loanType) {
      alert("Please complete the Self Qualify section first.");
      return;
    }
    
    // Auto-populate values from self-qualify section
    setAddressCreditScore(creditScore);
    setMonthlyIncome(yearlyIncome);
    setAddressMonthlyDebts(monthlyDebts);
    setAddressLoanType(loanType);
    
    const downPaymentAmount = (downPaymentPercent / 100) * propertyPrice;
    const loanAmount = propertyPrice - downPaymentAmount;
    // Convert yearly income to monthly income for calculations
    const yearlyIncomeVal = parseFloat(yearlyIncome) || 0;
    const monthlyIncomeVal = yearlyIncomeVal / 12;
    const monthlyDebtsVal = parseFloat(monthlyDebts) || 0;
    
    // Get base interest rate based on loan type
    let baseInterestRate = mortgageRates[loanType as keyof typeof mortgageRates];
    
    // Apply credit score adjustments - add 0.1% for each tier below 780+
    const scoreTiers = [780, 760, 740, 720, 700, 680, 660, 640, 620, 600];
    if (creditScore) {
      const creditScoreNum = parseInt(creditScore);
      const tierIndex = scoreTiers.findIndex(score => score <= creditScoreNum);
      
      if (tierIndex > 0) {
        const rateAdjustment = tierIndex * 0.001; // 0.1% per tier
        baseInterestRate += rateAdjustment;
      }
    }
    
    // Calculate monthly payment (principal and interest)
    const monthlyInterestRate = baseInterestRate / 12;
    const term = 30 * 12; // 30-year mortgage in months
    
    // Using standard mortgage payment formula for principal and interest
    const principalAndInterestPayment = loanAmount * (
      monthlyInterestRate * Math.pow(1 + monthlyInterestRate, term) /
      (Math.pow(1 + monthlyInterestRate, term) - 1)
    );
    
    // Initialize tax and insurance amounts
    let propertyTaxAmount = 0;
    let homeownersInsuranceAmount = 0;
    let totalMonthlyPayment = principalAndInterestPayment;
    let customTaxEstimate = false;
    
    // Check if this is a Hillsborough County, FL property
    // Use a comprehensive check for Hillsborough County cities and FL
    const isHillsborough = (
      propertyAddress.toLowerCase().includes('fl') &&
      (
        propertyAddress.toLowerCase().includes('tampa') ||
        propertyAddress.toLowerCase().includes('temple terrace') ||
        propertyAddress.toLowerCase().includes('plant city') ||
        propertyAddress.toLowerCase().includes('brandon') ||
        propertyAddress.toLowerCase().includes('riverview') ||
        propertyAddress.toLowerCase().includes('sun city') ||
        propertyAddress.toLowerCase().includes('apollo beach') ||
        propertyAddress.toLowerCase().includes('hillsborough')
      )
    );
    
    if (isHillsborough) {
      try {
        // Use the Hillsborough County tax estimator API for more accurate tax data
        console.log('Using Hillsborough County tax estimator for', propertyAddress);
        
        const response = await fetch('/api/property-tax/hillsborough', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            address: propertyAddress,
            propertyValue: propertyPrice,
            isPrimaryResidence: propertyType === 'primary'
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.taxEstimate) {
            // Use the accurate tax data from Hillsborough County
            propertyTaxAmount = data.taxEstimate.monthlyTaxAmount;
            customTaxEstimate = true;
            console.log(`Using Hillsborough County tax estimate: $${propertyTaxAmount}/month`);
            
            // Still use our insurance estimate
            homeownersInsuranceAmount = (propertyPrice * 0.0075) / 12;
            totalMonthlyPayment = principalAndInterestPayment + propertyTaxAmount + homeownersInsuranceAmount;
          }
        } else {
          // Fall back to standard estimation
          console.log('Could not get Hillsborough tax data, using standard estimates');
          if (selectedState === 'FL') {
            propertyTaxAmount = (propertyPrice * 0.015) / 12;
            homeownersInsuranceAmount = (propertyPrice * 0.0075) / 12;
          } else {
            propertyTaxAmount = (propertyPrice * 0.011) / 12;
            homeownersInsuranceAmount = (propertyPrice * 0.0035) / 12;
          }
          totalMonthlyPayment = principalAndInterestPayment + propertyTaxAmount + homeownersInsuranceAmount;
        }
      } catch (error) {
        console.error('Error fetching Hillsborough tax data:', error);
        // Fall back to standard tax calculation if the API fails
        propertyTaxAmount = (propertyPrice * 0.015) / 12; // Florida rate
        homeownersInsuranceAmount = (propertyPrice * 0.0075) / 12;
        totalMonthlyPayment = principalAndInterestPayment + propertyTaxAmount + homeownersInsuranceAmount;
      }
    } else if (selectedState === 'FL') {
      // For other Florida properties, use standard Florida rates
      propertyTaxAmount = (propertyPrice * 0.015) / 12;
      homeownersInsuranceAmount = (propertyPrice * 0.0075) / 12;
      totalMonthlyPayment = principalAndInterestPayment + propertyTaxAmount + homeownersInsuranceAmount;
    } else {
      // For non-Florida properties, use national averages
      propertyTaxAmount = (propertyPrice * 0.011) / 12;
      homeownersInsuranceAmount = (propertyPrice * 0.0035) / 12;
      totalMonthlyPayment = principalAndInterestPayment + propertyTaxAmount + homeownersInsuranceAmount;
    }
    
    // Calculate required income based on 43% DTI (conservative estimate)
    const totalMonthlyDebt = monthlyDebtsVal + totalMonthlyPayment;
    const requiredIncome = totalMonthlyDebt / 0.43;
    
    // Determine if the user qualifies
    const qualifies = monthlyIncomeVal >= requiredIncome;
    
    setAddressResults({
      qualification: qualifies,
      maximumLoanAmount: Math.round(loanAmount),
      requiredIncome: Math.round(requiredIncome),
      estimatedMonthlyPayment: Math.round(totalMonthlyPayment),
      interestRate: baseInterestRate * 100, // Convert to percentage
      downPaymentAmount: Math.round(downPaymentAmount),
      principalAndInterest: Math.round(principalAndInterestPayment),
      propertyTax: propertyTaxAmount, // Keep exact amount with cents
      homeownersInsurance: Math.round(homeownersInsuranceAmount),
      customTaxEstimate: customTaxEstimate
    });
    
    setShowAddressResults(true);
  };
  
  const resources = [
    {
      title: "Refinance Guide",
      description: "Learn all about the refinancing process, when to refinance, and how to secure the best terms.",
      icon: <FileText className="h-10 w-10 text-primary" />,
      cta: "Download Refinance Guide",
      link: "#"
    },
    {
      title: "Cash Out Guide",
      description: "Understand how cash-out refinancing works and how to leverage your home equity responsibly.",
      icon: <FileText className="h-10 w-10 text-primary" />,
      cta: "Download Cash Out Guide",
      link: "#"
    }
  ];

  const mortgageTypes = [
    {
      title: "Conventional Mortgages",
      description: "Standard mortgages not backed by government agencies with competitive rates for qualified borrowers.",
      icon: <Home className="h-10 w-10 text-primary" />
    },
    {
      title: "FHA Loans",
      description: "Government-backed loans with lower down payment requirements and more flexible qualification criteria.",
      icon: <Home className="h-10 w-10 text-primary" />
    },
    {
      title: "VA Loans",
      description: "Loans for veterans and active military with no down payment requirements and competitive rates.",
      icon: <Home className="h-10 w-10 text-primary" />
    },
    {
      title: "USDA Loans",
      description: "Rural development loans with zero down payment for eligible homebuyers in qualifying areas.",
      icon: <Home className="h-10 w-10 text-primary" />
    }
  ];

  return (
    <>
      <Helmet>
        <title>Mortgage Calculator | Tateo & Co</title>
        <meta name="description" content="Get pre-qualified for a mortgage with our powerful calculator tool." />
      </Helmet>
      
      <div className="container mx-auto py-12 max-w-7xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary">Mortgage Calculator</h1>
          <p className="text-xl text-gray-600 mt-4 max-w-3xl mx-auto">
            Use our calculators below to get a quick estimate of your mortgage qualification. You can either enter your income details or search for a specific property address.
          </p>
        </div>
        
        <div className="grid md:grid-cols-1 gap-8">
          {/* Combined Qualification */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold text-primary mb-4 text-center">Self Qualify</h3>
            <p className="text-sm text-gray-600 mb-4 text-center">Calculate how much home you can afford based on your income and existing debts</p>
            
            <form className="space-y-6" id="qualification-form">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="yearlyIncome" className="block text-sm font-medium text-gray-700">Yearly Income ($)</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      id="yearlyIncome" 
                      name="yearlyIncome" 
                      placeholder="Enter your annual income" 
                      className="px-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      value={formattedIncome}
                      onChange={(e) => {
                        // Extract numbers only
                        const value = e.target.value.replace(/[^0-9]/g, '');
                        setYearlyIncome(value);
                        
                        // Format as currency
                        if (value) {
                          const numValue = parseInt(value, 10);
                          setFormattedIncome(new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD',
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0
                          }).format(numValue));
                        } else {
                          setFormattedIncome('');
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="monthlyDebts" className="block text-sm font-medium text-gray-700">Monthly Debts ($)</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      id="monthlyDebts" 
                      name="monthlyDebts" 
                      placeholder="Enter your total monthly debt payments" 
                      className="px-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      value={formattedDebts}
                      onChange={(e) => {
                        // Extract numbers only
                        const value = e.target.value.replace(/[^0-9]/g, '');
                        setMonthlyDebts(value);
                        
                        // Format as currency
                        if (value) {
                          const numValue = parseInt(value, 10);
                          setFormattedDebts(new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD',
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0
                          }).format(numValue));
                        } else {
                          setFormattedDebts('');
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="creditScore" className="block text-sm font-medium text-gray-700">Estimated Credit Score</label>
                  <select 
                    id="creditScore" 
                    name="creditScore" 
                    className="px-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    value={creditScore}
                    onChange={(e) => setCreditScore(e.target.value)}
                  >
                    <option value="">Select your credit score range</option>
                    <option value="780">780+</option>
                    <option value="760">760-779</option>
                    <option value="740">740-759</option>
                    <option value="720">720-739</option>
                    <option value="700">700-719</option>
                    <option value="680">680-699</option>
                    <option value="660">660-679</option>
                    <option value="640">640-659</option>
                    <option value="620">620-639</option>
                    <option value="600">Below 620</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="selectedState" className="block text-sm font-medium text-gray-700">State You're Buying In</label>
                  <select 
                    id="selectedState" 
                    name="selectedState" 
                    className="px-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    value={selectedState}
                    onChange={(e) => setSelectedState(e.target.value)}
                  >
                    <option value="">Select a state</option>
                    {usStates.map((state) => (
                      <option key={state.value} value={state.value}>{state.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="loanType" className="block text-sm font-medium text-gray-700">Loan Type</label>
                  <select 
                    id="loanType" 
                    name="loanType" 
                    className="px-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    value={loanType}
                    onChange={(e) => setLoanType(e.target.value)}
                  >
                    <option value="">Select loan type</option>
                    <option value="conventional">Conventional</option>
                    <option value="fha">FHA</option>
                    <option value="va">VA</option>
                    <option value="usda">USDA</option>
                    <option value="unique">Unique Loan Products</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="propertyType" className="block text-sm font-medium text-gray-700">Property Type</label>
                  <select 
                    id="propertyType" 
                    name="propertyType" 
                    className="px-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value)}
                  >
                    <option value="">Select property type</option>
                    <option value="primary">Primary Residence</option>
                    <option value="secondary">Secondary Home</option>
                    <option value="investment">Investment Property</option>
                  </select>
                </div>
              </div>
              
              <div className="text-center pt-4">
                <Button 
                  type="button" 
                  id="calculate-button"
                  className="bg-primary hover:bg-primary/90 text-white px-8 py-2 w-full"
                  onClick={handleCalculate}
                >
                  Calculate Qualification <Calculator className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </form>

            {showResults && (
              <div className="mt-8 p-6 bg-gray-50 rounded-lg">
                <h3 className="text-xl font-semibold text-primary mb-3">Your Estimated Qualification</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                    <span className="font-medium">Estimated Loan Amount:</span>
                    <span className="text-xl font-bold text-primary">${results.loanAmount.toLocaleString()}</span>
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded-md my-4">
                    <h4 className="font-semibold text-primary mb-2">Monthly Payment Breakdown:</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Principal & Interest:</span>
                        <span className="font-medium">${results.principalAndInterest.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Property Taxes:</span>
                        <span className="font-medium">${results.propertyTax.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Homeowners Insurance:</span>
                        <span className="font-medium">${results.insurance.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-blue-200 pt-2 mt-2">
                        <span className="font-medium">Total Monthly Payment:</span>
                        <span className="font-bold">${results.totalMonthlyPayment.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                    <span className="font-medium">Debt-to-Income Ratio:</span>
                    <span>{results.dtiRatio}%</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                    <span className="font-medium">Estimated Interest Rate:</span>
                    <div className="flex items-center">
                      <span>{results.interestRate.toFixed(2)}%</span>
                      <a href="https://www.mortgagenewsdaily.com/mortgage-rates" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 ml-2 text-xs underline flex items-center">
                        <ExternalLink className="h-3 w-3 mr-1" /> View current rates
                      </a>
                    </div>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                    <span className="font-medium">Loan Type:</span>
                    <span className="capitalize">{loanType} Loan</span>
                  </div>
                  
                  {/* Qualify for a Property Button */}
                  <div className="mt-4">
                    <Button 
                      type="button" 
                      id="qualify-for-property-button"
                      className="bg-secondary hover:bg-secondary/90 text-white px-8 py-2 w-full"
                      onClick={() => setShowPropertyQualifier(!showPropertyQualifier)}
                    >
                      {showPropertyQualifier ? "Hide Property Qualification" : "Qualify for a Property"} <Home className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* Property Qualification Section */}
                  {showPropertyQualifier && (
                    <div className="mt-6 border-t border-gray-200 pt-4">
                      <h4 className="text-lg font-semibold text-primary mb-4">Qualify for a Specific Property</h4>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label htmlFor="propertyAddress" className="block text-sm font-medium text-gray-700">Property Address</label>
                          <div className="relative">
                            <input 
                              type="text" 
                              id="propertyAddress" 
                              name="propertyAddress" 
                              placeholder="Enter the full property address" 
                              className="px-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                              value={propertyAddress}
                              onChange={(e) => setPropertyAddress(e.target.value)}
                              ref={addressInputRef}
                            />
                            {googleMapsLoaded ? (
                              <p className="text-xs text-green-600 mt-1">Address autocomplete enabled</p>
                            ) : (
                              <p className="text-xs text-gray-500 mt-1">Enter your full address manually</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex gap-4 mt-4">
                          <div className="flex-1">
                            <Button 
                              type="button" 
                              id="search-address-button"
                              className="bg-secondary hover:bg-secondary/90 text-white px-8 py-2 w-full"
                              onClick={handleSearchAddress}
                              disabled={isSearching}
                            >
                              {isSearching ? (
                                <>
                                  <span className="animate-pulse">Searching</span>
                                  <span className="ml-1 animate-pulse">...</span>
                                </>
                              ) : (
                                <>
                                  Pull from Zillow <Search className="ml-2 h-4 w-4" />
                                </>
                              )}
                            </Button>
                          </div>
                          <div className="flex-1">
                            <Button 
                              type="button" 
                              className="bg-slate-100 hover:bg-slate-200 text-gray-900 px-8 py-2 w-full"
                              onClick={() => setShowManualPriceInput(!showManualPriceInput)}
                            >
                              {showManualPriceInput ? "Hide" : "Enter Price Manually"}
                            </Button>
                          </div>
                        </div>
                        
                        {searchError && (
                          <div className="text-red-500 text-sm mb-3 mt-2">{searchError}</div>
                        )}
                        
                        {/* Property Price Display Field */}
                        {(showPropertyResult || showManualPriceInput) && (
                          <div className="space-y-2 mt-4">
                            <div className="flex justify-between items-center">
                              <label htmlFor="propertyPriceDisplay" className="block text-sm font-medium text-gray-700">
                                {showPropertyResult 
                                  ? (propertyData?.listingStatus === "forSale" ? "For Sale Price" : "Zestimate") 
                                  : "Property Price"}
                              </label>
                              {showPropertyResult && (
                                <a 
                                  href={propertyData?.zillow_url || `https://www.zillow.com/homes/${encodeURIComponent(propertyAddress)}_rb/`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:text-primary/80 flex items-center"
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" /> View on Zillow
                                </a>
                              )}
                            </div>
                            <div className="relative">
                              <input 
                                type="text" 
                                id="propertyPriceDisplay" 
                                name="propertyPriceDisplay" 
                                placeholder={showManualPriceInput ? "Enter property price" : "Property price will appear here after search"}
                                className="px-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-gray-50"
                                value={showPropertyResult ? `$${propertyPrice.toLocaleString()}` : manualPropertyPrice ? `$${manualPropertyPrice}` : ''}
                                onChange={(e) => {
                                  if (showManualPriceInput) {
                                    const value = e.target.value.replace(/[^0-9]/g, '');
                                    setManualPropertyPrice(value);
                                    setPropertyPrice(parseInt(value) || 0);
                                    setShowPropertyResult(value ? true : false);
                                  }
                                }}
                                readOnly={!showManualPriceInput}
                              />
                            </div>
                          </div>
                        )}

                        {/* Florida Property Information removed as requested */}

                        {showPropertyResult && (
                          <div className="space-y-2 mt-4">
                            <label htmlFor="downPayment" className="block text-sm font-medium text-gray-700">Down Payment (%)</label>
                            <div className="relative">
                              <input 
                                type="number" 
                                id="downPayment" 
                                name="downPayment" 
                                placeholder="20" 
                                min="3" 
                                max="50"
                                className="px-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                value={downPaymentPercent}
                                onChange={(e) => setDownPaymentPercent(parseInt(e.target.value))}
                              />
                            </div>
                          </div>
                        )}
                        
                        {showPropertyResult && creditScore && (
                          <div className="p-3 my-4 bg-gray-50 rounded-md">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Using Credit Score:</span>
                              <span className="font-medium">{creditScore}</span>
                            </div>
                            <div className="flex justify-between text-sm mt-1">
                              <span className="text-gray-600">Yearly Income:</span>
                              <span className="font-medium">${parseInt(yearlyIncome).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm mt-1">
                              <span className="text-gray-600">Monthly Debts:</span>
                              <span className="font-medium">${parseInt(monthlyDebts).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm mt-1">
                              <span className="text-gray-600">Loan Type:</span>
                              <span className="font-medium capitalize">{loanType}</span>
                            </div>
                            <div className="flex justify-between text-sm mt-1">
                              <span className="text-gray-600">Property Type:</span>
                              <span className="font-medium capitalize">{propertyType ? propertyType : 'primary'}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">Using your information from Self Qualify</p>
                          </div>
                        )}
                        
                        {showPropertyResult && (
                          <div className="text-center mt-6">
                            <Button 
                              type="button" 
                              id="calculate-address-button"
                              className="bg-primary hover:bg-primary/90 text-white px-8 py-2 w-full"
                              onClick={handleAddressCalculate}
                            >
                              Calculate Property Qualification <Calculator className="ml-2 h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Address Qualification Results */}
                  {showAddressResults && (
                    <div className="mt-8 p-6 bg-gray-50 rounded-lg">
                      <h3 className="text-xl font-semibold text-primary mb-3">Property Qualification Results</h3>
                      
                      {addressResults.qualification ? (
                        <div className="bg-green-50 p-4 rounded-md mb-4">
                          <p className="font-medium text-green-700">Congratulations! You qualify for this property.</p>
                        </div>
                      ) : (
                        <div className="bg-red-50 p-4 rounded-md mb-4">
                          <p className="font-medium text-red-700">Based on the information provided, you may not qualify for this property.</p>
                          <p className="text-sm text-gray-700 mt-2">Required monthly income: ${addressResults.requiredIncome.toLocaleString()}</p>
                        </div>
                      )}
                      
                      <div className="space-y-3">
                        <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                          <span className="font-medium">
                            {propertyData?.listingStatus === "forSale" ? "Listed Price:" : "Zestimate:"}
                          </span>
                          <span className="font-semibold">${propertyPrice.toLocaleString()}</span>
                        </div>
                        
                        <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                          <span className="font-medium">Down Payment:</span>
                          <span className="font-semibold">${addressResults.downPaymentAmount.toLocaleString()} ({downPaymentPercent}%)</span>
                        </div>
                        
                        <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                          <span className="font-medium">Loan Amount:</span>
                          <span className="text-lg font-bold text-primary">${addressResults.maximumLoanAmount.toLocaleString()}</span>
                        </div>
                        
                        <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                          <span className="font-medium">Estimated Monthly Payment:</span>
                          <span className="font-semibold">${addressResults.estimatedMonthlyPayment.toLocaleString()}</span>
                        </div>
                        
                        <div className="mt-4 bg-blue-50 p-3 rounded-md">
                          <h4 className="font-semibold text-primary mb-2">Monthly Payment Breakdown:</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm">Principal & Interest:</span>
                              <span className="font-medium">${addressResults.principalAndInterest.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm">
                                Property Tax
                                {addressResults.customTaxEstimate && (
                                  <span className="text-sm font-normal text-gray-600"> (</span>
                                )}
                                {addressResults.customTaxEstimate && (
                                  <a 
                                    href="https://gis.hcpafl.org/propertysearch/taxestimator.aspx" 
                                    target="_blank"
                                    rel="noopener noreferrer" 
                                    className="text-sm font-normal text-primary hover:text-primary/80"
                                  >
                                    Hillsborough data
                                  </a>
                                )}
                                {addressResults.customTaxEstimate && (
                                  <span className="text-sm font-normal text-gray-600">):</span>
                                )}
                                {!addressResults.customTaxEstimate && (
                                  <span>:</span>
                                )}
                              </span>
                              <span className="font-medium">${addressResults.propertyTax.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm">Homeowners Insurance:</span>
                              <span className="font-medium">${addressResults.homeownersInsurance.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center border-t border-blue-200 pt-2 mt-2">
                              <span className="font-medium">Total Monthly Payment:</span>
                              <span className="font-bold">${addressResults.estimatedMonthlyPayment.toLocaleString()}</span>
                            </div>
                          </div>
                          
                          {selectedState === 'FL' && !addressResults.customTaxEstimate && (
                            <div className="mt-2 text-xs text-amber-700 italic">
                              * Florida properties include higher property tax (1.5%) and homeowners insurance (0.75%) rates
                            </div>
                          )}
                          
                          {addressResults.customTaxEstimate && (
                            <div className="mt-2 text-xs text-green-700 italic">
                              * Using precise property tax data from the Hillsborough County Property Appraiser
                              {propertyType === 'primary' && (
                                <span className="block mt-1">* Includes homestead exemption benefits for primary residences</span>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                          <span className="font-medium">Estimated Interest Rate:</span>
                          <div className="flex items-center">
                            <span>{addressResults.interestRate.toFixed(2)}%</span>
                            <a href="https://www.mortgagenewsdaily.com/mortgage-rates" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 ml-2 text-xs underline flex items-center">
                              <ExternalLink className="h-3 w-3 mr-1" /> View current rates
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>  
        </div>

        {/* Resource Cards */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-primary mb-6">Mortgage Resources</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {resources.map((resource, index) => (
              <Card key={index} className="overflow-hidden hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="flex items-start">
                    <div className="mr-4">
                      {resource.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-2">{resource.title}</h3>
                      <p className="text-gray-600 mb-4">{resource.description}</p>
                      <Button variant="outline" asChild className="gap-2">
                        <Link to={resource.link}>
                          {resource.cta} <Download className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Mortgage Types */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-primary mb-6">Mortgage Options</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {mortgageTypes.map((type, index) => (
              <Card key={index} className="overflow-hidden hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="mb-4">
                    {type.icon}
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{type.title}</h3>
                  <p className="text-gray-600 text-sm">{type.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Call to Action */}
        <div className="mt-12 bg-gradient-to-r from-primary to-secondary text-white p-8 rounded-lg">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Ready to Get Started?</h2>
            <p className="mb-6 max-w-2xl mx-auto">Connect with our mortgage experts to get personalized advice and find the perfect loan for your needs.</p>
            <Button asChild className="bg-white text-primary hover:bg-gray-100">
              <Link to="/contact">
                Contact Our Mortgage Team <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}