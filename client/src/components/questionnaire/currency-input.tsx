import { useState, useEffect, ChangeEvent } from "react";
import { Input } from "@/components/ui/input";

interface CurrencyInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function CurrencyInput({
  value,
  onChange,
  placeholder = "$",
  className = "",
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState("");

  // Format the value for display when the component mounts or value changes
  useEffect(() => {
    if (value) {
      // If it's already formatted (contains $ or commas), use as is
      if (value.includes("$") || value.includes(",")) {
        setDisplayValue(value);
      } else {
        // Format the numeric value
        const numericValue = parseFloat(value);
        if (!isNaN(numericValue)) {
          setDisplayValue(formatCurrency(Math.round(numericValue)));
        } else {
          setDisplayValue(value);
        }
      }
    } else {
      // Default to showing $ placeholder
      setDisplayValue("");
    }
  }, [value]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    // Update the display value immediately for a responsive feel
    setDisplayValue(inputValue);
    
    // Strip non-numeric characters and pass the raw number to onChange
    const numericValue = inputValue.replace(/[$,]/g, "");
    onChange(numericValue);
  };

  // Format number as currency
  const formatCurrency = (num: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  // When input loses focus, format the value
  const handleBlur = () => {
    if (displayValue) {
      // Remove existing formatting
      const numericValue = displayValue.replace(/[$,]/g, "");
      const parsedValue = parseFloat(numericValue);
      
      if (!isNaN(parsedValue)) {
        setDisplayValue(formatCurrency(parsedValue));
      }
    }
  };

  return (
    <Input
      type="text"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
    />
  );
}