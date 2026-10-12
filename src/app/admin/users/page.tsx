"use client";

import * as React from "react";
import { use, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUpDown,
  Ban,
  BookOpen,
  GraduationCap,
  Receipt,
  Search,
  SearchX,
  ShieldCheck,
  Star,
  UserCog,
  UserCheck,
  Users,
} from "lucide-react";
import type { AdminReport, AdminRole, AdminUser, CreatorCourse, Enrollment, Order } from "@/types";
import { COURSES, REVIEWS } from "@/data/mock-data";
import { useAdmin } from "@/components/providers/admin-provider";
import { useCreator } from "@/components/providers/creator-provider";
import { useApp } from "@/components/providers/app-providers";
import { formatDate, formatPrice, timeAgo } from "@/lib/format";
import { AdminDrawer } from "@/components/admin/admin-drawer";
import { ActionButton } from "@/components/admin/action-button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PAGE_SIZE = 8;
type Sort = "registered" | "name" | "active" | "courses";

const ROLE_META: Record<AdminRole, { label: string; variant: "violet" | "emerald" | "secondary" | "amber" }> = {
  admin: { label: "Admin", variant: "violet" },
  moderator: { label: "Moderator", variant: "amber" },
  creator: { label: "Creator", variant: "emerald" },
  learner: { label: "Learner", variant: "secondary" },
};

