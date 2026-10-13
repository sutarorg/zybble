import Link from "next/link";
import { ZybbleMark } from "@/components/layout/logo";
import { CATEGORIES } from "@/data/mock-data";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Categories",
    links: CATEGORIES.slice(0, 4).map((c) => ({ label: c.name, href: `/categories/${c.slug}` })),
  },
  {
    title: "Company",
    links: [
      { label: "About Zybble", href: "/about" },
      { label: "Help Center", href: "/help" },
      { label: "My Learning", href: "/my-learning" },
      { label: "Wishlist", href: "/wishlist" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms of Service", href: "/terms" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Refund Policy", href: "/refund-policy" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border bg-white">
      <div className="page-container py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5">
              <ZybbleMark />
              <span className="font-display text-lg font-bold tracking-tight">Zybble</span>
            </div>
            <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
              The global marketplace for practical AI skills. Learn from practitioners,
              build real projects, and earn a certificate when you finish.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="text-[11.5px] font-semibold tracking-wider text-zinc-400 uppercase">
                {col.title}
              </p>
              <ul className="mt-3 space-y-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 sm:flex-row sm:items-center">
          <p className="text-[12.5px] text-zinc-400">
            © {new Date().getFullYear()} Zybble Inc. Crafted for learners everywhere.
          </p>
          <p className="text-[12.5px] text-zinc-400">
            Frontend demo — courses, prices and statistics are sample data.
          </p>
        </div>
      </div>
    </footer>
  );
}
