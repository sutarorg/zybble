"use client";

import * as React from "react";
import { createContext, useCallback, useContext, useMemo } from "react";
import { COURSES } from "@/data/mock-data";
import { useLocalStorage } from "@/lib/hooks";
import {
  PLATFORM_COMMISSION,
  applyDraftToCourse,
  newCourseFromDraft,
  seedCreatorNotifications,
  seedCreatorProfile,
  seedEarningTransactions,
  uid,
} from "@/lib/creator";
import { uploadProfilePicture } from "@/lib/upload";
import type {
  CourseDraft,
  CourseStatus,
  CreatorCourse,
  CreatorProfile,
  EarningTransaction,
  PayoutRecord,
  PayoutSettings,
} from "@/types";

const KEYS = {
  profile: "zybble.creator.profile.v1",
  courses: "zybble.creator.courses.v1",
  draft: "zybble.creator.draft.v1",
  replies: "zybble.creator.replies.v1",
  payoutSettings: "zybble.creator.payout-settings.v1",
  payouts: "zybble.creator.payouts.v1",
  readNotifications: "zybble.creator.read-notifications.v1",
} as const;

interface CreatorContextValue {
  hydrated: boolean;
  /* profile */
  profile: CreatorProfile;
  saveProfile: (patch: Partial<CreatorProfile>) => void;
  uploadCreatorAvatar: (file: File) => Promise<{ success: boolean; error?: string; avatarUrl?: string }>;
  /* courses */
  courses: CreatorCourse[];
  getCourse: (id: string) => CreatorCourse | undefined;
  addCourse: (draft: CourseDraft) => CreatorCourse;
  updateCourse: (id: string, patch: Partial<CreatorCourse>) => void;
  applyDraft: (id: string, draft: CourseDraft) => void;
  deleteCourse: (id: string) => void;
  duplicateCourse: (id: string) => CreatorCourse | null;
  submitForReview: (id: string) => void;
  withdrawSubmission: (id: string) => void;
  /** Published courses created locally (not part of the static catalog). */
  communityCourses: CreatorCourse[];
  /**
   * Admin flip: ids of locally published courses the admin hid from the
   * public catalog (frontend simulation only).
   */
  unlistPublished: (courseId: string) => void;
  relistPublished: (courseId: string) => void;
  /* wizard draft */
  draft: CourseDraft | null;
  saveDraft: (draft: CourseDraft | null) => void;
  /* finances */
  transactions: EarningTransaction[];
  payouts: PayoutRecord[];
  payoutSettings: PayoutSettings | null;
  savePayoutSettings: (settings: PayoutSettings) => void;
  requestPayout: (amount: number) => PayoutRecord;
  finances: {
    lifetimeGross: number;
    lifetimeCommission: number;
    lifetimeNet: number;
    paidOut: number;
    processingPayouts: number;
    pendingEarnings: number;
    availableBalance: number;
  };
  /* review replies */
  replies: Record<string, string>;
  addReply: (reviewId: string, text: string) => void;
  /* notifications */
  creatorNotifications: ReturnType<typeof seedCreatorNotifications>;
  readCreatorNotifIds: string[];
  markAllCreatorNotifsRead: (ids: string[]) => void;
  /* misc */
  resetCreatorData: () => void;
}

const CreatorContext = createContext<CreatorContextValue | null>(null);

