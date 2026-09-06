tely small: a
  // client must never be able to nominate the user or agent for an event.
  const ifwActivitySchema = z.object({
    action: z.enum(["save", "download", "share"]),
    address: z.string().trim().min(1).max(500),
    summary: z.object({
      price: z.number().finite().nonnegative().max(100_000_000).optional(),
      downPayment: z.number().finite().nonnegative().max(100_000_000).optional(),
      loanAmount: z.number().finite().nonnegative().max(100_000_000).optional(),
      monthlyPayment: z.number().finite().nonnegative().max(1_000_000).optional(),
      cashToClose: z.number().finite().nonnegative().max(100_000_000).optional(),
      notes: z.string().trim().min(1).max(280).optional(),
    }).strict().optional(),
  });

  const IFW_ACTIVITY_WINDOW_MS = 60_000;
  const IFW_ACTIVITY_MAX_PER_MINUTE = 12;
  const claimIfwActivity = createIfwActivityClaimHandler(ifwActivityClaimStore, {
    windowMs: IFW_ACTIVITY_WINDOW_MS,
    maxPerWindow: IFW_ACTIVITY_MAX_PER_MINUTE,
    onUnavailable: error => {
      console.error(
        "[IFW] notification claim storage unavailable; continuing:",
        error instanceof Error ? error.message : error,
      );
    },
  });

  function formatIfwSummary(
    summary: z.infer<typeof ifwActivitySchema>["summary"],
  ): string {
    if (!summary) return "";
    const currency = (value: number) =>
      value.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      });
    const lines = [
      summary.price !== undefined && `Price: ${currency(summary.price)}`,
      summary.downPayment !== undefined &&
        `Down payment: ${currency(summary.downPayment)}`,
      summary.loanAmount !== undefined &&
        `Loan amount: ${currency(summary.loanAmount)}`,
      summary.monthlyPayment !== undefined &&
        `Monthly payment: ${currency(summary.monthlyPayment)}`,
      summary.cashToClose !== undefined &&
        `Cash to close: ${currency(summary.cashToClose)}`,
      summary.notes && `Notes: ${summary.notes}`,
    ].filter((line): line is string => Boolean(line));
    return lines.join("\n");
  }

  // POST /api/ifw/activity
  // Records save/download/share intent for the authenticated user's assigned
  // agent. FUB is intentionally best-effort so an outage cannot break a
  // worksheet action in the browser.
  app.post("/api/ifw/activity", async (req, res) => {
    try {
      const user = await optionalUser(req);
      if (!user) {
        return res.status(401).json({ error: "Sign in required" });
      }

      const input = ifwActivitySchema.parse(req.body);
      const addressKey = normalizeAddr(input.address);
      const dedupeKey = `${user.id}:${input.action}:${addressKey}`;

      // The atomic persistent claim shares duplicate and rate-limit state
      // across restarts/instances. Storage is best-effort: an outage must not
      // block the worksheet action in the browser.
      const claim = await claimIfwActivity({ userId: user.id, dedupeKey });
      if (claim === "duplicate") {
        return res.json({ ok: true, deduped: true });
      }
      if (claim === "rate_limited") {
        return res.status(429).json({
          error: "Too many worksheet actions. Please wait a moment.",
        });
      }

      // Identity and the account's saved agent choice come from the verified
      // auth record/profile, never from this request body. Validate the saved
      // choice against the server's FUB allowlist before routing.
      const { data: profile } = supabaseAdmin
        ? await supabaseAdmin
            .from("profiles")
            .select("name,phone,agent")
            .eq("id", user.id)
            .maybeSingle()
        : { data: null };
      const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
      const email = String(user.email ?? "").trim();
      const name = String(profile?.name ?? metadata.name ?? "").trim();
      const nameParts = name.split(/\s+/).filter(Boolean);
      const savedAgent = String(profile?.agent ?? metadata.agent ?? "").trim();
      const assignedAgent = Object.prototype.hasOwnProperty.call(FUB_AGENT_IDS, savedAgent)
        ? savedAgent
        : "Team";
      const actionLabel: Record<z.infer<typeof ifwActivitySchema>["action"], string> = {
        save: "saved",
        download: "downloaded",
        share: "shared",
      };
      const summary = formatIfwSummary(input.summary);

      if (email) {
        createFollowUpBossContact({
          firstName: nameParts[0] ?? email.split("@")[0] ?? "Havo",
          lastName: nameParts.slice(1).join(" ") || "Lead",
          email,
          phone: String(profile?.phone ?? metadata.phone ?? ""),
          address: input.address,
          agent: assignedAgent,
          messageHeader: `Customer ${actionLabel[input.action]} an IFW worksheet`,
          scenarioDetails:
            `The customer ${actionLabel[input.action]} their IFW worksheet for ${input.address}.` +
            (summary ? `\nWorksheet summary:\n${summary}` : ""),
        }).catch(error =>
          console.error("[FUB] IFW activity delivery failed:", error?.message ?? error),
        );
      } else {
        console.warn("[FUB] IFW activity skipped: verified user has no email");
      }

      return res.json({ ok: true, deduped: false });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid worksheet activity" });
      }
      console.error("[IFW] activity processing failed:", error);
      return res.status(500).json({ error: "Worksheet activity could not be recorded" });
    }
  });

  // Simple per-IP rate limiter for the notify endpoint (max 10/min per IP)
  const _notifyHits = new Map<string, number[]>();

  // Dedupe window for account events (keyed by `${userId}:${event}`) so a
  // rapid re-login doesn't spam Follow Up Boss with sign-in notes.
  const _accountEventSeen = new Map<string, number>();
  function notifyRateLimited(ip: string): boolean {
    const now = Date.now();
    const windowMs = 60_000;
    const hits = (_notifyHits.get(ip) || []).filter(t => now - t < windowMs);
    if (hits.length >= 10) { _notifyHits.set(ip, hits); return true; }
    hits.push(now);
    _notifyHits.set(ip, hits);
    return false;
  }

  // POST /api/leads/notify-new-scenario
  // Called when a logged-in user adds another property to their dashboard.
  // Sends a FUB event so the assigned agent knows the customer is exploring a new property.
  app.post("/api/leads/notify-new-scenario", async (req, res) => {
    try {
      const ip = (req.ip || req.socket.remoteAddress || "unknown").toString();
      if (notifyRateLimited(ip)) {
        return res.status(429).json({ error: "Too many notifications. Please wait a moment." });
      }
      const { firstName, lastName, email, phone, agent, address, scenarioType, scenarioDetails, referral } = z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional().default(""),
        agent: z.string().optional(),
        address: z.string().min(1),
        scenarioType: z.string().optional().default("Scenario"),
        scenarioDetails: z.string().optional(),
        referral: referralSchema,
      }).parse(req.body);

      console.log(`[LEAD] New property scenario: ${email} → ${address} (agent: ${agent || "Team"})`);

      // Non-blocking — never fail the request if FUB has an issue
      createFollowUpBossContact({
        firstName,
        lastName,
        email,
        phone,
        address,
        agent,
        scenarioDetails,
        referral,
        messageHeader: `Customer added another property to their dashboard: ${address}`,
      }).catch(err => console.error("[FUB] notify-new-scenario failed:", err.message));

      // Internal team alert (non-blocking — never crash the request if email fails)
      sendInternalAlert({
        scenarioType,
        userEmail: email,
        address,
        summary: scenarioDetails ?? "",
      }).catch(err => console.error("[internal-alert] notify-new-scenario failed:", err?.message ?? err));

      res.json({ ok: true });
    } catch (err: any) {
      console.error("notify-new-scenario error:", err);
      res.status(400).json({ error: err.message || "Failed to notify agent" });
    }
  });

  // ── FUB Team Leaderboard ─────────────────────────────────────────────────
  app.get("/api/fub/leaderboard", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const token = authHeader.slice(7);
    if (!supabaseAdmin) {
      return res.status(503).json({ error: "Auth backend not configured" });
    }
    try {
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !user) return res.status(401).json({ error: "Invalid session" });
      const email = user.email?.toLowerCase() ?? "";
      const allowed = LEADERBOARD_TEAM.some((m) => m.email === email) ||
        (LEADERBOARD_VIEWERS as readonly string[]).includes(email);
      if (!allowed) return res.status(403).json({ error: "Access denied" });
    } catch {
      return res.status(401).json({ error: "Auth check failed" });
    }

    const apiKey = process.env.FOLLOWUPBOSS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "FOLLOWUPBOSS_API_KEY not set on server" });
    }

    const raw = (req.query.period as string) ?? "today";
    const validPeriods: Period[] = ["today", "yesterday", "week", "month", "quarter", "year"];
    const period: Period = (validPeriods.includes(raw as Period) ? raw : "today") as Period;

    try {
      const result = await getLeaderboardData(apiKey, period);
      res.json({
        ...result.data,
        refreshState: result.refreshState,
        ...(result.retryAfterSeconds !== undefined ? { retryAfterSeconds: result.retryAfterSeconds } : {}),
      });
    } catch (err: any) {
      console.error("[leaderboard] fetch error:", err.message);
      res.status(500).json({ error: err.message ?? "Failed to fetch leaderboard data" });
    }
  });

  app.post("/api/fub/leaderboard/refresh", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Not authenticated" });
    const token = authHeader.slice(7);
    if (!supabaseAdmin) {
      return res.status(503).json({ error: "Auth backend not configured" });
    }
    try {
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !user) return res.status(401).json({ error: "Invalid session" });
      const email = user.email?.toLowerCase() ?? "";
      const isAdmin = LEADERBOARD_TEAM.some((m) => m.email === email && m.isAdmin);
      if (!isAdmin) return res.status(403).json({ error: "Admin only" });
    } catch {
      return res.status(401).json({ error: "Auth check failed" });
    }
    bustLeaderboardCache();
    res.json({ ok: true, message: "Leaderboard cache cleared" });
  });

  app.get("/api/fub/leaderboard/debug", async (_req, res) => {
    const apiKey = process.env.FOLLOWUPBOSS_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "FOLLOWUPBOSS_API_KEY not set" });

    try {
      let allDeals: any[] = [];
      let offset = 0;
      while (true) {
        const r = await fetch(
          `https://api.followupboss.com/v1/deals?limit=200&offset=${offset}`,
          { headers: fubHeaders(apiKey) }
        );
        const d = await r.json();
        const items: any[] = d.deals ?? [];
        allDeals.push(...items);
        const total: number = d._metadata?.total ?? items.length;
        offset += 200;
        if (offset >= total || items.length === 0) break;
      }

      // Show every commission-related field on every deal
      const commissionBreakdown = allDeals.map((d: any) => ({
        id:                d.id,
        name:              d.name,
        pipelineName:      d.pipelineName,
        stageName:         d.stageName,
        price:             d.price,
        // All commission fields — we need to see which one holds the right value
        commissionValue:   d.commissionValue,
        agentCommission:   d.agentCommission,
        teamCommission:    d.teamCommission,
        users:             (d.users ?? []).map((u: any) => ({ id: u.id, name: u.name })),
      }));

      // Flag any deals where commissionValue !== agentCommission + teamCommission
      const mismatches = commissionBreakdown.filter((d: any) => {
        const sum = (d.agentCommission ?? 0) + (d.teamCommission ?? 0);
        return Math.abs(sum - (d.commissionValue ?? 0)) > 1;
      });

      // Summary: which field has non-zero values
      const agentCommissionNonZero = commissionBreakdown.filter((d: any) => (d.agentCommission ?? 0) > 0).length;
      const commissionValueNonZero = commissionBreakdown.filter((d: any) => (d.commissionValue ?? 0) > 0).length;
      const teamCommissionNonZero  = commissionBreakdown.filter((d: any) => (d.teamCommission  ?? 0) > 0).length;

      res.json({
        totalDeals: allDeals.length,
        fieldSummary: {
          dealsWithAgentCommission: agentCommissionNonZero,
          dealsWithCommissionValue: commissionValueNonZero,
          dealsWithTeamCommission:  teamCommissionNonZero,
        },
        mismatchCount: mismatches.length,
        mismatches,
        allDeals: commissionBreakdown,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/fub/showing-request
  // Fired when a user taps "Schedule your showing now" on Purchase with Loan
  // (Likely Qualifies only) or Purchase with Cash. Notifies Follow Up Boss
  // with the property address. The tel: link is handled entirely client-side
  // and is NEVER blocked by this endpoint — if FUB fails the user can still
  // call. Works for logged-in and logged-out visitors: with an email we
  // create/append the FUB contact note; either way the team gets an internal
  // alert email so anonymous requests still reach us.
  app.post("/api/fub/showing-request", async (req, res) => {
    try {
      const ip = (req.ip || req.socket.remoteAddress || "unknown").toString();
      if (notifyRateLimited(ip)) {
        return res.status(429).json({ error: "Too many requests. Please wait a moment." });
      }
      const body = z.object({
        address: z.string().min(1),
        service: z.enum(["purchase_with_loan", "purchase_with_cash"]),
        eventType: z.enum([
          "showing_request_started",
          "showing_request_text_selected",
          "showing_request_call_selected",
        ]).optional(),
        contactMethod: z.enum(["text", "call"]).nullish(),
        qualificationStatus: z.string().optional(),
        estimatedPrice: z.number().optional(),
        normalizedPropertyKey: z.string().optional(),
        pageUrl: z.string().optional().default(""),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional().default(""),
        agent: z.string().optional(),
        userId: z.string().optional(),
      }).parse(req.body);

      const serviceLabel = body.service === "purchase_with_loan" ? "Purchase with Loan" : "Purchase with Cash";
      const contactLabel = body.contactMethod === "text" ? "Text" : body.contactMethod === "call" ? "Call" : "";
      // Headline + lead-in line vary by which step of the flow fired this.
      const eventType = body.eventType ?? "showing_request_started";
      const eventTitle =
        eventType === "showing_request_text_selected"
          ? "User selected Text for showing request."
          : eventType === "showing_request_call_selected"
          ? "User selected Call for showing request."
          : "Showing request started from Havo.";
      console.log("[api/fub/showing-request] request received");
      console.log(`[api/fub/showing-request] property address: ${body.address}`);
      console.log(`[api/fub/showing-request] user email: ${body.email || "(none)"}`);
      console.log(`[api/fub/showing-request] user phone: ${body.phone || "(none)"}`);
      console.log(`[showing-alert-env] RESEND_API_KEY present ${!!process.env.RESEND_API_KEY}`);
      console.log(`[showing-alert-env] ALERT_FROM_EMAIL present ${!!process.env.ALERT_FROM_EMAIL}`);
      console.log(`[showing-alert-env] INTERNAL_ALERT_EMAIL present ${!!process.env.INTERNAL_ALERT_EMAIL}`);
      console.log(`[showing-alert-env] ALERT_FROM_EMAIL uses updates.tateoco.com ${(process.env.ALERT_FROM_EMAIL || "").includes("updates.tateoco.com")}`);
      console.log(`[showing-request] ${serviceLabel} → ${body.address} (event: ${eventType}, user: ${body.email || "anonymous"}, contact: ${body.contactMethod || "n/a"})`);
      console.log("[showing-request-schema] sql needed no");

      const priceLine = typeof body.estimatedPrice === "number" && body.estimatedPrice > 0
        ? `Estimated Price: $${Math.round(body.estimatedPrice).toLocaleString()}`
        : "";
      // Resolve a display name from first/last (the "-" placeholder lastName
      // means "no last name supplied", so drop it).
      const contactName = [
        body.firstName,
        body.lastName && body.lastName !== "-" ? body.lastName : "",
      ].filter((p) => (p || "").trim()).join(" ").trim();
      const contactEmail = body.email || "Not provided";
      const contactPhone = body.phone || "Not provided";
      const noteBody = [
        eventTitle,
        "",
        "Contact:",
        `Name: ${contactName || "Not provided"}`,
        `Email: ${contactEmail}`,
        `Phone: ${contactPhone}`,
        "",
        `Property: ${body.address}`,
        "",
        contactLabel ? `Preferred contact action: ${contactLabel}` : "",
        `Service: ${serviceLabel}`,
        body.qualificationStatus ? `Qualification Status: ${body.qualificationStatus}` : "",
        priceLine,
        body.pageUrl ? `Page: ${body.pageUrl}` : "",
        eventType === "showing_request_started"
          ? "The user clicked Schedule your showing now. Follow up even if no call/text was completed."
          : "",
      ].filter(Boolean).join("\n");

      // 1) Follow Up Boss — only when we have an email to match/create a contact.
      // This CRM note is unchanged in behaviour; we now await it so the response
      // can report its outcome alongside the email alert.
      const fub: { ok: boolean; noteAdded: boolean; skipped: boolean; error: string | null } =
        { ok: false, noteAdded: false, skipped: false, error: null };
      if (body.email) {
        console.log("[api/fub/showing-request] FUB note start");
        console.log("[fub-showing] contact lookup", body.email);
        try {
          const r = await createFollowUpBossContact({
            firstName: body.firstName || body.email.split("@")[0],
            lastName: body.lastName || "-",
            email: body.email,
            phone: body.phone || "",
            address: body.address,
            agent: body.agent,
            scenarioDetails: noteBody,
            messageHeader: `Showing requested: ${body.address}`,
          });
          fub.ok = r.ok;
          fub.noteAdded = r.noteAdded;
          fub.skipped = r.skipped;
          fub.error = r.error;
          if (r.ok) {
            console.log("[api/fub/showing-request] FUB note success");
            console.log("[fub-showing] note/event created");
          } else {
            console.warn(`[api/fub/showing-request] FUB note not added: ${r.error || (r.skipped ? "skipped" : "unknown")}`);
          }
        } catch (err: any) {
          fub.error = err?.message ?? String(err);
          console.error("[fub-showing] error", fub.error);
        }
      } else {
        fub.skipped = true;
        console.log("[fub-showing] no email on request — internal alert only");
      }

      // 2) Internal team email — always, so anonymous showing requests reach us.
      // Sent via the verified Resend domain (updates.tateoco.com).
      console.log("[api/fub/showing-request] email alert start");
      const alert = await sendInternalAlert({
        scenarioType: `Showing Requested — ${serviceLabel}`,
        userEmail: body.email || "logged-out visitor",
        address: body.address,
        summary: noteBody,
        contact: {
          name: contactName,
          email: body.email || "",
          phone: body.phone || "",
        },
      });
      const fromDomain = (alert.from.match(/@([^>\s]+)/)?.[1]) || "(none)";
      console.log(`[api/fub/showing-request] email recipient ${alert.to || "(none)"}`);
      console.log(`[api/fub/showing-request] email from domain ${fromDomain}`);
      const email = {
        ok: alert.status === "sent",
        status: alert.status,
        to: alert.to || null,
        from: alert.from || null,
        error: alert.error,
      };
      if (email.ok) {
        console.log("[api/fub/showing-request] email alert success");
      } else {
        console.error(`[api/fub/showing-request] email alert error: ${alert.error || alert.status}`);
      }

      // Partial success is fine: the popup/SMS/tel never depend on this response.
      console.log("[api/fub/showing-request] success");
      res.json({ ok: fub.ok || email.ok, fub, email });
    } catch (err: any) {
      console.error("[api/fub/showing-request] error:", err);
      res.status(400).json({ ok: false, error: err.message || "Failed to log showing request" });
    }
  });

  // POST /api/leads/account-event
  // Notifies Follow Up Boss when a user creates a free account or signs in.
  // Creates the contact if missing (account_created) or adds a note to the
  // existing contact (typical for account_signed_in). Auth-required and
  // non-blocking, with a short per-user dedupe on sign-ins. Only fired on
  // real signup/sign-in actions by the client — never on a session
  // restore/refresh — so sign-in notifications aren't duplicated on reload.
  app.post("/api/leads/account-event", async (req, res) => {
    // Identity is taken from the verified Supabase session, never the body —
    // this endpoint cannot be used to forge CRM events for arbitrary emails.
    const user = await requireUser(req, res);
    if (!user) return;
    try {
      const { event } = z.object({
        event: z.enum(["account_created", "account_signed_in"]),
      }).parse(req.body);

      const email = (user.email || "").toLowerCase().trim();
      if (!email) return res.status(400).json({ error: "No email on session" });

      // Dedupe: skip a repeat sign-in note within 5 minutes for the same
      // user. account_created is naturally once per user.
      const dedupeKey = `${user.id}:${event}`;
      const now = Date.now();
      const last = _accountEventSeen.get(dedupeKey) || 0;
      if (event === "account_signed_in" && now - last < 5 * 60_000) {
        console.log(`[fub] duplicate prevention result: skipped ${event} for ${user.id}`);
        return res.status(202).json({ ok: true, deduped: true });
      }
      _accountEventSeen.set(dedupeKey, now);

      const meta = (user.user_metadata || {}) as Record<string, any>;
      const parts = String(meta.name || "").trim().split(/\s+/).filter(Boolean);
      const firstName = parts[0] || "Havo";
      const lastName = parts.slice(1).join(" ") || "User";
      const phone = String(meta.phone || "");
      const messageHeader =
        event === "account_created"
          ? "User created a free account in the platform."
          : "User signed into their account.";

      console.log(`[fub] ${event} start`);

      // Non-blocking — never fail the request if FUB has an issue.
      createFollowUpBossContact({
        firstName,
        lastName,
        email,
        phone,
        agent: "Team",
        messageHeader,
      })
        .then(() => console.log(`[fub] ${event} success`))
        .catch((err) => console.error(`[fub] ${event} error:`, err.message));

      // Onboarding drip campaign (steps 2–5; step 1 is the welcome email).
      // Fires only once per user — account_created is a one-time event.
      if (event === "account_created") {
        startOnboardingCampaign({
          userId: user.id,
          email,
          firstName: parts[0] || undefined,
        }).catch(err =>
          console.error("[onboarding] campaign start failed:", err?.message)
        );
      }

      res.status(202).json({ ok: true });
    } catch (err: any) {
      console.error("account-event error:", err);
      res.status(400).json({ error: err.message || "Failed to record account event" });
    }
  });

  // POST /api/leads/update-profile
  // Called when a logged-in user changes their name/email/phone in Settings.
  // Looks up the FUB contact by their previous email and updates it in place.
  app.post("/api/leads/update-profile", async (req, res) => {
    try {
      const ip = (req.ip || req.socket.remoteAddress || "unknown").toString();
      if (notifyRateLimited(ip)) {
        return res.status(429).json({ error: "Too many requests. Please wait a moment." });
      }
      const { previousEmail, firstName, lastName, email, phone, agent } = z.object({
        previousEmail: z.string().email(),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional().default(""),
        agent: z.string().optional(),
      }).parse(req.body);

      const apiKey = process.env.FOLLOWUPBOSS_API_KEY;
      if (!apiKey) {
        console.log("[FUB] FOLLOWUPBOSS_API_KEY not set — skipping profile update.");
        return res.json({ ok: true, skipped: true });
      }

      // Look up by previous email; if not found, also try the new email
      let personId = await findFubPersonByEmail(apiKey, previousEmail.toLowerCase().trim());
      if (!personId && email.toLowerCase().trim() !== previousEmail.toLowerCase().trim()) {
        personId = await findFubPersonByEmail(apiKey, email.toLowerCase().trim());
      }

      if (!personId) {
        console.log(`[FUB] No existing contact for ${previousEmail}; skipping profile update.`);
        return res.json({ ok: true, found: false });
      }

      const phoneDigits = normalizePhoneDigits(phone);
      const agentName = agent === "Team" ? "Christian Tateo" : (agent || "Christian Tateo");
      const agentId = FUB_AGENT_IDS[agentName] ?? 1;

      const personUpdate: Record<string, any> = {
        firstName,
        lastName,
        assignedUserId: agentId,
        emails: [{ value: email, type: "work" }],
      };
      if (phoneDigits) {
        personUpdate.phones = [{ value: formatPhoneDisplay(phoneDigits), type: "mobile" }];
      }

      const putRes = await fetch(`https://api.followupboss.com/v1/people/${personId}`, {
        method: "PUT",
        headers: fubHeaders(apiKey),
        body: JSON.stringify(personUpdate),
      });
      if (!putRes.ok) {
        const errText = await putRes.text();
        console.warn(`[FUB] Profile update failed ${putRes.status}:`, errText);
        return res.status(502).json({ error: `Failed to update contact (${putRes.status}).` });
      }

      console.log(`[FUB] Profile updated for person ${personId}: ${firstName} ${lastName} <${email}>`);
      res.json({ ok: true, personId });
    } catch (err: any) {
      console.error("update-profile error:", err);
      res.status(400).json({ error: err.message || "Failed to update profile" });
    }
  });

  // POST /api/leads/invite-user
  // Called when a logged-in user invites someone to share their account.
  // Creates a FUB contact for the invitee assigned to the same agent and adds a note on the inviter's record.
  app.post("/api/leads/invite-user", async (req, res) => {
    try {
      const ip = (req.ip || req.socket.remoteAddress || "unknown").toString();
      if (notifyRateLimited(ip)) {
        return res.status(429).json({ error: "Too many requests. Please wait a moment." });
      }
      const { inviterFirstName, inviterLastName, inviterEmail, inviterPhone, agent, inviteeName, inviteeEmail } = z.object({
        inviterFirstName: z.string().min(1),
        inviterLastName: z.string().min(1),
        inviterEmail: z.string().email(),
        inviterPhone: z.string().optional().default(""),
        agent: z.string().optional(),
        inviteeName: z.string().min(1),
        inviteeEmail: z.string().email(),
      }).parse(req.body);

      const inviterFullName = `${inviterFirstName} ${inviterLastName}`.trim();
      const trimmedInvitee = inviteeName.trim();
      const [first, ...rest] = trimmedInvitee.split(/\s+/);
      const inviteeFirst = first || inviteeEmail.split("@")[0];
      const inviteeLast = rest.join(" ") || "-";

      console.log(`[LEAD] Invite: ${inviterEmail} → ${inviteeEmail} (agent: ${agent || "Team"})`);

      // Create/update the invitee contact in FUB, assigned to the inviter's agent.
      createFollowUpBossContact({
        firstName: inviteeFirst,
        lastName: inviteeLast,
        email: inviteeEmail,
        phone: "",
        agent,
        messageHeader: `Invited by ${inviterFullName} (${inviterEmail}) to share their Havo account.`,
      }).catch(err => console.error("[FUB] invite-user invitee failed:", err.message));

      // Add a note to the inviter's FUB record too.
      createFollowUpBossContact({
        firstName: inviterFirstName,
        lastName: inviterLastName,
        email: inviterEmail,
        phone: inviterPhone,
        agent,
        messageHeader: `Added a shared account user: ${trimmedInvitee} (${inviteeEmail})`,
      }).catch(err => console.error("[FUB] invite-user inviter failed:", err.message));

      res.json({ ok: true });
    } catch (err: any) {
      console.error("invite-user error:", err);
      res.status(400).json({ error: err.message || "Failed to send invite" });
    }
  });

  // GET /api/leads (simple admin view — protect in production)
  app.get("/api/leads", (_req, res) => {
    res.json({ count: _leads.length, leads: _leads });
  });

  // ── POST /api/zillow-property-lookup ──────────────────────────────
  // Backend-only Apify Zillow Scraper. Successful results are cached
  // indefinitely in Supabase `property_cache` keyed by a NORMALIZED
  // property key (street# + street name + ZIP5 + state, no city) so the
  // same property entered with different formatting — or under a
  // different city name (e.g. Google says St. Petersburg, Zillow says
  // Kenneth City) — shares one cache entry. Cached entries do NOT
  // auto-expire; the original successful scrape stays stable for as long
  // as the property is owned. To force a re-pull (e.g. after a sale)
  // delete the row from `property_cache`.

  // In-process dedup so concurrent lookups for the same property don't
  // double-scrape Apify. Keyed by cacheKey, value is the in-flight
  // Promise; cleared once it resolves/rejects. Effective per server
  // instance — best-effort only.
  const inFlightZillow = new Map<string, Promise<PropertyScenario>>();

  app.post("/api/zillow-property-lookup", async (req, res) => {
    const addressOrUrl = String(req.body?.addressOrUrl ?? "").trim();
    if (!addressOrUrl) {
      return res.status(400).json({ error: "addressOrUrl is required" });
    }
    // Namespaced cache key. URLs and addresses live in distinct keyspaces
    // so a URL that happens to look like an address can never collide.
    // - URLs: drop query strings + trailing slashes so the same listing
    //   fetched with different tracking params shares one entry.
    // - Addresses: use the NORMALIZED property key (street + zip + state)
    //   when parseable, falling back to a sanitized raw string only when
    //   the address is too sparse to normalize.
    const isUrl = /^https?:\/\//i.test(addressOrUrl);
    let cacheKey: string;
    if (isUrl) {
      try {
        const u = new URL(addressOrUrl);
        const path = u.pathname.replace(/\/+$/, "");
        cacheKey = `url:${u.host.toLowerCase()}${path.toLowerCase()}`;
      } catch {
        cacheKey = `url:${addressOrUrl.toLowerCase()}`;
      }
    } else {
      const normalizedKey = buildNormalizedPropertyKey(addressOrUrl);
      cacheKey = normalizedKey
        ?? `addr:raw:${addressOrUrl.toLowerCase().replace(/\s+/g, " ").trim()}`;
    }

    // 1. Cache check (only if Supabase admin is configured). Successful
    // entries are served regardless of age — see header comment.
    let cachedNormalized: any = null;
    if (supabaseAdmin) {
      try {
        const { data: cached } = await supabaseAdmin
          .from("property_cache")
          .select("normalized, fetched_at")
          .eq("cache_key", cacheKey)
          .maybeSingle();
        if (cached?.normalized) {
          const ageMs = cached.fetched_at
            ? Date.now() - new Date(cached.fetched_at).getTime()
            : null;
          const cachedPhotosCount = Array.isArray((cached.normalized as any).photos)
            ? (cached.normalized as any).photos.length
            : 0;
          // Photo back-fill: if the cached normalized blob has photos
          // already, serve immediately. Otherwise fall through and
          // re-scrape — old cache entries from before the photo-fix
          // may have empty arrays.
          if (cachedPhotosCount > 0) {
            return res.json({ cached: true, property: cached.normalized });
          }
          cachedNormalized = cached.normalized;
        } else {
        }
      } catch (e: any) {
        console.warn("[zillow-lookup] cache read failed:", e?.message);
      }
    }

    // 2. Live Apify call — deduped by cacheKey so two concurrent requests
    // for the same property share one Apify run.
    let property: PropertyScenario;
    try {
      let inFlight = inFlightZillow.get(cacheKey);
      if (inFlight) {
      } else {
        inFlight = fetchZillowProperty(addressOrUrl);
        inFlightZillow.set(cacheKey, inFlight);
        // Clear the dedup slot when the scrape settles. The `.finally()`
        // returns a NEW promise that rejects in lockstep with `inFlight`
        // when the scrape fails (e.g. "No Zillow results found"); without
        // the trailing `.catch()` that rejection is unhandled and Node 20
        // treats it as fatal, crashing the whole server. The real error is
        // still surfaced to the request via the `await inFlight` below.
        void inFlight
          .finally(() => {
            // Clear only if the slot still points at this same promise.
            if (inFlightZillow.get(cacheKey) === inFlight) {
              inFlightZillow.delete(cacheKey);
            }
          })
          .catch(() => {});
      }
      property = await inFlight;
      // Data safety: if the fresh scrape returned 0 photos but the
      // existing cache row had some, preserve the cached photos so we
      // don't blank out a good record because of a one-off scrape miss.
      if (
        (!property.photos || property.photos.length === 0) &&
        cachedNormalized &&
        Array.isArray((cachedNormalized as any).photos) &&
        (cachedNormalized as any).photos.length > 0
      ) {
        property.photos = (cachedNormalized as any).photos;
      }
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      const status = /No Zillow results/i.test(msg) ? 404
        : /timed out/i.test(msg) ? 504
        : /Missing/i.test(msg) ? 400
        : 502;
      console.error("[zillow-lookup] apify error:", msg);
      // Failures are NOT cached — allow future retries.
      return res.status(status).json({ error: msg });
    }

    // 3. Write-through cache (best-effort; never block the response).
    // Only successful scrapes are cached.
    if (supabaseAdmin) {
      void Promise.resolve(
        supabaseAdmin
          .from("property_cache")
          .upsert(
            {
              cache_key: cacheKey,
              normalized: property,
              raw: property.rawZillowData,
              fetched_at: new Date().toISOString(),
            },
            { onConflict: "cache_key" },
          )
          .then(({ error }) => {
            if (error) console.warn("[zillow-lookup] cache write failed:", error.message);
          })
      )
        // Fire-and-forget: a transport-level rejection here must not become
        // an unhandled rejection (fatal under Node 20's default).
        .catch((e: any) => console.warn("[zillow-lookup] cache write rejected:", e?.message ?? e));
    }

    return res.json({ cached: false, property });
  });

  // POST /api/zillow-property-lookup/policy-type
  // Tiny helper so the frontend can recompute insurancePolicyType after
  // the user changes propertyType or occupancy without re-hitting Apify.
  app.post("/api/zillow-property-lookup/policy-type", (req, res) => {
    const { propertyType = "", occupancyType = "" } = req.body ?? {};
    res.json({ policyType: derivePolicyType(propertyType, occupancyType) });
  });

  // ── POST /api/listing-market-analysis ──────────────────────────────
  // AI-powered weekly market briefing for a For Sale listing. Reads the
  // cached row from Supabase first; only calls Anthropic when stale (Friday
  // rollover) or missing. Anthropic API key is read from env server-side
  // and never sent to the frontend.
  //
  // Auth: the caller MUST send the Supabase access token in the
  // `Authorization: Bearer <token>` header. We verify it with the admin
  // client and derive `userId` from the token — never from the request body.
  // This prevents IDOR since we use the service-role client (RLS bypassed).
  app.post("/api/listing-market-analysis", async (req, res) => {
    try {
      if (!supabaseAdmin) {
        return res.status(503).json({ error: "Auth backend not configured" });
      }
      const authHeader = req.headers.authorization || "";
      const match = /^Bearer\s+(.+)$/i.exec(authHeader);
      if (!match) {
        return res.status(401).json({ error: "Missing bearer token" });
      }
      const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(match[1]);
      if (userErr || !userData?.user?.id) {
        return res.status(401).json({ error: "Invalid or expired session" });
      }
      const verifiedUserId = userData.user.id;

      const body = (req.body ?? {}) as Partial<ListingInput> & { forceRefresh?: boolean };
      if (!body.listingId || !body.address) {
        return res.status(400).json({ error: "listingId and address are required" });
      }

      // Status gate: Market Analysis only runs for scenarios that are
      // actually being marketed. We trust the DB, not the client body,
      // so a spoofed status can't bypass the gate. A Draft row gets a
      // 200 with `skipped: true` so the client renders the clean
      // placeholder instead of an error.
      const { data: statusRow } = await supabaseAdmin
        .from("seller_scenarios")
        .select("status")
        .eq("id", body.listingId)
        .eq("user_id", verifiedUserId)
        .maybeSingle();
      const sellerStatus = (statusRow?.status ?? null) as string | null;
      const allowedStatus = sellerStatus === "ready_to_list" || sellerStatus === "listed";
      if (!allowedStatus) {
        return res.json({ analysis: null, generating: false, skipped: true, reason: "draft_status" });
      }

      // Server-side guardrail: the frontend cannot trigger Anthropic on
      // demand. `forceRefresh` is only honored for admin emails listed in
      // MARKET_ANALYSIS_ADMIN_EMAILS (comma-separated). Everyone else is
      // silently demoted to the normal cached/weekly path.
      const adminEmails = (process.env.MARKET_ANALYSIS_ADMIN_EMAILS || "")
        .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
      const callerEmail = (userData.user.email || "").toLowerCase();
      const isAdmin = adminEmails.length > 0 && adminEmails.includes(callerEmail);
      const honorForceRefresh = !!body.forceRefresh && isAdmin;
      if (body.forceRefresh && !isAdmin) {
      }

      // Enrich the listing input with cached Zillow property data when we
      // have it (beds/baths/sqft/yearBuilt/lotSize/last sold/photo count/
      // property type). Same logic as the weekly precompute job uses.
      const enriched = await enrichListingFromPropertyCache({
        ...(body as ListingInput),
        userId: verifiedUserId,
      });

      // Two paths:
      //  - Admin force-refresh: synchronous generate (blocks until done).
      //  - Everyone else: fast read from Supabase. If the current-cycle
      //    saved analysis is missing/stale/insufficient, queue background
      //    generation and return the prior saved row (or a "generating"
      //    stub) immediately — NEVER blocks on Anthropic.
      let record;
      let generating = false;
      if (honorForceRefresh) {
        // Route through the single-flight lock so an admin refresh won't
        // duplicate an in-flight scheduler/display generation for the
        // same listing/week.
        const { ensureMarketAnalysis } = await import("./integrations/market-analysis-scheduler");
        record = await ensureMarketAnalysis(enriched, { forceRefresh: true });
      } else {
        const display = await getMarketAnalysisForDisplay(enriched);
        record = display.analysis;
        generating = display.generating;
      }
      if (!record) {
        return res.status(503).json({ error: "Market analysis unavailable" });
      }
      const { raw_prompt: _rp, raw_anthropic_response: _ra, ...safe } = record as any;
      return res.json({ analysis: safe, generating });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[market-analysis] route error:", message);
      return res.status(500).json({ error: message });
    }
  });

  // ── POST /api/admin/market-analysis-weekly/run ─────────────────────
  // Manual trigger for the weekly precompute job. Gated by
  // MARKET_ANALYSIS_ADMIN_EMAILS. Useful for QA / first-run after deploy
  // before Friday rolls around.
  app.post("/api/admin/market-analysis-weekly/run", async (req, res) => {
    try {
      if (!supabaseAdmin) return res.status(503).json({ error: "Auth backend not configured" });
      const authHeader = req.headers.authorization || "";
      const match = /^Bearer\s+(.+)$/i.exec(authHeader);
      if (!match) return res.status(401).json({ error: "Missing bearer token" });
      const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(match[1]);
      if (userErr || !userData?.user?.id) return res.status(401).json({ error: "Invalid or expired session" });
      const adminEmails = (process.env.MARKET_ANALYSIS_ADMIN_EMAILS || "")
        .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
      const callerEmail = (userData.user.email || "").toLowerCase();
      const isAdmin = adminEmails.length > 0 && adminEmails.includes(callerEmail);
      if (!isAdmin) return res.status(403).json({ error: "Admin only" });
      // Run in background; respond immediately so the request doesn't time out.
      void precomputeWeeklyMarketAnalysesForAllSellerScenarios()
        .catch((e) => console.warn("[market-analysis-weekly] manual run failed:", e?.message));
      return res.json({ ok: true, queued: true });
    } catch (err) {
      return res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
    }
  });

  // ── Property alert subscriptions (Phase 1: CRUD + admin manual checks) ─
  // The bell on dashboard saved scenarios writes here. Auth: Bearer token →
  // derive user from server-side verification (never trust body user_id).
  // RLS is also enabled on the table; this server still uses the service-
  // role client and enforces user_id manually.
  async function requireUser(req: any, res: any) {
    if (!supabaseAdmin) {
      res.status(503).json({ error: "Auth backend not configured" });
      return null;
    }
    const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || "");
    if (!m) {
      res.status(401).json({ error: "Missing bearer token" });
      return null;
    }
    const { data, error } = await supabaseAdmin.auth.getUser(m[1]);
    if (error || !data?.user?.id) {
      res.status(401).json({ error: "Invalid or expired session" });
      return null;
    }
    return data.user;
  }

  // ── Havo Pro subscription (Stripe Managed Payments) ────────────────
  // POST /api/subscription/create-checkout-session — returns a Stripe
  // Checkout URL for the $20/mo Havo Pro plan. The userId comes from the
  // verified session, never the body.
  app.post("/api/subscription/create-checkout-session", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    try {
      const origin = (req.headers.origin as string | undefined)
        || `${req.protocol}://${req.get("host")}`;
      const successUrl = `${origin}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${origin}/subscribe`;
      const { url } = await createSubscriptionCheckout({
        userId: user.id,
        email: user.email,
        successUrl,
        cancelUrl,
      });
      // Ensure a row exists so status checks have something to read.
      await db
        .insert(userSubscriptions)
        .values({ userId: user.id, email: user.email ?? null, status: "pending" })
        .onConflictDoUpdate({
          target: userSubscriptions.userId,
          set: { email: user.email ?? null, updatedAt: new Date() },
        });
      return res.json({ url });
    } catch (e: any) {
      console.error("[subscription] create-checkout-session error:", e?.message);
      return res.status(500).json({ error: e?.message ?? "Unknown error" });
    }
  });

  // POST /api/subscription/confirm — called on return from Checkout. We
  // verify the session belongs to this user, then persist the customer /
  // subscription ids and status.
  app.post("/api/subscription/confirm", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    const sessionId = String(req.body?.sessionId ?? "").trim();
    if (!sessionId) return res.status(400).json({ error: "sessionId is required" });
    try {
      const session = await retrieveCheckoutSession(sessionId);
      // Strictly require the session to belong to this user and to be the
      // subscription checkout we created — never trust a permissive fallback.
      if (session.client_reference_id !== user.id) {
        return res.status(403).json({ error: "Session does not belong to this user" });
      }
      if (session.mode !== "subscription") {
        return res.status(400).json({ error: "Not a subscription checkout session" });
      }
      const customerId = typeof session.customer === "string"
        ? session.customer
        : session.customer?.id ?? null;
      const sub = session.subscription;
      const subscriptionId = typeof sub === "string" ? sub : sub?.id ?? null;
      const status: string = (typeof sub === "object" && sub?.status)
        ? sub.status
        : (session.payment_status === "paid" ? "active" : "incomplete");
      const periodEndSec = (typeof sub === "object" && typeof sub?.current_period_end === "number")
        ? sub.current_period_end
        : null;
      const currentPeriodEnd = periodEndSec ? new Date(periodEndSec * 1000) : null;

      await db
        .insert(userSubscriptions)
        .values({
          userId: user.id,
          email: user.email ?? null,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          status,
          currentPeriodEnd,
        })
        .onConflictDoUpdate({
          target: userSubscriptions.userId,
          set: {
            email: user.email ?? null,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            status,
            currentPeriodEnd,
            updatedAt: new Date(),
          },
        });
      return res.json({ active: isActiveStatus(status), status });
    } catch (e: any) {
      console.error("[subscription] confirm error:", e?.message);
      return res.status(500).json({ error: e?.message ?? "Unknown error" });
    }
  });

  // GET /api/subscription/status — live-checks Stripe so cancellations /
  // renewals are reflected without webhooks. Falls back to the stored
  // status if Stripe is unreachable.
  // Emails that get full access with no paywall (comped accounts).
  // admin@tateoco.com is always included; extra addresses can be added
  // via the COMP_ACCESS_EMAILS env var (comma-separated).
  // The app is free with a free account: no Stripe checkout, payment
  // method, or subscription is enforced for any signed-in user. Stripe
  // routes/webhooks/tables are all left intact — only enforcement is
  // bypassed. This is intentionally hard-coded to true so that no
  // environment variable can accidentally re-enable payments. To restore
  // paid mode in the future, change this constant back to an env-driven value.
  const FREE_ACCESS_MODE = true;
  if (FREE_ACCESS_MODE) {
    console.log("[access-mode] free access mode enabled");
    console.log("[stripe] code retained");
  }

  function hasFreeAccess(email: string | null | undefined): boolean {
    const list = [
      "admin@tateoco.com",
      "courtney@tateoco.com",
      "zhornsby22@gmail.com",
      "paul@mymarcoisland.com",
      "coreyfranklin21@yahoo.com",
      "kellypozda22@gmail.com",
      ...(process.env.COMP_ACCESS_EMAILS || "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ];
    return list.includes((email || "").toLowerCase());
  }

  app.get("/api/subscription/status", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    // Free access mode: payment enforcement is bypassed for every signed-in
    // user. Stripe is not contacted; the code below is preserved for paid mode.
    if (FREE_ACCESS_MODE) {
      return res.json({ active: true, status: "free_access" });
    }
    // Comped accounts skip Stripe entirely and always read as active.
    if (hasFreeAccess(user.email)) {
      return res.json({ active: true, status: "comped" });
    }
    try {
      const rows = await db
        .select()
        .from(userSubscriptions)
        .where(eq(userSubscriptions.userId, user.id));
      const row = rows[0];
      if (!row || !row.stripeSubscriptionId) {
        return res.json({ active: false, status: row?.status ?? "inactive" });
      }
      try {
        const snap = await getSubscriptionStatus(row.stripeSubscriptionId);
        const currentPeriodEnd = snap.currentPeriodEnd
          ? new Date(snap.currentPeriodEnd * 1000)
          : null;
        await db
          .update(userSubscriptions)
          .set({ status: snap.status, currentPeriodEnd, updatedAt: new Date() })
          .where(eq(userSubscriptions.userId, user.id));
        return res.json({
          active: isActiveStatus(snap.status),
          status: snap.status,
          currentPeriodEnd: snap.currentPeriodEnd,
        });
      } catch (stripeErr: any) {
        console.warn("[subscription] status live-check failed, using stored:", stripeErr?.message);
        return res.json({ active: isActiveStatus(row.status), status: row.status });
      }
    } catch (e: any) {
      console.error("[subscription] status error:", e?.message);
      return res.status(500).json({ error: e?.message ?? "Unknown error" });
    }
  });

  function isAdminEmail(email: string | null | undefined): boolean {
    const adminEmails = (process.env.MARKET_ANALYSIS_ADMIN_EMAILS || "")
      .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    return adminEmails.length > 0 && adminEmails.includes((email || "").toLowerCase());
  }

  const VALID_SCENARIO_TYPES = ["purchase", "refinance", "cash_buy", "seller"] as const;
  const VALID_ALERT_TYPES = ["rate_drop", "price_drop"] as const;

  // GET /api/property-alerts?scenarioId=&scenarioType= — list this user's
  // subscriptions (optionally scoped to one scenario, used by the bell to
  // hydrate active state).
  app.get("/api/property-alerts", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    const scenarioId = (req.query.scenarioId as string | undefined)?.trim();
    const scenarioType = (req.query.scenarioType as string | undefined)?.trim();
    let q = supabaseAdmin!
      .from("property_alert_subscriptions")
      .select("*")
      .eq("user_id", user.id);
    if (scenarioId) q = q.eq("scenario_id", scenarioId);
    if (scenarioType) q = q.eq("scenario_type", scenarioType);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ subscriptions: data ?? [] });
  });

  // POST /api/property-alerts — upsert one subscription (insert or update).
  // Body shape (server enforces user_id from the verified session):
  //   scenarioId, scenarioType, alertType, isActive (default true),
  //   targetRate, loanType, loanTermYears, occupancyType, creditScore, ltv,
  //   initialWatchedPrice, propertyAddress, normalizedPropertyKey,
  //   zpid, zillowUrl
  app.post("/api/property-alerts", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    const b = (req.body ?? {}) as any;
    const scenarioId = String(b.scenarioId ?? "").trim();
    const scenarioType = String(b.scenarioType ?? "").trim();
    const alertType = String(b.alertType ?? "").trim();
    if (!scenarioId || !VALID_SCENARIO_TYPES.includes(scenarioType as any)) {
      return res.status(400).json({ error: "Invalid scenarioId/scenarioType" });
    }
    if (!VALID_ALERT_TYPES.includes(alertType as any)) {
      return res.status(400).json({ error: "Invalid alertType" });
    }
    if (alertType === "rate_drop") {
      const tr = Number(b.targetRate);
      if (!Number.isFinite(tr) || tr <= 0 || tr > 25) {
        return res.status(400).json({ error: "targetRate must be a positive number <= 25" });
      }
    }

    // Look up existing subscription so we can preserve immutable fields
    // (initial_watched_price, last_alerted_*).
    const { data: existing } = await supabaseAdmin!
      .from("property_alert_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .eq("scenario_id", scenarioId)
      .eq("scenario_type", scenarioType)
      .eq("alert_type", alertType)
      .maybeSingle();

    const nowIso = new Date().toISOString();
    const isActive = b.isActive !== false; // default true

    const initialPrice = typeof b.initialWatchedPrice === "number" && b.initialWatchedPrice > 0
      ? b.initialWatchedPrice : null;

    const row: any = {
      user_id: user.id,
      scenario_id: scenarioId,
      scenario_type: scenarioType,
      alert_type: alertType,
      is_active: isActive,
      normalized_property_key: b.normalizedPropertyKey ?? existing?.normalized_property_key ?? null,
      property_address: b.propertyAddress ?? existing?.property_address ?? null,
      zpid: b.zpid ?? existing?.zpid ?? null,
      zillow_url: b.zillowUrl ?? existing?.zillow_url ?? null,
      target_rate: alertType === "rate_drop" ? Number(b.targetRate) : existing?.target_rate ?? null,
      loan_type: b.loanType ?? existing?.loan_type ?? null,
      loan_term_years: b.loanTermYears ?? existing?.loan_term_years ?? null,
      occupancy_type: b.occupancyType ?? existing?.occupancy_type ?? null,
      credit_score: b.creditScore ?? existing?.credit_score ?? null,
      ltv: b.ltv ?? existing?.ltv ?? null,
      // Preserve dedupe state across reactivation; only reset
      // last_alerted_rate when target rate is raised above prior threshold.
      last_alerted_rate: existing?.last_alerted_rate ?? null,
      initial_watched_price: existing?.initial_watched_price ?? initialPrice,
      last_seen_price: existing?.last_seen_price ?? initialPrice,
      last_alerted_price: existing?.last_alerted_price ?? null,
      notification_channel: existing?.notification_channel ?? "email",
      updated_at: nowIso,
    };

    // If the user raised their target above last_alerted_rate, clear the
    // dedupe marker so a fresh notification can fire on the next check.
    if (
      alertType === "rate_drop" &&
      existing?.last_alerted_rate != null &&
      row.target_rate != null &&
      row.target_rate > existing.last_alerted_rate
    ) {
      row.last_alerted_rate = null;
    }

    // Atomic upsert keyed by the unique index
    // (user_id, scenario_id, scenario_type, alert_type). Avoids a race
    // between SELECT and INSERT when the user double-clicks Save.
    const upsertRow = existing ? row : { ...row, created_at: nowIso };
    const { data, error } = await supabaseAdmin!
      .from("property_alert_subscriptions")
      .upsert(upsertRow, {
        onConflict: "user_id,scenario_id,scenario_type,alert_type",
      })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ subscription: data });
  });

  // DELETE /api/property-alerts/:id — soft delete (is_active=false). Hard
  // delete would lose dedupe history if the user re-subscribes immediately.
  app.delete("/api/property-alerts/:id", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    const id = req.params.id;
    const { error } = await supabaseAdmin!
      .from("property_alert_subscriptions")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  });

  // POST /api/admin/property-alerts/check-rates — admin manual trigger.
  app.post("/api/admin/property-alerts/check-rates", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    if (!isAdminEmail(user.email)) return res.status(403).json({ error: "Admin only" });
    try {
      const { runRateDropChecks } = await import("./integrations/property-alerts");
      const result = await runRateDropChecks();
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message ?? "Unknown error" });
    }
  });

  // POST /api/admin/property-alerts/check-prices — admin manual trigger.
  // May call Apify when watched-property caches are stale; rate-limited
  // implicitly by the small number of active subscriptions.
  app.post("/api/admin/property-alerts/check-prices", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    if (!isAdminEmail(user.email)) return res.status(403).json({ error: "Admin only" });
    try {
      const { runPriceDropChecks } = await import("./integrations/property-alerts");
      const result = await runPriceDropChecks();
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message ?? "Unknown error" });
    }
  });

  // GET /api/email/unsubscribe?uid=<userId>&cid=onboarding_v1
  // One-click unsubscribe target for the drip campaign (linked in every
  // email footer + List-Unsubscribe header). Also accepts POST for
  // RFC 8058 one-click unsubscribes from mail clients.
  const handleUnsubscribe = async (req: any, res: any) => {
    const uid = String(req.query.uid || "").trim();
    const cid = String(req.query.cid || "").trim() || undefined;
    if (!uid) return res.status(400).send("Missing uid");
    const ok = await unsubscribeFromCampaign(uid, cid);
    res.status(ok ? 200 : 500).send(
      `<!doctype html><html><body style="font-family:Arial,sans-serif;max-width:480px;margin:60px auto;text-align:center">
        <h2 style="color:#13294b">${ok ? "You're unsubscribed" : "Something went wrong"}</h2>
        <p style="color:#333">${ok
          ? "You won't receive any more emails from this series."
          : "Please try the link again, or reply to any of our emails and we'll remove you manually."}</p>
      </body></html>`
    );
  };
  app.get("/api/email/unsubscribe", handleUnsubscribe);
  app.post("/api/email/unsubscribe", handleUnsubscribe);

  // Re-schedule pending onboarding drip emails for recent signups —
  // setTimeout schedules are lost on restart; this catch-up pass (plus the
  // email_campaign_log dedupe) makes the campaign restart-safe.
  resumeOnboardingCampaigns().catch(err =>
    console.error("[onboarding] resume failed:", err?.message)
  );

  const httpServer = createServer(app);
  return httpServer;
}

