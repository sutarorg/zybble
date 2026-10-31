import type { Metadata } from "next";
import { ArrowRight, ArrowUpRight, Clock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { FinalCta } from "@/components/marketing/final-cta";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Reveal } from "@/components/motion/reveal";
import { Badge } from "@/components/ui/badge";
import { posts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog — LinkedIn growth, scheduling and analytics",
  description:
    "Practical writing on LinkedIn strategy, scheduling systems and analytics that matter — for B2B founders, consultants and creators.",
  alternates: { canonical: "/blog" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BlogIndexPage() {
  const sorted = [...posts].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const [featured, ...rest] = sorted;

  return (
    <>
      <section className="relative overflow-hidden">
        <div aria-hidden className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-brand-50/70 via-white to-white" />
          <div className="bg-grid-blue absolute inset-x-0 top-0 h-[320px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]" />
        </div>
        <Container className="py-20 lg:py-24">
          <Reveal>
            <SectionHeading
              as="h1"
              eyebrow="The Zybble blog"
              title="Write less often. Mean it more."
              description="Practical notes on LinkedIn consistency, scheduling systems and analytics that respect your time. No growth hacks, no recycled threads."
            />
          </Reveal>

          {/* Featured article */}
          <Reveal delay={120}>
            <Link
              href={`/blog/${featured.slug}`}
              className="group mt-16 grid overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 shadow-xs transition-shadow duration-300 hover:shadow-soft lg:grid-cols-2"
            >
              <div className="relative aspect-[16/9] overflow-hidden lg:aspect-auto lg:min-h-[320px]">
                <Image
                  src={featured.cover.src}
                  alt={featured.cover.alt}
                  fill
                  priority
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                />
              </div>
              <div className="flex flex-col justify-center p-8 lg:p-12">
                <div className="flex items-center gap-3">
                  <Badge>{featured.category}</Badge>
                  <span className="inline-flex items-center gap-1.5 text-[13px] text-slate-500">
                    <Clock className="size-3.5" aria-hidden />
                    {featured.readingTime}
                  </span>
                </div>
                <h2 className="mt-4 text-balance text-2xl font-semibold tracking-tight text-slate-950 transition-colors group-hover:text-brand-700 lg:text-3xl">
                  {featured.title}
                </h2>
                <p className="mt-3 text-pretty text-[15px] leading-7 text-slate-600">
                  {featured.description}
                </p>
                <p className="mt-6 inline-flex items-center gap-1.5 text-[15px] font-medium text-brand-700">
                  Read the article
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </p>
                <p className="mt-2 text-sm text-slate-500">{formatDate(featured.publishedAt)}</p>
              </div>
            </Link>
          </Reveal>

          {/* Remaining articles */}
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((post, i) => (
              <Reveal key={post.slug} delay={(i % 3) * 90}>
                <Link href={`/blog/${post.slug}`} className="group block h-full">
                  <article className="flex h-full flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 shadow-xs transition-shadow duration-300 hover:shadow-soft">
                    <div className="relative aspect-[16/9] overflow-hidden">
                      <Image
                        src={post.cover.src}
                        alt={post.cover.alt}
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    </div>
                    <div className="flex flex-1 flex-col p-6">
                      <div className="flex items-center gap-3">
                        <Badge>{post.category}</Badge>
                        <span className="text-[13px] text-slate-500">{post.readingTime}</span>
                      </div>
                      <h2 className="mt-4 text-balance text-lg font-semibold tracking-tight text-slate-950 transition-colors group-hover:text-brand-700">
                        {post.title}
                        <ArrowUpRight
                          className="ml-1 inline size-4 text-slate-300 transition-colors group-hover:text-brand-600"
                          aria-hidden
                        />
                      </h2>
                      <p className="mt-2 line-clamp-3 text-[15px] leading-7 text-slate-600">
                        {post.description}
                      </p>
                      <p className="mt-auto pt-5 text-sm text-slate-500">
                        {formatDate(post.publishedAt)}
                      </p>
                    </div>
                  </article>
                </Link>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>
      <FinalCta />
    </>
  );
}
