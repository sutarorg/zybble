import Link from "next/link";
import { categorySlug, getCategories, posts } from "@/lib/blog";
import { cn } from "@/lib/utils";

interface CategoryNavProps {
  /** Slug of the category currently being viewed, if any. */
  active?: string;
}

/**
 * Count badges are coloured with explicit tokens rather than `opacity-*`.
 * Opacity fades a colour toward whatever is behind it, which is how the
 * previous version ended up at 3.34:1 (brand-100 white at 70% over brand-600)
 * and failed the WCAG AA threshold. A chip with its own background keeps the
 * count visually secondary without dropping below 4.5:1:
 *
 *   white on brand-700  6.7:1   (active)
 *   slate-600 on slate-100  6.9:1 (inactive)
 *
 * Both hold whether the section behind the nav is white, slate-50 or brand-50.
 */
function countClassName(active: boolean) {
  return cn(
    "ml-1.5 rounded-full px-1.5 py-0.5 text-[12px] leading-none tabular-nums",
    active ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-600",
  );
}

/**
 * Horizontal category filter. Rendered as links to real, indexable category
 * routes rather than client-side state, so each category is a crawlable
 * landing page instead of a filter that only exists in the browser.
 */
export function CategoryNav({ active }: CategoryNavProps) {
  const categories = getCategories();
  const allActive = !active;

  return (
    <nav aria-label="Article categories" className="-mx-1 overflow-x-auto px-1">
      <ul className="flex w-max min-w-full gap-2 pb-1">
        <li>
          <Link
            href="/blog"
            aria-current={allActive ? "page" : undefined}
            className={cn(
              "inline-flex items-center whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium ring-1 transition-colors",
              allActive
                ? "bg-brand-600 text-white ring-brand-600"
                : "text-slate-700 ring-slate-200 hover:bg-slate-50 hover:text-slate-900",
            )}
          >
            All
            <span className={countClassName(allActive)}>{posts.length}</span>
          </Link>
        </li>
        {categories.map((category) => {
          const slug = categorySlug(category);
          const isActive = slug === active;
          const count = posts.filter((post) => categorySlug(post.category) === slug).length;
          return (
            <li key={slug}>
              <Link
                href={`/blog/category/${slug}`}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex items-center whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium ring-1 transition-colors",
                  isActive
                    ? "bg-brand-600 text-white ring-brand-600"
                    : "text-slate-700 ring-slate-200 hover:bg-slate-50 hover:text-slate-900",
                )}
              >
                {category}
                <span className={countClassName(isActive)}>{count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
