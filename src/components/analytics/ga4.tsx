import Script from "next/script";
import { publicEnv } from "@/lib/env";

/**
 * GA4 loader.
 *
 * Loads `gtag.js` only when a measurement id is configured. Nothing is sent when
 * it is not, and no email address, auth token, lesson note, payment field or
 * other sensitive value is ever pushed to GA — see `trackEvent` in
 * `src/lib/analytics.ts` for the allow-listed event surface.
 */
export function GA4Script() {
  const id = publicEnv.gaMeasurementId;
  if (!id) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`}
        strategy="afterInteractive"
      />
      <Script id="zybble-ga4" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', ${JSON.stringify(id)}, { send_page_view: true, anonymize_ip: true });
        `}
      </Script>
    </>
  );
}
