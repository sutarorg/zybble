/**
 * Session types shared by client and server.
 *
 * This module must stay free of any `"server-only"` marker or Node import so a
 * client component can reference the shape without pulling the server module in.
 */

export type AppRole = "learner" | "creator" | "moderator" | "admin";

export interface SessionCreator {
  username: string | null;
  displayName: string | null;
  headline: string | null;
  onboardingStatus: string;
  onboardedAt: string | null;
  routeAccountId: string | null;
  routeAccountStatus: string | null;
  routeSettlementVerified: boolean;
  routeError: string | null;
}

export interface SessionProfile {
  id: string;
  email: string;
  fullName: string;
  initials: string;
  avatarKey: string | null;
  role: AppRole;
  status: "active" | "suspended" | "deleted";
  emailVerified: boolean;
  countryCode: string | null;
  locale: string;
  creator: SessionCreator | null;
}
