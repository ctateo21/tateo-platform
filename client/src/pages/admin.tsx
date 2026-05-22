import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  Home, Plus, Pencil, Trash2, ArrowLeft, Save, Eye, EyeOff,
  AlertTriangle, FileText, Sparkles, RefreshCw, UserPlus, Users,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListingView } from "@/pages/seller-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import {
  fetchAllListingsWithSellers, fetchListingRecaps, fetchSellers,
  upsertListing, deleteListing, upsertRecap, deleteRecap,
  fmtMoney, fmtDate, statusColor,
  type Listing, type WeeklyRecap, type SellerProfile,
} from "@/lib/seller-dashboard";

type ListingRow = Awaited<ReturnType<typeof fetchAllListingsWithSellers>>[number];

// ── Listing form ─────────────────────────────────────────────────────
function ListingFormDialog({
  trigger, sellers, initial, onSaved,
}: {
  trigger: React.ReactNode;
  sellers: SellerProfile[];
  initial?: Listing;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const [form, setForm] = useState(() => ({
    id: initial?.id,
    seller_id: initial?.seller_id ?? "",
    address: initial?.address ?? "",
    unit: initial?.unit ?? "",
    city: initial?.city ?? "",
    state: initial?.state ?? "FL",
    zip: initial?.zip ?? "",
    mls_number: initial?.mls_number ?? "",
    list_price: initial?.list_price ?? 0,
    beds: initial?.beds ?? 0,
    baths: initial?.baths ?? 0,
    sqft: initial?.sqft ?? 0,
    community: initial?.community ?? "",
    status: initial?.status ?? "active",
    list_date: initial?.list_date ?? new Date().toISOString().slice(0, 10),
  }));

  const save = useMutation({
    mutationFn: () => upsertListing({
      ...form,
      unit: form.unit || null,
      mls_number: form.mls_number || null,
      community: form.community || null,
      beds: Number(form.beds) || null,
      baths: Number(form.baths) || null,
      sqft: Number(form.sqft) || null,
    } as any),
    onSuccess: () => {
      toast({ title: "Listing saved" });
      setOpen(false);
      onSaved();
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Listing" : "Add Listing"}</DialogTitle>
          <DialogDescription>Link a property to a seller account.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Seller</Label>
            <Select value={form.seller_id} onValueChange={v => setForm({ ...form, seller_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select seller" /></SelectTrigger>
              <SelectContent>
                {sellers.length === 0 && <SelectItem value="__none" disabled>No sellers yet</SelectItem>}
                {sellers.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name} — {s.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Street Address</Label>
            <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
          </div>
          <div><Label>Unit</Label><Input value={form.unit ?? ""} onChange={e => setForm({ ...form, unit: e.target.value })} /></div>
          <div><Label>MLS #</Label><Input value={form.mls_number ?? ""} onChange={e => setForm({ ...form, mls_number: e.target.value })} /></div>
          <div><Label>City</Label><Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
          <div><Label>State</Label><Input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} /></div>
          <div><Label>Zip</Label><Input value={form.zip} onChange={e => setForm({ ...form, zip: e.target.value })} /></div>
          <div><Label>Community</Label><Input value={form.community ?? ""} onChange={e => setForm({ ...form, community: e.target.value })} /></div>
          <div><Label>List Price</Label><Input type="number" value={form.list_price} onChange={e => setForm({ ...form, list_price: Number(e.target.value) })} /></div>
          <div><Label>List Date</Label><Input type="date" value={form.list_date ?? ""} onChange={e => setForm({ ...form, list_date: e.target.value })} /></div>
          <div><Label>Beds</Label><Input type="number" value={form.beds ?? 0} onChange={e => setForm({ ...form, beds: Number(e.target.value) })} /></div>
          <div><Label>Baths</Label><Input type="number" step="0.5" value={form.baths ?? 0} onChange={e => setForm({ ...form, baths: Number(e.target.value) })} /></div>
          <div><Label>Sqft</Label><Input type="number" value={form.sqft ?? 0} onChange={e => setForm({ ...form, sqft: Number(e.target.value) })} /></div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="sold">Sold</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.seller_id || !form.address || !form.city}>
            <Save className="h-4 w-4 mr-2" />Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Recap editor (collapsible card per recap) ────────────────────────
function RecapEditor({ recap, listingId, onSaved }: {
  recap?: WeeklyRecap;
  listingId: string;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const isNew = !recap;
  const [form, setForm] = useState<Partial<WeeklyRecap>>(() => recap ?? {
    listing_id: listingId,
    recap_date: new Date().toISOString().slice(0, 10),
    published: false,
    next_steps: [],
  });
  const [nextStepsText, setNextStepsText] = useState((form.next_steps ?? []).join("\n"));

  const upd = (patch: Partial<WeeklyRecap>) => setForm(f => ({ ...f, ...patch }));
  const num = (v: string) => v === "" ? null : Number(v);

  const save = useMutation({
    mutationFn: (publish?: boolean) => upsertRecap({
      ...form,
      listing_id: listingId,
      next_steps: nextStepsText.split("\n").map(s => s.trim()).filter(Boolean),
      published: publish ?? form.published ?? false,
    } as any),
    onSuccess: (_d, publish) => {
      toast({ title: publish ? "Recap published" : "Recap saved" });
      onSaved();
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: () => deleteRecap(recap!.id),
    onSuccess: () => { toast({ title: "Recap deleted" }); onSaved(); },
  });

  return (
    <Card className={form.published ? "border-emerald-300" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {form.published ? <Eye className="h-4 w-4 text-emerald-600" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
            {isNew ? "New Recap" : `Recap — ${fmtDate(form.recap_date as string)}`}
          </CardTitle>
          {form.published && <Badge className="bg-emerald-100 text-emerald-800">Published</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="edit">
          <TabsList className="mb-4">
            <TabsTrigger value="edit"><Pencil className="h-3.5 w-3.5 mr-1.5" />Edit</TabsTrigger>
            <TabsTrigger value="preview"><Eye className="h-3.5 w-3.5 mr-1.5" />Preview as Seller</TabsTrigger>
          </TabsList>
          <TabsContent value="edit" className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><Label>Recap Date</Label><Input type="date" value={form.recap_date ?? ""} onChange={e => upd({ recap_date: e.target.value })} /></div>
          <div><Label>Days on Market</Label><Input type="number" value={form.days_on_market ?? ""} onChange={e => upd({ days_on_market: num(e.target.value) })} /></div>
          <div><Label>Avg Market DOM</Label><Input type="number" value={form.avg_market_dom ?? ""} onChange={e => upd({ avg_market_dom: num(e.target.value) })} /></div>
          <div><Label>List Price</Label><Input type="number" value={form.list_price ?? ""} onChange={e => upd({ list_price: num(e.target.value) })} /></div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Pricing Recommendation</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><Label>Rec. Low</Label><Input type="number" value={form.recommended_price_low ?? ""} onChange={e => upd({ recommended_price_low: num(e.target.value) })} /></div>
            <div><Label>Rec. High</Label><Input type="number" value={form.recommended_price_high ?? ""} onChange={e => upd({ recommended_price_high: num(e.target.value) })} /></div>
            <div><Label>Projected Low</Label><Input type="number" value={form.projected_sale_low ?? ""} onChange={e => upd({ projected_sale_low: num(e.target.value) })} /></div>
            <div><Label>Projected High</Label><Input type="number" value={form.projected_sale_high ?? ""} onChange={e => upd({ projected_sale_high: num(e.target.value) })} /></div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Platform Engagement</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><Label>Zillow daily views</Label><Input type="number" value={form.zillow_daily_views_est ?? ""} onChange={e => upd({ zillow_daily_views_est: num(e.target.value) })} /></div>
            <div><Label>Zillow daily saves</Label><Input type="number" step="0.1" value={form.zillow_daily_saves_est ?? ""} onChange={e => upd({ zillow_daily_saves_est: num(e.target.value) })} /></div>
            <div><Label>Zillow heat %</Label><Input type="number" step="0.1" value={form.zillow_heat_index_est ?? ""} onChange={e => upd({ zillow_heat_index_est: num(e.target.value) })} /></div>
            <div className="flex items-end gap-2"><input type="checkbox" id={`hot-${recap?.id ?? "new"}`} checked={!!form.redfin_hot_home} onChange={e => upd({ redfin_hot_home: e.target.checked })} /><Label htmlFor={`hot-${recap?.id ?? "new"}`}>Redfin Hot Home</Label></div>
            <div><Label>Realtor weekly views</Label><Input type="number" value={form.realtor_weekly_views_est ?? ""} onChange={e => upd({ realtor_weekly_views_est: num(e.target.value) })} /></div>
            <div><Label>Realtor weekly saves</Label><Input type="number" value={form.realtor_weekly_saves_est ?? ""} onChange={e => upd({ realtor_weekly_saves_est: num(e.target.value) })} /></div>
            <div><Label>Redfin weekly views</Label><Input type="number" value={form.redfin_weekly_views_est ?? ""} onChange={e => upd({ redfin_weekly_views_est: num(e.target.value) })} /></div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Comps (up to 3)</p>
          {[1, 2, 3].map(n => (
            <div key={n} className="grid grid-cols-12 gap-2 mb-2">
              <Input className="col-span-6" placeholder={`Comp ${n} address`}
                value={(form as any)[`comp_${n}_address`] ?? ""}
                onChange={e => upd({ [`comp_${n}_address`]: e.target.value } as any)} />
              <Input className="col-span-2" type="number" placeholder="Price"
                value={(form as any)[`comp_${n}_price`] ?? ""}
                onChange={e => upd({ [`comp_${n}_price`]: num(e.target.value) } as any)} />
              <Input className="col-span-2" type="number" placeholder="DOM"
                value={(form as any)[`comp_${n}_dom`] ?? ""}
                onChange={e => upd({ [`comp_${n}_dom`]: num(e.target.value) } as any)} />
              <Select
                value={(form as any)[`comp_${n}_status`] ?? ""}
                onValueChange={v => upd({ [`comp_${n}_status`]: v } as any)}>
                <SelectTrigger className="col-span-2"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Market Context</p>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Inv. Months</Label><Input type="number" step="0.1" value={form.market_inventory_months ?? ""} onChange={e => upd({ market_inventory_months: num(e.target.value) })} /></div>
            <div><Label>Median Price</Label><Input type="number" value={form.market_median_price ?? ""} onChange={e => upd({ market_median_price: num(e.target.value) })} /></div>
            <div><Label>Sale-to-List %</Label><Input type="number" step="0.1" value={form.market_sale_to_list_pct ?? ""} onChange={e => upd({ market_sale_to_list_pct: num(e.target.value) })} /></div>
          </div>
        </div>

        <div>
          <Label>Market Summary</Label>
          <Textarea rows={2} value={form.market_summary ?? ""} onChange={e => upd({ market_summary: e.target.value })} />
        </div>
        <div>
          <Label>Engagement Summary (plain language for seller)</Label>
          <Textarea rows={3} value={form.engagement_summary ?? ""} onChange={e => upd({ engagement_summary: e.target.value })} />
        </div>
        <div>
          <Label>Price Drop Rationale (shows as amber alert if filled)</Label>
          <Textarea rows={2} value={form.price_drop_rationale ?? ""} onChange={e => upd({ price_drop_rationale: e.target.value })} />
        </div>
        <div>
          <Label>Next Steps (one per line)</Label>
          <Textarea rows={4} value={nextStepsText} onChange={e => setNextStepsText(e.target.value)} />
        </div>
        <div>
          <Label>Agent Note</Label>
          <Textarea rows={2} value={form.agent_notes ?? ""} onChange={e => upd({ agent_notes: e.target.value })} />
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => save.mutate(false)} disabled={save.isPending}>
            <Save className="h-4 w-4 mr-2" />Save Draft
          </Button>
          <Button onClick={() => save.mutate(true)} disabled={save.isPending}>
            <Eye className="h-4 w-4 mr-2" />Publish to Seller
          </Button>
          {!isNew && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="ml-auto text-destructive"><Trash2 className="h-4 w-4" /></Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this recap?</AlertDialogTitle>
                  <AlertDialogDescription>This permanently removes the recap.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => del.mutate()} className="bg-destructive">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
          </TabsContent>
          <TabsContent value="preview">
            <RecapPreview form={form} nextStepsText={nextStepsText} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// Preview the recap exactly as the seller will see it.
function RecapPreview({ form, nextStepsText }: { form: Partial<WeeklyRecap>; nextStepsText: string }) {
  const previewListing: Listing = {
    id: "preview",
    seller_id: "preview",
    address: "(preview)",
    unit: null, city: "Sarasota", state: "FL", zip: "—",
    mls_number: null,
    list_price: form.list_price ?? 0,
    beds: null, baths: null, sqft: null,
    community: null,
    status: "active",
    list_date: null,
    last_updated: new Date().toISOString(),
  };
  const previewRecap: WeeklyRecap = {
    id: "preview",
    listing_id: "preview",
    recap_date: form.recap_date ?? new Date().toISOString().slice(0, 10),
    created_at: new Date().toISOString(),
    published: true,
    days_on_market: form.days_on_market ?? null,
    avg_market_dom: form.avg_market_dom ?? null,
    list_price: form.list_price ?? null,
    recommended_price_low: form.recommended_price_low ?? null,
    recommended_price_high: form.recommended_price_high ?? null,
    projected_sale_low: form.projected_sale_low ?? null,
    projected_sale_high: form.projected_sale_high ?? null,
    zillow_daily_views_est: form.zillow_daily_views_est ?? null,
    zillow_daily_saves_est: form.zillow_daily_saves_est ?? null,
    zillow_heat_index_est: form.zillow_heat_index_est ?? null,
    realtor_weekly_views_est: form.realtor_weekly_views_est ?? null,
    realtor_weekly_saves_est: form.realtor_weekly_saves_est ?? null,
    redfin_weekly_views_est: form.redfin_weekly_views_est ?? null,
    redfin_hot_home: form.redfin_hot_home ?? null,
    comp_1_address: (form as any).comp_1_address ?? null, comp_1_price: (form as any).comp_1_price ?? null, comp_1_dom: (form as any).comp_1_dom ?? null, comp_1_status: (form as any).comp_1_status ?? null,
    comp_2_address: (form as any).comp_2_address ?? null, comp_2_price: (form as any).comp_2_price ?? null, comp_2_dom: (form as any).comp_2_dom ?? null, comp_2_status: (form as any).comp_2_status ?? null,
    comp_3_address: (form as any).comp_3_address ?? null, comp_3_price: (form as any).comp_3_price ?? null, comp_3_dom: (form as any).comp_3_dom ?? null, comp_3_status: (form as any).comp_3_status ?? null,
    market_inventory_months: form.market_inventory_months ?? null,
    market_median_price: form.market_median_price ?? null,
    market_sale_to_list_pct: form.market_sale_to_list_pct ?? null,
    market_summary: form.market_summary ?? null,
    engagement_summary: form.engagement_summary ?? null,
    price_drop_rationale: form.price_drop_rationale ?? null,
    next_steps: nextStepsText.split("\n").map(s => s.trim()).filter(Boolean),
    agent_notes: form.agent_notes ?? null,
  };
  return (
    <div className="rounded-lg border-2 border-dashed border-primary/30 bg-muted/20 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-1">
        <Eye className="h-3.5 w-3.5" />Seller will see:
      </p>
      <ListingView listing={previewListing} recaps={[previewRecap]} />
    </div>
  );
}

// ── Create seller dialog ──────────────────────────────────────────────
function CreateSellerDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/seller-dashboard/create-seller", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ name, email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Create failed");
      toast({ title: "Seller invited", description: json.message ?? `${email} can now log in.` });
      setOpen(false);
      setName(""); setEmail("");
      onCreated();
    } catch (e: any) {
      toast({ title: "Couldn't create seller", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><UserPlus className="h-4 w-4 mr-2" />Add Seller</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Seller</DialogTitle>
          <DialogDescription>Creates a seller account with a one-time password sent via Supabase invite.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Full Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <div><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !name || !email}>
            <UserPlus className="h-4 w-4 mr-2" />{busy ? "Inviting…" : "Send Invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SellersPanel({ sellers, listings, onChange }: {
  sellers: SellerProfile[];
  listings: ListingRow[];
  onChange: () => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2"><Users className="h-5 w-5" />Sellers</CardTitle>
        <CreateSellerDialog onCreated={onChange} />
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground border-b bg-muted/40">
            <tr>
              <th className="text-left py-3 px-4">Name</th>
              <th className="text-left py-3 px-4">Email</th>
              <th className="text-right py-3 px-4">Linked Listings</th>
            </tr>
          </thead>
          <tbody>
            {sellers.length === 0 && (
              <tr><td colSpan={3} className="py-8 text-center text-muted-foreground text-sm">No sellers yet. Click "Add Seller" to invite one.</td></tr>
            )}
            {sellers.map(s => {
              const linked = listings.filter(l => l.seller_id === s.id);
              return (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="py-3 px-4 font-medium">{s.name}</td>
                  <td className="py-3 px-4 text-muted-foreground">{s.email}</td>
                  <td className="py-3 px-4 text-right">
                    <Badge variant="outline">{linked.length}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ── Listing detail view (recaps manager) ─────────────────────────────
function ListingDetail({ listing, onBack }: { listing: ListingRow; onBack: () => void }) {
  const qc = useQueryClient();
  const { data: recaps, refetch } = useQuery<WeeklyRecap[]>({
    queryKey: ["admin", "recaps", listing.id],
    queryFn: () => fetchListingRecaps(listing.id, false),
  });
  const [showNew, setShowNew] = useState(false);
  const refresh = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ["admin", "listings"] });
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-2" />Back to Listings</Button>

      <Card>
        <CardContent className="p-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">{listing.address}{listing.unit ? ` ${listing.unit}` : ""}</h2>
            <p className="text-sm text-muted-foreground">{listing.city}, {listing.state} {listing.zip}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Seller: <span className="font-medium">{listing.seller_name ?? "—"}</span> ({listing.seller_email ?? "—"})
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant="outline" className={`capitalize ${statusColor(listing.status)}`}>{listing.status}</Badge>
            <p className="text-sm font-bold text-primary">{fmtMoney(listing.list_price)}</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Weekly Recaps</h3>
        <Button size="sm" onClick={() => setShowNew(s => !s)}>
          {showNew ? "Hide" : <><Plus className="h-4 w-4 mr-2" />New Recap</>}
        </Button>
      </div>

      {showNew && (
        <RecapEditor listingId={listing.id} onSaved={() => { setShowNew(false); refresh(); }} />
      )}

      {(recaps ?? []).map(r => (
        <RecapEditor key={r.id} recap={r} listingId={listing.id} onSaved={refresh} />
      ))}

      {(recaps ?? []).length === 0 && !showNew && (
        <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">No recaps yet. Click "New Recap" to create one.</CardContent></Card>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────
export default function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const [selected, setSelected] = useState<ListingRow | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [tab, setTab] = useState<"listings" | "sellers">("listings");

  // Per spec, non-agent users should be redirected away from /admin.
  useEffect(() => {
    if (user && !user.agent) setLocation("/seller-dashboard");
  }, [user, setLocation]);

  const { data: listings, refetch } = useQuery({
    queryKey: ["admin", "listings"],
    queryFn: fetchAllListingsWithSellers,
    enabled: !!user?.agent,
  });
  const { data: sellers } = useQuery<SellerProfile[]>({
    queryKey: ["admin", "sellers"],
    queryFn: fetchSellers,
    enabled: !!user?.agent,
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteListing(id),
    onSuccess: () => { toast({ title: "Listing deleted" }); refetch(); },
  });

  async function runSeed() {
    setSeeding(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch("/api/seller-dashboard/seed", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: "{}",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Seed failed");
      toast({ title: "Demo data ready", description: json.message });
      qc.invalidateQueries({ queryKey: ["admin"] });
    } catch (e: any) {
      toast({ title: "Seed failed", description: e.message, variant: "destructive" });
    } finally {
      setSeeding(false);
    }
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-md text-center">
        <h1 className="text-2xl font-bold mb-2">Agent Admin</h1>
        <p className="text-muted-foreground">Please log in to access admin.</p>
      </div>
    );
  }

  if (!user.agent) {
    // Render nothing while the useEffect redirect runs.
    return null;
  }

  if (selected) {
    const fresh = listings?.find(l => l.id === selected.id) ?? selected;
    return (
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <ListingDetail listing={fresh} onBack={() => setSelected(null)} />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-6 gap-3">
        <div>
          <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
            <FileText className="h-7 w-7" /> Listings Admin
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage listings and publish weekly recaps to sellers.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={runSeed} disabled={seeding}>
            <Sparkles className="h-4 w-4 mr-2" />{seeding ? "Seeding…" : "Seed Demo Data"}
          </Button>
          <ListingFormDialog
            sellers={sellers ?? []}
            onSaved={() => { refetch(); qc.invalidateQueries({ queryKey: ["admin", "sellers"] }); }}
            trigger={<Button size="sm"><Plus className="h-4 w-4 mr-2" />Add Listing</Button>}
          />
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mb-4">
        <TabsList>
          <TabsTrigger value="listings"><FileText className="h-3.5 w-3.5 mr-1.5" />Listings</TabsTrigger>
          <TabsTrigger value="sellers"><Users className="h-3.5 w-3.5 mr-1.5" />Sellers</TabsTrigger>
        </TabsList>
        <TabsContent value="sellers" className="mt-4">
          <SellersPanel
            sellers={sellers ?? []}
            listings={listings ?? []}
            onChange={() => qc.invalidateQueries({ queryKey: ["admin"] })}
          />
        </TabsContent>
        <TabsContent value="listings" className="mt-4">

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b bg-muted/40">
                <tr>
                  <th className="text-left py-3 px-4">Address</th>
                  <th className="text-left py-3 px-4">Seller</th>
                  <th className="text-right py-3 px-4">List Price</th>
                  <th className="text-center py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Last Recap</th>
                  <th className="text-right py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(listings ?? []).length === 0 && (
                  <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <Home className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No listings yet. Click "Seed Demo Data" to start with 3 sample listings.
                  </td></tr>
                )}
                {(listings ?? []).map(l => (
                  <tr key={l.id} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => setSelected(l)}>
                    <td className="py-3 px-4">
                      <p className="font-semibold">{l.address}{l.unit ? ` ${l.unit}` : ""}</p>
                      <p className="text-xs text-muted-foreground">{l.city}, {l.state} {l.zip}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p>{l.seller_name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{l.seller_email ?? ""}</p>
                    </td>
                    <td className="py-3 px-4 text-right font-semibold tabular-nums">{fmtMoney(l.list_price)}</td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant="outline" className={`capitalize text-xs ${statusColor(l.status)}`}>{l.status}</Badge>
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">{l.last_recap_date ? fmtDate(l.last_recap_date) : <span className="text-amber-600 font-medium">None yet</span>}</td>
                    <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1 justify-end">
                        <ListingFormDialog
                          sellers={sellers ?? []}
                          initial={l}
                          onSaved={refetch}
                          trigger={<Button size="sm" variant="ghost"><Pencil className="h-4 w-4" /></Button>}
                        />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this listing?</AlertDialogTitle>
                              <AlertDialogDescription>This removes the listing and all its recaps.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => del.mutate(l.id)} className="bg-destructive">Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
