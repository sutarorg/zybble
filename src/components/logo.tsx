import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  /** Render the wordmark next to the mark (default true). */
  withWordmark?: boolean;
}

/** Official Zybble logo lockup — the supplied brand asset, never redrawn. */
export function Logo({ className, withWordmark = true }: LogoProps) {
  return (
    <Link
      href="/"
      aria-label="Zybble — home"
      className={cn("inline-flex items-center gap-2.5 rounded-md", className)}
    >
      <Image
        src={siteConfig.logoPath}
        alt=""
        width={32}
        height={32}
        priority
        className="size-8 rounded-[9px]"
      />
      {withWordmark && (
        <span className="text-[17px] font-semibold tracking-tight text-slate-900">
          {siteConfig.name}
        </span>
      )}
    </Link>
  );
}
