"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { saveCategory } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

export function CategoryEditor({
  id,
  slug,
  name,
  description,
  visible,
  sortOrder,
  courseCount,
}: {
  id: string;
  slug: string;
  name: string;
  description: string;
  visible: boolean;
  sortOrder: number;
  courseCount: number;
}) {
  const router = useRouter();
  const [form, setForm] = React.useState({ name, description, visible, sortOrder });
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const dirty =
    form.name !== name ||
    form.description !== description ||
    form.visible !== visible ||
    form.sortOrder !== sortOrder;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        setMessage(null);
        void saveCategory({ id, ...form })
          .then((result) => {
            if (!result.ok) setError(result.error ?? "Could not save");
            else {
              setMessage("Saved");
              router.refresh();
            }
          })
          .finally(() => setBusy(false));
      }}
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
            <div>
              <label htmlFor={`cat-name-${id}`} className="mb-1 block text-[12px] text-muted-foreground">
                Name
              </label>
              <Input
                id={`cat-name-${id}`}
                value={form.name}
                maxLength={60}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>
            <div>
              <label htmlFor={`cat-order-${id}`} className="mb-1 block text-[12px] text-muted-foreground">
                Sort order
              </label>
              <Input
                id={`cat-order-${id}`}
                type="number"
                min={0}
                max={999}
                value={form.sortOrder}
                onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })}
              />
            </div>
          </div>
          <div className="mt-3">
            <label htmlFor={`cat-desc-${id}`} className="mb-1 block text-[12px] text-muted-foreground">
              Description
            </label>
            <Textarea
              id={`cat-desc-${id}`}
              rows={2}
              maxLength={400}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-[12.5px]">
            <input
              type="checkbox"
              checked={form.visible}
              onChange={(event) => setForm({ ...form, visible: event.target.checked })}
              className="size-4 accent-[var(--primary)]"
            />
            Visible
          </label>
          <Button type="submit" size="sm" variant={dirty ? "default" : "outline"} disabled={busy || !dirty}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <p className="mt-2 text-[11.5px] text-zinc-400">
        <code className="font-mono">/{categorySlug(slug)}</code> · {courseCount} course
        {courseCount === 1 ? "" : "s"}
      </p>
      {message ? <p className="mt-1 text-[12px] text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-1 text-[12px] text-red-600">{error}</p> : null}
    </form>
  );
}

function categorySlug(slug: string): string {
  return `categories/${slug}`;
}