export default function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; selected?: string }>;
}) {
  const sp = use(searchParams);
  const router = useRouter();
  const pathname = usePathname();

  const { hydrated, users, setUserStatus, setUserRole, reports } = useAdmin();
  const { courses } = useCreator();
  const { orders: learnerOrders, enrollments } = useApp();

  const [query, setQuery] = useState("");
  const [role, setRole] = useState<AdminRole | "all">(
    typeof sp.role === "string" && sp.role !== "all" && ["admin", "moderator", "creator", "learner"].includes(sp.role)
      ? (sp.role as AdminRole)
      : "all"
  );
  const [sort, setSort] = useState<Sort>("registered");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(typeof sp.selected === "string" ? sp.selected : null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = users.filter((u) => {
      if (role !== "all" && u.role !== role) return false;
      if (q && !`${u.name} ${u.email} ${u.country}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      switch (sort) {
        case "name":
          return a.name.localeCompare(b.name);
        case "active":
          return +new Date(b.lastActiveAt) - +new Date(a.lastActiveAt);
        case "courses":
          return b.coursesCreated + b.enrollments - (a.coursesCreated + a.enrollments);
        default:
          return +new Date(b.registeredAt) - +new Date(a.registeredAt);
      }
    });
  }, [users, query, role, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageItems = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  React.useEffect(() => setPage(1), [query, role, sort]);

  const selected = selectedId ? users.find((u) => u.id === selectedId) : null;
  const syncUrl = (id: string | null) => {
    const qs = new URLSearchParams();
    if (role !== "all") qs.set("role", role);
    if (id) qs.set("selected", id);
    router.replace(`${pathname}${qs.size ? `?${qs}` : ""}`, { scroll: false });
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold tracking-[0.14em] text-primary uppercase">People</p>
        <h1 className="font-display mt-1.5 text-[26px] font-bold tracking-tight sm:text-3xl">User management</h1>
        <p className="mt-1.5 max-w-2xl text-[14px] text-muted-foreground">
          Creators, learners and staff as mock accounts. Status and role changes update demo data
          only — no real permissions are ever granted.
        </p>
      </div>

      {/* Role chips */}
      <div className="flex snap-x gap-2 overflow-x-auto pb-1 scrollbar-hide" role="tablist" aria-label="Filter by role">
        {(["all", "admin", "moderator", "creator", "learner"] as const).map((r) => {
          const active = role === r;
          const count = r === "all" ? users.length : users.filter((u) => u.role === r).length;
          return (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setRole(r);
                const qs = new URLSearchParams();
                if (r !== "all") qs.set("role", r);
                router.replace(`${pathname}${qs.size ? `?${qs}` : ""}`, { scroll: false });
              }}
              className={cn(
                "flex h-8.5 shrink-0 cursor-pointer snap-start items-center gap-1.5 rounded-full border px-3.5 text-[12.5px] font-medium capitalize whitespace-nowrap transition-all",
                active ? "border-primary bg-primary text-white shadow-sm" : "border-border bg-white text-muted-foreground hover:border-zinc-300 hover:text-foreground"
              )}
            >
              {r === "all" ? "All accounts" : `${ROLE_META[r].label}s`}
              <span className={cn("rounded px-1 text-[10.5px] tabular-nums", active ? "bg-white/20" : "bg-muted")}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email or country…"
            aria-label="Search users"
            className="h-9.5 w-full rounded-lg border border-input bg-white pr-3 pl-9 text-sm shadow-xs outline-none placeholder:text-zinc-400 focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/20 [&::-webkit-search-cancel-button]:hidden"
          />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
          <SelectTrigger className="w-44" aria-label="Sort users">
            <ArrowUpDown className="size-3.5 text-zinc-400" aria-hidden />
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="registered">Newest first</SelectItem>
            <SelectItem value="active">Recently active</SelectItem>
            <SelectItem value="courses">Most courses</SelectItem>
            <SelectItem value="name">Name A–Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!hydrated ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : pageItems.length === 0 ? (
        <EmptyState
          icon={query ? SearchX : Users}
          title={query ? "No users match" : "No users in this segment"}
          description="Try a different search or role filter."
          action={
            <Button variant="outline" onClick={() => { setQuery(""); setRole("all"); router.replace(pathname, { scroll: false }); }}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-border bg-white shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-200 text-left">
                <thead>
                  <tr className="border-b border-border text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                    <th className="py-3 pr-4 pl-5">User</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Registered</th>
                    <th className="px-4 py-3">Activity</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="py-3 pr-5 pl-4 text-right">
                      <span className="sr-only">Profile</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((u) => (
                    <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                      <td className="max-w-64 py-3 pr-4 pl-5">
                        <div className="flex items-center gap-3">
                          <Avatar className="size-9">
                            <AvatarFallback className={cn("text-[11px]", u.avatarColor)}>{u.initials}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold">{u.name}</p>
                            <p className="truncate text-[11.5px] text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={ROLE_META[u.role].variant}>{ROLE_META[u.role].label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-[12px] whitespace-nowrap text-muted-foreground">
                        {formatDate(u.registeredAt)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[12px] text-muted-foreground">
                          {u.role === "creator"
                            ? `${u.coursesCreated} ${u.coursesCreated === 1 ? "course" : "courses"}`
                            : u.role === "learner"
                              ? `${u.enrollments} enrollments`
                              : "Staff"}
                          {" · "}
                          <span className="text-zinc-400">{timeAgo(u.lastActiveAt)}</span>
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {u.status === "active" ? (
                          <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-emerald-700">
                            <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
                            Active
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-red-600">
                            <span className="size-1.5 rounded-full bg-red-500" aria-hidden />
                            Suspended
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-5 pl-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedId(u.id);
                            syncUrl(u.id);
                          }}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12.5px] text-muted-foreground">
              Page {current} of {totalPages} · {filtered.length} users
            </p>
            <Pagination page={current} totalPages={totalPages} onChange={setPage} />
          </div>
        </>
      )}

      {/* User detail drawer */}
      <AdminDrawer
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null);
            syncUrl(null);
          }
        }}
        title={selected ? <UserDrawerTitle user={selected} /> : null}
        description={selected ? `${ROLE_META[selected.role].label} · joined ${formatDate(selected.registeredAt)} · ${selected.country}` : undefined}
        footer={
          selected && selected.role !== "admin" ? (
            <div className="flex flex-wrap items-center gap-2">
              {selected.status === "active" ? (
                <ActionButton
                  label="Suspend account"
                  icon={Ban}
                  danger
                  size="sm"
                  confirmTitle={`Suspend ${selected.name}?`}
                  confirmBody="The account is marked suspended in this local demo. No real access is revoked — the demo role preview is unaffected."
                  confirmLabel="Suspend account"
                  onAction={() => setUserStatus(selected.id, "suspended")}
                  toastText="Account suspended (simulated)"
                />
              ) : (
                <ActionButton
                  label="Reactivate account"
                  icon={UserCheck}
                  size="sm"
                  confirmTitle={`Reactivate ${selected.name}?`}
                  confirmBody="The account is marked active again in the local mock data."
                  confirmLabel="Reactivate"
                  onAction={() => setUserStatus(selected.id, "active")}
                  toastText="Account reactivated (simulated)"
                />
              )}
              <div className="flex items-center gap-1.5">
                <span className="text-[11.5px] font-semibold text-zinc-400 uppercase">Role:</span>
                {(["creator", "learner", "moderator"] as const).map((r) =>
                  selected.role !== r ? (
                    <ActionButton
                      key={r}
                      label={ROLE_META[r].label}
                      icon={UserCog}
                      variant="outline"
                      size="sm"
                      confirmTitle={`Make ${selected.name} a ${ROLE_META[r].label.toLowerCase()}?`}
                      confirmBody="This changes the mock account's role label only. It never grants real permissions — the portal is a frontend simulation."
                      confirmLabel={`Set role: ${ROLE_META[r].label}`}
                      onAction={() => setUserRole(selected.id, r)}
                      toastText={`Role updated to ${ROLE_META[r].label} (simulated)`}
                    />
                  ) : null
                )}
              </div>
            </div>
          ) : undefined
        }
      >
        {selected && (
          <UserDrawerBody
            user={selected}
            courses={courses}
            reports={reports.filter((r) => r.targetId === selected.id)}
            learnerOrders={learnerOrders}
            enrollments={enrollments}
          />
        )}
      </AdminDrawer>
    </div>
  );
}

function UserDrawerTitle({ user }: { user: AdminUser }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar className="size-11">
        <AvatarFallback className={cn("text-[12px]", user.avatarColor)}>{user.initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="text-[15.5px] font-semibold">{user.name}</p>
        <p className="truncate text-[12px] text-muted-foreground">{user.email}</p>
      </div>
    </div>
  );
}

function UserDrawerBody({
  user,
  courses,
  reports,
  learnerOrders,
  enrollments,
}: {
  user: AdminUser;
  courses: CreatorCourse[];
  reports: AdminReport[];
  learnerOrders: Order[];
  enrollments: Enrollment[];
}) {
  const instructorKey = user.id.replace("u_", "");
  const isCreatorPersona = user.role === "creator";
  const personaCourses = isCreatorPersona
    ? courses.filter((c) => c.instructorId === instructorKey)
    : [];
  void enrollments;
  const spent = user.lifetimeSpend;
  const userReviews = REVIEWS.filter((r) => r.author === user.name);

  const timeline = [
    { text: "Registered on Zybble", at: user.registeredAt },
    { text: `Marked ${user.status}`, at: user.lastActiveAt },
    ...(isCreatorPersona && personaCourses.length ? [{ text: `Published “${personaCourses[0].title}” (simulated)`, at: user.lastActiveAt }] : []),
  ];

  return (
    <div className="space-y-5 pb-6">
      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: "Courses", value: isCreatorPersona ? personaCourses.length : 0 },
          { label: "Enrollments", value: user.enrollments },
          { label: "Spend", value: spent > 0 ? formatPrice(spent) : "—" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border p-2.5">
            <p className="font-display text-[15px] font-bold tabular-nums">{s.value}</p>
            <p className="text-[10.5px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Courses */}
      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold">
          <BookOpen className="size-3.5 text-zinc-400" aria-hidden />
          {isCreatorPersona ? "Created courses" : "Courses & enrollments"}
        </h3>
        {isCreatorPersona ? (
          personaCourses.length === 0 ? (
            <p className="text-[12.5px] text-zinc-400">No courses created.</p>
          ) : (
            <ul className="space-y-1.5">
              {personaCourses.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
                  <span className="truncate text-[12.5px] font-medium">{c.title}</span>
                  <span className="shrink-0 text-[11.5px] tabular-nums text-zinc-400">{c.price === 0 ? "Free" : formatPrice(c.price)}</span>
                </li>
              ))}
            </ul>
          )
        ) : user.role === "learner" ? (
          learnerOrders.length === 0 && enrollments.length === 0 ? (
            <p className="text-[12.5px] text-zinc-400">
              {user.enrollments} mock enrollments recorded in the seed data. Local demo enrollments
              appear here when you complete a simulated checkout yourself.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {learnerOrders.slice(0, 5).map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
                  <span className="truncate font-mono text-[11.5px] text-zinc-500">{o.id}</span>
                  <span className="shrink-0 text-[11.5px] tabular-nums">{formatPrice(o.total)}</span>
                </li>
              ))}
            </ul>
          )
        ) : (
          <p className="text-[12.5px] text-zinc-400">Staff accounts don't own or enroll in courses.</p>
        )}
      </section>

      {/* Reviews & reports */}
      {(userReviews.length > 0 || reports.length > 0) && (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold">
            <Star className="size-3.5 text-zinc-400" aria-hidden />
            Reviews & reports
          </h3>
          <ul className="space-y-1.5">
            {userReviews.slice(0, 3).map((r) => (
              <li key={r.id} className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-[12px] text-muted-foreground">
                “{r.title}” · {r.rating}★
              </li>
            ))}
            {reports.slice(0, 3).map((r) => (
              <li key={r.id} className="rounded-lg border border-red-200 bg-red-50/60 px-3 py-2 text-[12px] text-red-700">
                Report: {r.targetTitle} · {r.status}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Activity timeline */}
      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold">
          <GraduationCap className="size-3.5 text-zinc-400" aria-hidden />
          Activity timeline (mock)
        </h3>
        <ul className="space-y-2.5 border-l border-border pl-4">
          {timeline.map((t, i) => (
            <li key={i} className="relative">
              <span className="absolute top-1.5 -left-[21px] size-2 rounded-full bg-primary" aria-hidden />
              <p className="text-[12.5px]">{t.text}</p>
              <p className="text-[11px] text-zinc-400">{formatDate(t.at)}</p>
            </li>
          ))}
        </ul>
      </section>

      {selectedGuardNote()}
    </div>
  );
}

function selectedGuardNote() {
  return (
    <p className="flex items-start gap-1.5 rounded-lg border border-violet-200 bg-accent p-3 text-[11.5px] leading-relaxed text-violet-950/70">
      <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
      Account changes in this drawer only update local mock data. Nothing touches real accounts,
      permissions or servers.
    </p>
  );
}
