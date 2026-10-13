"use client";

import * as React from "react";
import { createContext, useCallback, useContext, useMemo } from "react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { clearSessionNamespace, useLocalStorage } from "@/lib/hooks";
import type {
  ActivityItem,
  Certificate,
  Enrollment,
  LessonNote,
  Order,
  RecentCourseView,
  User,
} from "@/types";
import { uploadProfilePicture, MAX_FILE_SIZE } from "@/lib/upload";

const KEYS = {
  user: "zybble.user.v1",
  wishlist: "zybble.wishlist.v1",
  enrollments: "zybble.enrollments.v1",
  orders: "zybble.orders.v1",
  readNotifications: "zybble.read-notifications.v1",
  language: "zybble.language.v1",
  notes: "zybble.learner.notes.v1",
  certificates: "zybble.learner.certificates.v1",
  recentViews: "zybble.learner.recent-views.v1",
  activity: "zybble.learner.activity.v1",
  learnerPrefs: "zybble.learner.prefs.v1",
} as const;

export interface LearnerPrefs {
  goalMinutesPerDay: number;
  emailCourseUpdates: boolean;
  emailPromos: boolean;
  weeklyReport: boolean;
  studyReminders: boolean;
}

const DEFAULT_LEARNER_PREFS: LearnerPrefs = {
  goalMinutesPerDay: 30,
  emailCourseUpdates: true,
  emailPromos: false,
  weeklyReport: true,
  studyReminders: true,
};

let _uid = 0;
const uid = (p: string) => `${p}_${Date.now().toString(36)}_${(++_uid).toString(36)}`;

