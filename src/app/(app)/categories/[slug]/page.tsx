import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CATEGORIES } from "@/data/mock-data";
import { coursesByCategory, getCategoryBySlug } from "@/lib/courses";
import { formatCompact } from "@/lib/format";
import { categoryIcon } from "@/lib/icons";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { CategoryPool } from "./category-pool";
import { EmptyState } from "@/components/ui/empty-state";
import { Compass } from "lucide-react";

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);
  if (!category) return {};
  return { title: `${category.name} Courses`, description: category.description };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);
  if (!category) notFound();

  // Rendered with createElement below so the icon lookup is not treated as a
  // component created during render.
  const Icon = categoryIcon(category.icon);
  const pool = coursesByCategory(slug);
  const students = pool.reduce((a, c) => a + c.studentsCount, 0);

  return (
    <div className="page-container py-6 sm:py-8">
      <Breadcrumb items={[{ label: "Explore", href: "/explore" }, { label: category.name }]} />

      <header className="mt-6">
        <p className="text-[11px] font-bold tracking-[0.14em] text-primary uppercase">
          Category
        </p>
        <div className="mt-2 flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-primary">
            {React.createElement(Icon, { className: "size-5.5", "aria-hidden": true })}
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              {category.name}
            </h1>
            <p className="text-[13px] text-muted-foreground">
              {pool.length} {pool.length === 1 ? "course" : "courses"} ·{" "}
              {formatCompact(students)} learners
            </p>
          </div>
        </div>
        <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-muted-foreground">
          {category.description}
        </p>
      </header>

      {pool.length === 0 ? (
        <EmptyState
          icon={Compass}
          className="mt-8"
          title="Courses are on the way"
          description="We're lining up instructors for this category right now. Check back soon — or explore what's already live."
        />
      ) : (
        <CategoryPool categorySlug={category.slug} />
      )}
    </div>
  );
}
