import Link from "next/link";
import { categorySlug, getCategories, posts } from "@/lib/blog";
import { cn } from "@/lib/utils";

interface CategoryNavProps {
  /** Slug of the category currently being viewed, if any. */
  active?: string;
}

/**
 * Horizontal category filter. Rendered as links to real, indexable category
 * routes rather than client-side state, so each category is a crawlable
 * landing page instead of a filter that only exists in the browser.
 */
export function CategoryNav({ active }: CategoryNavProps) {
  const categories = getCategories();

  return (
    <nav aria-label="Article categories" className="-mx-1 overflow-x-auto px-1">
      <ul className="flex w-max min-w-full gap-2 pb-1">
        <li>
          <Link
            href="/blog"
            aria-current={active ? undefined : "page"}
            className={cn(
              "inline-flex whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium ring-1 transition-colors",
              active
                ? "text-slate-600 ring-slate-200 hover:bg-slate-50 hover:text-slate-900"
                : "bg-brand-600 text-white ring-brand-600",
            )}
          >
            All
            <span className="ml-1.5 opacity-70">{posts.length}</span>
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
                  "inline-flex whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium ring-1 transition-colors",
                  isActive
                    ? "bg-brand-600 text-white ring-brand-600"
                    : "text-slate-600 ring-slate-200 hover:bg-slate-50 hover:text-slate-900",
                )}
              >
                {category}
                <span className="ml-1.5 opacity-70">{count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
