import { useEffect } from "react";
import { CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";

/** Work / Follow Up Boss showing line. tel: needs digits only. */
const SHOWING_PHONE = "8132148356";

type ShowingService = "purchase_with_loan" | "purchase_with_cash";

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
 * "Schedule your showing now" CTA. Renders a tel: link styled as a primary
 * button so it opens the phone dialer on mobile and the default calling app
 * on desktop. On click it ALSO fires a non-blocking Follow Up Boss
 * notification with the property address — the tel action is never blocked
 * if that notification fails (keepalive lets it survive navigation).
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

  useEffect(() => {
    console.log("[showing-cta] service", service);
    console.log("[showing-cta] address", address);
    console.log("[showing-cta] qualification status", qualificationStatus ?? "n/a");
    console.log("[showing-cta] should show button", true);
  }, [service, address, qualificationStatus]);

  function handleClick() {
    console.log("[showing-request] clicked");
    console.log("[showing-request] service", service);
    console.log("[showing-request] address", address);
    try {
      const fullName = (user?.name || "").trim();
      const spaceIdx = fullName.indexOf(" ");
      const firstName =
        spaceIdx > 0
          ? fullName.slice(0, spaceIdx)
          : fullName || (user?.email ? user.email.split("@")[0] : "");
      const lastName = spaceIdx > 0 ? fullName.slice(spaceIdx + 1) : "-";
      console.log("[showing-request] fub notification start");
      // keepalive lets this complete even as the tel: link opens the dialer.
      fetch("/api/fub/showing-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
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
          if (res.ok) console.log("[showing-request] fub notification success");
          else console.warn("[showing-request] fub notification error", res.status);
        })
        .catch((err) => console.warn("[showing-request] fub notification error", err));
    } catch (err) {
      console.warn("[showing-request] fub notification error", err);
    }
    console.log("[showing-request] tel link opened");
    // No preventDefault — let the tel: href open the dialer.
  }

  return (
    <div className={className}>
      <Button asChild size="lg" className="w-full sm:w-auto">
        <a
          href={`tel:${SHOWING_PHONE}`}
          onClick={handleClick}
          data-testid="button-schedule-showing"
        >
          <CalendarCheck className="h-4 w-4 mr-2" />
          Schedule your showing now
        </a>
      </Button>
      {subtext && (
        <p className="text-xs text-muted-foreground mt-1.5">
          Call or text our team to schedule a showing.
        </p>
      )}
    </div>
  );
}
