import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Reusable single-image carousel for the Zillow property photo gallery
 * captured by the Apify scrape. Renders one photo at a time with left
 * and right arrows, a "1 / N" counter, keyboard nav, and a graceful
 * placeholder when no photos exist.
 *
 * The visible index is keyed by `scenarioId` so editing an answer on
 * the active property doesn't reset the carousel — only switching to a
 * different scenario does. At the boundaries the arrows loop (next at
 * the last photo wraps to the first; back at the first wraps to the
 * last) so the user can browse continuously without dead-ending.
 *
 * If a photo URL 404s (Zillow's CDN paths can rotate), it's removed
 * from the local list so the carousel never shows a broken image and
 * the counter stays accurate.
 */
export function PropertyPhotoCarousel({
  photos,
  primaryPhotoUrl,
  propertyAddress,
  scenarioId,
}: {
  photos: string[] | null | undefined;
  primaryPhotoUrl?: string | null;
  propertyAddress: string;
  scenarioId: string;
}) {
  // Build a deduped list: prefer the full propertyPhotos array, else
  // fall back to the single primaryPhotoUrl, else an empty list. This
  // mirrors the spec: "If propertyPhotos is empty but primaryPhotoUrl
  // exists, display primaryPhotoUrl as the only image."
  const initialList = (() => {
    const out: string[] = [];
    const seen = new Set<string>();
    const add = (u: string | null | undefined) => {
      if (typeof u !== "string" || u.length === 0) return;
      if (seen.has(u)) return;
      seen.add(u);
      out.push(u);
    };
    if (Array.isArray(photos)) for (const u of photos) add(u);
    if (out.length === 0) add(primaryPhotoUrl);
    return out;
  })();

  const [list, setList] = useState<string[]>(initialList);
  const [index, setIndex] = useState(0);

  // Reset list + index whenever the active scenario changes OR the
  // upstream photo data changes (e.g. Zillow lookup completes mid-view
  // and populates more photos). Using JSON.stringify keeps the effect
  // shallow-stable when the parent re-renders with the same array.
  const listKey = JSON.stringify(initialList);
  useEffect(() => {
    setList(initialList);
    setIndex(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioId, listKey]);

  const total = list.length;
  const hasMultiple = total > 1;

  const goPrev = useCallback(() => {
    if (total <= 1) return;
    setIndex(i => (i - 1 + total) % total);
  }, [total]);

  const goNext = useCallback(() => {
    if (total <= 1) return;
    setIndex(i => (i + 1) % total);
  }, [total]);

  // Keyboard navigation — only active when the carousel is mounted and
  // has multiple photos. Window-level listener so the user doesn't have
  // to click the carousel first to focus it.
  useEffect(() => {
    if (!hasMultiple) return;
    const onKey = (e: KeyboardEvent) => {
      // Don't hijack arrow keys while the user is typing/editing — the
      // carousel listens at the window level, so without this guard
      // ArrowLeft/Right would jump the carousel AND move the text caret
      // in inputs, textareas, contenteditable regions, or selects.
      const t = e.target as HTMLElement | null;
      if (t) {
        const tag = t.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable) {
          return;
        }
      }
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasMultiple, goPrev, goNext]);

  // Drop a URL from the local list when it fails to load. Re-clamp the
  // current index so we never point past the end. The base data is left
  // intact upstream; this only affects the carousel session.
  const handleError = useCallback((badUrl: string) => {
    setList(prev => {
      const next = prev.filter(u => u !== badUrl);
      setIndex(i => (next.length === 0 ? 0 : Math.min(i, next.length - 1)));
      return next;
    });
  }, []);

  // Placeholder when nothing to show — keeps the slot from being empty
  // white space (spec: do not show a broken image icon).
  if (total === 0) {
    return (
      <div className="w-full aspect-[16/10] sm:aspect-[16/9] rounded-xl bg-muted border flex flex-col items-center justify-center text-muted-foreground">
        <ImageIcon className="h-10 w-10 opacity-40 mb-2" />
        <p className="text-xs">No property photos available</p>
      </div>
    );
  }

  const current = list[index];

  return (
    <div className="w-full">
      <div className="relative w-full aspect-[16/10] sm:aspect-[16/9] rounded-xl overflow-hidden bg-muted border">
        <img
          key={current}
          src={current}
          alt={`${propertyAddress} — photo ${index + 1} of ${total}`}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => handleError(current)}
        />

        {hasMultiple && (
          <>
            <Button
              variant="secondary"
              size="icon"
              onClick={goPrev}
              aria-label="Previous photo"
              className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/90 hover:bg-white shadow-sm"
              data-testid="carousel-prev"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              onClick={goNext}
              aria-label="Next photo"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/90 hover:bg-white shadow-sm"
              data-testid="carousel-next"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
            <div
              className="absolute bottom-2 right-2 rounded-md bg-black/60 text-white text-xs px-2 py-0.5 font-medium tabular-nums"
              data-testid="carousel-count"
            >
              {index + 1} / {total}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
