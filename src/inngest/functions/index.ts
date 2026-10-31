import { publishScheduledPost, reconcileStuckPublishes, dispatchDuePosts } from "@/inngest/functions/publish-post";
import {
  notifyPostPublished,
  notifyPostFailed,
  sendPostReminder,
  notifyWorkspacePostFailedSummary,
} from "@/inngest/functions/post-notifications";
import {
  syncPostAnalytics,
  syncWorkspaceAnalyticsJob,
  recomputeBestTimeJob,
  nightlyAnalyticsSync,
} from "@/inngest/functions/analytics";
import { checkLinkedInConnections } from "@/inngest/functions/linkedin-connections";
import {
  syncWorkspaceSeats,
  reconcileSubscriptions,
  cancelSubscriptionOnDelete,
} from "@/inngest/functions/billing";
import { sendTransactionalEmail } from "@/inngest/functions/email";
import { deleteWorkspace } from "@/inngest/functions/workspace-delete";

/** Every durable function served from /api/inngest. */
export const functions = [
  // publishing
  publishScheduledPost,
  reconcileStuckPublishes,
  dispatchDuePosts,
  // notifications
  notifyPostPublished,
  notifyPostFailed,
  sendPostReminder,
  notifyWorkspacePostFailedSummary,
  sendTransactionalEmail,
  // analytics
  syncPostAnalytics,
  syncWorkspaceAnalyticsJob,
  recomputeBestTimeJob,
  nightlyAnalyticsSync,
  // linkedin
  checkLinkedInConnections,
  // billing
  syncWorkspaceSeats,
  reconcileSubscriptions,
  cancelSubscriptionOnDelete,
  // lifecycle
  deleteWorkspace,
];
