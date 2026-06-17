import { useEffect, useState } from "react";
import { CalendarCheck, MessageSquare, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from "@/components/ui/drawer";
import { useAuth } from "@/context/auth-context";

/** Work / Follow Up Boss showing line. tel:/sms: need digits only. */
const SHOWING_PHONE = "8132148356";

/**
 * Remembers which addresses already fired the immediate "started" event in
 * this browser session, so rapid repeat clicks don't spam Follow Up Boss.
 * Module-level (survives component remounts); keyed by address → timestamp.
 */
const startedSentAt = new Map<string, number>();
const STARTED_DEDUPE_MS = 60_000;

type ShowingService = "purchase_with_loan" | "purchase_with_cash";
type ContactMethod = "text" | "call";
type ShowingEvent =
  | "showing_request_started"
  | "showing_request_text_selected"
  | "showing_request_call_selected";

interface ScheduleShowingButtonProps {
  service: ShowingService;
  address: string;
  /** Only relevant for purchase_with_loan (e.g. "likely_qualifies"). */
  qualificationStatus?: string;
  estimatedPrice?: number;
  normalizedPropertyKey?: string;
  /** Show the "Call or text our team…" helper line. Defaults to true. */
  subtext?: boolean;
  /** Extra wrapper classes for placement-specific spacing. */
  className?: string;
}

/**
 * Build an sms: link that pre-fills a body where the device supports it.
 * SMS URL formats differ by platform: iOS historically uses `&body=`, while
 * Android uses `?body=`. We can't reliably detect the SMS app, so we use the
 * broadly-compatible `?&body=` form (works on modern iOS + Android); if a
 * device ignores the body it simply opens the thread to the number, which is
 * the acceptable fallback.
 */
function buildSmsLink(phone: string, message: string): string {
  if (!message) return `sms:${phone}`;
  return `sms:${phone}?&body=${encodeURIComponent(message)}`;
}

/**
 * "Schedule your showing now" CTA. On the main click it IMMEDIATELY fires a
 * non-blocking Follow Up Boss notification (event: showing_request_started)
 * so the agent can follow up even if the visitor never calls/texts — then it
 * opens a mobile-friendly bottom sheet with "Text us" / "Call us". Each choice
 * fires its own FUB event (text/call) and then opens the sms:/tel: link. None
 * of the telephony actions are blocked if a FUB notification fails (keepalive
 * lets the request survive navigation). Repeat clicks for the same address are
 * de-duplicated for ~60s so FUB isn't spammed.
 */
export function ScheduleShowingButton({
  service,
  address,
  qualificationStatus,
  estimatedPrice,
  normalizedPropertyKey,
  subtext = true,
  className,
}: ScheduleShowingButtonProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    console.log("[showing-cta] service", service);
    console.log("[showing-cta] address", address);
    console.log("[showing-cta] qualification status", qualificationStatus ?? "n/a");
    console.log("[showing-cta] should show button", true);
  }, [service, address, qualificationStatus]);

  function notifyFub(eventType: ShowingEvent, contactMethod: ContactMethod | null) {
    try {
      const fullName = (user?.name || "").trim();
      const spaceIdx = fullName.indexOf(" ");
      const firstName =
        spaceIdx > 0
          ? fullName.slice(0, spaceIdx)
          : fullName || (user?.email ? user.email.split("@")[0] : "");
      const lastName = spaceIdx > 0 ? fullName.slice(spaceIdx + 1) : "-";
      console.log("[fub-showing] event type", eventType);
      console.log("[fub-showing] contact method", contactMethod ?? "n/a");
      console.log("[showing-cta] user name present", Boolean(user?.name));
      console.log("[showing-cta] user email present", Boolean(user?.email));
      console.log("[showing-cta] user phone present", Boolean(user?.phone));
      // keepalive lets this complete even as the sms:/tel: link opens.
      fetch("/api/fub/showing-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          eventType,
          contactMethod,
          address,
          service,
          qualificationStatus,
          estimatedPrice,
          normalizedPropertyKey,
          pageUrl: typeof window !== "undefined" ? window.location.href : "",
          firstName: firstName || undefined,
          lastName,
          email: user?.email || undefined,
          phone: user?.phone || undefined,
          agent: user?.agent || "Team",
          userId: user?.id || undefined,
        }),
      })
        .then((res) => {
          if (res.ok) console.log("[fub-showing] note/event created");
          else console.warn("[fub-showing] error", res.status);
        })
        .catch((err) => console.warn("[fub-showing] error", err));
    } catch (err) {
      console.warn("[fub-showing] error", err);
    }
  }

  function openSheet() {
    console.log("[showing-cta] schedule clicked");
    console.log("[showing-cta] address", address);
    // Immediate FUB notification — fires on the main click, before the user
    // picks Call or Text, so a started request is captured either way.
    // Dedupe only when we have a real address; a blank address must never
    // collapse different properties into one 60s window.
    const key = `${service}:${(address || "").trim().toLowerCase()}`;
    const hasAddress = (address || "").trim().length > 0;
    const last = startedSentAt.get(key) ?? 0;
    if (!hasAddress || Date.now() - last > STARTED_DEDUPE_MS) {
      startedSentAt.set(key, Date.now());
      console.log("[showing-cta] immediate FUB notification start");
      notifyFub("showing_request_started", null);
    } else {
      console.log("[showing-cta] immediate FUB notification skipped (recent duplicate)");
    }
    console.log("[showing-cta] popup opened");
    setOpen(true);
  }

  function handleText() {
    console.log("[showing-cta] text selected");
    notifyFub("showing_request_text_selected", "text");
    const message = `I'd like to schedule a showing for ${address}.`;
    const link = buildSmsLink(SHOWING_PHONE, message);
    console.log("[showing-cta] sms link built", link);
    setOpen(false);
    if (typeof window !== "undefined") window.location.href = link;
  }

  function handleCall() {
    console.log("[showing-cta] call selected");
    notifyFub("showing_request_call_selected", "call");
    const link = `tel:${SHOWING_PHONE}`;
    console.log("[showing-cta] tel link built", link);
    setOpen(false);
    if (typeof window !== "undefined") window.location.href = link;
  }

  return (
    <div className={className}>
      <Button
        size="lg"
        className="w-full sm:w-auto"
        onClick={openSheet}
        data-testid="button-schedule-showing"
      >
        <CalendarCheck className="h-4 w-4 mr-2" />
        Schedule your showing now
      </Button>
      {subtext && (
        <p className="text-xs text-muted-foreground mt-1.5">
          Call or text our team to schedule a showing.
        </p>
      )}

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-sm">
            <DrawerHeader className="text-center">
              <DrawerTitle>Schedule your showing</DrawerTitle>
              <DrawerDescription>
                Would you like to call or text us about this property?
              </DrawerDescription>
            </DrawerHeader>
            <div className="flex flex-col gap-3 px-4">
              <Button
                size="lg"
                className="w-full"
                onClick={handleText}
                data-testid="button-showing-text"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Text us
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full"
                onClick={handleCall}
                data-testid="button-showing-call"
              >
                <Phone className="h-4 w-4 mr-2" />
                Call us
              </Button>
            </div>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="ghost" className="w-full" data-testid="button-showing-cancel">
                  Cancel
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
