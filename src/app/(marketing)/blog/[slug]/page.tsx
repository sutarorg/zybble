import type { Metadata } from "next";
import { ArrowLeft, ArrowUpRight, Clock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { Container } from "@/components/layout/container";
import { FinalCta } from "@/components/marketing/final-cta";
import { Reveal } from "@/components/motion/reveal";
import { Badge } from "@/components/ui/badge";
import { getPost, posts, type Block } from "@/lib/blog";
import { siteConfig } from "@/lib/site";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      url: `${siteConfig.url}/blog/${post.slug}`,
      title: post.title,
      description: post.description,
      publishedTime: post.publishedAt,
      images: [{ url: post.cover.src, width: 1280, height: 720, alt: post.cover.alt }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: [post.cover.src],
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

function renderBlock(block: Block, index: number) {
  switch (block.type) {
    case "heading":
      return (
        <h2
          key={index}
          className="mt-12 text-balance text-2xl font-semibold tracking-tight text-slate-950"
        >
          {block.text}
        </h2>
      );
    case "list":
      return (
        <ul key={index} className="mt-6 space-y-3">
          {block.items.map((item) => (
            <li key={item} className="flex gap-3 text-[17px] leading-8 text-slate-700">
              <span
                aria-hidden
                className="mt-[13px] size-1.5 shrink-0 rounded-full bg-brand-500"
              />
              {item}
            </li>
          ))}
        </ul>
      );
    case "quote":
      return (
        <blockquote
          key={index}
          className="mt-10 rounded-r-xl border-l-2 border-brand-600 bg-brand-50/50 px-6 py-5"
        >
          <p className="text-pretty text-lg font-medium leading-8 text-brand-950">
            {block.text}
          </p>
        </blockquote>
      );
    default:
      return (
        <p key={index} className="mt-6 text-[17px] leading-8 text-slate-700">
          {block.text}
        </p>
      );
  }
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const related = posts.filter((p) => p.slug !== post.slug).slice(0, 2);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    image: `${siteConfig.url}${post.cover.src}`,
    datePublished: post.publishedAt,
    author: { "@type": "Organization", name: siteConfig.name, url: siteConfig.url },
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      url: siteConfig.url,
      logo: { "@type": "ImageObject", url: `${siteConfig.url}${siteConfig.logoPath}` },
    },
    mainEntityOfPage: `${siteConfig.url}/blog/${post.slug}`,
  };

  return (
    <>
      <JsonLd data={structuredData} />

      <article className="pb-24 pt-14 lg:pt-20">
        <Container>
          <Reveal className="mx-auto max-w-3xl">
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-brand-700"
            >
              <ArrowLeft className="size-4" aria-hidden />
              All articles
            </Link>
            <div className="mt-8 flex items-center gap-3">
              <Badge>{post.category}</Badge>
              <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
                <Clock className="size-3.5" aria-hidden />
                {post.readingTime}
              </span>
            </div>
            <h1 className="mt-5 text-balance text-4xl font-semibold leading-[1.12] tracking-tight text-slate-950 sm:text-[44px]">
              {post.title}
            </h1>
            <p className="mt-4 text-sm text-slate-500">
              <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
              {" · "}Zybble editorial
            </p>
          </Reveal>

          <Reveal delay={100} className="mx-auto mt-10 max-w-4xl">
            <div className="relative aspect-[16/9] overflow-hidden rounded-2xl ring-1 ring-slate-900/10">
              <Image
                src={post.cover.src}
                alt={post.cover.alt}
                fill
                priority
                sizes="(min-width: 1024px) 896px, 100vw"
                className="object-cover"
              />
            </div>
          </Reveal>

          <div className="mx-auto mt-12 max-w-3xl">
            {post.blocks.map(renderBlock)}
          </div>
        </Container>
      </article>

      {/* Related reading */}
      <section aria-labelledby="related-heading" className="border-t border-slate-200 bg-slate-50/70 py-20">
        <Container>
          <h2
            id="related-heading"
            className="text-2xl font-semibold tracking-tight text-slate-950"
          >
            Keep reading
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {related.map((rel) => (
              <Link
                key={rel.slug}
                href={`/blog/${rel.slug}`}
                className="group flex items-center gap-5 rounded-2xl bg-white p-5 ring-1 ring-slate-200 shadow-xs transition-shadow hover:shadow-soft"
              >
                <div className="relative size-20 shrink-0 overflow-hidden rounded-xl">
                  <Image
                    src={rel.cover.src}
                    alt=""
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold leading-snug text-slate-900 transition-colors group-hover:text-brand-700">
                    {rel.title}
                    <ArrowUpRight className="ml-1 inline size-3.5 text-slate-300 transition-colors group-hover:text-brand-600" aria-hidden />
                  </h3>
                  <p className="mt-1.5 text-sm text-slate-500">{rel.readingTime}</p>
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
