import { useState } from "react";
import { Input } from "@/components/ui/input";

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  "data-testid"?: string;
}

export function CurrencyInput({ value, onChange, placeholder, "data-testid": testId }: CurrencyInputProps) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState("");

  const displayValue = focused ? raw : value === 0 ? "" : value.toLocaleString("en-US");

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
      <Input
        data-testid={testId}
        className="pl-7"
        value={displayValue}
        placeholder={placeholder}
        onFocus={() => { setRaw(value === 0 ? "" : String(value)); setFocused(true); }}
        onBlur={() => {
          const parsed = parseFloat(raw.replace(/,/g, ""));
          if (!isNaN(parsed) && parsed >= 0) onChange(parsed);
          else if (raw === "") onChange(0);
          setFocused(false);
        }}
        onChange={(e) => setRaw(e.target.value.replace(/[^0-9.]/g, ""))}
      />
    </div>
  );
}
