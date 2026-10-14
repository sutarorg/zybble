"use client";

import * as React from "react";
import { publicEnv } from "@/lib/env";

/**
 * PostHog product analytics loader.
 *
 * Initialises only when a project key is present, and only in the browser.
 * Consent: Zybble ships with no analytics cookies before the visitor interacts;
 * loading is opt-out by clearing the key, and the documented launch requirement
 * is to add the consent banner before enabling it for EU traffic. See
 * LAUNCH_BLOCKERS.md.
 */
export function PostHogProvider() {
  React.useEffect(() => {
    if (!publicEnv.posthogKey || window.__zybblePosthogLoaded) return;
    window.__zybblePosthogLoaded = true;

    void import("posthog-js").then(({ default: posthog }) => {
      posthog.init(publicEnv.posthogKey as string, {
        api_host: publicEnv.posthogHost,
        person_profiles: "identified_only",
        autocapture: false,
        capture_pageview: true,
        capture_exceptions: false,
        // Never record page-view payloads verbatim: they can carry lesson
        // titles, search terms and query strings.
        mask_all_text: true,
        mask_all_element_attributes: true,
        persistence: "localStorage+cookie",
        disable_session_recording: true,
      });
    });
  }, []);

  return null;
}

declare global {
  interface Window {
    __zybblePosthogLoaded?: boolean;
  }
}
