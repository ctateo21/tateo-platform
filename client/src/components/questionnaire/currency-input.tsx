import { useState, useEffect, ChangeEvent } from "react";
import { Input } from "@/components/ui/input";

interface CurrencyInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  showCents?: boolean;
}

export default function CurrencyInput({
  value,
  onChange,
  placeholder = "$",
  className = "",
  showCents = false,
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
          setDisplayValue(formatCurrency(numericValue));
        } else {
          setDisplayValue(value);
        }
      }
    } else {
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

  const handleBlur = () => {
    // Auto-format as currency when user finishes typing
    const numericValue = displayValue.replace(/[$,]/g, "");
    if (numericValue && !isNaN(parseFloat(numericValue))) {
      const parsedValue = parseFloat(numericValue);
      if (showCents) {
        // Round to nearest penny for hourly rates
        const rounded = Math.round(parsedValue * 100) / 100;
        setDisplayValue(formatCurrency(rounded));
        onChange(rounded.toString());
      } else {
        // Round to whole number for other currency amounts
        const rounded = Math.round(parsedValue);
        setDisplayValue(formatCurrency(rounded));
        onChange(rounded.toString());
      }
    }
  };

  // Format number as currency
  const formatCurrency = (num: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: showCents ? 2 : 0,
      maximumFractionDigits: showCents ? 2 : 0,
    }).format(num);
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