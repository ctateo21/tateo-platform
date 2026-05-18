import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, TrendingDown, TrendingUp, Minus, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface LiveRate {
  name: string;
  rate: number;
  change: number;
  type: string;
  lastUpdated: string;
}

interface LiveRatesResponse {
  rates: LiveRate[];
  source: string;
  disclaimer: string;
  asOf: string;
}

const TYPE_COLORS: Record<string, string> = {
  Conventional: "bg-blue-100 text-blue-800",
  FHA:          "bg-green-100 text-green-800",
  VA:           "bg-purple-100 text-purple-800",
  Jumbo:        "bg-orange-100 text-orange-800",
  ARM:          "bg-amber-100 text-amber-800",
};

function ChangeIndicator({ change }: { change: number }) {
  if (change > 0) return <span className="flex items-center gap-0.5 text-xs text-red-500 font-medium"><TrendingUp className="h-3 w-3" />+{change.toFixed(2)}</span>;
  if (change < 0) return <span className="flex items-center gap-0.5 text-xs text-green-600 font-medium"><TrendingDown className="h-3 w-3" />{change.toFixed(2)}</span>;
  return <span className="flex items-center gap-0.5 text-xs text-muted-foreground font-medium"><Minus className="h-3 w-3" />0.00</span>;
}

function RateTile({ rate, isSelected, onSelect }: { rate: LiveRate; isSelected: boolean; onSelect: () => void }) {
  const typeColor = TYPE_COLORS[rate.type] ?? "bg-gray-100 text-gray-700";
  return (
    <button
      onClick={onSelect}
      className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-md border transition-colors text-center w-full ${isSelected ? "border-primary bg-accent" : "border-border bg-background hover:bg-accent/50"}`}
    >
      <p className="font-medium text-xs leading-tight text-muted-foreground">{rate.name}</p>
      <p className="text-2xl font-bold leading-none">{rate.rate.toFixed(2)}%</p>
      <ChangeIndicator change={rate.change} />
      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${typeColor}`}>{rate.type}</span>
    </button>
  );
}

interface LiveRatesCardProps {
  onSelectRate: (rate: number) => void;
  selectedRate?: number;
  className?: string;
}

export function LiveRatesCard({ onSelectRate, selectedRate, className }: LiveRatesCardProps) {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<LiveRatesResponse>({
    queryKey: ["/api/rates"],
    staleTime: 15 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2"><TrendingDown className="h-5 w-5" />Today's Rates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex flex-col items-center gap-2 p-3 rounded-md border">
                <Skeleton className="h-3 w-16" /><Skeleton className="h-7 w-14" /><Skeleton className="h-3 w-10" /><Skeleton className="h-4 w-12 rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3"><CardTitle className="text-lg flex items-center gap-2"><TrendingDown className="h-5 w-5" />Today's Rates</CardTitle></CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-muted-foreground text-sm mb-3">Unable to load live rates</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4 mr-2" />Retry</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-lg flex items-center gap-2"><TrendingDown className="h-5 w-5" />Today's Rates</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">As of {data.asOf} · Click a rate to use it</p>
          </div>
          <div className="flex items-center gap-3">
            <a href="https://www.mortgagenewsdaily.com/mortgage-rates" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
              <ExternalLink className="h-3 w-3" />{data.source}
            </a>
            <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {data.rates.filter(r => r.name !== "7/6 SOFR ARM" && r.name !== "15 Yr. Fixed").map(rate => (
            <RateTile key={rate.name} rate={rate} isSelected={selectedRate === rate.rate} onSelect={() => onSelectRate(rate.rate)} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
