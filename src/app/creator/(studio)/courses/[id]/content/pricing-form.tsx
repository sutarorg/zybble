"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { saveCourse } from "@/app/creator/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CourseDetailsInitial } from "../../new/course-details-form";

export function PricingForm({ initial, locked }: { initial: CourseDetailsInitial; locked?: boolean }) {
  const router = useRouter();
  const [price, setPrice] = React.useState(initial.priceRupees);
  const [compare, setCompare] = React.useState(initial.compareAtRupees);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const free = !price.trim() || Number(price) === 0;
  return (
    <form className="rounded-2xl border border-border bg-white p-5 shadow-card sm:p-6" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setError(null); setMsg(null);
      const r = await saveCourse({ ...initial, priceRupees: price || "0", compareAtRupees: compare || undefined }).catch(() => ({ ok: false, error: "Something went wrong." }));
      setBusy(false);
      if (!r.ok) { setError(r.error ?? "Could not save pricing."); return; }
      setMsg("Pricing saved."); router.refresh();
    }}>
      {error ? <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">{error}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="price" className="mb-1.5 block text-[13px]">Price (₹)</Label>
          <Input id="price" inputMode="decimal" disabled={locked} placeholder="0" value={price} onChange={(e) => setPrice(e.target.value)} />
          <p className="mt-1 text-[11.5px] text-zinc-400">{free ? "Free course" : `Learners pay ₹${price}`}</p>
        </div>
        <div>
          <Label htmlFor="compare" className="mb-1.5 block text-[13px]">Compare-at price (₹) <span className="font-normal text-zinc-400">(optional)</span></Label>
          <Input id="compare" inputMode="decimal" disabled={locked} placeholder="Optional" value={compare} onChange={(e) => setCompare(e.target.value)} />
        </div>
      </div>
      <div className="mt-6 flex items-center gap-3 border-t border-border pt-5">
        <Button type="submit" disabled={busy || locked} loading={busy}>{busy ? "Saving…" : "Save pricing"}</Button>
        {msg ? <span role="status" className="text-[12.5px] text-emerald-700">{msg}</span> : null}
      </div>
    </form>
  );
}
