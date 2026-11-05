import type { Metadata } from "next";
import { ArrowLeft, ArrowUpRight, Clock, Download } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RichText } from "@/components/blog/rich-text";
import { TableOfContents } from "@/components/blog/table-of-contents";
import { JsonLd } from "@/components/json-ld";
import { Container } from "@/components/layout/container";
import { FinalCta } from "@/components/marketing/final-cta";
import { Reveal } from "@/components/motion/reveal";
import { Badge } from "@/components/ui/badge";
import {
  categorySlug,
  getFaqs,
  getPost,
  getRelated,
  headingId,
  posts,
  readingTimeFor,
  tableOfContents,
  type Block,
} from "@/lib/blog";
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
    /**
     * `absolute` bypasses the root layout's `%s · Zybble` template. Each
     * article's search title is specified individually and several already
     * read correctly without a brand suffix, which would otherwise eat the
     * ~60 characters Google shows before truncating.
     */
    title: { absolute: post.metaTitle ?? post.title },
    description: post.metaDescription ?? post.description,
    keywords: post.keywords,
    alternates: { canonical: `/blog/${post.slug}` },
    // Indexed, and safe to index: every article is original prose with a
    // canonical pointing at its own URL. No private or duplicate surface here.
    robots: { index: true, follow: true },
    openGraph: {
      type: "article",
      url: `${siteConfig.url}/blog/${post.slug}`,
      /**
       * Social cards keep the editorial headline, not the search title.
       * A shared link lands on a page whose H1 is `post.title`, and a card
       * that promises a different headline than the page then delivers reads
       * as a mismatch — the query-matching that justifies `metaTitle` in a
       * SERP does not apply when someone is choosing whether to click a link
       * a colleague pasted.
       */
      title: post.title,
      description: post.description,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt ?? post.publishedAt,
      authors: [siteConfig.name],
      section: post.category,
      tags: post.keywords,
      // Declared dimensions match the generated artwork exactly; the covers
      // are 1376x768 and upscaling them to 1600x900 would only add weight.
      images: [{ url: post.cover.src, width: 1376, height: 768, alt: post.cover.alt }],
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
    case "heading": {
      const level = block.level ?? 2;
      const id = headingId(block.text);
      // Anchor ids are what the table of contents links to, so they must be
      // emitted for every H2 and H3, not just the ones currently in the TOC.
      if (level === 3) {
        return (
          <h3
            key={index}
            id={id}
            className="mt-10 scroll-mt-24 text-pretty text-xl font-semibold tracking-tight text-slate-900"
          >
            {block.text}
          </h3>
        );
      }
      return (
        <h2
          key={index}
          id={id}
          className="mt-12 scroll-mt-24 text-balance text-2xl font-semibold tracking-tight text-slate-950"
        >
          {block.text}
        </h2>
      );
    }
    case "list":
      return (
        <ul key={index} className="mt-6 space-y-3">
          {block.items.map((item) => (
            <li key={item} className="flex gap-3 text-[17px] leading-8 text-slate-700">
              <span
                aria-hidden
                className="mt-[13px] size-1.5 shrink-0 rounded-full bg-brand-500"
              />
              <span>
                <RichText text={item} />
              </span>
            </li>
          ))}
        </ul>
      );
    case "table":
      return (
        <div key={index} className="mt-8">
          <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200">
            <table className="w-full border-collapse text-left text-[15px]">
              {block.caption && (
                <caption className="px-4 pt-3 text-left text-sm text-slate-500">
                  {block.caption}
                </caption>
              )}
              <thead className="bg-slate-50">
                <tr>
                  {block.headers.map((header) => (
                    <th
                      key={header}
                      scope="col"
                      className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-t border-slate-100">
                    {row.map((cell, cellIndex) => (
                      <td
                        key={cellIndex}
                        className={
                          cellIndex === 0
                            ? "px-4 py-3 align-top font-medium text-slate-900"
                            : "px-4 py-3 align-top leading-7 text-slate-700"
                        }
                      >
                        <RichText text={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    case "faq":
      return (
        <div key={index} className="mt-10 space-y-7">
          {block.items.map((item) => (
            <div key={item.question}>
              <h3 className="text-pretty text-lg font-semibold text-slate-900">
                {item.question}
              </h3>
              <p className="mt-2.5 text-[17px] leading-8 text-slate-700">
                <RichText text={item.answer} />
              </p>
            </div>
          ))}
        </div>
      );
    case "quote":
      return (
        <blockquote
          key={index}
          className="mt-10 rounded-r-xl border-l-2 border-brand-600 bg-brand-50/50 px-6 py-5"
        >
          <p className="text-pretty text-lg font-medium leading-8 text-brand-950">
            <RichText text={block.text} />
          </p>
        </blockquote>
      );
    case "download":
      return (
        <a
          key={index}
          href={block.href}
          download
          className="mt-8 flex items-start gap-4 rounded-xl bg-brand-50 px-6 py-5 ring-1 ring-brand-100 transition-colors hover:bg-brand-100/70"
        >
          <span
            aria-hidden
            className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white"
          >
            <Download className="size-5" />
          </span>
          <span className="flex flex-col gap-1">
            <span className="text-[15px] font-semibold text-brand-950">
              {block.label}
            </span>
            <span className="text-sm leading-6 text-slate-600">{block.hint}</span>
          </span>
        </a>
      );
    default:
      return (
        <p key={index} className="mt-6 text-[17px] leading-8 text-slate-700">
          <RichText text={block.text} />
        </p>
      );
  }
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const related = getRelated(post);
  const toc = tableOfContents(post);
  const faqs = getFaqs(post);
  const canonical = `${siteConfig.url}/blog/${post.slug}`;

  const organisation = {
    "@type": "Organization",
    name: siteConfig.name,
    url: siteConfig.url,
    logo: { "@type": "ImageObject", url: `${siteConfig.url}${siteConfig.logoPath}` },
  };

  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    image: `${siteConfig.url}${post.cover.src}`,
    datePublished: post.publishedAt,
    // Only emitted when the article has actually been revised — an
    // unmodified post must not claim a freshness it does not have.
    ...(post.updatedAt ? { dateModified: post.updatedAt } : {}),
    author: organisation,
    publisher: organisation,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    articleSection: post.category,
    ...(post.keywords?.length ? { keywords: post.keywords.join(", ") } : {}),
    inLanguage: "en",
  };

  // FAQ rich results only apply when the page genuinely contains Q&A pairs.
  const faqPage = faqs.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      }
    : null;

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${siteConfig.url}/blog` },
      {
        "@type": "ListItem",
        position: 3,
        name: post.category,
        item: `${siteConfig.url}/blog/category/${categorySlug(post.category)}`,
      },
      { "@type": "ListItem", position: 4, name: post.title, item: canonical },
    ],
  };

  return (
    <>
      <JsonLd data={[article, breadcrumb, ...(faqPage ? [faqPage] : [])]} />

      <article className="pb-24 pt-14 lg:pt-20">
        <Container>
          <Reveal className="mx-auto max-w-3xl">
            <nav aria-label="Breadcrumb">
              <ol className="flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
                <li>
                  <Link href="/blog" className="transition-colors hover:text-brand-700">
                    Blog
                  </Link>
                </li>
                <li aria-hidden>/</li>
                <li>
                  <Link
                    href={`/blog/category/${categorySlug(post.category)}`}
                    className="transition-colors hover:text-brand-700"
                  >
                    {post.category}
                  </Link>
                </li>
              </ol>
            </nav>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Badge>{post.category}</Badge>
              <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
                <Clock className="size-3.5" aria-hidden />
                {readingTimeFor(post)}
              </span>
            </div>
            <h1 className="mt-5 text-balance text-4xl font-semibold leading-[1.12] tracking-tight text-slate-950 sm:text-[44px]">
              {post.title}
            </h1>
            <p className="mt-4 text-sm text-slate-500">
              <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
              {post.updatedAt && (
                <>
                  {" · Updated "}
                  <time dateTime={post.updatedAt}>{formatDate(post.updatedAt)}</time>
                </>
              )}
              {" · "}
              {siteConfig.name} editorial
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
            <TableOfContents entries={toc} />
            {post.blocks.map(renderBlock)}

            {post.sources && post.sources.length > 0 && (
              <section aria-labelledby="sources-heading" className="mt-14">
                <h2
                  id="sources-heading"
                  className="text-lg font-semibold tracking-tight text-slate-900"
                >
                  Sources and further reading
                </h2>
                <ul className="mt-4 space-y-2.5">
                  {post.sources.map((source) => (
                    <li key={source.href} className="flex gap-2.5 text-[15px] leading-7">
                      <span aria-hidden className="mt-[13px] size-1.5 shrink-0 rounded-full bg-brand-500" />
                      <span>
                        <a
                          href={source.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-brand-700 underline decoration-brand-200 underline-offset-4 transition-colors hover:text-brand-800"
                        >
                          {source.label}
                        </a>
                        <span className="text-slate-500"> — linkedin.com (official documentation)</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Honest byline note: the articles are written by the team that
                builds the product, from running LinkedIn publishing daily. No
                invented personas, no borrowed credentials. */}
            <aside className="mt-14 rounded-2xl bg-slate-50 p-6 ring-1 ring-slate-200">
              <h2 className="text-[15px] font-semibold text-slate-900">About the author</h2>
              <p className="mt-2.5 text-[15px] leading-7 text-slate-600">
                Written by the Zybble team — the people who build the{" "}
                <Link
                  href="/linkedin-scheduler"
                  className="font-medium text-brand-700 hover:text-brand-800"
                >
                  LinkedIn scheduler
                </Link>{" "}
                and analytics workspace this blog writes about. We publish, schedule and measure
                LinkedIn content as part of running the product, and every article here comes from
                that practice, not from recycled listicles.
              </p>
            </aside>
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
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((rel) => (
              <Link
                key={rel.slug}
                href={`/blog/${rel.slug}`}
                className="group flex flex-col rounded-2xl bg-white p-5 ring-1 ring-slate-200 shadow-xs transition-shadow hover:shadow-soft"
              >
                <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl">
                  <Image
                    src={rel.cover.src}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 90vw"
                    className="object-cover"
                  />
                </div>
                <Badge className="mt-4 self-start">{rel.category}</Badge>
                <h3 className="mt-3 text-[15px] font-semibold leading-snug text-slate-900 transition-colors group-hover:text-brand-700">
                  {rel.title}
                  <ArrowUpRight
                    className="ml-1 inline size-3.5 text-slate-300 transition-colors group-hover:text-brand-600"
                    aria-hidden
                  />
                </h3>
                <p className="mt-1.5 text-sm text-slate-500">{readingTimeFor(rel)}</p>
              </Link>
            ))}
          </div>
        </Container>
      </section>

      <FinalCta />
    </>
  );
}
