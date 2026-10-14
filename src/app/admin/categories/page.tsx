import { Tags } from "lucide-react";
import { getAdminCategories } from "@/lib/server/admin";
import { EmptyState } from "@/components/ui/empty-state";
import { CategoryEditor } from "./category-editor";

export const metadata = { title: "Categories" };
export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const categories = await getAdminCategories();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">Categories</h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">
          The eight marketplace categories are seeded by migration and can be renamed, reordered or hidden here.
          Slugs are part of public URLs, so changing one breaks existing links.
        </p>
      </header>

      {categories.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="No categories"
          description="Apply the migrations to seed the category taxonomy."
        />
      ) : (
        <ul className="space-y-3">
          {categories.map((category) => (
            <li key={category.id} className="rounded-xl border border-border bg-white p-4 shadow-card">
              <CategoryEditor
                id={category.id}
                slug={category.slug}
                name={category.name}
                description={category.description}
                visible={category.visible}
                sortOrder={category.sortOrder}
                courseCount={category.courseCount}
              />
            </li>
          ))}
        </ul>
      )}

      <p className="text-[12px] text-zinc-400">
        Hiding a category removes it from navigation and filters. Existing course pages keep working; only the
        category listing changes.
      </p>
    </div>
  );
}