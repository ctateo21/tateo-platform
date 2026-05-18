import { useState } from "react";
import { Input } from "@/components/ui/input";

interface PercentInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  max?: number;
  "data-testid"?: string;
}

export function PercentInput({ value, onChange, placeholder, max = 25, "data-testid": testId }: PercentInputProps) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState("");

  const displayValue = focused ? raw : value === 0 ? "" : value.toFixed(3);

  return (
    <div className="relative">
      <Input
        data-testid={testId}
        className="pr-7"
        value={displayValue}
        placeholder={placeholder}
        onFocus={() => { setRaw(value === 0 ? "" : value.toFixed(3)); setFocused(true); }}
        onBlur={() => {
          const parsed = parseFloat(raw);
          if (!isNaN(parsed) && parsed >= 0 && parsed <= max) onChange(parsed);
          setFocused(false);
        }}
        onChange={(e) => setRaw(e.target.value.replace(/[^0-9.]/g, ""))}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
    </div>
  );
}
