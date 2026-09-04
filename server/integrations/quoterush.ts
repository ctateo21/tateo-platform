// QuoteRUSH live carrier quoting integration.
//
// Flow: enrich property data → import lead → extract LeadId →
// submit quote request (triggers QuoteBot) → poll GetQuotes.
//
// Credentials come from process.env only. The saved Replit secrets
// are QUOTERUSH_WEBID / QUOTERUSH_WEBID_PASSWORD /
// QUOTERUSH_ENDPOINT_KEY / QUOTERUSH_AGENCY_ID; the spec's shorter
// aliases (QUOTERUSH_WEBPASSWORD / QUOTERUSH_AGENCY) are accepted as
// fallbacks so either naming works.
//
// The console.log statements are intentional — they surface the raw
// API response shapes during the first live tests.

import type { QuoteRushPropertyDefaults } from "@shared/quoterush-property-defaults";

export interface QuoteRushParams {
  streetAddress: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  coverageA: number;
  policyType: string;
  yearBuilt: number;
  roofYear: number;
  constructionType: string;
  masonryConstruction: string;
  frameConstruction: string;
  hurrDeductible: string;
  aopDeductible: string;
  priorClaims: number;
  claimRecords: QuoteRushClaimRecord[];
  floodZone: string;
  sqFt: number;
  windMitForm: boolean;
  openingProtection: string;
  secondaryWaterResistance: string;
  roofShape: string;
  usageType: string;
  rentalTerm: QuoteRushPropertyDefaults["rentalTerm"];
  monthsOccupied: QuoteRushPropertyDefaults["monthsOccupied"];
  newPurchase: string;
  purchaseDate: string;
  purchasePrice: number;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  email: string;
  phone: string;
  hasMortgage?: boolean;
}

export interface QuoteRushClaimRecord {
  lossDate: string;
  /** The applicant's description of the loss type or cause. */
  claimDetail: string;
  amount: number;
  priorResidence: boolean;
  paid: boolean;
}

export interface QuoteRushQuote {
  siteName: string;
  annualPremium: number;
  monthlyPremium: number;
  coverageA: number;
  hurricaneDeductible: string;
  aop: string;
  quoteUrl: string | null;
  quoteMessage: string;
  quoteDate: string;
  rank: number;
}

export interface QuoteRushResult {
  status: "success" | "pending" | "error";
  quotes: QuoteRushQuote[];
  leadId: number;
  quoteCounter: number;
  errorMessage?: string;
}

function getWebId(): string {
  return process.env.QUOTERUSH_WEBID ?? "";
}
function getWebPassword(): string {
  return process.env.QUOTERUSH_WEBID_PASSWORD ?? process.env.QUOTERUSH_WEBPASSWORD ?? "";
}
function getEndpointKey(): string {
  return process.env.QUOTERUSH_ENDPOINT_KEY ?? "";
}
function getAgency(): string {
  return process.env.QUOTERUSH_AGENCY_ID ?? process.env.QUOTERUSH_AGENCY ?? "";
}