export function CreatorProvider({ children }: { children: React.ReactNode }) {
  const profile = useLocalStorage<CreatorProfile>(KEYS.profile, { ...seedCreatorProfile(), displayName: "", headline: "", bio: "", country: "", initials: "", website: "", topics: [], onboardedAt: null });
  const courses = useLocalStorage<CreatorCourse[]>(KEYS.courses, []);
  const draft = useLocalStorage<CourseDraft | null>(KEYS.draft, null);
  const replies = useLocalStorage<Record<string, string>>(KEYS.replies, {});
  const payoutSettings = useLocalStorage<PayoutSettings | null>(KEYS.payoutSettings, null);
  const payouts = useLocalStorage<PayoutRecord[]>(KEYS.payouts, []);
  const readNotifs = useLocalStorage<string[]>(KEYS.readNotifications, []);

  const hydrated =
    profile.hydrated && courses.hydrated && payoutSettings.hydrated && payouts.hydrated;

  /* ------------------------------ course actions ----------------------------- */

  const getCourse = useCallback(
    (id: string) => courses.value.find((c) => c.id === id),
    [courses.value]
  );

  const addCourse = useCallback(
    (d: CourseDraft) => {
      const course = newCourseFromDraft(d);
      const author = profile.value;
      course.instructorId = author.instructorId;
      course.instructor = { id: author.instructorId, username: author.instructorId,
        name: author.displayName, headline: author.headline, bio: author.bio,
        initials: author.initials, avatarColor: author.avatarColor,
        country: author.country, languages: author.languages };

      courses.set((prev) => [course, ...prev]);
      return course;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [courses.set, profile.value]
  );

  const updateCourse = useCallback(
    (id: string, patch: Partial<CreatorCourse>) => {
      courses.set((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, ...patch, lastUpdated: new Date().toISOString() } : c
        )
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [courses.set]
  );

  const applyDraft = useCallback(
    (id: string, d: CourseDraft) => {
      courses.set((prev) =>
        prev.map((c) => (c.id === id ? applyDraftToCourse(c, d) : c))
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [courses.set]
  );

  const deleteCourse = useCallback(
    (id: string) => {
      courses.set((prev) => prev.filter((c) => c.id !== id));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [courses.set]
  );

  const duplicateCourse = useCallback(
    (id: string): CreatorCourse | null => {
      const source = courses.value.find((c) => c.id === id);
      if (!source) return null;
      const copy: CreatorCourse = {
        ...source,
        id: uid("crs"),
        slug: `${source.slug}-copy`,
        title: `${source.title} (Copy)`,
        rating: 0,
        ratingsCount: 0,
        studentsCount: 0,
        badge: undefined,
        status: "draft",
        demoRevenue: 0,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        reviewHistory: [
          { id: uid("rev"), at: new Date().toISOString(), status: "draft", actor: "creator", note: `Duplicated from “${source.title}”.` },
        ],
        curriculum: source.curriculum.map((s) => ({
          ...s,
          id: uid("sec"),
          lessons: s.lessons.map((l) => ({ ...l, id: uid("les") })),
        })),
        uploads: source.uploads ? { ...source.uploads } : undefined,
      };
      courses.set((prev) => [copy, ...prev]);
      return copy;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [courses.set, courses.value]
  );

  const pushReviewEvent = useCallback(
    (id: string, status: CourseStatus, note: string) => {
      courses.set((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                status,
                lastUpdated: new Date().toISOString(),
                reviewHistory: [
                  ...c.reviewHistory,
                  { id: uid("rev"), at: new Date().toISOString(), status, actor: "creator" as const, note },
                ],
              }
            : c
        )
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [courses.set]
  );

  const submitForReview = useCallback(
    (id: string) => pushReviewEvent(id, "pending", "Submitted for review — all checks passed locally."),
    [pushReviewEvent]
  );

  const withdrawSubmission = useCallback(
    (id: string) => pushReviewEvent(id, "draft", "Submission withdrawn by creator."),
    [pushReviewEvent]
  );

  /* --------------------------------- finances -------------------------------- */

  const transactions = useMemo(() => seedEarningTransactions(courses.value), [courses.value]);

  const finances = useMemo(() => {
    const lifetimeGross =
      courses.value.reduce((a, c) => a + c.demoRevenue, 0) +
      transactions.reduce((a, t) => (t.status !== "refunded" ? a + t.gross : a), 0);
    const lifetimeCommission = Math.round(lifetimeGross * PLATFORM_COMMISSION * 100) / 100;
    const lifetimeNet = Math.round((lifetimeGross - lifetimeCommission) * 100) / 100;
    const paidOut = payouts.value.filter((p) => p.status === "paid").reduce((a, p) => a + p.amount, 0);
    const processingPayouts = payouts.value.filter((p) => p.status === "processing").reduce((a, p) => a + p.amount, 0);
    const pendingEarnings =
      Math.round(transactions.filter((t) => t.status === "pending").reduce((a, t) => a + t.net, 0) * 100) / 100;
    const availableBalance = Math.max(
      0,
      Math.round((lifetimeNet - paidOut - processingPayouts) * 100) / 100
    );
    return { lifetimeGross, lifetimeCommission, lifetimeNet, paidOut, processingPayouts, pendingEarnings, availableBalance };
  }, [courses.value, transactions, payouts.value]);

  const requestPayout = useCallback(
    (amount: number): PayoutRecord => {
      const method = payoutSettings.value;
      const record: PayoutRecord = {
        id: uid("pay"),
        period: new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        amount,
        status: "processing",
        method: method ? (method.method === "bank" ? `Bank ${method.details.slice(-6)}` : "PayPal") : "Manual",
        reference: `PO-2026-${Math.floor(160 + Math.random() * 40)}`,
        requestedAt: new Date().toISOString(),
      };
      payouts.set((prev) => [record, ...prev.filter((p) => p.status === "paid"), ...prev.filter((p) => p.status === "processing")]);
      return record;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payouts.set, payoutSettings.value]
  );

  const savePayoutSettings = useCallback(
    (settings: PayoutSettings) => payoutSettings.set(settings),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payoutSettings.set]
  );

  /* ---------------------------------- misc ----------------------------------- */

  const communityCourses = useMemo(() => {
    const staticIds = new Set(COURSES.map((c) => c.id));
    return courses.value.filter((c) => !staticIds.has(c.id) && c.status === "published");
  }, [courses.value]);

  /**
   * Admin "remove from marketplace" for a community course: moves it back to
   * draft so public Explore no longer lists it (drafts never appear publicly).
   */
  const unlistPublished = useCallback(
    (courseId: string) => {
      courses.set((prev) =>
        prev.map((c) =>
          c.id === courseId && !COURSES.some((s) => s.id === c.id)
            ? {
                ...c,
                status: "draft" as const,
                lastUpdated: new Date().toISOString(),
                reviewHistory: [
                  ...c.reviewHistory,
                  {
                    id: uid("rev"),
                    at: new Date().toISOString(),
                    status: "draft" as const,
                    actor: "reviewer" as const,
                    note: "Removed from marketplace by the admin portal (frontend simulation).",
                  },
                ],
              }
            : c
        )
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [courses.set]
  );

  const relistPublished = useCallback(
    (courseId: string) => {
      courses.set((prev) =>
        prev.map((c) =>
          c.id === courseId && !COURSES.some((s) => s.id === c.id)
            ? {
                ...c,
                status: "published" as const,
                lastUpdated: new Date().toISOString(),
                reviewHistory: [
                  ...c.reviewHistory,
                  {
                    id: uid("rev"),
                    at: new Date().toISOString(),
                    status: "published" as const,
                    actor: "reviewer" as const,
                    note: "Re-listed on the marketplace by the admin portal (frontend simulation).",
                  },
                ],
              }
            : c
        )
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [courses.set]
  );

  const saveProfile = useCallback(
    (patch: Partial<CreatorProfile>) => profile.set((prev) => ({ ...prev, ...patch })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile.set]
  );

  /* --------------------------- profile picture upload ------------------------ */

  const uploadCreatorAvatar = useCallback(
    async (file: File) => {
      try {
        const result = await uploadProfilePicture(file);
        if (result.success && result.fileUrl) {
          // Update creator profile with new avatar
          saveProfile({ avatar: result.fileUrl });
          return { success: true, avatarUrl: result.fileUrl };
        }
        return { success: false, error: result.error };
      } catch (error) {
        return { success: false, error: "Failed to upload avatar" };
      }
    },
    [saveProfile]
  );

  const addReply = useCallback(
    (reviewId: string, text: string) => replies.set((prev) => ({ ...prev, [reviewId]: text })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [replies.set]
  );

  const saveDraft = useCallback(
    (d: CourseDraft | null) => draft.set(d),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft.set]
  );

  const markAllCreatorNotifsRead = useCallback(
    (ids: string[]) => readNotifs.set(ids),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [readNotifs.set]
  );

  const resetCreatorData = useCallback(() => {
    profile.clear();
    courses.clear();
    draft.clear();
    replies.clear();
    payoutSettings.clear();
    payouts.clear();
    readNotifs.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.clear, courses.clear, draft.clear, replies.clear, payoutSettings.clear, payouts.clear, readNotifs.clear]);

  const creatorNotifications = useMemo(() => courses.value.length ? seedCreatorNotifications() : [], [courses.value]);

  const value = useMemo<CreatorContextValue>(
    () => ({
      hydrated,
      profile: profile.value,
      saveProfile,
      uploadCreatorAvatar,
      courses: courses.value,
      getCourse,
      addCourse,
      updateCourse,
      applyDraft,
      deleteCourse,
      duplicateCourse,
      submitForReview,
      withdrawSubmission,
      communityCourses,
      unlistPublished,
      relistPublished,
      draft: draft.hydrated ? draft.value : null,
      saveDraft,
      transactions,
      payouts: payouts.value,
      payoutSettings: payoutSettings.hydrated ? payoutSettings.value : null,
      savePayoutSettings,
      requestPayout,
      finances,
      replies: replies.value,
      addReply,
      creatorNotifications,
      readCreatorNotifIds: readNotifs.hydrated ? readNotifs.value : [],
      markAllCreatorNotifsRead,
      resetCreatorData,
    }),
    [
      hydrated, profile.value, courses.value, draft, payoutSettings, payouts.value, replies.value,
      readNotifs, finances, transactions, communityCourses, creatorNotifications,
      getCourse, addCourse, updateCourse, applyDraft, deleteCourse, duplicateCourse,
      submitForReview, withdrawSubmission, saveDraft, savePayoutSettings, requestPayout,
      saveProfile, uploadCreatorAvatar, addReply, markAllCreatorNotifsRead, resetCreatorData, unlistPublished, relistPublished,
    ]
  );

  return <CreatorContext.Provider value={value}>{children}</CreatorContext.Provider>;
}

export function useCreator(): CreatorContextValue {
  const ctx = useContext(CreatorContext);
  if (!ctx) throw new Error("useCreator must be used within CreatorProvider");
  return ctx;
}

/** Convenience hook for public pages: locally published courses only. */
export function useCommunityCourses(): CreatorCourse[] {
  const { communityCourses, hydrated } = useCreator();
  return hydrated ? communityCourses : [];
}
