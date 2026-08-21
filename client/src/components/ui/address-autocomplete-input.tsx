import { Input } from "@/components/ui/input";
import { useGooglePlaces } from "@/hooks/use-google-places";

interface AddressAutocompleteInputProps extends Omit<React.ComponentProps<typeof Input>, "onChange"> {
  value: string;
  /** Fired on both manual typing and autocomplete selection. */
  onValueChange: (address: string) => void;
}

export function AddressAutocompleteInput({ value, onValueChange, ...inputProps }: AddressAutocompleteInputProps) {
  const { bindInputRef } = useGooglePlaces({
    onPlaceSelected: place => onValueChange(place.formatted_address),
  });

  return (
    <Input
      {...inputProps}
      ref={bindInputRef}
      type="text"
      autoComplete="off"
      value={value}
      onChange={e => onValueChange(e.target.value)}
    />
  );
}