function parseLeadId(text: string): number | null {
  try {
    const json = JSON.parse(text);
    const id = json.id ?? json.leadId ?? json.LeadId
               ?? json.lead_id ?? json.Id;
    if (id) return parseInt(String(id), 10);
  } catch {}
  const m = text.match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

function formatDateOfBirth(dateOfBirth: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth);
  return match
    ? `${match[2]}/${match[3]}/${match[1]}`
    : dateOfBirth;
}
export function buildImporterPayload(
  p: QuoteRushParams,
  assignedEmail: string
): Record<string, any> {
  if (
    !Number.isInteger(p.priorClaims) ||
    p.priorClaims < 0 ||
    p.priorClaims > 3 ||
    p.claimRecords.length !== p.priorClaims
  ) {
    throw new Error(
      "Prior claim details must be confirmed before submitting to QuoteRUSH.",
    );
  }
  const formTypeMap: Record<string, string> = {
    HO3: "HO-3: Home Owners Policy",
    HO6: "HO-6: Condo Unit Owners Policy",
    DP3: "DP-3: Dwelling Fire Policy",
  };
  const formType =
    formTypeMap[p.policyType] ||
    "HO-3: Home Owners Policy";
  const payload: Record<string, any> = {
    Client: {
      NameFirst: p.firstName || "Havo",
      NameLast: p.lastName || "Lead",
      DOB: formatDateOfBirth(p.dateOfBirth),
      Phone: p.phone || "",
      PhoneCell: p.phone || "",
      PhoneOther: "",
      EmailAddress: p.email || "",
      EntityType: "Individual",
      Gender: "Male",
      MaritalStatus: "Single",
      Industry: "Business/Sales/Office",
      Occupation: "Account Executive",
      EPolicy: true,
      Address: p.streetAddress,
      City: p.city,
      State: p.state || "FL",
      Zip: p.zip,
      County: p.county || "",
      International: false,
      AssumedCreditScore: "Excellent",
      CreditPermission: "Yes",
      Assigned: assignedEmail,
      LeadSource: "Havo Platform",
      LeadStatus: "New Lead",
      Lob_Home: true,
      Lob_Auto: false,
      // FEMA flood-zone enrichment is property context only. A separate
      // flood quote must be explicitly requested and is never synthesized.
      Lob_Flood: false,
    },
    HO: {
      FormType: formType,
      Address: p.streetAddress,
      City: p.city,
      State: p.state || "FL",
      Zip: p.zip,
      County: p.county || "",
      NewPurchase: p.newPurchase || "No",
      PurchaseDate: p.purchaseDate,
      PurchasePrice: String(Math.round(p.purchasePrice)),
      UsageType: p.usageType || "Primary",
      MonthsOccupied: p.monthsOccupied,
      ...(p.rentalTerm ? { RentalTerm: p.rentalTerm } : {}),
      YearBuilt: String(p.yearBuilt),
      PolicyEffectiveDate: (() => {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        return (
          String(d.getMonth() + 1).padStart(2, "0") +
          "/" +
          String(d.getDate()).padStart(2, "0") +
          "/" +
          d.getFullYear()
        );
      })(),
      // Do not fabricate a square-footage value. Carrier data is only useful
      // when it is supplied by the user or a verified property source.
      ...(p.sqFt > 0 ? { SquareFeet: String(Math.round(p.sqFt)) } : {}),
      ConstructionType: p.constructionType ||
        "Masonry",
      Construction:
        p.constructionType === "Mixed"
          ? p.masonryConstruction || "Mixed"
          : p.masonryConstruction ||
            p.constructionType ||
            "Concrete Block",
      // Do not send exterior-finish labels (for example Stucco) as a
      // structural framing subtype.
      MasonryConstruction:
        p.masonryConstruction || "",
      FoundationType: "Slab",
      RoofShape: p.roofShape || "Gable",
      RoofMaterial: "Composite Shingle",
      UpdateRoofYear: String(p.roofYear),
      UpdateRoofType: "Full",
      CoverageA: String(p.coverageA),
      ...(p.policyType === "HO6"
        ? {}
        : {
            CoverageB: String(Math.round(p.coverageA * 0.02)),
            CoverageBPercent: "2%",
          }),
      CoverageC: String(Math.round(p.coverageA * 0.25)),
      CoverageCPercent: "25%",
      CoverageD: String(Math.round(p.coverageA * 0.10)),
      CoverageDPercent: "10%",
      CoverageE: "$300,000",
      CoverageF: p.policyType === "HO6" ? "$2,000" : "$5,000",
      AllOtherPerilsDeductible: p.aopDeductible,
      HurricaneDeductible: p.hurrDeductible,
      WindHailDeductible: p.hurrDeductible,
      ...(p.floodZone ? { FloodZone: p.floodZone } : {}),
      FloodPolicy: false,
      CurrentlyInsured: "Yes",
      AnyLapses: "No",
      CurrentCarrier: "Unknown",
      Claims: p.priorClaims > 0 ? "Yes" : "No",
      HaveWindMitForm: p.windMitForm,
      OpeningProtection: p.openingProtection,
      SecondaryWaterResistance:
        p.secondaryWaterResistance,
      Terrain: "Exposure B",
      BurglarAlarm: "None",
      FireAlarm: "None",
      FireHydrant: "Within 1000 Feet",
      FireStation: "Within 5 Miles",
      ...(typeof p.hasMortgage === "boolean"
        ? { Mortgage: p.hasMortgage ? "Yes" : "No" }
        : {}),
      EPolicy: true,
      WaterBackup: true,
      WaterBackupAmount: "$10,000",
      RoofLossSettlement: "Replacement Cost",
      PersonalInjuryCoverage: true,
      IdentityTheft: true,
      IncreaseReplacementCostOnDwelling: true,
    },
  };
  if (p.claimRecords.length > 0) {
    payload.Claims = p.claimRecords.map((claim) => ({
      ClaimDetail: claim.claimDetail,
      Date: formatDateOfBirth(claim.lossDate),
      Amount: String(Math.round(claim.amount)),
      PriorResidence: claim.priorResidence,
      Paid: claim.paid,
    }));
  }

  return payload;
}

