import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Home, MapPin, Calendar, TrendingDown, Eye, Heart, Flame,
  CheckCircle2, Circle, AlertTriangle, BarChart3, Info, FileText, LogIn,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ListingStatusFilter } from "@/lib/seller-dashboard";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/context/auth-context";
import {
  fetchMyListings, fetchListingRecaps, fetchMyListingStatusCounts,
  fmtMoney, fmtDate, domColor, heatColor, statusColor,
  type Listing, type WeeklyRecap, type ListingStatusCounts,
} from "@/lib/seller-dashboard";

function HelpTip({ text }: { text: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-3.5 w-3.5 text-muted-foreground/60 inline-block ml-1 cursor-help" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function MetricCard({
  label, value, sub, color, tip, icon,
}: { label: string; value: React.ReactNode; sub?: string; color?: string; tip?: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}{tip && <HelpTip text={tip} />}
        </p>
        {icon}
      </div>
      <p className={`text-2xl font-bold ${color ?? "text-foreground"}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function PriceRangeBar({ low, high, current }: { low: number; high: number; current: number }) {
  // Anchor the bar to span min..max of (low, high, current) so the marker is
  // always inside the visible track.
  const min = Math.min(low, current);
  const max = Math.max(high, current);
  const span = Math.max(1, max - min);
  const lowPct = ((low - min) / span) * 100;
  const highPct = ((high - min) / span) * 100;
  const curPct = ((current - min) / span) * 100;
  return (
    <div className="mt-3">
      <div className="relative h-3 bg-muted rounded-full overflow-hidden">
        <div
          className="absolute h-full bg-emerald-200"
          style={{ left: `${lowPct}%`, width: `${Math.max(0, highPct - lowPct)}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded"
          style={{ left: `calc(${curPct}% - 2px)` }}
          title="Current list price"
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground mt-1">
        <span>{fmtMoney(low)}</span>
        <span className="font-semibold text-primary">List: {fmtMoney(current)}</span>
        <span>{fmtMoney(high)}</span>
      </div>
    </div>
  );
}

