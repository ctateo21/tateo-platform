export interface EducationFaq {
  question: string;
  answer: string;
}

export interface EducationTopic {
  id: string;
  title: string;
  directAnswer: { question: string; answer: string };
  body: string;
  faqs: EducationFaq[];
  cta: { heading: string; text: string; label: string; href: string };
}

export const EDUCATION_TOPICS: EducationTopic[] = [
  {
    id: "florida-insurance-cost-by-region",
    title: "Florida Homeowners Insurance Cost by Region",
    directAnswer: {
      question: "How much does homeowners insurance cost in Florida?",
      answer:
        "Florida homeowners insurance costs between 0.54% and 6.65% of a home's rebuild cost per year, depending on region. Tampa Bay averages 1.10–1.70%, Miami-Dade and Broward average 2.33–4.07%, and the Florida Keys average 4.95–6.65%. On a $400,000 rebuild cost home, that's roughly $2,200/year in Tampa versus $9,300/year in Monroe County. Roof age, construction type, and impact windows can move the number by 25% or more in either direction.",
    },
    body: `Florida has the widest insurance cost range of any state in the country, and it isn't random — it's driven by seven distinct risk regions, each shaped by hurricane exposure, building codes, and distance to the coast. Two homes with the same square footage and the same purchase price can have insurance bills $400 a month apart depending on which side of a county line they sit on.

Most online calculators give Florida a single statewide average, which is close to useless — the gap between Pensacola and Key West is too wide for one number to mean anything. Havo built a seven-region model using actual Florida market data so the number you see reflects where the property actually is.

#### Florida Homeowners Insurance Cost by Region

| Region | Counties | Annual Cost (% of rebuild cost) | Risk Tier |
|---|---|---|---|
| Florida Keys / Barrier Islands | Monroe | 4.95% – 6.65% | Extreme |
| Southeast FL Coastal | Miami-Dade, Broward, Palm Beach | 2.33% – 4.07% | High |
| Southwest FL Coastal | Lee, Collier, Charlotte, Sarasota, Manatee | 1.34% – 2.07% | High |
| Tampa Bay Area | Hillsborough, Pinellas, Pasco | 1.10% – 1.70% | Moderate-High |
| Northeast FL / Jacksonville | Duval, Clay, St. Johns, Flagler | 0.80% – 1.27% | Moderate |
| Central FL Inland | Orange, Osceola, Polk, Seminole | 0.78% – 1.22% | Moderate |
| North-Central FL Inland | Alachua, Marion, Sumter, Lake, Columbia | 0.54% – 0.80% | Low |

*Example: a home with a $400,000 rebuild cost runs roughly $2,200–$4,800/year in Tampa Bay, $4,300–$11,600/year in Miami-Dade, and $9,300–$13,300/year in the Florida Keys.*

#### What Actually Moves Your Number

Region sets the baseline. Five property-specific factors move you up or down within that range:

- **Roof age** — a roof under 5 years old can earn up to a 15% discount; a roof over 20 years old can add a 35% surcharge. This is the single biggest factor carriers weigh after location.
- **Opening protection** — impact-rated windows, doors, and shutters can earn up to a 25% discount. In Miami-Dade and Broward, impact protection has been required by code on new construction since 2002 — if a home was built after that date in either county, it almost certainly qualifies.
- **Construction type** — concrete block (CBS) construction is rated lower-risk than wood frame construction in every Florida region.
- **Year built** — homes built after 2002 are held to the modern Florida Building Code, which carriers price more favorably than pre-2002 construction.
- **Prior claims** — zero claims in 5 years rates best; each claim on file adds cost.

#### Why Two Identical Houses Can Cost Different Amounts

A 2,000 sq ft CBS home built in 2019 with a 2019 roof and impact windows, sitting two miles from the coast, will insure for meaningfully less than the same house with a 2005 roof and no impact protection sitting half a mile from the coast — even in the same zip code. Carriers price the building, not just the address.`,
    faqs: [
      {
        question: "Why is homeowners insurance so expensive in Florida?",
        answer:
          "Florida insurance is priced around hurricane and wind risk, which varies enormously by region. Coastal counties with direct hurricane exposure — Monroe, Miami-Dade, Broward — carry the highest rates in the country. Inland counties away from the coast, like Alachua or Marion, carry rates closer to the national average.",
      },
      {
        question: "Why is Miami insurance more expensive than Tampa insurance?",
        answer:
          "Miami-Dade and Broward sit in the Southeast Florida Coastal tier (2.33%-4.07% of rebuild cost) due to direct Atlantic hurricane exposure and dense coastal development. Tampa Bay sits in a Moderate-High tier (1.10%-1.70%) because the Gulf-facing geography and historical storm tracks carry comparatively lower wind risk.",
      },
      {
        question: "Does a new roof actually lower my insurance?",
        answer:
          "Yes, significantly. A roof installed in the last 5 years can earn up to a 15% discount versus a roof over 20 years old, which can carry up to a 35% surcharge. Roof age is one of the most heavily weighted factors in Florida underwriting.",
      },
      {
        question: "Are impact windows worth it for insurance savings?",
        answer:
          "In high-wind regions, impact windows and doors can reduce your premium by up to 25%. In Miami-Dade and Broward, any home built after 2002 is required by code to have them, so the discount applies automatically in most cases.",
      },
      {
        question: "How do I get my exact insurance cost, not just a regional estimate?",
        answer:
          "Regional estimates are a starting point, not a final number. Havo's free calculator pulls your specific property's construction type, roof year, and flood zone, then runs live quotes from real Florida carriers, no login required.",
      },
    ],
    cta: {
      heading: "See your exact number, not a regional average.",
      text: "Enter your address and Havo shows your real insurance estimate — construction type, roof year, and flood zone factored in — free, no login.",
      label: "Get My Insurance Estimate",
      href: "/insurance",
    },
  },
  {
    id: "florida-homeowners-insurance-cost",
    title: "How Much Is Homeowners Insurance in Florida?",
    directAnswer: {
      question: "How much is homeowners insurance in Florida?",
      answer:
        "Florida homeowners insurance averages $1,800 to $13,300 per year, depending on where the property sits. Inland Central and North Florida homes average $1,800–$3,000/year. Tampa Bay averages $2,200–$4,800/year. Miami-Dade and Broward average $4,300–$11,600/year. The Florida Keys average $9,300–$13,300/year. These are calculated as a percentage of the home's rebuild cost, not its purchase price — a $500,000 purchase price with a $350,000 rebuild cost insures based on the $350,000 figure.",
    },
    body: `If you searched this question, you've probably already noticed the answers online are either too generic ("$2,000 a year") or too vague to act on. The honest answer is that Florida doesn't have one homeowners insurance cost — it has seven, one for each risk region, and the difference between the cheapest and most expensive region is more than 10x.

#### Real Numbers by Florida Metro Area

| City / Metro | Region | Typical Annual Range (on $350K rebuild cost) |
|---|---|---|
| Gainesville, Ocala | North-Central Inland | $1,890 – $2,800 |
| Orlando, Kissimmee | Central Inland | $2,730 – $4,270 |
| Jacksonville, St. Augustine | Northeast FL | $2,800 – $4,445 |
| Tampa, St. Petersburg, Clearwater | Tampa Bay | $3,850 – $5,950 |
| Sarasota, Naples, Fort Myers | Southwest Coastal | $4,690 – $7,245 |
| Miami, Fort Lauderdale, West Palm Beach | Southeast Coastal | $8,155 – $14,245 |
| Key West, Marathon | Florida Keys | $17,325 – $23,275 |

*Figures use a $350,000 rebuild cost as a consistent baseline across regions. Your actual number depends on your home's specific rebuild cost, roof year, and construction type.*

#### Rebuild Cost vs. Purchase Price — the Distinction That Trips People Up

Insurance is priced against what it would cost to rebuild the structure, not what you paid for it or what it's worth on the market. Land value, view, and lot size are not insured — they don't burn down. A $600,000 home on a $200,000 lot in a desirable Tampa neighborhood might only have a $400,000 rebuild cost, and that $400,000 figure is what drives the insurance number, not the $600,000 sale price.

#### The Five Factors That Move You Within Your Region's Range

1. **Roof age** (up to 15% discount under 5 years, up to 35% surcharge over 20 years)
2. **Construction type** (concrete block rates lower than wood frame)
3. **Year built** (post-2002 Florida Building Code construction rates more favorably)
4. **Opening protection** (impact windows/doors/shutters, up to 25% discount)
5. **Claims history** (each prior claim adds cost; zero claims rates best)`,
    faqs: [
      {
        question: "What is the average homeowners insurance cost in Florida?",
        answer:
          "There is no single statewide average that's useful, costs range from roughly $1,800/year in inland North-Central Florida to over $13,000/year in the Florida Keys, depending entirely on region.",
      },
      {
        question: "Is Florida the most expensive state for homeowners insurance?",
        answer:
          "Florida consistently ranks among the most expensive states, driven by hurricane and flood exposure. However, costs vary so widely within the state itself that an inland Florida home can insure for less than homes in some non-coastal states, while a coastal Florida home can cost multiples more.",
      },
      {
        question: "Why does my insurance quote keep changing as I add property details?",
        answer:
          "Florida insurance underwriting is highly sensitive to specific property characteristics, roof year and construction type alone can swing a quote by 30% or more. A true quote requires your property's specific details, not just its zip code.",
      },
      {
        question: "Can I lower my Florida homeowners insurance?",
        answer:
          "Yes. The two highest-impact changes are replacing an aging roof and adding impact-rated windows or doors, which combined can reduce premiums by 30-40% on older coastal homes.",
      },
    ],
    cta: {
      heading: "Stop guessing with statewide averages.",
      text: "Run your real address through Havo and see what your specific home actually costs to insure — free, instant, no login.",
      label: "Get My Real Number",
      href: "/insurance",
    },
  },
  {
    id: "mortgage-payment-calculator-florida",
    title: "Florida Mortgage Payment — Real PITI, Not Just P&I",
    directAnswer: {
      question: "What is my mortgage payment on a house in Florida?",
      answer:
        "Your full Florida mortgage payment is principal, interest, property tax, and homeowners insurance combined — commonly called PITI. On a $400,000 Florida home with 20% down at current rates, principal and interest alone runs roughly $2,100/month, but taxes and insurance typically add another $500–$1,200/month depending on the county and insurance region — bringing the real total to $2,600–$3,300/month. Most online calculators only show the P&I portion, which understates the real payment by 20-40% in Florida specifically.",
    },
    body: `Florida is one of the worst states in the country to rely on a generic mortgage calculator, because the gap between principal-and-interest and the full real payment is unusually large here. Two things drive that gap: Florida has no state income tax, which pushes property tax burden up relative to income-tax states, and Florida insurance costs — as covered on our insurance page — can range from a few hundred to over a thousand dollars a month depending entirely on where the property sits.

A buyer comparing a $450,000 home in Ocala to a $450,000 home in Miami using a standard calculator will see the identical monthly payment. In reality, the Miami payment can be $600-$900/month higher once real insurance is factored in.

#### What Goes Into a Real Florida Mortgage Payment

| Component | What It Is | Typical Range (varies by county/region) |
|---|---|---|
| Principal & Interest | The loan payment itself | Based on loan amount, rate, term |
| Property Tax | County millage rate × assessed value | 0.8% – 1.5% of home value annually |
| Homeowners Insurance | Region-specific (see insurance page) | 0.54% – 6.65% of rebuild cost annually |
| Flood Insurance | Required in high-risk FEMA zones | $400 – $2,000+/year if required |
| HOA Dues | If applicable | $0 – $600+/month |

#### Why Property Tax Varies by County Even at the Same Home Value

Florida property tax is calculated as assessed value times the local millage rate, and millage rates differ by county and even by city within a county. A homestead exemption removes up to $50,000 from the taxable assessed value for a primary residence, and the Save Our Homes provision caps how much a homesteaded property's assessed value can rise each year — 3% or the CPI change, whichever is lower (2.7% for 2026). New buyers don't inherit the seller's capped assessed value — the property typically reassesses to full market value in the year following the sale, then the buyer's own cap begins.

#### Why This Matters Before You Make an Offer

The most common mistake we see is a buyer qualifying themselves using a P&I-only calculator, falling in love with a home, and discovering during underwriting that the real payment with taxes and insurance pushes their debt-to-income ratio past what their lender allows. Knowing the full PITI number before you write an offer prevents that entirely.`,
    faqs: [
      {
        question: "Does my mortgage payment include taxes and insurance in Florida?",
        answer:
          "If you put down less than 20%, your lender almost always escrows property tax and insurance into your monthly payment automatically. Even with 20%+ down, you're still responsible for both, they just aren't collected monthly by the lender unless you choose to escrow voluntarily.",
      },
      {
        question: "Why is my estimated payment different from what my lender quoted?",
        answer:
          "Generic calculators typically use a national average for taxes and insurance rather than your property's actual county millage rate and region-specific insurance cost, which in Florida can be off by hundreds of dollars a month.",
      },
      {
        question: "What's a realistic mortgage payment on a $400,000 home in Florida?",
        answer:
          "It depends heavily on location. In inland Central Florida, expect roughly $2,600-$2,900/month all-in. In Tampa Bay, roughly $2,800-$3,200/month. In Miami-Dade or Broward, roughly $3,300-$4,000/month, the difference is almost entirely insurance and tax rate.",
      },
      {
        question: "Do I need flood insurance in Florida?",
        answer:
          "Only if your property sits in a FEMA-designated high-risk flood zone (typically zones beginning with A or V) and you have a federally backed mortgage, in that case it's required. Outside those zones it's optional but often still worth carrying given Florida's flood exposure.",
      },
    ],
    cta: {
      heading: "See your real PITI, not just principal and interest.",
      text: "Havo calculates your full monthly payment — mortgage, real property tax, and real insurance for your specific property — in one place. Free, no login.",
      label: "Calculate My Real Payment",
      href: "/estimate",
    },
  },
  {
    id: "florida-flood-zones-explained",
    title: "Do I Need Flood Insurance in Florida? Flood Zones Explained",
    directAnswer: {
      question: "Do I need flood insurance in Florida?",
      answer:
        "Flood insurance is federally required only if your property sits in a FEMA high-risk zone (zones starting with A or V) and you have a mortgage from a federally regulated lender. Roughly one in three Florida flood insurance claims comes from properties outside the mandatory zones, which is why many buyers in Zone X — the lowest-risk designation — still choose to carry coverage. \"Not required\" is not the same as \"not at risk.\"",
    },
    body: `Flood zone is one of the most misunderstood factors in a Florida home purchase. Buyers often hear "Zone X" and assume it means no flood risk at all — it actually means no federal flood insurance requirement, which is a different statement entirely.

#### FEMA Flood Zone Designations in Florida

| Zone | Meaning | Insurance Requirement |
|---|---|---|
| Zone X (unshaded) | Minimal flood risk (outside 500-year floodplain) | Not required, optional |
| Zone X (shaded) | Moderate flood risk (500-year floodplain) | Not required, often recommended |
| Zone A / AE | High-risk, 1% annual chance of flooding (100-year floodplain) | Required with a federally backed mortgage |
| Zone AH / AO | High-risk, shallow flooding (ponding, sheet flow) | Required with a federally backed mortgage |
| Zone VE | High-risk coastal zone with wave action | Required with a federally backed mortgage, highest premiums |

#### NFIP vs. Private Flood Insurance

The National Flood Insurance Program (NFIP) is the federal program most flood policies fall under, administered through "Write Your Own" carriers like Wright Flood. NFIP rates are standardized by FEMA — every WYO carrier charges the same rate for the same property, since the government underwrites the risk, not the insurance company.

Private flood insurers — companies like Neptune Flood, which is headquartered in Florida — underwrite their own risk using more granular, often more current data than the NFIP's flood maps. Private flood policies can offer higher coverage limits, broader coverage (including additional living expenses), and in many cases lower premiums than NFIP for the same property, particularly outside the highest-risk zones.

#### Why Buyers in "Safe" Zones Still Get Flood Insurance

Florida's flat terrain, intense rainfall events, and rapid development mean flood risk doesn't map perfectly onto FEMA's zone boundaries, which are based on historical data and updated infrequently. A property in Zone X today can still flood from a rainfall event that overwhelms local drainage, which is why many Florida buyers — especially in Tampa Bay, Central Florida, and inland areas with poor drainage history — carry flood coverage even where it isn't required.`,
    faqs: [
      {
        question: "What does Flood Zone X mean?",
        answer:
          "Zone X means the property sits outside FEMA's designated high-risk flood areas. It does not mean zero flood risk, it means flood insurance is not federally required for a mortgage on that property.",
      },
      {
        question: "Is private flood insurance better than NFIP?",
        answer:
          "It depends on the property. Private insurers often offer higher coverage limits, broader policy terms, and competitive pricing, especially for moderate-risk properties. For the highest-risk coastal zones, NFIP's federally backstopped pricing can sometimes be more favorable.",
      },
      {
        question: "How much does flood insurance cost in Florida?",
        answer:
          "NFIP premiums vary by flood zone, foundation type, and elevation, but commonly range from $400/year in lower-risk zones to $2,000+/year in high-risk coastal VE zones. Private flood quotes vary by carrier.",
      },
      {
        question: "Can I find out my flood zone before making an offer?",
        answer:
          "Yes. Flood zone is determined by FEMA Flood Insurance Rate Maps and can be looked up by address.",
      },
    ],
    cta: {
      heading: "Know your flood zone and your real flood cost before you offer.",
      text: "Havo resolves your property's FEMA flood zone automatically and shows private and NFIP estimates side by side. Free, no login.",
      label: "Check My Flood Risk",
      href: "/insurance",
    },
  },
  {
    id: "florida-real-estate-closing-costs",
    title: "Florida Closing Costs Explained — Buyer & Seller",
    directAnswer: {
      question: "What are closing costs in Florida?",
      answer:
        "Florida buyer closing costs typically run 2% to 5% of the purchase price, covering lender fees, the documentary stamp tax on the mortgage note ($0.35 per $100 borrowed), title insurance, and recording fees. Seller closing costs run higher — roughly 8% to 9.5% — because Florida custom puts the documentary stamp tax on the deed ($0.70 per $100 of sale price, $0.60 in Miami-Dade), the owner's title insurance policy, and real estate commissions on the seller's side of the closing statement.",
    },
    body: `Florida closing costs are structured differently than many other states, and the buyer/seller split surprises a lot of out-of-state buyers. Understanding who customarily pays what — and that it's negotiable in the contract — helps you budget accurately before you write an offer.

#### Buyer Closing Costs in Florida

| Cost | What It Is | Typical Amount |
|---|---|---|
| Documentary stamp tax (mortgage note) | State tax on the loan amount | $0.35 per $100 borrowed |
| Intangible tax | State tax on new mortgages | $0.002 (0.2%) of loan amount |
| Lender's title insurance | Protects the lender's interest | Set by state-regulated schedule |
| Loan origination & lender fees | Underwriting, processing, appraisal | Varies by lender |
| Recording fees | County clerk recording of deed/mortgage | ~$10 first page, $8.50 each additional |
| Prepaid items | First year insurance, escrow reserves, prorated interest | Varies |

#### Seller Closing Costs in Florida

| Cost | What It Is | Typical Amount |
|---|---|---|
| Documentary stamp tax (deed) | State tax on sale price | $0.70 per $100 (Miami-Dade: $0.60 + surtax) |
| Owner's title insurance | Customarily seller-paid in most FL counties | Starts at $5.75 per $1,000 (state-regulated) |
| Real estate commissions | Listing + buyer's agent | Averages ~5.5% statewide |
| Title search & closing fee | Title company services | Varies |
| Outstanding liens / mortgage payoff | Any remaining balance owed | Property-specific |
| Property tax prorations | Seller's share through closing date | Property-specific |

*On a $400,000 Florida sale: documentary stamp tax on the deed alone is $2,800 in most counties. Combined with title insurance and a 5.5% commission, total seller costs commonly land between $32,000 and $38,000.*

#### The Miami-Dade Exception

Miami-Dade uses a different documentary stamp rate than the rest of the state — $0.60 per $100 on the deed plus an additional $0.45 per $100 surtax, for a combined effective rate of $1.15 per $100 on most transactions. Miami-Dade is also one of the few counties where local custom shifts title insurance and deed stamp responsibility toward the buyer rather than the seller — always confirm local custom with your title company.

#### Who Actually Pays What Is Negotiable

The percentages above reflect Florida custom, not law. The purchase contract controls who pays each line item, and buyers commonly negotiate a seller closing cost credit — typically 2-3% of the sale price — as part of the offer, especially in a buyer's market.`,
    faqs: [
      {
        question: "Who pays closing costs in Florida, the buyer or seller?",
        answer:
          "Both parties pay closing costs, but the split differs. Florida custom has sellers paying the deed documentary stamp tax, owner's title insurance, and commissions, while buyers pay the mortgage-related taxes, lender fees, and the lender's title policy. The actual split is set by the purchase contract.",
      },
      {
        question: "How much are closing costs on a $400,000 house in Florida?",
        answer:
          "Buyer costs typically run $8,000-$20,000 (2-5%). Seller costs typically run $32,000-$38,000 (8-9.5%), driven mainly by the documentary stamp tax, title insurance, and commission.",
      },
      {
        question: "Is Miami-Dade closing cost different from the rest of Florida?",
        answer:
          "Yes. Miami-Dade charges a different documentary stamp rate ($0.60 per $100 plus a $0.45 surtax, for an effective $1.15 per $100) versus the standard $0.70 per $100 used in the other 66 Florida counties.",
      },
      {
        question: "Can a seller refuse to pay closing costs in Florida?",
        answer:
          "The contract determines the split, and either party can negotiate. A seller is not obligated by law to pay any specific cost, Florida custom is just the typical starting point for negotiation.",
      },
    ],
    cta: {
      heading: "See your full cash-to-close number, not just the down payment.",
      text: "Havo calculates your real closing costs alongside your mortgage payment and insurance — the complete picture before you offer. Free, no login.",
      label: "Calculate My Closing Costs",
      href: "/estimate",
    },
  },
  {
    id: "florida-property-tax-calculator",
    title: "Florida Property Tax — Homestead & Save Our Homes Explained",
    directAnswer: {
      question: "How much are property taxes in Florida?",
      answer:
        "Florida property taxes average roughly 0.8% to 1.5% of a home's assessed value annually, varying by county millage rate. A homestead exemption removes up to $50,000 from a primary residence's taxable value, saving the average owner $400-$550/year. The Save Our Homes provision then caps future assessed value increases at 3% or the CPI (2.7% for 2026), whichever is lower — but that cap resets for a new buyer, who starts at full market value in their first year of ownership.",
    },
    body: `Property tax is the part of a Florida home purchase that most often gets estimated wrong, because the number a current owner pays and the number a new buyer will pay can be dramatically different on the exact same property — and most online estimates don't account for that gap.

#### How Florida Property Tax Is Calculated

\`\`\`
Annual Tax = (Assessed Value − Exemptions) × (Millage Rate ÷ 1,000)
\`\`\`

Assessed value starts at full market (just) value in a property's first year under a new owner, then — if homesteaded — is capped from rising more than 3% (or CPI, whichever is lower) each year after that. Millage rate is set locally and varies by county and even by city or special taxing district within a county.

#### Why the Listing's Current Tax Bill Can Be Misleading

If the current owner has held the home for 10+ years with a homestead exemption, their assessed value has likely drifted well below the home's actual market value thanks to the Save Our Homes cap — sometimes by $100,000 or more. A new buyer does not inherit that capped assessment. In the year following the sale, the property typically reassesses to full market value, and the buyer's tax bill resets to reflect that — often significantly higher than what the listing showed as the "current taxes" figure.

#### Homestead Exemption — What It Actually Saves

- Removes up to **$50,000** from the assessed value of a primary residence (the first $25,000 applies to all taxing authorities including schools; the next $25,000 applies to all except school taxes)
- Must be your primary residence and you must apply by **March 1** of the tax year
- Activates the **Save Our Homes** cap going forward
- Additional exemptions may apply for seniors 65+ (up to another $50,000, income-restricted), veterans, and disabled persons — check with your county property appraiser

#### Save Our Homes — the Long-Term Benefit

| Scenario | Assessed Value Treatment |
|---|---|
| Year of purchase (new buyer) | Assessed at full market value |
| Each year after, with homestead | Capped at +3% or CPI, whichever is lower |
| 2026 CPI cap | 2.7% |
| If you sell and rebuy in FL | Up to $500,000 of SOH savings is portable to a new homestead |

A homeowner who buys today and holds the property for 10+ years can see meaningful savings build as market values rise faster than the 3% cap — but a buyer evaluating a home today should budget for the full reassessed tax, not the seller's current capped bill.`,
    faqs: [
      {
        question: "Will my property tax be the same as the current owner's?",
        answer:
          "No. In most cases the property reassesses to full market value the year after you buy it, meaning your tax bill is typically higher than the current taxes shown on the listing, especially if the seller held the home for many years.",
      },
      {
        question: "How much does homestead exemption save in Florida?",
        answer:
          "On average, roughly $400-$550 per year, based on a typical effective tax rate applied to the $50,000 exemption. Savings are higher in counties with higher millage rates.",
      },
      {
        question: "What is the Save Our Homes cap?",
        answer:
          "A Florida constitutional protection that limits how much a homesteaded property's assessed value can increase each year, capped at 3% or the change in CPI, whichever is lower (2.7% for 2026). It only applies once you have homestead exemption, and it resets to full market value when the property sells to a new owner.",
      },
      {
        question: "Can I transfer my Save Our Homes savings to a new home?",
        answer:
          "Yes, this is called portability. If you sell a homesteaded Florida property and buy another within roughly 2-3 years, you can transfer up to $500,000 of accumulated Save Our Homes savings to the new homestead.",
      },
      {
        question: "Do I need to apply for homestead exemption or is it automatic?",
        answer:
          "You must apply with your county property appraiser by March 1 of the tax year. It is not automatic, missing the deadline means waiting until the following year.",
      },
    ],
    cta: {
      heading: "See your real first-year tax bill, not the seller's capped number.",
      text: "Havo factors in reassessment and homestead exemption to show what you'll actually pay — alongside your mortgage and insurance. Free, no login.",
      label: "Calculate My Property Tax",
      href: "/estimate",
    },
  },
];
