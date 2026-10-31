/**
 * Curated IANA zone list for the pickers.
 *
 * Deliberately short and hand-checked rather than a dump of every zone: these
 * cover the overwhelming majority of users, and the detected browser zone is
 * always prepended when it is not already in the list. Every value here must be
 * a real IANA identifier — the server rejects anything `Intl` does not know.
 */
export const TIMEZONE_OPTIONS: string[] = [
  "UTC",
  "Pacific/Honolulu",
  "America/Anchorage",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Madrid",
  "Europe/Athens",
  "Europe/Moscow",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Jakarta",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Perth",
  "Australia/Sydney",
  "Pacific/Auckland",
];
