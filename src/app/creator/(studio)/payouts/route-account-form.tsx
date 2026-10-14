"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createRouteAccount } from "@/app/creator/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STATES = [
  "Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra",
  "Odisha", "Punjab", "Rajasthan", "Tamil Nadu", "Telangana", "Uttar Pradesh", "Uttarakhand",
  "West Bengal",
];

const CATEGORIES = [
  { value: "education", label: "Education & training" },
  { value: "professional_services", label: "Professional services" },
  { value: "individual", label: "Individual / freelancer" },
  { value: "technology", label: "Technology" },
];

const DEFAULT_FORM = {
  email: "",
  phone: "",
  legalBusinessName: "",
  businessType: "Individual",
  contactName: "",
  category: "education",
  subcategory: "Online courses",
  street1: "",
  street2: "",
  city: "",
  state: "Karnataka",
  postalCode: "",
  pan: "",
};

/**
 * Submits Razorpay Route KYC details.
 *
 * The values are sent to a server action that calls Razorpay's linked-account
 * API. Nothing is stored in the browser and no success is shown unless
 * Razorpay actually returned an account.
 */
export function RouteAccountForm() {
  const router = useRouter();
  const [form, setForm] = React.useState(DEFAULT_FORM);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  function set<K extends keyof typeof DEFAULT_FORM>(key: K, value: string) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    const result = await createRouteAccount({
      ...form,
      state: STATES.includes(form.state) ? stateCodeOf(form.state) : form.state,
    })
      .then((value) => value)
      .catch(() => ({ ok: false, error: "Something went wrong. Please try again." }) as Awaited<ReturnType<typeof createRouteAccount>>);

    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Razorpay could not create the account");
      return;
    }
    setMessage(result.message ?? "Account created");
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-border bg-white p-5 shadow-card">
      <h2 className="font-display text-[15px] font-semibold tracking-tight">Create your Razorpay linked account</h2>
      <p className="mt-1 max-w-2xl text-[12.5px] text-muted-foreground">
        Razorpay collects and holds your KYC documents and bank details. Zybble only stores the resulting
        linked-account id and the status Razorpay reports back.
      </p>

      <form onSubmit={onSubmit} className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Contact email" id="route-email">
          <Input id="route-email" type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="Indian mobile number" id="route-phone">
          <Input id="route-phone" inputMode="numeric" placeholder="9876543210" required value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label="Legal business or full name" id="route-legal-name" className="sm:col-span-2">
          <Input id="route-legal-name" required value={form.legalBusinessName} onChange={(e) => set("legalBusinessName", e.target.value)} />
        </Field>
        <Field label="Contact name" id="route-contact">
          <Input id="route-contact" required value={form.contactName} onChange={(e) => set("contactName", e.target.value)} />
        </Field>
        <Field label="Business type" id="route-business-type">
          <Input id="route-business-type" required value={form.businessType} onChange={(e) => set("businessType", e.target.value)} />
        </Field>
        <Field label="Razorpay category" id="route-category">
          <select
            id="route-category"
            className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm"
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
          >
            {CATEGORIES.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Subcategory" id="route-subcategory">
          <Input id="route-subcategory" required value={form.subcategory} onChange={(e) => set("subcategory", e.target.value)} />
        </Field>
        <Field label="Address line 1" id="route-street1" className="sm:col-span-2">
          <Input id="route-street1" required value={form.street1} onChange={(e) => set("street1", e.target.value)} />
        </Field>
        <Field label="Address line 2 (optional)" id="route-street2" className="sm:col-span-2">
          <Input id="route-street2" value={form.street2} onChange={(e) => set("street2", e.target.value)} />
        </Field>
        <Field label="City" id="route-city">
          <Input id="route-city" required value={form.city} onChange={(e) => set("city", e.target.value)} />
        </Field>
        <Field label="State" id="route-state">
          <select
            id="route-state"
            className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm"
            value={form.state}
            onChange={(e) => set("state", e.target.value)}
          >
            {STATES.map((state) => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
        </Field>
        <Field label="PIN code" id="route-pin">
          <Input id="route-pin" inputMode="numeric" required value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} />
        </Field>
        <Field label="PAN (optional but speeds up KYC)" id="route-pan">
          <Input id="route-pan" maxLength={10} value={form.pan} onChange={(e) => set("pan", e.target.value.toUpperCase())} />
        </Field>

        <div className="sm:col-span-2">
          <Button type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create Razorpay linked account"}
          </Button>
        </div>

        {error ? <p className="text-[13px] text-red-600 sm:col-span-2">{error}</p> : null}
        {message ? <p className="text-[13px] text-emerald-700 sm:col-span-2">{message}</p> : null}
      </form>
    </section>
  );
}

function Field({
  label,
  id,
  className,
  children,
}: {
  label: string;
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={id} className="mb-1.5 block text-[13px]">
        {label}
      </Label>
      {children}
    </div>
  );
}

/** Razorpay expects the ISO 3166-2 subdivision code, e.g. `KA`. */
function stateCodeOf(state: string): string {
  const index = STATES.indexOf(state);
  return index === -1 ? state.toUpperCase() : INDIAN_STATE_CODES[index];
}

const INDIAN_STATE_CODES = [
  "AP", "AS", "BR", "CG", "DL", "GA", "GJ", "HR", "HP", "JH", "KA", "KL", "MP", "MH",
  "OD", "PB", "RJ", "TN", "TG", "UP", "UK", "WB",
];