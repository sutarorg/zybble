import type { Metadata } from "next";
import { ArrowUpRight, Clock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryNav } from "@/components/blog/category-nav";
import { JsonLd } from "@/components/json-ld";
import { Container } from "@/components/layout/container";
import { FinalCta } from "@/components/marketing/final-cta";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Reveal } from "@/components/motion/reveal";
import { Badge } from "@/components/ui/badge";
import {
  categorySlug,
  getCategories,
  getCategoryBySlug,
  postsByCategory,
  readingTimeFor,
} from "@/lib/blog";
import { siteConfig } from "@/lib/site";

interface PageProps {
  params: Promise<{ category: string }>;
}

export function generateStaticParams() {
  return getCategories().map((category) => ({ category: categorySlug(category) }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category: slug } = await params;
  const category = getCategoryBySlug(slug);
  if (!category) return {};

  const title = `${category} articles — Zybble blog`;
  const description = `Every Zybble article on ${category.toLowerCase()} — practical writing on LinkedIn strategy, scheduling systems and analytics for B2B founders, consultants and creators.`;

  return {
    title,
    description,
    alternates: { canonical: `/blog/category/${slug}` },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      url: `${siteConfig.url}/blog/category/${slug}`,
      title,
      description,
    },
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function BlogCategoryPage({ params }: PageProps) {
  const { category: slug } = await params;
  const category = getCategoryBySlug(slug);
  if (!category) notFound();

  const articles = postsByCategory(slug);

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${siteConfig.url}/blog` },
      {
        "@type": "ListItem",
        position: 3,
        name: category,
        item: `${siteConfig.url}/blog/category/${slug}`,
      },
    ],
  };

  return (
    <>
      <JsonLd data={breadcrumb} />

      <section className="relative overflow-hidden">
        <div aria-hidden className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-brand-50/70 via-white to-white" />
        </div>
        <Container className="py-16 lg:py-20">
          <Reveal>
            <SectionHeading
              as="h1"
              eyebrow="The Zybble blog"
              title={`${category} articles`}
              description="Practical notes on LinkedIn consistency, scheduling systems and analytics that respect your time."
            />
          </Reveal>
          <Reveal delay={80} className="mt-10">
            <CategoryNav active={slug} />
          </Reveal>
        </Container>
      </section>

      <section className="pb-24">
        <Container>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 shadow-xs transition-shadow hover:shadow-soft"
              >
                <div className="relative aspect-[16/9] w-full overflow-hidden">
                  <Image
                    src={post.cover.src}
                    alt={post.cover.alt}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <Badge>{post.category}</Badge>
                  <h2 className="mt-3 text-pretty text-lg font-semibold leading-snug tracking-tight text-slate-950 transition-colors group-hover:text-brand-700">
                    {post.title}
                    <ArrowUpRight
                      className="ml-1 inline size-4 text-slate-300 transition-colors group-hover:text-brand-600"
                      aria-hidden
                    />
                  </h2>
                  <p className="mt-2.5 flex-1 text-pretty text-[15px] leading-7 text-slate-600">
                    {post.description}
                  </p>
                  <div className="mt-5 flex items-center gap-3 text-sm text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="size-3.5" aria-hidden />
                      {readingTimeFor(post)}
                    </span>
                    <span aria-hidden>·</span>
                    <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Container>
      </section>

      <FinalCta />
    </>
  );
}
