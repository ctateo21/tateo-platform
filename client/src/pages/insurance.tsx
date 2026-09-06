-colors ${
                  sc.id === activeScenarioId
                    ? "bg-white border-border text-foreground shadow-sm -mb-px relative z-10"
                    : "bg-gray-100 border-transparent text-muted-foreground hover:bg-gray-200"
                }`}
              >
                <MapPin className="h-3 w-3 shrink-0" />
                <span>{shortLabel(sc.address) || "New property"}</span>
                {scenarios.length > 1 && (
                  <button
                    onClick={(e) => removeScenario(sc.id, e)}
                    className="ml-0.5 rounded-full hover:bg-black/10 p-0.5 transition-colors"
                    aria-label="Remove"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            ))}
            {scenarios.length < 5 && (
              <button
                onClick={requestAddScenario}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-t-md text-xs text-muted-foreground hover:text-primary hover:bg-gray-100 border border-transparent border-b-0 transition-colors"
                title="Compare another property"
              >
                <Plus className="h-3.5 w-3.5" /> Add Property
              </button>
            )}
          </div>

          {/* Address + action bar */}
          <div className="container mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              {/* Back routing matches Cash Buy / Seller / Purchase: a
                  logged-in user is always inside a dashboard scenario, so
                  Back returns to Dashboard → Insurance tab. Only the
                  logged-out flow (entered via the six-service picker)
                  should land back on /select-service. */}
              <button
                onClick={() => {
                  if (isAuthenticated) {
                    setLocation("/dashboard?tab=insurance");
                  } else {
                    setLocation(
                      `/select-service${addressParam ? `?address=${encodeURIComponent(addressParam)}` : ""}`
                    );
                  }
                }}
                className="text-muted-foreground hover:text-primary transition-colors"
                aria-label={isAuthenticated ? "Back to Insurance dashboard" : "Back to Services"}
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium flex items-center gap-1.5">
                  <Shield className="h-3 w-3" /> Insurance Estimate
                </p>
                {isEditingAddress ? (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                    <input
                      ref={addressInputRef}
                      type="text"
                      value={editAddressVal}
                      onChange={e => setEditAddressVal(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          const val = editAddressVal.trim();
                          if (val) setLocation(`/insurance?address=${encodeURIComponent(val)}`);
                          setIsEditingAddress(false);
                        } else if (e.key === "Escape") {
                          setIsEditingAddress(false);
                        }
                      }}
                      onBlur={() => setTimeout(() => setIsEditingAddress(false), 200)}
                      className="text-sm font-semibold bg-transparent border-b border-primary outline-none w-72 max-w-full leading-tight pb-0.5"
                      autoComplete="off"
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => setIsEditingAddress(true)}
                    className="group flex items-center gap-1.5 mt-0.5 hover:text-primary transition-colors text-left"
                  >
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0" />
                    <span className="font-semibold text-sm leading-tight">{address || "Enter an address"}</span>
                    <Pencil className="h-3 w-3 text-muted-foreground/50 group-hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Standard Share + Save Scenario pair, identical to
                  the other four detail views. Save persists one row
                  per address into `insurance_scenarios`; the call is
                  awaited so the success toast only fires after the
                  Supabase write returns OK. */}
              <ScenarioActions
                scenarioType="insurance"
                getPdfData={() => {
                  if (!address || !address.trim()) return null;
                  const annualPremium =
                    manualAnnualPremium != null
                      ? manualAnnualPremium
                      : Math.round(calc.mid);
                  // Occupancy / structure type aren't held in component
                  // state — derive them from the saved source scenarios
                  // for this address, mirroring the default-policy helper.
                  const pdfKey = address.trim().toLowerCase();
                  const pdfPurchase = getPurchaseScenarios().find(
                    p => (p.address ?? "").trim().toLowerCase() === pdfKey,
                  );
                  const pdfCash = getCashBuyScenarios().find(
                    c => (c.address ?? "").trim().toLowerCase() === pdfKey,
                  );
                  const pdfLoan = getTrackedLoans().find(
                    l => (l.propertyAddress ?? "").trim().toLowerCase() === pdfKey,
                  );
                  const occupancy =
                    pdfCash?.occupancyType ??
                    (pdfLoan?.propertyType as string | undefined) ??
                    (pdfPurchase ? "primary" : undefined);
                  const propertyType =
                    pdfPurchase?.propertyType ?? pdfLoan?.physicalPropertyType;
                  const POLICY_LABELS: Record<string, string> = {
                    HO3: "HO-3 (Homeowners)",
                    HO6: "HO-6 (Condo / Townhome)",
                    DP3: "DP-3 (Dwelling / Rental)",
                  };
                  const OCCUPANCY_LABELS: Record<string, string> = {
                    primary: "Primary residence",
                    secondary: "Secondary home",
                    investment: "Investment property",
                  };
                  return {
                    address,
                    sections: [
                      {
                        heading: "Policy Summary",
                        rows: [
                          { label: "Policy type", value: policyType ? POLICY_LABELS[policyType] ?? policyType : "—" },
                          { label: "Occupancy", value: occupancy ? OCCUPANCY_LABELS[occupancy] ?? occupancy : "—" },
                          { label: "Property type", value: propertyType || "—" },
                          { label: "Coverage A / Rebuild cost", value: fmt(rebuild) },
                          { label: "Annual premium", value: fmt(annualPremium) },
                          { label: "AOP deductible", value: fmt(aopDeductible) },
                          { label: "Flood zone", value: floodZone || "—" },
                        ],
                      },
                    ],
                    disclaimer:
                      "These are estimates only based on regional data, property characteristics, and standard assumptions. Results vary by specific property inspection and market availability. Not a binding quote. Coverage is not effective until confirmed by a licensed agent. Tateo Insurance Corp (Company) - License #L132640. Paul Christian Tateo (Agent) - License #W142842.",
                  };
                }}
                onSave={async () => {
                  if (!address || !address.trim()) {
                    throw new Error("Enter an address before saving.");
                  }
                  const key = address.trim().toLowerCase();
                  const existing = getInsuranceScenarios();
                  const match = existing.find(
                    s => s.address.trim().toLowerCase() === key
                  );
                  const updated: InsuranceScenario = {
                    id: match?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    address,
                    savedAt: new Date().toISOString(),
                    // If the user has typed a manual Annual Premium,
                    // persist that exact value and stamp the source.
                    // Otherwise fall back to the calculated midpoint
                    // (Coverage A × 0.75% × factor adjustment) — the
                    // sync helper is free to recompute this later.
                    annualPremium:
                      manualAnnualPremium != null
                        ? manualAnnualPremium
                        : match?.premiumSource === "quote" && typeof match.annualPremium === "number"
                          ? match.annualPremium
                          : Math.round(calc.mid),
                    // Persist Coverage A so the Phase 1 cross-tab value
                    // sync can read/protect it. Source carries forward
                    // from the saved scenario; if the user moved the
                    // Rebuild Cost slider this save call,
                    // `_stampManualOnValueDiff` in saveInsuranceScenarios
                    // will detect the diff vs `match.coverageA` and
                    // stamp coverageASource = "manual". If unchanged,
                    // the prior source ("property_value_sync" /
                    // "default" / "manual") is preserved.
                    coverageA: rebuild,
                    coverageASource: match?.coverageASource ?? "default",
                    // Stamp premium provenance from the manual-input
                    // state, preserving any prior "quote" upload that
                    // the page can't override today.
                    premiumSource:
                      manualAnnualPremium != null
                        ? "manual"
                        : match?.premiumSource === "quote"
                          ? "quote"
                          : "default_0_75_percent",
                    coverageType: region.name,
                    ...(policyType
                      ? {
                          policyType,
                          policyTypeSource: policyTypeSource ?? "default_rule",
                        }
                      : {}),
                    ...(match?.occupancyType ? { occupancyType: match.occupancyType } : {}),
                    ...(match?.propertyType ? { propertyType: match.propertyType } : {}),
                    userAnswerSources: withQuotePropertyAnswers(
                      match?.userAnswerSources,
                    ),
                  };
                  const next = match
                    ? existing.map(s => (s.id === match.id ? updated : s))
                    : [...existing, updated];
                  await saveInsuranceScenarios(next);
                }}
              />
            </div>
          </div>
        </div>

        {/* ── Main content ── */}
        <div className="container mx-auto px-4 py-6 space-y-6">

          {/* Page indicator */}
          <div className="max-w-2xl mx-auto lg:max-w-none">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-foreground">Insurance Estimate</p>
              <p className="text-xs text-muted-foreground font-medium">Page 1 of 1</p>
            </div>
            <div className="h-1.5 w-full rounded-full bg-primary" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

            {/* ── SECTION 1: General estimate ── */}
            <Card className="border shadow-sm overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Home className="h-4 w-4 text-primary" /> General Insurance Estimate
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Adjust the property details below to refine your planning estimate.
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                <InsuranceEstimateForm
                  policyType={policyType}
                  onPolicyTypeChange={(value) => {
                    setPolicyType(value);
                    setPolicyTypeSource(value ? "manual" : null);
                  }}
                  policyTypeNote={policyTypeSource === "manual" ? "Manual selection." : policyType ? "Auto-defaulted from this property's details." : "QuoteRUSH policy defaults are applied automatically when this selection changes."}
                  newPurchase={newPurchase}
                  onNewPurchaseChange={(value) => {
                    setNewPurchase(value); setPurchaseDate("");
                     if (
                       purchasePriceSource === "user-confirmed-contract" ||
                       purchasePriceSource === "user-confirmed-property-value"
                     ) {
                       setPurchasePriceSource(
                         value === true
                           ? "user-confirmed-contract"
                           : value === false
                             ? "user-confirmed-property-value"
                             : "",
                       );
                     }
                    if (value !== false) { setCurrentlyInsured(null); setCurrentCarrier(""); }
                  }}
                  currentlyInsured={currentlyInsured}
                  onCurrentlyInsuredChange={(value) => {
                    setCurrentlyInsured(value);
                    if (value !== true) {
                      setCurrentCarrier("");
                      saveCurrentPolicyExpirationDate("");
                    }
                  }}
                  currentCarrier={currentCarrier}
                  onCurrentCarrierChange={setCurrentCarrier}
                  currentPolicyExpirationDate={currentPolicyExpirationDate}
                  onCurrentPolicyExpirationDateChange={
                    saveCurrentPolicyExpirationDate
                  }
                  purchaseDate={purchaseDate}
                  onPurchaseDateChange={setPurchaseDate}
                   purchasePrice={purchasePrice}
                   onPurchasePriceChange={(value) => {
                     setPurchasePrice(value);
                     setPurchasePriceSource(
                        newPurchase === true
                          ? "user-confirmed-contract"
                          : newPurchase === false
                            ? "user-confirmed-property-value"
                            : "",
                     );
                   }}
                   purchasePriceSource={purchasePriceSource}
                  residenceUse={ho6ResidenceUse}
                  onResidenceUseChange={(value) => { setHo6ResidenceUse(value); if (value !== "investment") setHo6RentalTerm(""); }}
                  rentalTerm={ho6RentalTerm}
                  onRentalTermChange={setHo6RentalTerm}
                  rebuild={rebuild}
                  onRebuildChange={setRebuild}
                  roofYear={roofYear}
                  onRoofYearChange={setRoofYear}
                  openingProtection={openingProtectionIdx}
                  onOpeningProtectionChange={(value) => {
                    windMitigationLocksRef.current.openingProtection = true;
                    setOpeningProtectionIdx(value);
                  }}
                  roofShape={roofShapeIdx}
                  onRoofShapeChange={setRoofShapeIdx}
                  swr={swrIdx}
                  onSwrChange={(value) => {
                    windMitigationLocksRef.current.secondaryWaterResistance = true;
                    setSwrIdx(value);
                  }}
                  hurricaneDeductible={hurrIdx}
                  onHurricaneDeductibleChange={setHurrIdx}
                  construction={constIdx}
                   onConstructionChange={(value) => {
                     propertyCharacteristicLocksRef.current.construction = true;
                     setConstIdx(value);
                   }}
                  yearBuilt={yearBuilt}
                   onYearBuiltChange={(value) => {
                     propertyCharacteristicLocksRef.current.yearBuilt = true;
                     setYearBuilt(value);
                   }}
                   squareFeet={squareFeet}
                   onSquareFeetChange={(value) => {
                     propertyCharacteristicLocksRef.current.squareFeet = true;
                     setSquareFeet(value);
                   }}
                   propertyCharacteristicsNote={propertyCharacteristicsNote}
                  aopDeductible={aopDeductible}
                  onAopDeductibleChange={setAopDeductible}
                  floodZone={floodZone}
                  floodZoneSource={floodZoneSource === "fema" ? "FEMA" : floodZoneSource}
                   onFloodZoneChange={(value) => {
                     propertyCharacteristicLocksRef.current.floodZone = true;
                     setFloodZone(value);
                     setFloodZoneSource("Manual entry");
                   }}
                   hasClaims={hasClaims}
                   onHasClaimsChange={(value) => {
                     setHasClaims(value);
                     if (value === false) setClaimRecords([]);
                     if (value === true && claimRecords.length === 0) {
                       setClaimRecords([{ lossDate: "", claimDetail: "", amount: "", paid: null, priorResidence: null }]);
                     }
                   }}
                   claimRecords={claimRecords}
                   onClaimRecordsChange={setClaimRecords}
                  annualPremium={calc.mid}
                />
              </CardContent>
            </Card>

            {/* ── SECTION 2: Live carrier quotes ── */}
            <Card className="border shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary shrink-0" />
                        {qrSharedContext
                          ? "Preliminary carrier quote from last 30 days"
                          : "Live Carrier Quotes"}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {qrStatus === "idle" &&
                          "Get real-time rates from your Florida-appointed carriers."}
                        {qrStatus === "starting" &&
                          "Submitting to QuoteRUSH…"}
                        {qrStatus === "pending" &&
                          `QuoteBot is quoting your carriers — ${qrQuoteCounter} quote${qrQuoteCounter !== 1 ? "s" : ""} so far · ${qrElapsed}s`}
                        {qrStatus === "success" &&
                          `${qrQuoteCounter} carrier${qrQuoteCounter !== 1 ? "s" : ""} quoted${
                            qrExpiresAt
                              ? ` · saved rates, valid ${Math.max(
                                  0,
                                  Math.ceil(
                                    (new Date(qrExpiresAt).getTime() -
                                      Date.now()) /
                                      86400000
                                  )
                                )} more day${
                                  Math.ceil(
                                    (new Date(qrExpiresAt).getTime() -
                                      Date.now()) /
                                      86400000
                                  ) !== 1
                                    ? "s"
                                    : ""
                                }`
                              : " · checking for more…"
                          }`}
                        {qrStatus === "expired" &&
                          "These saved rates are over 30 days old — re-run for current pricing."}
                        {qrStatus === "error" &&
                          "Quote request failed — call us for a custom quote."}
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {qrStatus === "idle" && (
                        <Button
                          size="sm"
                          onClick={startQuoteRush}
                          disabled={
                            !address ||
                            !rebuild ||
                            !isAuthenticated
                          }
                        >
                          Get Live Quotes
                        </Button>
                      )}
                      {(qrStatus === "starting" ||
                        qrStatus === "pending") && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <div className="h-2.5 w-2.5 rounded-full bg-primary/50 animate-pulse" />
                          Working…
                        </div>
                      )}
                      {qrStatus === "success" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={refreshQuotes}
                          disabled={
                            qrRefreshing || !qrLeadId
                          }
                        >
                          {qrRefreshing
                            ? "Refreshing…"
                            : "Refresh"}
                        </Button>
                      )}
                      {(qrStatus === "expired" ||
                        qrStatus === "error") && (
                        <Button
                          size="sm"
                          onClick={startQuoteRush}
                        >
                          Re-run
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-xs leading-relaxed text-blue-950">
                    {qrSharedContext ? (
                      <>
                        <strong>Original preliminary quote inputs:</strong>{" "}
                        {String(
                          qrSharedContext.consumerPropertyAnswers.policyType ??
                            policyType ??
                            "HO3",
                        )}{" "}
                        with Coverage A of{" "}
                        {fmt(Number(
                          qrSharedContext.consumerPropertyAnswers.coverageA ??
                            rebuild,
                        ))}, home built{" "}
                        {String(
                          qrSharedContext.propertyDataSnapshot.yearBuilt ??
                            "not confirmed",
                        )}, roof year{" "}
                        {String(
                          qrSharedContext.propertyDataSnapshot.roofYear ??
                            "not confirmed",
                        )}, flood zone{" "}
                        {String(
                          qrSharedContext.propertyDataSnapshot.floodZone ??
                            "not confirmed",
                        )}, and{" "}
                        {Number(qrSharedContext.propertyDataSnapshot.sqFt ?? 0) > 0
                          ? `${Number(qrSharedContext.propertyDataSnapshot.sqFt).toLocaleString()} sq. ft.`
                          : "square footage not confirmed"}
                        .
                        {qrSharedContext.quoteProfileVersion ? (
                          <span className="block mt-1 text-blue-800">
                            Quote profile: {qrSharedContext.quoteProfileVersion}
                          </span>
                        ) : null}
                        {qrSharedContext.assumptions.length > 0 ? (
                          <>
                            <strong className="mt-2 block text-blue-900">
                              Fields requiring verification:
                            </strong>
                            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-blue-800">
                              {qrSharedContext.assumptions.map((assumption) => (
                                <li key={assumption}>{assumption}</li>
                              ))}
                            </ul>
                          </>
                        ) : null}
                        <span className="block mt-1 text-blue-800">
                          These saved rates reflect the original request, not
                          later edits on this page.
                        </span>
                      </>
                    ) : (
                      <>
                    <strong>New live quote requests use:</strong>{" "}
                    roof installed {roofYear}, home built {yearBuilt},{" "}
                    {openingProtectionIdx === 1
                      ? "impact protection"
                      : "no impact protection"}
                    , {["hip", "flat", "gable (other / unsure)"][roofShapeIdx] ?? "gable"} roof,{" "}
                    SWR {swrIdx === 2 ? "yes" : swrIdx === 0 ? "no" : "needs confirmation"},{" "}
                    {["concrete block", "mixed masonry / frame", "frame"][constIdx] ?? "concrete block"} construction,{" "}
                    {["2%", "5%", "10%"][hurrIdx] ?? "2%"} hurricane deductible, and{" "}
                    {fmt(aopDeductible)} AOP deductible.
                    {roofShapeIdx === 2 || swrIdx === 1 ? (
                      <span className="block mt-1 text-blue-800">
                        <strong>Carrier default to confirm:</strong>{" "}
                        {roofShapeIdx === 2
                          ? "the unspecified roof shape is sent as gable"
                          : ""}
                        {roofShapeIdx === 2 && swrIdx === 1 ? "; " : ""}
                        {swrIdx === 1
                          ? "SWR is sent as unknown for carrier confirmation"
                          : ""}
                        .
                      </span>
                    ) : null}
                    {constIdx !== 0 ? (
                      <span className="block mt-1 text-blue-800">
                        <strong>Construction subtype default to confirm:</strong>{" "}
                        {constIdx === 1
                          ? "mixed construction includes verified concrete-block masonry; the frame subtype is omitted"
                          : "the structural frame subtype is omitted until confirmed"}
                        .
                      </span>
                    ) : null}
                    <span className="block mt-1 text-blue-800">
                      <strong>Other defaults to confirm:</strong>{" "}
                      {!policyType
                        ? "policy type required"
                        : policyType === "HO3"
                          ? "primary residence"
                          : policyType === "DP3"
                            ? "investment property"
                            : ho6ResidenceUse
                              ? `${ho6ResidenceUse} residence`
                              : "HO6 residence use required"}
                      {policyType === "HO6" && ho6ResidenceUse === "investment"
                        ? `, ${ho6RentalTerm || "rental term required"}`
                        : ""}
                      , {newPurchase === null
                        ? "purchase status required"
                        : newPurchase
                          ? `new purchase closing ${purchaseDate || "date required"}`
                          : currentPolicyExpirationDate
                            ? `current policy expiration ${currentPolicyExpirationDate} (preferred over requested date ${purchaseDate || "not provided"})`
                            : `requested effective date ${purchaseDate || "30-day fallback disclosed at quote time"}`},
                      9 months or more occupied, purchase price{" "}
                      {purchasePrice > 0 ? fmt(purchasePrice) : "required"},
                       composite-shingle roof, slab foundation, and{" "}
                       {hasClaims === null
                         ? "claims history required"
                         : hasClaims
                           ? `${claimRecords.length} reported claim${claimRecords.length === 1 ? "" : "s"}`
                           : "no claims in the past five years"}.
                      {squareFeet > 0
                        ? ` Square footage is ${squareFeet.toLocaleString()} sq. ft.`
                        : " Square footage is omitted until a trusted source or manual answer is available."}
                    </span>
                    <details className="mt-1 text-blue-800">
                      <summary className="cursor-pointer font-semibold">
                        View additional carrier assumptions
                      </summary>
                      <span className="block mt-1">
                         For a new purchase, prior insurance is marked as a New Purchase assumption, while existing-home carrier answers remain private;
                         mortgage status is omitted when Havo cannot derive it; no alarms;
                        Exposure B terrain with nearby fire protection; and standard ancillary
                         coverages and endorsements{policyType === "HO6" ? ", including a $2,000 loss-assessment assumption" : ""}. Wind-mitigation-form status is inferred from the
                        property answers above. Confirm these details with the carrier or licensed agent.
                      </span>
                    </details>
                      </>
                    )}
                  </div>
                  {agentVerification.length > 0 ? (
                    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
                      <strong className="block">Agent-only verification</strong>
                      <ul className="mt-1 list-disc space-y-0.5 pl-4">
                        {agentVerification.map(field => (
                          <li key={field}>{field}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {/* Progress bar */}
                  {(qrStatus === "starting" ||
                    qrStatus === "pending") && (
                    <div className="mb-4 space-y-2">
                      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-1000"
                          style={{
                            width: `${Math.min(
                              (qrElapsed / 600) * 100,
                              90
                            )}%`,
                          }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground text-center">
                        QuoteBot is logging into carrier websites and pulling real-time rates. This typically takes 2–5 minutes.
                      </p>
                    </div>
                  )}

                  {/* Not authenticated */}
                  {!isAuthenticated &&
                    qrStatus === "idle" && (
                    <p className="text-xs text-muted-foreground text-center py-3">
                      Create a free account to get live carrier quotes from your Florida-appointed insurers.
                    </p>
                  )}

                  {/* Quotes (top 3) */}
                  {qrQuotes.length > 0 && (
                    <div className="space-y-2">
                      {qrQuotes.slice(0, 3).map((q, i) => (
                        <div
                          key={q.siteName + i}
                          className={`p-3 rounded-lg border ${
                            i === 0
                              ? "border-yellow-300 bg-yellow-50"
                              : "border-border bg-muted/20"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <span className="text-base mt-0.5">
                                {i === 0
                                  ? "🥇"
                                  : i === 1
                                  ? "🥈"
                                  : i === 2
                                  ? "🥉"
                                  : "•"}
                              </span>
                              <div>
                                <div className="text-sm font-semibold">
                                  {q.siteName}
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
                                  {q.hurricaneDeductible && (
                                    <div>
                                      Hurricane deductible:{" "}
                                      {q.hurricaneDeductible}
                                    </div>
                                  )}
                                  {q.aop && (
                                    <div>
                                      AOP deductible: {q.aop}
                                    </div>
                                  )}
                                  {q.coverageA > 0 && (
                                    <div>
                                      Coverage A:{" "}
                                      {new Intl.NumberFormat(
                                        "en-US",
                                        {
                                          style: "currency",
                                          currency: "USD",
                                          maximumFractionDigits: 0,
                                        }
                                      ).format(q.coverageA)}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-right shrink-0 ml-2">
                              <div className="text-base font-bold font-mono text-primary">
                                {new Intl.NumberFormat(
                                  "en-US",
                                  {
                                    style: "currency",
                                    currency: "USD",
                                    maximumFractionDigits: 0,
                                  }
                                ).format(q.annualPremium)}
                                /yr
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {new Intl.NumberFormat(
                                  "en-US",
                                  {
                                    style: "currency",
                                    currency: "USD",
                                    maximumFractionDigits: 0,
                                  }
                                ).format(q.monthlyPremium)}
                                /mo
                              </div>
                              {q.quoteUrl && (
                                <a
                                  href={q.quoteUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary underline mt-1 block"
                                >
                                  View quote →
                                </a>
                              )}
                            </div>
                          </div>
                          {i === 0 && !windMitigationReportConfirmed && (
                            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-left">
                              <p className="text-xs leading-relaxed text-amber-950">
                                This estimate assumes wind mitigation credits based on the home's age. A wind mitigation inspection is required to confirm them — without one, your premium may be higher.
                              </p>
                              <Button
                                size="sm"
                                variant="outline"
                                className="mt-2 h-8 border-amber-300 bg-white text-xs hover:bg-amber-100"
                                asChild
                              >
                                <a
                                  href={`mailto:christian@tateoco.com?subject=${encodeURIComponent("Wind mitigation report")}&body=${encodeURIComponent(`Property: ${address || "Please add the property address"}\n\nPlease attach the wind mitigation inspection report for review.`)}`}
                                >
                                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                                  Send wind mitigation report
                                </a>
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                      {qrStatus === "pending" && (
                        <p className="text-xs text-muted-foreground text-center">
                          More quotes may still be arriving…
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground text-center leading-relaxed pt-1">
                        Real-time carrier rates via Tateo &amp; Co ·
                        Tateo Insurance Corp · License #L132640 ·
                        Not a binding quote. Coverage not effective
                        until confirmed by a licensed agent.
                      </p>
                    </div>
                  )}

                  {/* Error / no quotes fallback */}
                  {qrStatus === "error" &&
                    qrQuotes.length === 0 && (
                    <div className="text-center py-4 space-y-3">
                      <p className="text-sm text-muted-foreground">
                        This property may need a custom quote.
                        Contact Tateo &amp; Co directly.
                      </p>
                      <div className="flex gap-2 justify-center">
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                        >
                          <a href="tel:+18132148356">
                            (813) 214-8356
                          </a>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                        >
                          <a href="mailto:christian@tateoco.com">
                            Email Us
                          </a>
                        </Button>
                      </div>
                    </div>
                  )}

                </CardContent>
            </Card>
          </div>

          {/* Flood warning */}
          <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-900 leading-relaxed">
              <strong>Flood insurance is not included in this estimate.</strong> Properties in AE or VE flood zones require a separate NFIP or private flood policy — often $800–$3,500+/year depending on zone and elevation. Ask your agent about an elevation certificate to reduce flood premiums.
            </p>
          </div>

          <p className="text-xs text-muted-foreground text-center leading-relaxed pb-4">
            These are estimates only based on regional data, property characteristics, and standard assumptions. Results vary by specific property inspection and market availability. Not a binding quote. Coverage not effective until confirmed by a licensed agent. Tateo Insurance Corp (Company) - License #L132640. Paul Christian Tateo (Agent) - License #W142842.
          </p>

        </div>
      </div>
      )}

      {/* ── Lead capture dialog ── */}
      <LeadCaptureDialog
        open={leadDialogOpen}
        onOpenChange={setLeadDialogOpen}
        action={leadDialogAction}
        address={address}
        onSuccess={handleLeadSuccess}
      />

      {/* ── Existing-account live-quote DOB preflight ── */}
      <Dialog
        open={dobPromptOpen}
        onOpenChange={(open) => {
          if (dobSaving) return;
          setDobPromptOpen(open);
          if (!open) {
            setDobInput("");
            setDobError("");
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Date of birth required</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleDobPreflight} className="space-y-4 pt-1">
            <p className="text-sm text-muted-foreground">
              Insurance carriers require the applicant's date of birth. Save it
              once to continue this live quote request.
            </p>
            <div className="space-y-1.5">
              <label
                htmlFor="live-quote-date-of-birth"
                className="text-sm font-medium"
              >
                Date of Birth
              </label>
              <input
                id="live-quote-date-of-birth"
                name="bday"
                type="date"
                min="1900-01-01"
                max={new Date().toISOString().slice(0, 10)}
                value={dobInput}
                onChange={(event) => setDobInput(event.target.value)}
                required
                autoComplete="bday"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            {dobError ? (
              <p className="text-sm text-destructive" role="alert">
                {dobError}
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setDobPromptOpen(false)}
                disabled={dobSaving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={dobSaving || !dobInput}
              >
                {dobSaving ? "Saving…" : "Save & Continue"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Add property dialog ── */}
      <Dialog open={showAddressPrompt} onOpenChange={setShowAddressPrompt}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add New Property</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <p className="text-sm text-muted-foreground">Enter the address for your new scenario (up to 5 total).</p>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                ref={newScenarioInputRef}
                type="text"
                value={newScenarioAddress}
                onChange={e => setNewScenarioAddress(e.target.value)}
                onKeyDown={e => e.key === "Enter" && confirmNewScenario()}
                placeholder="123 Main St, City, State…"
                autoComplete="off"
                className="w-full pl-9 pr-3 py-2 text-sm border rounded-md outline-none focus:ring-2 ring-primary/30 focus:border-primary"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setShowAddressPrompt(false); setNewScenarioAddress(""); }}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={confirmNewScenario} disabled={!newScenarioAddress.trim()}>
                Add Property
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
