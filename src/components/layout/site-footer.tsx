import Link from "next/link";
import { Logo } from "@/components/logo";
import { Container } from "@/components/layout/container";
import { siteConfig } from "@/lib/site";

const columns = [
  {
    heading: "Product",
    links: [
      { label: "LinkedIn Scheduler", href: siteConfig.links.product },
      { label: "LinkedIn Analytics", href: siteConfig.links.analytics },
      { label: "Pricing", href: siteConfig.links.pricing },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Blog", href: siteConfig.links.blog },
      { label: "Get started", href: siteConfig.links.signup },
      { label: "Log in", href: siteConfig.links.login },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy Policy", href: siteConfig.links.privacy },
      { label: "Terms of Service", href: siteConfig.links.terms },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <Container className="py-16">
        <div className="grid grid-cols-2 gap-x-8 gap-y-12 md:grid-cols-6">
          <div className="col-span-2">
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-6 text-slate-600">
              The focused LinkedIn scheduler and analytics workspace for B2B
              founders, consultants and creators.
            </p>
            <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
              <span className="size-1.5 rounded-full bg-brand-500" aria-hidden />
              LinkedIn™ is a trademark of LinkedIn Corporation. Zybble is not
              affiliated with LinkedIn.
            </p>
          </div>

          {columns.map((col) => (
            <nav key={col.heading} aria-label={col.heading} className="md:col-span-1">
              <h2 className="text-sm font-semibold text-slate-900">{col.heading}</h2>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-600 transition-colors hover:text-brand-700"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div className="col-span-2 md:col-span-1">
            <h2 className="text-sm font-semibold text-slate-900">Plans</h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              <li>Free — $0/month</li>
              <li>Pro — $15/seat/month</li>
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-slate-200 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} Zybble. All rights reserved.
          </p>
          <p className="text-sm text-slate-500">
            Built for LinkedIn creators who value craft over noise.
          </p>
        </div>
      </Container>
    </footer>
  );
}
