import { ArrowRight, ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Reveal } from "@/components/motion/reveal";
import { Badge } from "@/components/ui/badge";
import { posts, readingTimeFor } from "@/lib/blog";
import { siteConfig } from "@/lib/site";

/**
 * Latest writing on the homepage.
 *
 * The three most recent articles only — this is a preview, not an index, so it
 * stays in step with /blog automatically as posts are added. Cards mirror the
 * ones on the blog index so the two never drift apart visually.
 */
const LATEST = [...posts]
  .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  .slice(0, 3);

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function BlogPreview() {
  return (
    <section
      aria-labelledby="home-blog-heading"
      className="border-t border-slate-200 py-20 lg:py-24"
    >
      <Container>
        <Reveal>
          <SectionHeading
            as="h2"
            eyebrow="From the blog"
            title={<span id="home-blog-heading">What we have worked out so far</span>}
            description="Long-form guides on LinkedIn strategy, scheduling and reading your own numbers properly. No growth hacks, no recycled threads."
          />
        </Reveal>

        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {LATEST.map((post, i) => (
            <Reveal key={post.slug} delay={i * 90}>
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
                      <span className="text-[13px] text-slate-500">
                        {readingTimeFor(post)}
                      </span>
                    </div>
                    <h3 className="mt-4 text-balance text-lg font-semibold tracking-tight text-slate-950 transition-colors group-hover:text-brand-700">
                      {post.title}
                      <ArrowUpRight
                        className="ml-1 inline size-4 text-slate-300 transition-colors group-hover:text-brand-600"
                        aria-hidden
                      />
                    </h3>
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

        <Reveal delay={140}>
          <p className="mt-10 text-center">
            <Link
              href={siteConfig.links.blog}
              className="inline-flex items-center gap-1.5 text-[15px] font-medium text-brand-700 transition-colors hover:text-brand-800"
            >
              Read all articles
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
