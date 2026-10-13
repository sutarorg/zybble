"use client";

import * as React from "react";
import { createContext, useCallback, useContext, useMemo } from "react";
import { useLocalStorage } from "@/lib/hooks";
import { uid as creatorUid } from "@/lib/creator";
import {
  ADMIN_NAME,
  DEFAULT_COMMISSION_RATE,
  seedAdminActivity,
  seedAdminCategories,
  seedAdminNotifications,
  seedAdminOrders,
  seedAdminPayouts,
  seedAdminReports,
  seedAdminUsers,
} from "@/lib/admin";
import type {
  AdminActivity,
  AdminCategory,
  AdminNotification,
  AdminOrder,
  AdminPayout,
  AdminReport,
  AdminSettings,
  AdminUser,
  CourseStatus,
  ModerationNote,
  ReportStatus,
} from "@/types";
import { useCreator } from "@/components/providers/creator-provider";

const KEYS = {
  users: "zybble.admin.users.v1",
  payouts: "zybble.admin.payouts.v1",
  categories: "zybble.admin.categories.v1",
  reports: "zybble.admin.reports.v1",
  hiddenReviews: "zybble.admin.hidden-reviews.v1",
  settings: "zybble.admin.settings.v1",
  notes: "zybble.admin.notes.v1",
  activity: "zybble.admin.activity.v1",
  readNotifications: "zybble.admin.read-notifications.v1",
} as const;

const DEFAULT_SETTINGS: AdminSettings = {
  marketplaceName: "Zybble",
  marketplaceDescription: "The global marketplace for practical AI courses.",
  currency: "USD",
  commissionRate: DEFAULT_COMMISSION_RATE,
  autoApproveFreeCourses: false,
  autoApproveReturningCreators: false,
  emailReviewDecisions: true,
  requirePayoutApproval: true,
  hiddenCategorySlugs: [],
};

interface AdminContextValue {
  hydrated: boolean;
  adminName: string;
  /* users */
  users: AdminUser[];
  setUserStatus: (id: string, status: "active" | "suspended") => void;
  setUserRole: (id: string, role: AdminUser["role"]) => void;
  /* orders (composite preview set + learner's local orders) */
  orders: AdminOrder[];
  /* payouts */
  payouts: AdminPayout[];
  setPayoutStatus: (id: string, status: AdminPayout["status"]) => void;
  /* categories */
  categories: AdminCategory[];
  addCategory: (data: Omit<AdminCategory, "id" | "courseCount">) => AdminCategory;
  updateCategory: (id: string, patch: Partial<AdminCategory>) => void;
  reorderCategories: (from: number, to: number) => void;
  toggleCategoryVisible: (id: string) => void;
  /* moderation (drives the shared creator store) */
  approveCourse: (courseId: string) => void;
  rejectCourse: (courseId: string, note: string) => void;
  requestChanges: (courseId: string, note: string) => void;
  returnToQueue: (courseId: string) => void;
  moderationNotes: ModerationNote[];
  addModerationNote: (courseId: string, text: string) => void;
  /* reviews */
  hiddenReviewIds: string[];
  hideReview: (id: string) => void;
  restoreReview: (id: string) => void;
  /* reports */
  reports: AdminReport[];
  setReport: (id: string, patch: Partial<AdminReport>) => void;
  /* settings */
  settings: AdminSettings;
  saveSettings: (patch: Partial<AdminSettings>) => void;
  /* activity + notifications */
  activity: AdminActivity[];
  notifications: AdminNotification[];
  readNotificationIds: string[];
  markAllRead: (ids: string[]) => void;
  logActivity: (action: string, target: string, kind: AdminActivity["kind"]) => void;
  resetAdminData: () => void;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const creator = useCreator();
  const users = useLocalStorage<AdminUser[]>(KEYS.users, seedAdminUsers());
  const payouts = useLocalStorage<AdminPayout[]>(KEYS.payouts, seedAdminPayouts());
  const categories = useLocalStorage<AdminCategory[]>(KEYS.categories, seedAdminCategories());
  const reports = useLocalStorage<AdminReport[]>(KEYS.reports, seedAdminReports());
  const hiddenReviews = useLocalStorage<string[]>(KEYS.hiddenReviews, []);
  const settings = useLocalStorage<AdminSettings>(KEYS.settings, DEFAULT_SETTINGS);
  const notes = useLocalStorage<ModerationNote[]>(KEYS.notes, []);
  const activity = useLocalStorage<AdminActivity[]>(KEYS.activity, seedAdminActivity());
  const readNotifs = useLocalStorage<string[]>(KEYS.readNotifications, []);

