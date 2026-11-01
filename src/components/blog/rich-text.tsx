import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { INLINE_LINK } from "@/lib/blog";

const linkClass =
  "font-medium text-brand-700 underline decoration-brand-300 decoration-1 underline-offset-[3px] transition-colors hover:text-brand-800 hover:decoration-brand-500";

/**
 * Renders body copy containing inline links written as `[[anchor]](/target)`.
 *
 * A purpose-built matcher rather than a markdown library: the blog already
 * renders from typed blocks, and this is the one place prose needs markup.
 * Internal targets become client-side navigation; anything with a scheme is
 * treated as external and opened safely.
 */
export function RichText({ text }: { text: string }): ReactNode {
  const nodes: ReactNode[] = [];
  const pattern = new RegExp(INLINE_LINK.source, "g");
  let cursor = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    const [full, label, target] = match;
    if (match.index > cursor) {
      nodes.push(<Fragment key={`t-${key++}`}>{text.slice(cursor, match.index)}</Fragment>);
    }
    const isExternal = /^https?:\/\//i.test(target);
    nodes.push(
      isExternal ? (
        <a
          key={`a-${key++}`}
          href={target}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          {label}
        </a>
      ) : (
        <Link key={`a-${key++}`} href={target} className={linkClass}>
          {label}
        </Link>
      ),
    );
    cursor = match.index + full.length;
  }

  if (cursor < text.length) {
    nodes.push(<Fragment key={`t-${key++}`}>{text.slice(cursor)}</Fragment>);
  }

  return <>{nodes}</>;
}