async function getPropertyData(
  streetAddress: string,
  city: string,
  state: string,
  zip: string
): Promise<{
  sqFt: number;
  yearBuilt: number;
  constructionType: string;
  masonryConstruction: string;
} | null> {
  const ENDPOINT_KEY = getEndpointKey();
  const AGENCY = getAgency();

  try {
    const res = await fetch(
      "https://api.quoterush.com/GetPropertyData",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          EndpointKey: ENDPOINT_KEY,
          Agency: AGENCY,
          AddressLine1: streetAddress,
          AddressLine2: "",
          City: city,
          State: state,
          Zip: zip,
        }),
      }
    );
    const text = await res.text();
    console.log(
      "[quoterush] GetPropertyData response:",
      text
    );
    if (!res.ok) return null;
    const json = JSON.parse(text);
    return {
      sqFt: parseInt(
        String(
          json.SquareFeet ?? json.sqFt ??
          json.square_feet ?? 0
        ),
        10
      ),
      yearBuilt: parseInt(
        String(
          json.YearBuilt ?? json.yearBuilt ?? 0
        ),
        10
      ),
      constructionType:
        json.ConstructionType ??
        json.constructionType ?? "",
      masonryConstruction:
        json.MasonryConstruction ??
        json.masonry ?? "",
    };
  } catch (e) {
    console.error(
      "[quoterush] GetPropertyData error:", e
    );
    return null;
  }
}

