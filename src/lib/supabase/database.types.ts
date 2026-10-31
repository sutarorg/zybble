/**
 * Typed database definitions for the Zybble schema.
 *
 * Hand-maintained to mirror `supabase/migrations`. Regenerate with
 * `supabase gen types typescript --local > src/lib/supabase/database.types.ts`
 * once the project is linked; the shapes below are what application code is
 * written against and CI fails if they drift from the migrations
 * (tests/db/migrations.test.ts).
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type PlanId = "free" | "pro";

export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer";
export type MemberStatus = "active" | "invited" | "removed";

export type PostStatus = "draft" | "scheduled" | "publishing" | "published" | "failed" | "cancelled";
export type MediaKind = "image" | "video" | "document";
export type MediaUploadStatus = "stored" | "registering" | "registered" | "ready" | "failed";

export type LinkedInAccountStatus = "active" | "expired" | "revoked" | "reauth_required";
export type LinkedInAccountKind = "member" | "organization";

export type SubscriptionStatus =
  | "free"
  | "pending"
  | "active"
  | "on_hold"
  | "paused"
  | "past_due"
  | "failed"
  | "cancelled"
  | "expired";

export type NotificationKind =
  | "post_published"
  | "post_failed"
  | "post_reminder"
  | "token_expiring"
  | "token_revoked"
  | "subscription_confirmed"
  | "payment_failed"
  | "subscription_cancelled"
  | "member_invited"
  | "system";

export type AnalyticsMetric =
  | "IMPRESSION"
  | "MEMBERS_REACHED"
  | "REACTION"
  | "COMMENT"
  | "RESHARE"
  | "POST_SAVE"
  | "POST_SEND"
  | "LINK_CLICKS"
  | "PREMIUM_CTA_CLICKS"
  | "FOLLOWER_GAINED_FROM_CONTENT"
  | "PROFILE_VIEW_FROM_CONTENT";

export type Table<Row, Insert = Row, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  /**
   * Declared explicitly because supabase-js resolves row types through
   * `Relationships`; without it every query resolves to `never`. The app never
   * uses embedded selects (it joins explicitly), so no relationships are
   * declared.
   */
  Relationships: [];
};

