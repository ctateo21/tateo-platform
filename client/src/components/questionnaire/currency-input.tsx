import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";

interface CurrencyInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  id?: string;
  name?: string;
}

export default function CurrencyInput({
  value,
  onChange,
  className,
  placeholder = "$",
  id,
  name,
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState("");

  // Format the input value as currency
  useEffect(() => {
    // Only format if there's a value and it's numeric
    if (value && !isNaN(Number(value))) {
      const numericValue = parseFloat(value);
      // Format as currency with commas
      const formattedValue = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(numericValue);
      
      setDisplayValue(formattedValue);
    } else {
      setDisplayValue(value);
    }
  }, [value]);

  // Handle input changes - strip formatting and update parent
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    
    // Remove all non-numeric characters
    const numericValue = rawValue.replace(/[^0-9]/g, '');
    
    // Update the parent with clean numeric value
    onChange(numericValue);
  };

  return (
    <Input
      type="text"
      value={displayValue}
      onChange={handleChange}
      className={className}
      placeholder={placeholder}
      id={id}
      name={name}
    />
  );
}