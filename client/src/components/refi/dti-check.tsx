import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, XCircle, Calculator } from "lucide-react";
import { getPurchaseScenarios, getSession, saveBorrowerFinances } from "@/lib/auth";

// DTI qualification check for cash-out / 2nd-lien refinance scenarios.
//
// Income & non-mortgage debts prefill priority:
//   1. values checked earlier this session (module-level store)
//   2. values persisted on the user's profile from a previous session
//   3. a purchase scenario where the user manually entered income
//      (manual income only — the AMI-seeded default is not user data)
// "Check DTI" persists the figures to the profile (best-effort), so
// returning users see their qualification without retyping.

const QUALIFY_MAX = 45; // % — standard conforming DTI ceiling
const BORDERLINE_MAX = 50; // % — possible with compensating factors

// Session-shared borrower figures (monthly) — scoped to the logged-in
// user so a logout/login on the same SPA instance never leaks the
// previous account's income/debts into the next one.
let _shared: { userId?: string; income?: number; debts?: number } = {};

function sharedForCurrentUser(): { income?: number; debts?: number } {
  const uid = getSession()?.id;
  if (_shared.userId !== uid) _shared = { userId: uid };
  return _shared;
}

/** Pull income/debts the user filled out on a purchase scenario. Both
 *  figures must come from the SAME scenario — mixing income from one
 *  property with debts from another would produce a bogus DTI. */
function prefillFromPurchase(): { income?: number; debts?: number } {
  try {
    const match = getPurchaseScenarios().find(
      s => s.monthlyIncomeSource === "manual" && typeof s.monthlyIncome === "number" && s.monthlyIncome > 0,
    );
    if (!match) return {};
    return {
      income: match.monthlyIncome,
      debts: typeof match.monthlyDebts === "number" && Number.isFinite(match.monthlyDebts) ? match.monthlyDebts : undefined,
    };
  } catch {
    return {};
  }
}

const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;

export function DtiCheck({ housingPayment, paymentLabel }: {
  /** Total proposed monthly housing payment for this scenario (new P&I
   *  + escrow for cash-out; current payment + 2nd-lien payment for
   *  home-equity). */
  housingPayment: number;
  /** e.g. "new mortgage payment" / "current payment + 2nd lien" */
  paymentLabel: string;
}) {
  const [prefill] = useState(() => {
    const shared = sharedForCurrentUser();
    const profile = getSession();
    const p = prefillFromPurchase();
    return {
      income: shared.income ?? profile?.monthlyIncome ?? p.income,
      debts: shared.debts ?? profile?.monthlyDebts ?? p.debts,
    };
  });
  const [incomeStr, setIncomeStr] = useState(prefill.income ? String(Math.round(prefill.income)) : "");
  const [debtsStr, setDebtsStr] = useState(prefill.debts != null ? String(Math.round(prefill.debts)) : "");
  const [submitted, setSubmitted] = useState(false);

  const num = (s: string) => {
    const n = parseFloat(s.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };
  const income = num(incomeStr);
  const debts = num(debtsStr);
  const ready = income > 0 && debtsStr.trim() !== "" && housingPayment > 0;
  const dti = ready ? ((housingPayment + debts) / income) * 100 : 0;

  const status = dti <= QUALIFY_MAX ? "qualify" : dti <= BORDERLINE_MAX ? "borderline" : "no";

  return (
    <div className="rounded-md border p-3 space-y-3 bg-muted/20" data-testid="dti-check">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
        <Calculator className="h-3.5 w-3.5" /> Do you qualify? (Debt-to-Income check)
      </p>
      <div className="grid sm:grid-cols-3 gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Gross monthly income</Label>
          <Input inputMode="numeric" placeholder="$8,000" className="h-9" value={incomeStr}
            onChange={e => { setIncomeStr(e.target.value); setSubmitted(false); }}
            data-testid="input-dti-income" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Monthly debts (excl. mortgage)</Label>
          <Input inputMode="numeric" placeholder="$500 — cards, autos, loans" className="h-9" value={debtsStr}
            onChange={e => { setDebtsStr(e.target.value); setSubmitted(false); }}
            data-testid="input-dti-debts" />
        </div>
        <Button size="sm" className="h-9" disabled={!ready}
          onClick={() => {
            _shared = { userId: getSession()?.id, income, debts };
            void saveBorrowerFinances(income, debts);
            setSubmitted(true);
          }}
          data-testid="button-dti-check">
          Check DTI
        </Button>
      </div>
      {submitted && ready && (
        <div
          className={`rounded-md border p-3 flex items-start gap-2.5 ${
            status === "qualify" ? "bg-green-50 border-green-200" :
            status === "borderline" ? "bg-amber-50 border-amber-200" :
            "bg-red-50 border-red-200"}`}
          data-testid="dti-result"
        >
          {status === "qualify" && <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />}
          {status === "borderline" && <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />}
          {status === "no" && <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />}
          <div className="space-y-0.5 text-sm">
            <p className={`font-semibold ${status === "qualify" ? "text-green-700" : status === "borderline" ? "text-amber-700" : "text-red-700"}`}>
              {status === "qualify" && `You likely qualify — DTI ${dti.toFixed(1)}%`}
              {status === "borderline" && `Borderline — DTI ${dti.toFixed(1)}%`}
              {status === "no" && `DTI too high — ${dti.toFixed(1)}%`}
            </p>
            <p className="text-xs text-muted-foreground">
              {fmt(housingPayment)} ({paymentLabel}) + {fmt(debts)} other debts ÷ {fmt(income)} income.{" "}
              {status === "qualify" && `Under the ${QUALIFY_MAX}% standard limit.`}
              {status === "borderline" && `Above ${QUALIFY_MAX}% but under ${BORDERLINE_MAX}% — may qualify with strong credit or reserves.`}
              {status === "no" && `Above the ${BORDERLINE_MAX}% ceiling — consider a smaller loan amount or paying down debts.`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
