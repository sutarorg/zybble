"use client";

import * as React from "react";
import { createContext, useCallback, useContext, useMemo } from "react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useLocalStorage } from "@/lib/hooks";
import type { SessionProfile } from "@/lib/server/session-types";
import type { User } from "@/types";
import { toUiUser } from "@/lib/session-user";
import { uploadAvatarFile } from "@/lib/upload";
import { signOutAction } from "@/app/(auth)/actions";
import { useRouter } from "next/navigation";

/**
 * Client-side app state.
 *
 * This provider deliberately holds **no business data**. The learner, creator
 * and admin shells receive their records from server components, which read them
 * from Supabase under Row Level Security. Anything kept here is a UI preference
 * that cannot grant access: the interface language, and nothing else.
 */

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

const LANGUAGE_KEY = "zybble.language.v1";

interface AppContextValue {
  hydrated: boolean;
  /** The verified server session. Null for anonymous visitors. */
  session: SessionProfile | null;
  /** The same session projected onto the shape shared UI components expect. */
  user: User | null;
  /** Uploads a new profile image to private R2 storage and updates the profile. */
  uploadAvatar: (file: File) => Promise<{ success: boolean; error?: string; avatarUrl?: string }>;
  /* interface language — a UI preference only */
  language: string;
  setLanguage: (code: string) => void;
  /** Optimistic defaults; the authoritative preferences live in Postgres. */
  learnerPrefs: LearnerPrefs;
  setLearnerPrefs: (patch: Partial<LearnerPrefs>) => void;
  /** Signs out through the Supabase Auth server and clears the session cookie. */
  signOut: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProviders({
  children,
  session = null,
}: {
  children: React.ReactNode;
  session?: SessionProfile | null;
}) {
  const router = useRouter();
  const language = useLocalStorage<string>(LANGUAGE_KEY, "en");

  // Mirror the selected interface language onto <html lang> (the root layout can
  // only render the SSR default) so screen readers, hyphenation and the browser
  // follow the learner's choice.
  React.useEffect(() => {
    if (language.hydrated) document.documentElement.lang = language.value;
  }, [language.hydrated, language.value]);

  const uploadAvatar = useCallback(
    async (file: File) => {
      if (!session) return { success: false, error: "Sign in to change your profile photo" };
      try {
        const result = await uploadAvatarFile(file);
        if (!result.success) return { success: false, error: result.error };
        // Re-render from the server so the avatar key comes from the database.
        window.location.reload();
        return { success: true, avatarUrl: result.fileUrl };
      } catch {
        return { success: false, error: "Failed to upload your profile photo" };
      }
    },
    [session]
  );

  const setLearnerPrefs = useCallback(() => {
    // Preferences are persisted server-side by the settings action; the local
    // hook intentionally does nothing so nothing is silently stored in the
    // browser and then lost.
  }, []);

  const signOut = useCallback(async () => {
    await signOutAction();
    // `signOutAction` revalidates the layout; this refresh makes the server
    // components re-read the (now cleared) session cookie.
    router.refresh();
    router.push("/");
  }, [router]);

  const value = useMemo<AppContextValue>(
    () => ({
      hydrated: language.hydrated,
      session,
      user: toUiUser(session),
      uploadAvatar,
      language: language.hydrated ? language.value : "en",
      setLanguage: language.set,
      learnerPrefs: DEFAULT_LEARNER_PREFS,
      setLearnerPrefs,
      signOut,
    }),
    [language.hydrated, language.value, language.set, session, uploadAvatar, setLearnerPrefs, signOut]
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

/**
 * Backwards-compatible accessor used by shared UI components that only need to
 * know whether somebody is signed in.
 */
export function useSession(): SessionProfile | null {
  return useApp().session;
}
