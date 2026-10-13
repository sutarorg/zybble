"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Always start a newly opened page at the top.
 *
 * Next's default scroll handling can leave the viewport mid-page when the
 * previous page was scrolled, when navigation happens from a long list, or
 * when the browser restores a scroll position. Taking over scroll
 * restoration (`history.scrollRestoration = "manual"`) and snapping to the
 * top on every pathname change guarantees a click never lands the learner
 * in the middle of the next page. Hash links keep their anchor behaviour.
 */
export function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    try {
      window.history.scrollRestoration = "manual";
    } catch {
      /* history unavailable — the scroll below still applies */
    }
  }, []);

  useEffect(() => {
    if (window.location.hash) return;
    // `instant` deliberately overrides the `scroll-behavior: smooth` CSS so
    // a page change never animates up from the previous scroll position.
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);

  return null;
}