  const hydrated =
    users.hydrated && payouts.hydrated && categories.hydrated && reports.hydrated && settings.hydrated;

  const logActivity = useCallback(
    (action: string, target: string, kind: AdminActivity["kind"]) => {
      activity.set((prev) =>
        [
          {
            id: creatorUid("act"),
            actor: ADMIN_NAME,
            action,
            target,
            at: new Date().toISOString(),
            kind,
          },
          ...prev,
        ].slice(0, 40)
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activity.set]
  );

  /* --------------------------------- users --------------------------------- */

  const setUserStatus = useCallback(
    (id: string, status: "active" | "suspended") => {
      users.set((prev) => prev.map((u) => (u.id === id ? { ...u, status } : u)));
      const u = users.value.find((x) => x.id === id);
      logActivity(status === "suspended" ? "Suspended account" : "Reactivated account", u?.name ?? id, "user");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [users.set, users.value, logActivity]
  );

  const setUserRole = useCallback(
    (id: string, role: AdminUser["role"]) => {
      users.set((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
      const u = users.value.find((x) => x.id === id);
      logActivity(`Changed role to ${role}`, u?.name ?? id, "user");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [users.set, users.value, logActivity]
  );

  /* -------------------------------- payouts --------------------------------- */

  const setPayoutStatus = useCallback(
    (id: string, status: AdminPayout["status"]) => {
      payouts.set((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, status, processedAt: status === "paid" || status === "rejected" ? new Date().toISOString() : p.processedAt }
            : p
        )
      );
      const p = payouts.value.find((x) => x.id === id);
      logActivity(
        status === "approved" ? "Approved payout request" : status === "rejected" ? "Rejected payout request" : "Marked payout paid",
        p ? `$${p.amount.toFixed(2)} — ${p.creatorName}` : id,
        "payout"
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payouts.set, payouts.value, logActivity]
  );

  /* ------------------------------- categories ------------------------------- */

  const addCategory = useCallback(
    (data: Omit<AdminCategory, "id" | "courseCount">): AdminCategory => {
      const cat: AdminCategory = { ...data, id: creatorUid("acat"), courseCount: 0 };
      categories.set((prev) => [...prev, cat]);
      logActivity("Added category", data.name, "settings");
      return cat;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories.set, logActivity]
  );

  const updateCategory = useCallback(
    (id: string, patch: Partial<AdminCategory>) => {
      categories.set((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories.set]
  );

  const reorderCategories = useCallback(
    (from: number, to: number) => {
      categories.set((prev) => {
        const sorted = [...prev].sort((a, b) => a.order - b.order);
        const [moved] = sorted.splice(from, 1);
        sorted.splice(to, 0, moved);
        return sorted.map((c, i) => ({ ...c, order: i + 1 }));
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories.set]
  );

  const toggleCategoryVisible = useCallback(
    (id: string) => {
      categories.set((prev) => {
        const target = prev.find((c) => c.id === id);
        if (target) logActivity(target.visible ? "Hid category" : "Restored category", target.name, "settings");
        return prev.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c));
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories.set, logActivity]
  );

  /* ------------------------------- moderation ------------------------------- */

  const pushStatusEvent = useCallback(
    (courseId: string, status: CourseStatus, note: string) => {
      creator.updateCourse(courseId, {
        status,
        reviewHistory: [
          ...(creator.getCourse(courseId)?.reviewHistory ?? []),
          {
            id: creatorUid("rev"),
            at: new Date().toISOString(),
            status,
            actor: "reviewer" as const,
            note,
          },
        ],
      });
    },
    [creator]
  );

  const approveCourse = useCallback(
    (courseId: string) => {
      const course = creator.getCourse(courseId);
      pushStatusEvent(courseId, "published", `Approved and published by ${ADMIN_NAME} — meets marketplace quality standards.`);
      logActivity("Approved and published", course?.title ?? courseId, "moderation");
    },
    [creator, pushStatusEvent, logActivity]
  );

  const rejectCourse = useCallback(
    (courseId: string, note: string) => {
      const course = creator.getCourse(courseId);
      pushStatusEvent(courseId, "rejected", note);
      logActivity("Rejected course submission", course?.title ?? courseId, "moderation");
    },
    [creator, pushStatusEvent, logActivity]
  );

  const requestChanges = useCallback(
    (courseId: string, note: string) => {
      const course = creator.getCourse(courseId);
      pushStatusEvent(courseId, "changes_requested", note);
      logActivity("Requested changes on", course?.title ?? courseId, "moderation");
    },
    [creator, pushStatusEvent, logActivity]
  );

  const returnToQueue = useCallback(
    (courseId: string) => {
      const course = creator.getCourse(courseId);
      pushStatusEvent(courseId, "pending", `Returned to the review queue by ${ADMIN_NAME}.`);
      logActivity("Returned submission to queue", course?.title ?? courseId, "moderation");
    },
    [creator, pushStatusEvent, logActivity]
  );

  const addModerationNote = useCallback(
    (courseId: string, text: string) => {
      notes.set((prev) => [
        { courseId, text, at: new Date().toISOString(), author: ADMIN_NAME },
        ...prev,
      ]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notes.set]
  );

  /* --------------------------------- reviews -------------------------------- */

  const hideReview = useCallback(
    (id: string) => {
      hiddenReviews.set((prev) => (prev.includes(id) ? prev : [...prev, id]));
      logActivity("Hid review from public pages", id, "review");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hiddenReviews.set, logActivity]
  );

  const restoreReview = useCallback(
    (id: string) => {
      hiddenReviews.set((prev) => prev.filter((r) => r !== id));
      logActivity("Restored review to public pages", id, "review");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hiddenReviews.set, logActivity]
  );

  /* --------------------------------- reports -------------------------------- */

  const setReport = useCallback(
    (id: string, patch: Partial<AdminReport>) => {
      reports.set((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
      const r = reports.value.find((x) => x.id === id);
      if (patch.status && r) {
        const label: Record<ReportStatus, string> = {
          open: "Reopened report",
          under_review: "Marked report under review",
          resolved: "Resolved report",
          dismissed: "Dismissed report",
        };
        logActivity(label[patch.status], r.targetTitle, "review");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reports.set, reports.value, logActivity]
  );

  /* --------------------------------- misc ----------------------------------- */

  const saveSettings = useCallback(
    (patch: Partial<AdminSettings>) => {
      settings.set((prev) => ({ ...prev, ...patch }));
      logActivity("Updated platform settings", "Settings", "settings");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings.set, logActivity]
  );

  const markAllRead = useCallback(
    (ids: string[]) => readNotifs.set(ids),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [readNotifs.set]
  );

  const resetAdminData = useCallback(() => {
    users.clear();
    payouts.clear();
    categories.clear();
    reports.clear();
    hiddenReviews.clear();
    settings.clear();
    notes.clear();
    activity.clear();
    readNotifs.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users.clear, payouts.clear, categories.clear, reports.clear, hiddenReviews.clear, settings.clear, notes.clear, activity.clear, readNotifs.clear]);

  const orders = useMemo(() => seedAdminOrders(), []);
  const notifications = useMemo(() => seedAdminNotifications(), []);

  const value = useMemo<AdminContextValue>(
    () => ({
      hydrated,
      adminName: ADMIN_NAME,
      users: users.value,
      setUserStatus,
      setUserRole,
      orders,
      payouts: payouts.value,
      setPayoutStatus,
      categories: categories.value,
      addCategory,
      updateCategory,
      reorderCategories,
      toggleCategoryVisible,
      approveCourse,
      rejectCourse,
      requestChanges,
      returnToQueue,
      moderationNotes: notes.value,
      addModerationNote,
      hiddenReviewIds: hiddenReviews.hydrated ? hiddenReviews.value : [],
      hideReview,
      restoreReview,
      reports: reports.value,
      setReport,
      settings: settings.hydrated ? settings.value : DEFAULT_SETTINGS,
      saveSettings,
      activity: activity.value,
      notifications,
      readNotificationIds: readNotifs.hydrated ? readNotifs.value : [],
      markAllRead,
      logActivity,
      resetAdminData,
    }),
    [
      hydrated, users.value, payouts.value, categories.value, hiddenReviews,
      notes.value, reports, orders, notifications, readNotifs, activity.value, settings,
      setUserStatus, setUserRole, setPayoutStatus, addCategory, updateCategory, reorderCategories,
      toggleCategoryVisible, approveCourse, rejectCourse, requestChanges, returnToQueue,
      addModerationNote, hideReview, restoreReview, setReport, saveSettings, markAllRead,
      logActivity, resetAdminData,
    ]
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used within AdminProvider");
  return ctx;
}