export async function importAndSubmit(
  params: QuoteRushParams
): Promise<{
  leadId: number;
  submitted: boolean;
  error?: string;
}> {
  const WEBID = getWebId();
  const WEBPASSWORD = getWebPassword();
  const ENDPOINT_KEY = getEndpointKey();
  const AGENCY = getAgency();
  const ASSIGNED_EMAIL =
    process.env.QUOTERUSH_ASSIGNED_EMAIL ??
    "christian@tateoco.com";

  if (!WEBID || !WEBPASSWORD ||
      !ENDPOINT_KEY || !AGENCY) {
    return {
      leadId: 0,
      submitted: false,
      error: "QuoteRUSH env vars not set",
    };
  }

  // Step A: Enrich with real property data
  const propData = await getPropertyData(
    params.streetAddress,
    params.city,
    params.state,
    params.zip
  );
  if (propData) {
    console.log(
      "[quoterush] property data enrichment:",
      propData
    );
    if (params.sqFt <= 0 && propData.sqFt > 0)
      params.sqFt = propData.sqFt;
    // Preserve the user's explicit building year and construction answer.
    // Enrichment remains useful for square footage when it was not supplied,
    // but must not replace the property details used to price this quote.
  }

  // Step B: Import lead
  console.log(
    "[quoterush] importing lead:",
    params.streetAddress, params.city
  );
  const importPayload = buildImporterPayload(
    params, ASSIGNED_EMAIL
  );
  const importRes = await fetch(
    `https://importer.quoterush.com/Json/Import/${WEBID}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "webpassword": WEBPASSWORD,
      },
      body: JSON.stringify(importPayload),
    }
  );
  const importText = await importRes.text();
    console.log("[quoterush] import completed:", importRes.status);

  if (!importRes.ok) {
    return {
      leadId: 0,
      submitted: false,
      error: `Import failed ${importRes.status}: ` +
             importText,
    };
  }

  // Step C: Extract LeadId
  let leadId = parseLeadId(importText);

  // Fallback: GetNewLeads if parse failed
  if (!leadId || leadId <= 0) {
    console.log(
      "[quoterush] fallback to GetNewLeads"
    );
    try {
      const newLeadsRes = await fetch(
        "https://api.quoterush.com/GetNewLeads",
        {
          method: "GET",
          headers: {
            "WebId": WEBID,
            "WebIdPassword": WEBPASSWORD,
          },
        }
      );
      const newLeadsText =
        await newLeadsRes.text();
      const arr = JSON.parse(newLeadsText);
      const leads = Array.isArray(arr)
        ? arr
        : (arr.Leads ?? arr.leads ?? []);
      console.log("[quoterush] GetNewLeads count:", leads.length);
      if (leads.length > 0) {
        const first = leads[0];
        leadId = parseInt(
          String(
            first.id ?? first.Id ??
            first.leadId ?? first.LeadId ?? 0
          ),
          10
        );
      }
    } catch (e) {
      console.error(
        "[quoterush] GetNewLeads fallback error:",
        e
      );
    }
  }

  if (!leadId || leadId <= 0) {
    return {
      leadId: 0,
      submitted: false,
      error: "Could not extract LeadId",
    };
  }
  console.log("[quoterush] LeadId:", leadId);

  // Step D: Submit quote request (triggers QuoteBot)
  let submitRes: Response;
  let submitText: string;
  try {
    submitRes = await fetch(
      "https://api.quoterush.com/SubmitQuoteRequest",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          EndpointKey: ENDPOINT_KEY,
          Agency: AGENCY,
          LeadId: leadId,
          LOB: "Home",
          Submitter: ASSIGNED_EMAIL,
        }),
      }
    );
    submitText = await submitRes.text();
  } catch (error) {
    console.error(
      "[quoterush] SubmitQuoteRequest status could not be confirmed",
    );
    return {
      leadId,
      submitted: false,
      error: "Quote submission status could not be confirmed",
    };
  }
  console.log(
    "[quoterush] SubmitQuoteRequest:", submitText
  );

  return {
    leadId,
    submitted: submitRes.ok,
    error: submitRes.ok ? undefined : submitText,
  };
}

export async function getQuotes(
  leadId: number
): Promise<QuoteRushResult> {
  const ENDPOINT_KEY = getEndpointKey();
  const AGENCY = getAgency();

  try {
    const res = await fetch(
      "https://api.quoterush.com/GetQuotes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          EndpointKey: ENDPOINT_KEY,
          Agency: AGENCY,
          LeadId: leadId,
          LOB: "Home",
        }),
      }
    );
    const text = await res.text();
    console.log(
      "[quoterush] GetQuotes response:", text
    );

    if (!res.ok) {
      return {
        status: "error",
        quotes: [],
        leadId,
        quoteCounter: 0,
        errorMessage: `GetQuotes ${res.status}: ` +
                      text,
      };
    }

    const json = JSON.parse(text);
    const rawQuotes: any[] = json.Quotes ?? [];
    const quoteCounter: number =
      json.QuoteCounter ?? 0;

    if (quoteCounter === 0) {
      return {
        status: "pending",
        quotes: [],
        leadId,
        quoteCounter: 0,
      };
    }

    const quotes: QuoteRushQuote[] = rawQuotes
      .filter(
        (q: any) =>
          q.Premium &&
          parseFloat(String(q.Premium)) > 0
      )
      .map((q: any) => {
        const annual = parseFloat(
          String(q.Premium ?? "0")
        );
        return {
          siteName: String(
            q.SiteName ?? "Unknown Carrier"
          ),
          annualPremium: Math.round(annual),
          monthlyPremium: Math.round(annual / 12),
          coverageA: parseInt(
            String(q.CoverageA ?? "0"), 10
          ),
          hurricaneDeductible: String(
            q.HurricaneDeductible ?? ""
          ),
          aop: String(q.AOP ?? ""),
          quoteUrl: q.QuoteURL ?? null,
          quoteMessage: String(
            q.QuoteMessage ?? ""
          ),
          quoteDate: String(q.QuoteDate ?? ""),
          rank: 0,
        };
      })
      .sort(
        (a: QuoteRushQuote, b: QuoteRushQuote) =>
          a.annualPremium - b.annualPremium
      )
      .slice(0, 3)
      .map(
        (q: QuoteRushQuote, i: number) => ({
          ...q, rank: i + 1,
        })
      );

    return {
      status: "success",
      quotes,
      leadId,
      quoteCounter,
    };
  } catch (err: any) {
    console.error(
      "[quoterush] getQuotes error:", err
    );
    return {
      status: "error",
      quotes: [],
      leadId,
      quoteCounter: 0,
      errorMessage: err?.message,
    };
  }
}
