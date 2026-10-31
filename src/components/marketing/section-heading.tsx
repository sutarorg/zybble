import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  className?: string;
  /** Render as h1 for landing-page heroes on subpages. */
  as?: "h1" | "h2";
  /**
   * Anchor for a parent `aria-labelledby`. Sections that point at this heading
   * must give it an id — otherwise the reference dangles, the section has no
   * accessible name and axe fails `aria-valid-attr-value`.
   */
  headingId?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  className,
  as: Heading = "h2",
  headingId,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" ? "mx-auto text-center" : "text-left",
        className,
      )}
    >
      <Badge size="md" className={align === "center" ? "mx-auto" : undefined}>
        {eyebrow}
      </Badge>
      <Heading
        id={headingId}
        className="mt-5 text-balance text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl lg:text-[40px] lg:leading-[1.15]"
      >
        {title}
      </Heading>
      {description ? (
        <p className="mt-4 text-pretty text-lg leading-8 text-slate-600">{description}</p>
      ) : null}
    </div>
  );
}
