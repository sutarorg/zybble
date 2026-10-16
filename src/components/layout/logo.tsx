import { LocalizedText } from "@/components/providers/localized-text";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The brand mark, served from `public/zybble-mark.png`.
 *
 * Rendered with a plain `<img>` rather than `next/image`: it is a small static
 * asset that appears in every header, sidebar and footer, so sending it
 * through the image optimiser would add a request to the critical path for no
 * gain. The intrinsic size is declared so the layout never shifts.
 */
export function ZybbleMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static brand asset, see above
    <img
      src="/zybble-mark.png"
      alt=""
      width={32}
      height={32}
      decoding="async"
      className={cn("size-8 shrink-0 rounded-[10px] object-contain", className)}
      aria-hidden
    />
  );
}

export function Logo({
  className,
  href = "/",
  showWordmark = true,
}: {
  className?: string;
  href?: string;
  showWordmark?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex w-fit items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
        className
      )}
      aria-label="Zybble home"
    >
      <ZybbleMark />
      {showWordmark && (
        <span className="font-display text-[19px] font-bold tracking-tight text-foreground">
          <LocalizedText text={"Zybble"} />
        </span>
      )}
    </Link>
  );
}
