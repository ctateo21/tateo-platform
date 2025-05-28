import { useState, useEffect, ChangeEvent } from "react";
import { Input } from "@/components/ui/input";

interface NumberInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  roundToWhole?: boolean;
}

export default function NumberInput({
  value,
  onChange,
  placeholder = "",
  className = "",
  roundToWhole = true,
}: NumberInputProps) {
  const [displayValue, setDisplayValue] = useState("");

  // Format the value for display when the component mounts or value changes
  useEffect(() => {
    if (value) {
      const numericValue = parseFloat(value);
      if (!isNaN(numericValue)) {
        if (roundToWhole) {
          setDisplayValue(Math.round(numericValue).toString());
        } else {
          setDisplayValue(numericValue.toString());
        }
      } else {
        setDisplayValue(value);
      }
    } else {
      setDisplayValue("");
    }
  }, [value, roundToWhole]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    // Only allow numeric input
    if (inputValue === "" || /^\d*\.?\d*$/.test(inputValue)) {
      setDisplayValue(inputValue);
      onChange(inputValue);
    }
  };

  const handleBlur = () => {
    // Round to whole number when user finishes typing (for hours)
    if (displayValue && !isNaN(parseFloat(displayValue))) {
      const parsedValue = parseFloat(displayValue);
      if (roundToWhole) {
        const rounded = Math.round(parsedValue);
        setDisplayValue(rounded.toString());
        onChange(rounded.toString());
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