function EngagementCard({
  platform, views, viewsLabel, saves, savesLabel, heatPct, hot, baseline,
}: {
  platform: string;
  views: number | null;
  viewsLabel: string;
  saves: number | null;
  savesLabel: string;
  heatPct?: number | null;
  hot?: boolean | null;
  baseline: number; // baseline value for the "fresh comp" comparison
}) {
  const pct = views != null ? Math.min(100, Math.max(0, (views / baseline) * 100)) : 0;
  const barColor = pct >= 75 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-semibold text-sm">{platform}</p>
        {hot && <Badge className="bg-red-100 text-red-800 border-red-200 gap-1"><Flame className="h-3 w-3" />Hot Home</Badge>}
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{viewsLabel}:</span>
          <span className="ml-auto font-semibold tabular-nums">{views ?? "—"}</span>
        </div>
        <div className="flex items-center gap-2">
          <Heart className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{savesLabel}:</span>
          <span className="ml-auto font-semibold tabular-nums">{saves ?? "—"}</span>
        </div>
        {views != null && (
          <div className="pt-2">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
              <span>vs. fresh listing</span>
              <span className="tabular-nums">{Math.round(pct)}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
        {heatPct != null && (
          <div className="flex items-center gap-2 pt-2 border-t">
            <Flame className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Interest Score<HelpTip text="Saves divided by views — how strongly viewers respond." />:
            </span>
            <span className={`ml-auto font-bold ${heatColor(heatPct)}`}>{heatPct.toFixed(1)}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

function BenchmarkStrip() {
  const items = [
    { label: "250+ daily views", value: "Pending in ~1 week", color: "text-emerald-600" },
    { label: "5+ daily saves", value: "Under contract in a week", color: "text-emerald-600" },
    { label: "<1 save/day", value: "30+ days expected", color: "text-amber-600" },
    { label: "<25 views/day", value: "Pricing/presentation issue", color: "text-red-600" },
  ];
  return (
    <div className="rounded-lg border bg-muted/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
        <BarChart3 className="h-3.5 w-3.5" /> What the Numbers Mean
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
        {items.map(i => (
          <div key={i.label} className="rounded-md bg-background border px-3 py-2">
            <p className="font-semibold">{i.label}</p>
            <p className={i.color}>{i.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ListingView({ listing, recaps }: { listing: Listing; recaps: WeeklyRecap[] }) {
  const latest = recaps[0];
  const history = recaps.slice(1);
  const fullAddress = `${listing.address}${listing.unit ? ` ${listing.unit}` : ""}, ${listing.city}, ${listing.state} ${listing.zip}`;

  return (
    <div className="space-y-6">
      {/* 1. Overview */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <h2 className="text-xl font-bold leading-tight">{fullAddress}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {listing.mls_number && <span>MLS #{listing.mls_number}</span>}
                {listing.community && <><span>·</span><span>{listing.community}</span></>}
                {listing.list_date && <><span>·</span><span>Listed {fmtDate(listing.list_date)}</span></>}
              </div>
            </div>
            <Badge variant="outline" className={`text-sm capitalize ${statusColor(listing.status)}`}>
              {listing.status}
            </Badge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5">
            <MetricCard label="List Price" value={fmtMoney(listing.list_price)} color="text-primary" />
            <MetricCard label="Beds" value={listing.beds ?? "—"} />
            <MetricCard label="Baths" value={listing.baths ?? "—"} />
            <MetricCard label="Sqft" value={listing.sqft?.toLocaleString() ?? "—"} />
            <MetricCard
              label="Days on Market"
              value={latest?.days_on_market ?? "—"}
              sub={latest?.avg_market_dom != null ? `Avg: ${latest.avg_market_dom}` : undefined}
              color={domColor(latest?.days_on_market ?? null, latest?.avg_market_dom ?? null)}
              tip="How long your home has been listed vs. the average for comparable homes."
            />
          </div>
        </CardContent>
      </Card>

      {!latest && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Your agent hasn't published a weekly recap yet. Check back soon.
          </CardContent>
        </Card>
      )}

      {latest && (
        <>
          {/* 2. Price Analysis */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-primary" /> Price Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <MetricCard label="Current List" value={fmtMoney(latest.list_price ?? listing.list_price)} color="text-primary" />
                <MetricCard
                  label="Recommended Range"
                  value={
                    latest.recommended_price_low && latest.recommended_price_high
                      ? `${fmtMoney(latest.recommended_price_low)} – ${fmtMoney(latest.recommended_price_high)}`
                      : "—"
                  }
                  color="text-emerald-700"
                />
                <MetricCard
                  label="Projected Sale"
                  value={
                    latest.projected_sale_low && latest.projected_sale_high
                      ? `${fmtMoney(latest.projected_sale_low)} – ${fmtMoney(latest.projected_sale_high)}`
                      : "—"
                  }
                />
              </div>

              {latest.projected_sale_low && latest.projected_sale_high && (
                <PriceRangeBar
                  low={latest.projected_sale_low}
                  high={latest.projected_sale_high}
                  current={latest.list_price ?? listing.list_price}
                />
              )}

              {latest.price_drop_rationale && (
                <div className="rounded-lg border-l-4 border-amber-500 bg-amber-50 p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-amber-900 mb-1">Price Adjustment Recommended</p>
                      <p className="text-sm text-amber-900/80">{latest.price_drop_rationale}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 3. Market Comps */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Comparable Properties</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-muted-foreground border-b">
                    <tr>
                      <th className="text-left py-2 pr-3">Address</th>
                      <th className="text-right py-2 px-3">Price</th>
                      <th className="text-right py-2 px-3">DOM</th>
                      <th className="text-center py-2 pl-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3].map(n => {
                      const addr = (latest as any)[`comp_${n}_address`];
                      const price = (latest as any)[`comp_${n}_price`];
                      const dom = (latest as any)[`comp_${n}_dom`];
                      const status = (latest as any)[`comp_${n}_status`];
                      if (!addr) return null;
                      return (
                        <tr key={n} className="border-b last:border-0">
                          <td className="py-3 pr-3 font-medium">{addr}</td>
                          <td className="py-3 px-3 text-right tabular-nums">{fmtMoney(price)}</td>
                          <td className="py-3 px-3 text-right tabular-nums">{dom ?? "—"}</td>
                          <td className="py-3 pl-3 text-center">
                            <Badge variant="outline" className={`capitalize text-xs ${statusColor(status)}`}>
                              {status ?? "—"}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Mobile cards */}
              <div className="sm:hidden space-y-2">
                {[1, 2, 3].map(n => {
                  const addr = (latest as any)[`comp_${n}_address`];
                  const price = (latest as any)[`comp_${n}_price`];
                  const dom = (latest as any)[`comp_${n}_dom`];
                  const status = (latest as any)[`comp_${n}_status`];
                  if (!addr) return null;
                  return (
                    <div key={n} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="font-medium text-sm flex-1">{addr}</p>
                        <Badge variant="outline" className={`capitalize text-[10px] ${statusColor(status)}`}>{status ?? "—"}</Badge>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Price: <span className="font-semibold text-foreground tabular-nums">{fmtMoney(price)}</span></span>
                        <span>DOM: <span className="font-semibold text-foreground tabular-nums">{dom ?? "—"}</span></span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {(latest.market_inventory_months != null || latest.market_median_price != null || latest.market_sale_to_list_pct != null) && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t">
                  <MetricCard
                    label="Months of Inventory"
                    value={latest.market_inventory_months != null ? `${latest.market_inventory_months}` : "—"}
                    tip="How many months it would take to sell all current inventory at the current sales pace."
                  />
                  <MetricCard
                    label="Median Sale Price"
                    value={fmtMoney(latest.market_median_price)}
                  />
                  <MetricCard
                    label="Sale-to-List %"
                    value={latest.market_sale_to_list_pct != null ? `${latest.market_sale_to_list_pct}%` : "—"}
                    tip="What homes actually sell for as a percentage of their list price."
                  />
                </div>
              )}

              {latest.market_summary && (
                <p className="text-sm text-muted-foreground mt-4 italic">{latest.market_summary}</p>
              )}
            </CardContent>
          </Card>

          {/* 4. Online Engagement */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Online Interest</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <EngagementCard
                  platform="Zillow"
                  views={latest.zillow_daily_views_est}
                  viewsLabel="Daily views"
                  saves={latest.zillow_daily_saves_est}
                  savesLabel="Daily saves"
                  heatPct={latest.zillow_heat_index_est}
                  baseline={250}
                />
                <EngagementCard
                  platform="Realtor.com"
                  views={latest.realtor_weekly_views_est}
                  viewsLabel="Weekly views"
                  saves={latest.realtor_weekly_saves_est}
                  savesLabel="Weekly saves"
                  baseline={500}
                />
                <EngagementCard
                  platform="Redfin"
                  views={latest.redfin_weekly_views_est}
                  viewsLabel="Weekly views"
                  saves={null}
                  savesLabel="Saves"
                  hot={latest.redfin_hot_home}
                  baseline={400}
                />
              </div>

              {latest.engagement_summary && (
                <div className="rounded-lg bg-muted/40 p-4">
                  <p className="text-sm leading-relaxed">{latest.engagement_summary}</p>
                </div>
              )}

              <BenchmarkStrip />
            </CardContent>
          </Card>

          {/* 5. Next Steps */}
          {latest.next_steps && latest.next_steps.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Next Steps</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {latest.next_steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Circle className="h-4 w-4 text-amber-500 mt-1 shrink-0" />
                      <span className="text-sm">{step}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {latest.agent_notes && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" /> Note from Your Agent
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{latest.agent_notes}</p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* 6. Weekly Recap History */}
      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Past Recaps</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible>
              {history.map(r => (
                <AccordionItem key={r.id} value={r.id}>
                  <AccordionTrigger>
                    <div className="flex items-center gap-4 text-sm w-full pr-4">
                      <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-semibold">{fmtDate(r.recap_date)}</span>
                      <span className="text-muted-foreground">DOM: {r.days_on_market ?? "—"}</span>
                      <span className="text-muted-foreground">List: {fmtMoney(r.list_price)}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {r.market_summary && <p className="text-sm mb-2"><span className="font-semibold">Market: </span>{r.market_summary}</p>}
                    {r.engagement_summary && <p className="text-sm mb-2"><span className="font-semibold">Engagement: </span>{r.engagement_summary}</p>}
                    {r.agent_notes && <p className="text-sm italic text-muted-foreground">{r.agent_notes}</p>}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const STATUS_FILTERS: { value: ListingStatusFilter; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "sold", label: "Sold" },
  { value: "all", label: "All" },
];

export default function SellerDashboardPage() {
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ListingStatusFilter>("active");

  const { data: listings, isLoading, error } = useQuery<Listing[]>({
    queryKey: ["seller-dashboard", "listings", user?.id, statusFilter],
    queryFn: () => fetchMyListings(statusFilter),
    enabled: !!user,
  });

  const { data: statusCounts } = useQuery<ListingStatusCounts>({
    queryKey: ["seller-dashboard", "status-counts", user?.id],
    queryFn: fetchMyListingStatusCounts,
    enabled: !!user,
  });

  useEffect(() => {
    if (!listings) return;
    if (listings.length === 0) {
      if (selectedId) setSelectedId(null);
      return;
    }
    if (!selectedId || !listings.some(l => l.id === selectedId)) {
      setSelectedId(listings[0].id);
    }
  }, [listings, selectedId]);

  const activeListing = useMemo(
    () => listings?.find(l => l.id === selectedId) ?? listings?.[0] ?? null,
    [listings, selectedId]
  );

  const { data: recaps } = useQuery<WeeklyRecap[]>({
    queryKey: ["seller-dashboard", "recaps", activeListing?.id],
    queryFn: () => fetchListingRecaps(activeListing!.id, true),
    enabled: !!activeListing,
  });

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-md text-center">
        <Home className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Seller Dashboard</h1>
        <p className="text-muted-foreground mb-6">Log in to view your active listings and weekly recaps from your agent.</p>
        <Button asChild>
          <Link href="/"><LogIn className="h-4 w-4 mr-2" />Go to Home</Link>
        </Button>
      </div>
    );
  }

  const lastUpdated = listings?.[0]?.last_updated;

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-6 gap-3">
        <div>
          <h1 className="text-3xl font-bold text-primary">My Listings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Welcome back, {user.name.split(" ")[0]} · {listings?.length ?? 0}
            {statusFilter === "all" ? " " : ` ${statusFilter} `}
            listing{(listings?.length ?? 0) === 1 ? "" : "s"}
          </p>
        </div>
        {lastUpdated && (
          <Badge variant="outline" className="text-xs gap-1.5 w-fit">
            <Calendar className="h-3 w-3" /> Last updated {fmtDate(lastUpdated)}
          </Badge>
        )}
      </div>

      <Tabs
        value={statusFilter}
        onValueChange={(v) => setStatusFilter(v as ListingStatusFilter)}
        className="mb-4"
      >
        <TabsList className="flex-wrap h-auto">
          {STATUS_FILTERS.map(f => {
            const count = statusCounts?.[f.value];
            return (
              <TabsTrigger key={f.value} value={f.value} data-testid={`filter-${f.value}`} className="gap-1.5">
                {f.label}
                {count != null && (
                  <Badge
                    variant="secondary"
                    className="h-5 min-w-5 px-1.5 text-[11px] tabular-nums rounded-full"
                    data-testid={`filter-count-${f.value}`}
                  >
                    {count}
                  </Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {isLoading && (
        <div className="py-16 text-center text-muted-foreground">Loading your listings…</div>
      )}

      {error && (
        <Card>
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-3" />
            <p className="font-semibold mb-1">Couldn't load your listings</p>
            <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && (!listings || listings.length === 0) && (
        <Card>
          <CardContent className="p-12 text-center">
            <Home className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="font-semibold mb-1">
              {statusFilter === "active" && "No active listings yet"}
              {statusFilter === "pending" && "No pending listings"}
              {statusFilter === "sold" && "No sold listings yet"}
              {statusFilter === "all" && "No listings yet"}
            </p>
            <p className="text-sm text-muted-foreground">
              {statusFilter === "active"
                ? "Your agent will add your listing here once it goes live."
                : "Try a different status filter to see other listings."}
            </p>
          </CardContent>
        </Card>
      )}

      {listings && listings.length > 1 && (
        <Tabs value={activeListing?.id ?? ""} onValueChange={setSelectedId} className="mb-6">
          <TabsList className="flex-wrap h-auto">
            {listings.map(l => (
              <TabsTrigger key={l.id} value={l.id} className="text-xs">
                {l.address}{l.unit ? ` ${l.unit}` : ""}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {activeListing && <ListingView listing={activeListing} recaps={recaps ?? []} />}
    </div>
  );
}
