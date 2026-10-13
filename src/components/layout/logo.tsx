import { LocalizedText } from "@/components/providers/localized-text";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function ZybbleMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex size-8 items-center justify-center rounded-[10px] bg-primary shadow-sm",
        className
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-4.5 text-white" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 5.5h12L9.5 18.5H18" />
      </svg>
    </span>
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
        <span className="font-display text-[19px] font-bold tracking-tight text-foreground"><LocalizedText text={"Zybble"} /></span>
      )}
    </Link>
  );
}
