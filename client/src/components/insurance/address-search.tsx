import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Home, Loader2, SearchIcon } from "lucide-react";

interface AddressSearchProps {
  onAddressSelected: (address: string, placeId?: string) => void;
}

export default function AddressSearch({ onAddressSelected }: AddressSearchProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (address) {
      setLoading(true);
      // In a real implementation, we'd validate the address
      // For now, we'll just pass it to the parent component
      onAddressSelected(address);
      setLoading(false);
    }
  };

  return (
    <Card className="w-full bg-white shadow-sm border-0">
      <CardContent className="p-6">
        <div className="mb-4">
          <h3 className="text-xl font-semibold text-primary flex items-center">
            <Home className="mr-2 h-5 w-5" /> 
            Enter Your Property Address
          </h3>
          <p className="text-gray-600 mt-1">
            We'll help you find insurance coverage options tailored to your property.
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Input
              type="text"
              placeholder="Enter your property address"
              className="pr-10 h-12 border-gray-300"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <Button 
            type="submit" 
            className="bg-primary hover:bg-primary/90 text-white w-full h-12"
            disabled={loading || !address}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <SearchIcon className="mr-2 h-4 w-4" />
                Find Insurance Options
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
