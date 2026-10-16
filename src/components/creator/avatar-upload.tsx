"use client";

import * as React from "react";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";
import { useApp } from "@/components/providers/app-providers";
import { initialsOf } from "@/lib/format";
import { imagePath } from "@/lib/image-path";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/**
 * The profile photo, as the control that changes it.
 *
 * Clicking (or pressing Enter on) the photo opens the file picker — there is no
 * separate "Upload" button to find. The bytes go straight to private R2 through
 * a pre-signed URL and a server action attaches the key only after the object
 * exists, so a failed upload leaves the previous photo in place rather than a
 * broken image.
 */
export function AvatarUpload({
  avatarKey,
  name,
  className,
  label = "Change profile photo",
  onUploaded,
}: {
  avatarKey: string | null;
  name: string;
  /** Square size class, e.g. `size-16`. */
  className?: string;
  label?: string;
  onUploaded?: () => void;
}) {
  const { uploadAvatar } = useApp();
  const [busy, setBusy] = React.useState(false);
  const input = React.useRef<HTMLInputElement>(null);
  const size = cn("size-16", className);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Resetting lets the same file be picked twice in a row.
    event.target.value = "";
    if (!file) return;

    setBusy(true);
    const result = await uploadAvatar(file);
    setBusy(false);

    if (!result.success) {
      toast.error(result.error ?? "Could not update your profile photo");
      return;
    }
    toast.success("Profile photo updated");
    onUploaded?.();
  }

  return (
    <div className={cn("relative shrink-0", size)}>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        aria-label={label}
        title={label}
        className={cn(
          "group relative block cursor-pointer rounded-full ring-1 ring-border transition-shadow",
          "hover:ring-2 hover:ring-primary/40 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
          busy && "cursor-wait",
          size
        )}
      >
        {avatarKey ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imagePath("avatars", avatarKey)} alt="" className={cn("rounded-full object-cover", size)} />
        ) : (
          <Avatar className={size}>
            <AvatarFallback className={cn("bg-primary text-white", size === "size-16" ? "text-base" : "text-sm")}>
              {initialsOf(name)}
            </AvatarFallback>
          </Avatar>
        )}
        <span
          data-busy={busy}
          className="absolute inset-0 flex items-center justify-center rounded-full bg-zinc-900/55 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 data-[busy=true]:opacity-100"
        >
          {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Camera className="size-5" aria-hidden />}
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => void handleFile(event)}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
      />
    </div>
  );
}
