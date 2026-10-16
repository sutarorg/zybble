import { Users, ShieldCheck, Ban } from "lucide-react";
import { getAdminUsers } from "@/lib/server/admin";
import { money } from "@/lib/admin";
import { EmptyState } from "@/components/ui/empty-state";
import { UserRowActions } from "./user-row-actions";

export const metadata = { title: "Users" };
export const dynamic = "force-dynamic";

const ROLE_TONE: Record<string, string> = {
  admin: "bg-red-100 text-red-700",
  moderator: "bg-violet-100 text-violet-700",
  creator: "bg-sky-100 text-sky-700",
  learner: "bg-zinc-100 text-zinc-600",
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; q?: string }>;
}) {
  const { role, q } = await searchParams;
  const all = await getAdminUsers();

  const query = (q ?? "").trim().toLowerCase();
  const users = all.filter((user) => {
    if (role && role !== "all" && user.role !== role) return false;
    if (!query) return true;
    return (
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query)
    );
  });

  const ROLES = ["all", "learner", "creator", "moderator", "admin"];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">Users</h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">
          {all.length} account{all.length === 1 ? "" : "s"}. Role changes are written with the service role and
          guarded by a database trigger, so a learner cannot promote themselves through the API.
        </p>
      </header>

      <form className="flex flex-wrap gap-2" action="/admin/users" method="get">
        <select
          name="role"
          defaultValue={role ?? "all"}
          className="h-9.5 rounded-lg border border-input bg-white px-3 text-sm"
          aria-label="Filter by role"
        >
          {ROLES.map((value) => (
            <option key={value} value={value}>
              {value === "all" ? "All roles" : value}
            </option>
          ))}
        </select>
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search name or email"
          aria-label="Search users"
          className="h-9.5 max-w-xs flex-1 rounded-lg border border-input bg-white px-3 text-sm"
        />
        <button type="submit" className="h-9.5 rounded-lg border border-border bg-white px-3 text-sm hover:bg-muted/60">
          Search
        </button>
      </form>

      {users.length === 0 ? (
        <EmptyState icon={Users} title="No accounts match" description="Try a different role or search term." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-white shadow-card">
          <table className="w-full min-w-[880px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[12px] text-muted-foreground">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Payout destination</th>
                <th className="px-4 py-3 text-right font-medium">Courses</th>
                <th className="px-4 py-3 text-right font-medium">Enrollments</th>
                <th className="px-4 py-3 text-right font-medium">Lifetime spend</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{user.name}</p>
                    <p className="text-[11.5px] text-muted-foreground">{user.email}</p>
                    {!user.emailVerified ? (
                      <span className="mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10.5px] font-medium text-amber-700">
                        email unverified
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${ROLE_TONE[user.role] ?? ROLE_TONE.learner}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                        user.status === "active"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{user.routeStatus ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{user.coursesCreated}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{user.enrollments}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{money(user.lifetimeSpendPaise)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-4 py-3">
                    <UserRowActions
                      userId={user.id}
                      role={user.role}
                      status={user.status}
                      isSelf={false}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="flex items-center gap-2 text-[12px] text-zinc-400">
        <ShieldCheck className="size-3.5" aria-hidden /> Suspension also revokes active Supabase Auth sessions so a
        banned account cannot keep using an existing cookie. <Ban className="size-3.5" aria-hidden />
      </p>
    </div>
  );
}