export type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  timezone: string;
  onboarding_completed_at: string | null;
  marketing_opt_in: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkspaceRow = {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  plan: PlanId;
  seats: number;
  timezone: string;
  billing_email: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkspaceMemberRow = {
  id: string;
  workspace_id: string;
  user_id: string | null;
  email: string;
  role: WorkspaceRole;
  status: MemberStatus;
  invited_by: string | null;
  invite_token_hash: string | null;
  invite_expires_at: string | null;
  invited_at: string | null;
  joined_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LinkedInAccountRow = {
  id: string;
  workspace_id: string;
  kind: LinkedInAccountKind;
  profile_urn: string;
  display_name: string | null;
  headline: string | null;
  avatar_url: string | null;
  granted_scopes: string[];
  can_publish: boolean;
  can_read_analytics: boolean;
  status: LinkedInAccountStatus;
  token_expires_at: string | null;
  last_verified_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  expiry_notified_at: string | null;
  connected_by: string | null;
  disconnected_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LinkedInAccountSecretRow = {
  account_id: string;
  access_token_ciphertext: string;
  access_token_key_id: string;
  refresh_token_ciphertext: string | null;
  refresh_token_key_id: string | null;
  refresh_token_expires_at: string | null;
  scope: string | null;
  token_type: string;
  created_at: string;
  updated_at: string;
};

export type LinkedinOAuthStateRow = {
  id: string;
  state_hash: string;
  user_id: string;
  workspace_id: string;
  reconnect_account_id: string | null;
  redirect_to: string | null;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
};

export type PostRow = {
  id: string;
  workspace_id: string;
  author_account_id: string;
  created_by: string;
  body: string;
  status: PostStatus;
  scheduled_at: string | null;
  timezone: string | null;
  usage_period: string | null;
  published_at: string | null;
  linkedin_post_urn: string | null;
  failure_reason: string | null;
  failure_code: string | null;
  attempts: number;
  idempotency_key: string | null;
  media_count: number;
  last_error_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MediaAssetRow = {
  id: string;
  workspace_id: string;
  post_id: string | null;
  kind: MediaKind;
  file_name: string;
  mime_type: string;
  byte_size: number;
  checksum_sha256: string | null;
  storage_path: string;
  upload_status: MediaUploadStatus;
  linkedin_asset_urn: string | null;
  linkedin_upload_expires_at: string | null;
  processing_error: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PostPublishAttemptRow = {
  id: string;
  post_id: string;
  attempt: number;
  outcome: "started" | "succeeded" | "failed" | "skipped";
  linkedin_post_urn: string | null;
  error_code: string | null;
  error_message: string | null;
  retryable: boolean;
  started_at: string;
  finished_at: string | null;
};

export type PostAnalyticsRow = {
  id: string;
  workspace_id: string;
  post_id: string;
  captured_on: string;
  source: string;
  impressions: number | null;
  members_reached: number | null;
  reactions: number | null;
  comments: number | null;
  reposts: number | null;
  engagement_rate: string | null;
  raw: Json | null;
  synced_at: string;
};

export type AnalyticsSnapshotRow = {
  id: string;
  workspace_id: string;
  linkedin_account_id: string;
  captured_on: string;
  metric_type: AnalyticsMetric;
  granularity: "daily" | "total";
  value: number;
  raw: Json | null;
  synced_at: string;
};

export type BestTimeRecommendationRow = {
  id: string;
  workspace_id: string;
  linkedin_account_id: string;
  weekday: number;
  hour: number;
  score: string;
  sample_size: number;
  confidence: string;
  computed_at: string;
};

export type SubscriptionRow = {
  id: string;
  workspace_id: string;
  dodo_subscription_id: string | null;
  dodo_customer_id: string | null;
  plan: PlanId;
  status: SubscriptionStatus;
  seats: number;
  unit_amount_cents: number | null;
  currency: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  trial_ends_at: string | null;
  last_event_at: string | null;
  last_event_type: string | null;
  raw: Json | null;
  created_at: string;
  updated_at: string;
};

export type BillingPaymentRow = {
  id: string;
  workspace_id: string;
  subscription_id: string | null;
  dodo_payment_id: string;
  amount_cents: number;
  currency: string;
  status: "paid" | "failed" | "refunded" | "pending";
  brand: string | null;
  last4: string | null;
  invoice_url: string | null;
  issued_at: string;
  created_at: string;
};

export type WebhookEventRow = {
  event_id: string;
  provider: "dodo" | "inngest" | "linkedin";
  event_type: string;
  status: "received" | "processed" | "failed" | "ignored";
  signature_verified: boolean;
  workspace_id: string | null;
  payload: Json;
  error: string | null;
  attempts: number;
  received_at: string;
  processed_at: string | null;
};

export type NotificationRow = {
  id: string;
  workspace_id: string;
  user_id: string | null;
  kind: NotificationKind;
  title: string;
  body: string;
  action_url: string | null;
  severity: "info" | "warning" | "error" | "success";
  metadata: Json | null;
  read_at: string | null;
  created_at: string;
};

export type NotificationPreferencesRow = {
  user_id: string;
  email_post_published: boolean;
  email_post_failed: boolean;
  email_post_reminder: boolean;
  email_token_expiring: boolean;
  email_billing: boolean;
  email_product_updates: boolean;
  quiet_hours_start: number | null;
  quiet_hours_end: number | null;
  created_at: string;
  updated_at: string;
};

export type AuditLogRow = {
  id: string;
  workspace_id: string | null;
  actor_type: "user" | "system" | "webhook";
  actor_user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Json | null;
  ip_address: string | null;
  user_agent: string | null;
  request_id: string | null;
  created_at: string;
};

export type UsageCounterRow = {
  workspace_id: string;
  period: string;
  metric: "scheduled_posts";
  count: number;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        ProfileRow,
        Partial<ProfileRow> & { id: string; email: string },
        Partial<ProfileRow>
      >;
      workspaces: Table<
        WorkspaceRow,
        Partial<WorkspaceRow> & { name: string; slug: string; owner_id: string },
        Partial<WorkspaceRow>
      >;
      workspace_members: Table<
        WorkspaceMemberRow,
        Partial<WorkspaceMemberRow> & { workspace_id: string; email: string },
        Partial<WorkspaceMemberRow>
      >;
      linkedin_accounts: Table<
        LinkedInAccountRow,
        Partial<LinkedInAccountRow> & { workspace_id: string; profile_urn: string },
        Partial<LinkedInAccountRow>
      >;
      linkedin_account_secrets: Table<
        LinkedInAccountSecretRow,
        Partial<LinkedInAccountSecretRow> & {
          account_id: string;
          access_token_ciphertext: string;
          access_token_key_id: string;
        },
        Partial<LinkedInAccountSecretRow>
      >;
      linkedin_oauth_states: Table<
        LinkedinOAuthStateRow,
        Partial<LinkedinOAuthStateRow> & {
          state_hash: string;
          user_id: string;
          workspace_id: string;
        },
        Partial<LinkedinOAuthStateRow>
      >;
      posts: Table<
        PostRow,
        Partial<PostRow> & {
          workspace_id: string;
          author_account_id: string;
          created_by: string;
        },
        Partial<PostRow>
      >;
      media_assets: Table<
        MediaAssetRow,
        Partial<MediaAssetRow> & {
          workspace_id: string;
          kind: MediaKind;
          file_name: string;
          mime_type: string;
          byte_size: number;
          storage_path: string;
        },
        Partial<MediaAssetRow>
      >;
      post_publish_attempts: Table<
        PostPublishAttemptRow,
        Partial<PostPublishAttemptRow> & { post_id: string; attempt: number },
        Partial<PostPublishAttemptRow>
      >;
      post_analytics: Table<
        PostAnalyticsRow,
        Partial<PostAnalyticsRow> & { workspace_id: string; post_id: string; captured_on: string },
        Partial<PostAnalyticsRow>
      >;
      analytics_snapshots: Table<
        AnalyticsSnapshotRow,
        Partial<AnalyticsSnapshotRow> & {
          workspace_id: string;
          linkedin_account_id: string;
          captured_on: string;
          metric_type: AnalyticsMetric;
        },
        Partial<AnalyticsSnapshotRow>
      >;
      best_time_recommendations: Table<
        BestTimeRecommendationRow,
        Partial<BestTimeRecommendationRow> & {
          workspace_id: string;
          linkedin_account_id: string;
          weekday: number;
          hour: number;
          score: string;
          sample_size: number;
          confidence: string;
        },
        Partial<BestTimeRecommendationRow>
      >;
      subscriptions: Table<
        SubscriptionRow,
        Partial<SubscriptionRow> & { workspace_id: string },
        Partial<SubscriptionRow>
      >;
      billing_payments: Table<
        BillingPaymentRow,
        Partial<BillingPaymentRow> & { workspace_id: string; dodo_payment_id: string },
        Partial<BillingPaymentRow>
      >;
      webhook_events: Table<
        WebhookEventRow,
        Partial<WebhookEventRow> & { event_id: string; event_type: string; payload: Json },
        Partial<WebhookEventRow>
      >;
      notifications: Table<
        NotificationRow,
        Partial<NotificationRow> & { workspace_id: string; kind: NotificationKind; title: string; body: string },
        Partial<NotificationRow>
      >;
      notification_preferences: Table<
        NotificationPreferencesRow,
        Partial<NotificationPreferencesRow> & { user_id: string },
        Partial<NotificationPreferencesRow>
      >;
      audit_logs: Table<
        AuditLogRow,
        Partial<AuditLogRow> & { action: string },
        Partial<AuditLogRow>
      >;
      usage_counters: Table<
        UsageCounterRow,
        Partial<UsageCounterRow> & {
          workspace_id: string;
          period: string;
          metric: "scheduled_posts";
        },
        Partial<UsageCounterRow>
      >;
    };
    Views: Record<string, never>;
    Functions: {
      workspace_ids_for_user: { Args: Record<string, never>; Returns: string[] };
      workspace_plan: { Args: { workspace: string }; Returns: string };
      current_usage: { Args: { workspace: string; counter_metric: string }; Returns: number };
      create_workspace: {
        Args: { workspace_name: string; workspace_timezone?: string };
        Returns: string;
      };
      accept_workspace_invitation: { Args: { token_hash_value: string }; Returns: string };
      bump_rate_limit: {
        Args: { bucket_key: string; max_hits: number; window_ms: number };
        Returns: { allowed: boolean; remaining: number; reset_at: string }[];
      };
      purge_workspace_data: { Args: { target_workspace: string }; Returns: undefined };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
