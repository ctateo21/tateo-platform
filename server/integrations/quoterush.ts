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
  floodZone: string;
  sqFt: number;
  windMitForm: boolean;
  openingProtection: string;
  secondaryWaterResistance: string;
  usageType: string;
  newPurchase: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
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

function buildImporterPayload(
  p: QuoteRushParams,
  assignedEmail: string
): Record<string, any> {
  const formTypeMap: Record<string, string> = {
    HO3: "HO-3: Home Owners Policy",
    HO6: "HO-6: Condo Unit Owners Policy",
    DP3: "DP-3: Dwelling Fire Policy",
  };
  const formType =
    formTypeMap[p.policyType] ||
    "HO-3: Home Owners Policy";
  const includeFlood =
    !!p.floodZone &&
    p.floodZone !== "X" &&
    p.floodZone !== "";

  const payload: Record<string, any> = {
    Client: {
      NameFirst: p.firstName || "Havo",
      NameLast: p.lastName || "Lead",
      PhoneCell: p.phone || "",
      EmailAddress: p.email || "",
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
      Lob_Flood: includeFlood,
    },
    HO: {
      FormType: formType,
      Address: p.streetAddress,
      City: p.city,
      State: p.state || "FL",
      Zip: p.zip,
      County: p.county || "",
      NewPurchase: p.newPurchase || "No",
      UsageType: p.usageType || "Primary",
      YearBuilt: String(p.yearBuilt || 1995),
      SquareFeet:
        p.sqFt > 0 ? String(p.sqFt) : "1800",
      ConstructionType: p.constructionType ||
        "Masonry",
      Construction:
        p.masonryConstruction ||
        p.frameConstruction ||
        p.constructionType ||
        "Concrete Block",
      FrameConstruction: p.frameConstruction || "",
      MasonryConstruction:
        p.masonryConstruction || "",
      FoundationType: "Slab",
      RoofShape: "Gable",
      RoofMaterial: "Composite Shingle",
      UpdateRoofYear: String(p.roofYear),
      UpdateRoofType: "Full",
      CoverageA: String(p.coverageA),
      CoverageB: String(
        Math.round(p.coverageA * 0.02)
      ),
      CoverageBPercent: "2%",
      CoverageC: String(
        Math.round(p.coverageA * 0.25)
      ),
      CoverageCPercent: "25%",
      CoverageD: String(
        Math.round(p.coverageA * 0.10)
      ),
      CoverageDPercent: "10%",
      CoverageE: "$300,000",
      CoverageF: "$5,000",
      AllOtherPerilsDeductible: p.aopDeductible,
      HurricaneDeductible: p.hurrDeductible,
      WindHailDeductible: p.hurrDeductible,
      FloodZone: p.floodZone || "X",
      FloodPolicy: includeFlood,
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
      Mortgage: "No",
      EPolicy: true,
      WaterBackup: true,
      WaterBackupAmount: "$10,000",
      RoofLossSettlement: "Replacement Cost",
      PersonalInjuryCoverage: true,
      IdentityTheft: true,
      IncreaseReplacementCostOnDwelling: true,
    },
  };

  if (includeFlood) {
    payload.Flood = {
      FloodZone: p.floodZone,
      BuildingCoverage: String(p.coverageA),
      ContentsCoverage: "100000",
      FloodDeductible: "$1,250",
      PolicyType: "Preferred Risk (PRP)",
      FloodCarrier: "Wright Flood",
      CarrierType: "NFIP",
    };
  }

  if (p.priorClaims > 0) {
    const currentYear = new Date().getFullYear();
    payload.Claims = Array.from(
      { length: Math.min(p.priorClaims, 3) },
      (_, i) => ({
        ClaimDetail: "Water Damage",
        Date: `01/01/${currentYear - (i + 2)}`,
        Amount: "5000",
        ActOfGod: false,
        CatastrophicLoss: false,
        PriorResidence: false,
        Paid: true,
      })
    );
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
    if (propData.sqFt > 0)
      params.sqFt = propData.sqFt;
    if (
      propData.yearBuilt > 1900 &&
      params.yearBuilt === 1995
    ) params.yearBuilt = propData.yearBuilt;
    if (propData.constructionType) {
      params.constructionType =
        propData.constructionType;
      params.masonryConstruction =
        propData.masonryConstruction;
    }
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
  console.log(
    "[quoterush] import response:", importText
  );

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
      console.log(
        "[quoterush] GetNewLeads:", newLeadsText
      );
      const arr = JSON.parse(newLeadsText);
      const leads = Array.isArray(arr)
        ? arr
        : (arr.Leads ?? arr.leads ?? []);
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
  const submitRes = await fetch(
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
  const submitText = await submitRes.text();
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