interface AppContextValue {
  hydrated: boolean;
  /* auth */
  user: User | null;
  signIn: (user: User) => void;
  signOut: () => void;
  /* profile picture */
  uploadAvatar: (file: File) => Promise<{ success: boolean; error?: string; avatarUrl?: string }>;
  /* wishlist (shared with public) */
  wishlist: string[];
  toggleWishlist: (courseId: string) => boolean;
  isWishlisted: (courseId: string) => boolean;
  /* courses & learning */
  enrollments: Enrollment[];
  orders: Order[];
  completeOrder: (order: Order) => void;
  isEnrolled: (courseId: string) => boolean;
  toggleLessonComplete: (courseId: string, lessonId: string) => boolean | null;
  setLastLesson: (courseId: string, lessonId: string) => void;
  /* notes */
  notes: LessonNote[];
  setNote: (courseId: string, lessonId: string, text: string) => void;
  /* completion certificates */
  certificates: Certificate[];
  getCertificate: (courseId: string) => Certificate | undefined;
  issueCertificate: (input: Omit<Certificate, "id" | "issuedAt">) => Certificate;
  revokeCertificate: (courseId: string) => void;
  /* recently viewed */
  recentViews: RecentCourseView[];
  recordCourseView: (courseId: string) => void;
  /* activity timeline */
  activity: ActivityItem[];
  /* notifications (public header) */
  readNotificationIds: string[];
  markAllNotificationsRead: (ids: string[]) => void;
  /* preferences */
  language: string;
  setLanguage: (code: string) => void;
  learnerPrefs: LearnerPrefs;
  setLearnerPrefs: (patch: Partial<LearnerPrefs>) => void;
  resetLearnerData: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProviders({ children }: { children: React.ReactNode }) {
  const user = useLocalStorage<User | null>(KEYS.user, null);
  const wishlist = useLocalStorage<string[]>(KEYS.wishlist, []);
  const enrollments = useLocalStorage<Enrollment[]>(KEYS.enrollments, []);
  const orders = useLocalStorage<Order[]>(KEYS.orders, []);
  const readNotifs = useLocalStorage<string[]>(KEYS.readNotifications, []);
  const language = useLocalStorage<string>(KEYS.language, "en");
  const notes = useLocalStorage<LessonNote[]>(KEYS.notes, []);
  const certificates = useLocalStorage<Certificate[]>(KEYS.certificates, []);
  const recentViews = useLocalStorage<RecentCourseView[]>(KEYS.recentViews, []);
  const activity = useLocalStorage<ActivityItem[]>(KEYS.activity, []);
  const learnerPrefs = useLocalStorage<LearnerPrefs>(KEYS.learnerPrefs, DEFAULT_LEARNER_PREFS);

  // Mirror the selected interface language onto
  // <html lang> (the root layout can only render the SSR default) so screen
  // readers, hyphenation and the browser follow the learner's choice.
  React.useEffect(() => {
    if (language.hydrated) document.documentElement.lang = language.value;
  }, [language.hydrated, language.value]);

  const hydrated =
    user.hydrated &&
    wishlist.hydrated &&
    enrollments.hydrated &&
    orders.hydrated &&
    readNotifs.hydrated &&
    notes.hydrated &&
    certificates.hydrated &&
    recentViews.hydrated;

  const pushActivity = useCallback(
    (item: Omit<ActivityItem, "id" | "at">) => {
      activity.set((prev) =>
        [{ ...item, id: uid("act"), at: new Date().toISOString() }, ...prev].slice(0, 60)
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activity.set]
  );

  /* -------------------------------- wishlist -------------------------------- */

  const toggleWishlist = useCallback(
    (courseId: string) => {
      let added = false;
      wishlist.set((prev) => {
        if (prev.includes(courseId)) return prev.filter((id) => id !== courseId);
        added = true;
        return [...prev, courseId];
      });
      return added;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wishlist.set]
  );

  const isWishlisted = useCallback(
    (courseId: string) => wishlist.hydrated && wishlist.value.includes(courseId),
    [wishlist.hydrated, wishlist.value]
  );

  /* ------------------------------- enrollment ------------------------------- */

  const completeOrder = useCallback(
    (order: Order) => {
      orders.set((prev) => [order, ...prev]);
      if (order.status === "paid") {
        enrollments.set((prev) =>
          prev.some((e) => e.courseId === order.courseId)
            ? prev
            : [
                ...prev,
                {
                  courseId: order.courseId,
                  orderId: order.id,
                  enrolledAt: order.createdAt,
                  progress: 0,
                  lastLessonId: null,
                  completedLessons: [],
                  lastVisitedAt: order.createdAt,
                },
              ]
        );
        pushActivity({
          kind: "enroll",
          courseId: order.courseId,
          text: order.total === 0 ? "Enrolled for free" : `Purchased for $${order.total}`,
        });
      }
      wishlist.set((prev) => prev.filter((id) => id !== order.courseId));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders.set, enrollments.set, wishlist.set, pushActivity]
  );

  const isEnrolled = useCallback(
    (courseId: string) => enrollments.hydrated && enrollments.value.some((e) => e.courseId === courseId),
    [enrollments.hydrated, enrollments.value]
  );

  /** Toggle a lesson complete/incomplete. Returns the new completed state. */
  const toggleLessonComplete = useCallback(
    (courseId: string, lessonId: string): boolean | null => {
      let result: boolean | null = null;
      enrollments.set((prev) =>
        prev.map((e) => {
          if (e.courseId !== courseId) return e;
          const has = e.completedLessons.includes(lessonId);
          const completedLessons = has
            ? e.completedLessons.filter((l) => l !== lessonId)
            : [...e.completedLessons, lessonId];
          result = !has;
          return { ...e, completedLessons };
        })
      );
      if (result) {
        pushActivity({ kind: "lesson", courseId, lessonId, text: "Completed a lesson" });
      }
      return result;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enrollments.set, pushActivity]
  );

  const setLastLesson = useCallback(
    (courseId: string, lessonId: string) => {
      enrollments.set((prev) =>
        prev.map((e) =>
          e.courseId === courseId
            ? { ...e, lastLessonId: lessonId, lastVisitedAt: new Date().toISOString() }
            : e
        )
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enrollments.set]
  );

  /* ---------------------------------- notes --------------------------------- */

  const setNote = useCallback(
    (courseId: string, lessonId: string, text: string) => {
      notes.set((prev) => {
        const exists = prev.some((n) => n.courseId === courseId && n.lessonId === lessonId);
        if (!text.trim()) return prev.filter((n) => !(n.courseId === courseId && n.lessonId === lessonId));
        if (exists) {
          return prev.map((n) =>
            n.courseId === courseId && n.lessonId === lessonId
              ? { ...n, text, updatedAt: new Date().toISOString() }
              : n
          );
        }
        return [...prev, { courseId, lessonId, text, updatedAt: new Date().toISOString() }];
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notes.set]
  );

  /* ---------------------------- completion certificates ---------------------- */

  const getCertificate = useCallback(
    (courseId: string) => certificates.value.find((c) => c.courseId === courseId),
    [certificates.value]
  );

  /** Issue a certificate for a finished course. Re-issuing is a no-op. */
  const issueCertificate = useCallback(
    (input: Omit<Certificate, "id" | "issuedAt">) => {
      const existing = certificates.value.find((c) => c.courseId === input.courseId);
      if (existing) return existing;
      const certificate: Certificate = {
        ...input,
        id: `ZYB-${crypto.randomUUID().toUpperCase()}`,
        issuedAt: new Date().toISOString(),
      };
      certificates.set((prev) => {
        const existing = prev.find((c) => c.courseId === input.courseId);
        return existing ? prev : [...prev, certificate];
      });
      pushActivity({
        kind: "complete",
        courseId: input.courseId,
        text: `Earned certificate ${certificate.id}`,
      });
      return certificate;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [certificates.set, certificates.value, pushActivity]
  );

  const revokeCertificate = useCallback(
    (courseId: string) => {
      certificates.set((prev) => prev.filter((c) => c.courseId !== courseId));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [certificates.set]
  );

  /* ------------------------------ recently viewed ---------------------------- */

  const recordCourseView = useCallback(
    (courseId: string) => {
      recentViews.set((prev) =>
        [{ courseId, viewedAt: new Date().toISOString() }, ...prev.filter((v) => v.courseId !== courseId)].slice(0, 10)
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recentViews.set]
  );

  /* --------------------------------- misc ----------------------------------- */

  const markAllNotificationsRead = useCallback(
    (allIds: string[]) => readNotifs.set(allIds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [readNotifs.set]
  );

  const setLearnerPrefs = useCallback(
    (patch: Partial<LearnerPrefs>) => learnerPrefs.set((prev) => ({ ...prev, ...patch })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [learnerPrefs.set]
  );

  const resetLearnerData = useCallback(() => {
    enrollments.clear();
    orders.clear();
    notes.clear();
    certificates.clear();
    recentViews.clear();
    activity.clear();
    learnerPrefs.clear();
    wishlist.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrollments.clear, orders.clear, notes.clear, certificates.clear, recentViews.clear, activity.clear, learnerPrefs.clear, wishlist.clear]);

  /* --------------------------- profile picture upload ------------------------ */

  const uploadAvatar = useCallback(
    async (file: File) => {
      try {
        const result = await uploadProfilePicture(file);
        if (result.success && result.fileUrl) {
          // Update user with new avatar
          user.set((prev) =>
            prev
              ? { ...prev, avatar: result.fileUrl }
              : null
          );
          return { success: true, avatarUrl: result.fileUrl };
        }
        return { success: false, error: result.error };
      } catch (error) {
        return { success: false, error: "Failed to upload avatar" };
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user.set]
  );

  const value = useMemo<AppContextValue>(
    () => ({
      hydrated,
      user: user.hydrated ? user.value : null,
      signIn: (u) => user.set(u),
      signOut: () => clearSessionNamespace("zybble."),
      uploadAvatar,
      wishlist: wishlist.hydrated ? wishlist.value : [],
      toggleWishlist,
      isWishlisted,
      enrollments: enrollments.hydrated ? enrollments.value : [],
      orders: orders.hydrated ? orders.value : [],
      completeOrder,
      isEnrolled,
      toggleLessonComplete,
      setLastLesson,
      notes: notes.hydrated ? notes.value : [],
      setNote,
      certificates: certificates.hydrated ? certificates.value : [],
      getCertificate,
      issueCertificate,
      revokeCertificate,
      recentViews: recentViews.hydrated ? recentViews.value : [],
      recordCourseView,
      activity: activity.hydrated ? activity.value : [],
      readNotificationIds: readNotifs.hydrated ? readNotifs.value : [],
      markAllNotificationsRead,
      language: language.hydrated ? language.value : "en",
      setLanguage: language.set,
      learnerPrefs: learnerPrefs.hydrated ? learnerPrefs.value : DEFAULT_LEARNER_PREFS,
      setLearnerPrefs,
      resetLearnerData,
    }),
    [
      hydrated,
      user, wishlist, enrollments, orders, readNotifs, language, notes, certificates, recentViews, activity, learnerPrefs,
      toggleWishlist, isWishlisted, completeOrder, isEnrolled, toggleLessonComplete, setLastLesson,
      setNote, getCertificate, issueCertificate, revokeCertificate, recordCourseView, markAllNotificationsRead,
      setLearnerPrefs, resetLearnerData, uploadAvatar,
    ]
  );

  return (
    <AppContext.Provider value={value}>
      <TooltipProvider delayDuration={250}>
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: "#17171b",
              color: "#fff",
              border: "1px solid #2e2e34",
              borderRadius: "10px",
              fontSize: "13.5px",
            },
          }}
          richColors={false}
          closeButton
        />
      </TooltipProvider>
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProviders");
  return ctx;
}
