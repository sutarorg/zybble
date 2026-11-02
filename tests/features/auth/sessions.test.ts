import { describe, expect, it } from "vitest";
import { describeUserAgent, formatLocation, locationFromHeaders } from "@/features/auth/sessions";

/**
 * Device labelling for the account screen.
 *
 * The strings here are what a person reads when deciding whether a device in
 * the list is theirs, so they have to be recognisable rather than technically
 * exact. The ordering of the UA checks is the part that actually breaks: Edge
 * and Chrome both claim to be Safari, and Edge also claims to be Chrome.
 */
describe("describeUserAgent", () => {
  const CHROME_MAC =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  const EDGE_WINDOWS =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0";
  const SAFARI_IPHONE =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
  const FIREFOX_LINUX = "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0";

  it("names Chrome on macOS", () => {
    expect(describeUserAgent(CHROME_MAC)).toBe("Chrome on macOS");
  });

  it("does not mistake Edge for Chrome", () => {
    expect(describeUserAgent(EDGE_WINDOWS)).toBe("Edge on Windows");
  });

  it("does not mistake Chrome for Safari", () => {
    expect(describeUserAgent(CHROME_MAC)).not.toContain("Safari");
  });

  it("names Safari on iPhone", () => {
    expect(describeUserAgent(SAFARI_IPHONE)).toBe("Safari on iPhone");
  });

  it("names Firefox on Linux", () => {
    expect(describeUserAgent(FIREFOX_LINUX)).toBe("Firefox on Linux");
  });

  it("falls back when there is no user agent at all", () => {
    expect(describeUserAgent(null)).toBe("Unknown device");
    expect(describeUserAgent("")).toBe("Unknown device");
  });

  it("names the browser even when the OS is unknown", () => {
    expect(describeUserAgent("Mozilla/5.0 Chrome/120.0.0.0")).toBe("Chrome");
  });
});

describe("locationFromHeaders", () => {
  it("reads Vercel's geo headers, decoding the URL-encoded city", () => {
    const headers = new Headers({
      "x-vercel-ip-city": "Pune",
      "x-vercel-ip-country-region": "MH",
      "x-vercel-ip-country": "IN",
    });

    expect(locationFromHeaders(headers)).toEqual({
      city: "Pune",
      region: "MH",
      country: "IN",
    });
  });

  it("returns empty strings when the host supplies no geo headers", () => {
    // Not "Unknown": an absent location must never be presented as a place.
    expect(locationFromHeaders(new Headers())).toEqual({
      city: "",
      region: "",
      country: "",
    });
  });

  it("survives malformed percent-encoding rather than throwing", () => {
    const headers = new Headers({ "x-vercel-ip-city": "%E0%A4%" });
    expect(locationFromHeaders(headers).city).toBe("%E0%A4%");
  });

  it("decodes a percent-encoded city name", () => {
    const headers = new Headers({ "x-vercel-ip-city": "S%C3%A3o%20Paulo" });
    expect(locationFromHeaders(headers).city).toBe("São Paulo");
  });
});

describe("formatLocation", () => {
  it("joins city, region and country", () => {
    expect(formatLocation({ city: "Pune", region: "MH", country: "IN" })).toBe("Pune, MH, IN");
  });

  it("drops a region that repeats the city", () => {
    expect(formatLocation({ city: "Singapore", region: "Singapore", country: "SG" })).toBe(
      "Singapore, SG",
    );
  });

  it("returns null when nothing is known, so the UI can say so honestly", () => {
    expect(formatLocation({ city: "", region: "", country: "" })).toBeNull();
  });

  it("uses what it has when only the country is present", () => {
    expect(formatLocation({ city: "", region: "", country: "IN" })).toBe("IN");
  });
});
