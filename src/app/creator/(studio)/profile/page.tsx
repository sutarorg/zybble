import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { requireCreator } from "@/lib/server/session";
import { AvatarUpload } from "@/components/creator/avatar-upload";
import { CreatorProfileForm } from "./creator-profile-form";

export const metadata = { title: "Creator profile" };
export const dynamic = "force-dynamic";

interface CreatorProfileRow {
  username: string | null;
  display_name: string | null;
  headline: string | null;
  bio: string | null;
  languages: string[] | null;
  topics: string[] | null;
  website: string | null;
  avatar_key: string | null;
  onboarding_status: string | null;
}

export default async function CreatorProfilePage() {
  const session = await requireCreator();

  let profile: CreatorProfileRow | null = null;
  if (isSupabaseConfigured()) {
    const supabase = await createServerClient();
    const { data } = await supabase
      .from("creator_profiles")
      .select("username, display_name, headline, bio, languages, topics, website, avatar_key, onboarding_status")
      .eq("user_id", session.id)
      .maybeSingle();
    profile = (data ?? null) as CreatorProfileRow | null;
  }

  const displayName = profile?.display_name ?? session.fullName;
  const username = profile?.username;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">Creator profile</h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">
          This is what learners see on your public instructor page.
        </p>
      </header>

      <section className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-white p-5 shadow-card">
        {/* The photo is the upload control: click it to change it. */}
        <AvatarUpload avatarKey={profile?.avatar_key ?? null} name={displayName} />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[17px] font-semibold tracking-tight">{displayName}</h2>
          {profile?.headline ? (
            <p className="mt-0.5 text-[13px] text-muted-foreground">{profile.headline}</p>
          ) : (
            <p className="mt-0.5 text-[13px] text-muted-foreground">No headline yet — add one below.</p>
          )}
          <p className="mt-1.5 text-[12.5px] text-muted-foreground">
            {username ? (
              <>
                Public profile:{" "}
                <a className="font-medium text-primary underline" href={`/instructors/${username}`}>
                  /instructors/{username}
                </a>
              </>
            ) : (
              "Choose a username to publish your instructor page."
            )}
          </p>
          <p className="mt-1 text-[11.5px] text-zinc-400">
            Click your photo to change it · JPEG, PNG or WebP up to 5 MB
          </p>
        </div>
      </section>

      <CreatorProfileForm
        accountEmail={session.email}
        avatarKey={profile?.avatar_key ?? null}
        initial={{
          username: profile?.username ?? "",
          displayName: profile?.display_name ?? session.fullName,
          headline: profile?.headline ?? "",
          bio: profile?.bio ?? "",
          languages: profile?.languages ?? ["English"],
          topics: profile?.topics ?? [],
          website: profile?.website ?? "",
        }}
      />
    </div>
  );
}