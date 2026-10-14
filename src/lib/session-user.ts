import type { SessionProfile } from "@/lib/server/session-types";
import type { User } from "@/types";
import { imagePath } from "@/lib/image-path";

/**
 * Projects a verified session onto the shared `User` UI shape.
 *
 * Shared by the server session helper and the client provider so both agree on
 * the avatar URL and the coarse role label used for navigation.
 */
export function toUiUser(session: SessionProfile | null): User | null {
  if (!session) return null;
  return {
    id: session.id,
    name: session.fullName,
    email: session.email,
    initials: session.initials,
    avatar: session.avatarKey ? imagePath("avatars", session.avatarKey) : undefined,
    role:
      session.role === "admin" || session.role === "moderator"
        ? "admin"
        : session.creator
          ? "creator"
          : "learner",
  };
}
