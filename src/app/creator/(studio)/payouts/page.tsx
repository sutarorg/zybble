import { Landmark, ShieldCheck, ShieldAlert } from "lucide-react";
import { getRouteOnboardingState, getCreatorFinance } from "@/lib/server/creator";
import { RouteAccountForm } from "./route-account-form";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Payouts" };
export const dynamic = "force-dynamic";

const STATUS_COPY: Record<string, { label: string; tone: string; detail: string }> = {
  created: {
    label: "Created",
    tone: "text-amber-700",
    detail: "Razorpay is verifying your bank account. This normally completes within 24 hours.",
  },
  requested: {
    label: "Under review",
    tone: "text-amber-700",
    detail: "Razorpay is reviewing your KYC and business details.",
  },
  active: {
    label: "Active",
    tone: "text-emerald-700",
    detail: "Transfers can be initiated and paid courses can be published.",
  },
  suspended: {
    label: "Suspended",
    tone: "text-red-700",
    detail: "Razorpay has suspended this linked account. Contact Razorpay support.",
  },
  closed: {
    label: "Closed",
    tone: "text-red-700",
    detail: "This linked account is closed.",
  },
  error: {
    label: "Error",
    tone: "text-red-700",
    detail: "Razorpay reported an error on this linked account.",
  },
};

export default async function CreatorPayoutsPage() {
  const [route, finance] = await Promise.all([getRouteOnboardingState(), getCreatorFinance()]);
  const status = route.status ?? null;
  const copy = status ? STATUS_COPY[status] : null;
  const verified = route.settlementVerified;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">Payouts</h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">
          Course earnings are routed to your own bank account through Razorpay Route. Zybble never holds your
          money in an internal wallet.
        </p>
      </header>

      <section
        className={`rounded-xl border p-5 shadow-card ${
          verified ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/40"
        }`}
      >
        <div className="flex flex-wrap items-start gap-3">
          <span className={`flex size-10 items-center justify-center rounded-xl ${verified ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
            {verified ? <ShieldCheck className="size-5" aria-hidden /> : <ShieldAlert className="size-5" aria-hidden />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[15px] font-semibold tracking-tight">
              Razorpay Route account {status ? <span className={copy?.tone}>· {copy?.label}</span> : "· not created"}
            </h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {route.accountId ? (
                <>
                  Linked account <code className="font-mono text-[11.5px]">{route.accountId}</code>
                  {route.checkedAt ? (
                    <> · last checked against Razorpay {new Date(route.checkedAt).toLocaleString("en-IN")}</>
                  ) : null}
                </>
              ) : (
                "You have not created a Razorpay linked account yet."
              )}
            </p>
            {route.blockedReason ? (
              <p className="mt-2 max-w-2xl text-[13px] text-amber-900">{route.blockedReason}</p>
            ) : (
              <p className="mt-2 text-[13px] text-emerald-800">
                Razorpay reports this account as active, so paid courses can be published and settled.
              </p>
            )}
          </div>
        </div>

        {!verified ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-white px-4 py-3 text-[13px]">
            <p className="font-medium text-amber-900">Paid courses are blocked</p>
            <p className="mt-1 text-muted-foreground">
              Zybble will not list a paid course until Razorpay marks this linked account active. Free courses
              are unaffected. This is a marketplace safety rule, not an error you can bypass.
            </p>
          </div>
        ) : null}
      </section>

      {!route.hasAccount ? <RouteAccountForm /> : null}

      <section className="rounded-xl border border-border bg-white p-5 shadow-card">
        <h2 className="font-display text-[15px] font-semibold tracking-tight">Money status</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Awaiting transfer", value: finance.pendingPaise },
            { label: "Transferred", value: finance.transferredPaise },
            { label: "Settled by Razorpay", value: finance.settledPaise },
            { label: "Reversed", value: finance.reversedPaise },
          ].map((row) => (
            <div key={row.label} className="rounded-lg border border-border px-3.5 py-3">
              <dt className="text-[12px] text-muted-foreground">{row.label}</dt>
              <dd className="mt-1 font-display text-[17px] font-bold tabular-nums">
                ₹{(row.value / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-[12px] text-zinc-400">
          A transfer is only marked settled once Razorpay reports the settlement; Zybble never sets that state
          from the browser.
        </p>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <a href="/creator/earnings">See the full earnings breakdown</a>
        </Button>
        <Button asChild variant="ghost">
          <a href="https://dashboard.razorpay.com/" target="_blank" rel="noreferrer noopener">
            Open the Razorpay dashboard
          </a>
        </Button>
      </div>

      {!route.hasAccount ? (
        <p className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
          <Landmark className="size-4" aria-hidden /> Razorpay requires a business or individual KYC and a
          verified Indian bank account before any transfer can settle.
        </p>
      ) : null}
    </div>
  );
}