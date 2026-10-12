import { CATEGORIES, COURSES, INSTRUCTORS, REVIEWS } from "@/data/mock-data";
import { PLATFORM_COMMISSION, mulberry32 } from "@/lib/creator";
import type {
  AdminActivity,
  AdminCategory,
  AdminNotification,
  AdminOrder,
  AdminPayout,
  AdminReport,
  AdminUser,
} from "@/types";

/* -------------------------------------------------------------------------- */
/* Shared configuration                                                        */
/* -------------------------------------------------------------------------- */

/** Single configurable commission value for the admin portal (10% default). */
export const DEFAULT_COMMISSION_RATE = PLATFORM_COMMISSION;

export const commissionOf = (gross: number, rate = DEFAULT_COMMISSION_RATE) =>
  Math.round(gross * rate * 100) / 100;

export const creatorShareOf = (gross: number, rate = DEFAULT_COMMISSION_RATE) =>
  Math.round((gross - commissionOf(gross, rate)) * 100) / 100;

export const ADMIN_NAME = "Nadia Vermeulen";

const daysAgo = (d: number, h = 12) =>
  new Date(Date.now() - d * 86400_000 - h * 360_000).toISOString();

/* -------------------------------------------------------------------------- */
/* Users                                                                       */
/* -------------------------------------------------------------------------- */

export function seedAdminUsers(): AdminUser[] {
  const creators: AdminUser[] = INSTRUCTORS.map((ins, i) => ({
    id: `u_${ins.id}`,
    name: ins.name,
    email: `${ins.username.replace(/-/g, ".")}@zybble.studio`,
    initials: ins.initials,
    avatarColor: ins.avatarColor,
    role: "creator",
    country: ins.country,
    registeredAt: daysAgo(420 - i * 30),
    lastActiveAt: daysAgo(i % 4, 2),
    status: "active",
    coursesCreated: COURSES.filter((c) => c.instructorId === ins.id).length,
    enrollments: 0,
    lifetimeSpend: 0,
  }));

  const learners: AdminUser[] = [
    { id: "u_l1", name: "Sarah Kimani", email: "sarah.kimani@mail.demo", initials: "SK", avatarColor: "bg-emerald-100 text-emerald-700", role: "learner", country: "Kenya", registeredAt: daysAgo(300), lastActiveAt: daysAgo(0, 3), status: "active", coursesCreated: 0, enrollments: 4, lifetimeSpend: 219.96 },
    { id: "u_l2", name: "Tom Becker", email: "tom.becker@mail.demo", initials: "TB", avatarColor: "bg-cyan-100 text-cyan-700", role: "learner", country: "Germany", registeredAt: daysAgo(280), lastActiveAt: daysAgo(1), status: "active", coursesCreated: 0, enrollments: 3, lifetimeSpend: 144.98 },
    { id: "u_l3", name: "Lucas Meyer", email: "lucas.meyer@mail.demo", initials: "LM", avatarColor: "bg-teal-100 text-teal-700", role: "learner", country: "Brazil", registeredAt: daysAgo(220), lastActiveAt: daysAgo(2), status: "active", coursesCreated: 0, enrollments: 2, lifetimeSpend: 84.99 },
    { id: "u_l4", name: "Amara Diallo", email: "amara.diallo@mail.demo", initials: "AD", avatarColor: "bg-purple-100 text-purple-700", role: "learner", country: "Senegal", registeredAt: daysAgo(190), lastActiveAt: daysAgo(0, 8), status: "active", coursesCreated: 0, enrollments: 5, lifetimeSpend: 304.95 },
    { id: "u_l5", name: "Kenta Sato", email: "kenta.sato@mail.demo", initials: "KS", avatarColor: "bg-orange-100 text-orange-700", role: "learner", country: "Japan", registeredAt: daysAgo(160), lastActiveAt: daysAgo(4), status: "active", coursesCreated: 0, enrollments: 2, lifetimeSpend: 159.98 },
    { id: "u_l6", name: "Elena Petrova", email: "elena.petrova@mail.demo", initials: "EP", avatarColor: "bg-sky-100 text-sky-700", role: "learner", country: "Bulgaria", registeredAt: daysAgo(140), lastActiveAt: daysAgo(1, 4), status: "active", coursesCreated: 0, enrollments: 3, lifetimeSpend: 74.99 },
    { id: "u_l7", name: "Diego Ramírez", email: "diego.ramirez@mail.demo", initials: "DR", avatarColor: "bg-lime-100 text-lime-700", role: "learner", country: "Chile", registeredAt: daysAgo(110), lastActiveAt: daysAgo(6), status: "suspended", coursesCreated: 0, enrollments: 1, lifetimeSpend: 54.99 },
    { id: "u_l8", name: "Hannah Cole", email: "hannah.cole@mail.demo", initials: "HC", avatarColor: "bg-rose-100 text-rose-700", role: "learner", country: "United Kingdom", registeredAt: daysAgo(96), lastActiveAt: daysAgo(0, 1), status: "active", coursesCreated: 0, enrollments: 2, lifetimeSpend: 69.99 },
    { id: "u_l9", name: "Marcus Webb", email: "marcus.webb@mail.demo", initials: "MW", avatarColor: "bg-indigo-100 text-indigo-700", role: "learner", country: "United States", registeredAt: daysAgo(74), lastActiveAt: daysAgo(3), status: "active", coursesCreated: 0, enrollments: 1, lifetimeSpend: 69.99 },
    { id: "u_l10", name: "Julia Armstrong", email: "julia.armstrong@mail.demo", initials: "JA", avatarColor: "bg-blue-100 text-blue-700", role: "learner", country: "Canada", registeredAt: daysAgo(52), lastActiveAt: daysAgo(1), status: "active", coursesCreated: 0, enrollments: 2, lifetimeSpend: 94.99 },
    { id: "u_l11", name: "Omar Haddad", email: "omar.haddad@mail.demo", initials: "OH", avatarColor: "bg-teal-100 text-teal-700", role: "learner", country: "Egypt", registeredAt: daysAgo(38), lastActiveAt: daysAgo(2, 5), status: "active", coursesCreated: 0, enrollments: 1, lifetimeSpend: 94.99 },
    { id: "u_l12", name: "Grace Adeyemi", email: "grace.adeyemi@mail.demo", initials: "GA", avatarColor: "bg-green-100 text-green-700", role: "learner", country: "Nigeria", registeredAt: daysAgo(21), lastActiveAt: daysAgo(0, 6), status: "active", coursesCreated: 0, enrollments: 1, lifetimeSpend: 0 },
  ];

  const staff: AdminUser[] = [
    { id: "u_admin", name: ADMIN_NAME, email: "nadia@zybble.admin", initials: "NV", avatarColor: "bg-zinc-800 text-white", role: "admin", country: "Netherlands", registeredAt: daysAgo(500), lastActiveAt: daysAgo(0, 1), status: "active", coursesCreated: 0, enrollments: 0, lifetimeSpend: 0 },
    { id: "u_mod", name: "Rafael Costa", email: "rafael@zybble.admin", initials: "RC", avatarColor: "bg-amber-100 text-amber-700", role: "moderator", country: "Portugal", registeredAt: daysAgo(430), lastActiveAt: daysAgo(0, 5), status: "active", coursesCreated: 0, enrollments: 0, lifetimeSpend: 0 },
  ];

  return [...staff, ...creators, ...learners];
}

/* -------------------------------------------------------------------------- */
/* Marketplace orders (platform-wide, composite demo data)                     */
/* -------------------------------------------------------------------------- */

const LEARNER_NAMES = [
  "Sarah Kimani", "Tom Becker", "Lucas Meyer", "Amara Diallo", "Kenta Sato",
  "Elena Petrova", "Hannah Cole", "Marcus Webb", "Ana Costa", "Viktor Nguyen",
  "Paula Ferreira", "Roberto Silva", "Julia Armstrong", "Omar Haddad", "Camila Torres",
  "Nils Bergström", "Grace Adeyemi", "Peter Novak", "Isabelle Laurent", "Sam Whitfield",
];

export function seedAdminOrders(): AdminOrder[] {
  const rand = mulberry32(9090);
  const paidCourses = COURSES.filter((c) => c.price > 0);
  const orders: AdminOrder[] = [];
  for (let i = 0; i < 42; i++) {
    const course = paidCourses[Math.floor(rand() * paidCourses.length)];
    const instructor = INSTRUCTORS.find((ins) => ins.id === course.instructorId)!;
    const learnerName = LEARNER_NAMES[Math.floor(rand() * LEARNER_NAMES.length)];
    const roll = rand();
    const status: AdminOrder["status"] =
      roll > 0.95 ? "failed" : roll > 0.88 ? "refunded" : roll > 0.8 ? "pending" : "paid";
    const date = new Date(Date.now() - Math.floor(rand() * 120) * 86400_000 - i * 1800_000);
    const methods = ["Visa ••4242", "MC ••5377", "Amex ••0005", "PayPal", "Visa ••9010"];
    orders.push({
      id: `ao_${i}`,
      orderRef: `Z-2026-${String(4100 + i + Math.floor(rand() * 60)).padStart(4, "0")}`,
      learnerId: `u_l_${i % 12}`,
      learnerName,
      courseId: course.id,
      courseTitle: course.title,
      creatorId: instructor.id,
      creatorName: instructor.name,
      gross: course.price,
      commission: commissionOf(course.price),
      creatorShare: creatorShareOf(course.price),
      date: date.toISOString(),
      status,
      method: methods[Math.floor(rand() * methods.length)],
    });
  }
  return orders.sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

/* -------------------------------------------------------------------------- */
/* Payouts                                                                     */
/* -------------------------------------------------------------------------- */

export function seedAdminPayouts(): AdminPayout[] {
  const rows: { idx: number; balance: number; amount: number; status: AdminPayout["status"]; days: number }[] = [
    { idx: 0, balance: 4120.4, amount: 1740.0, status: "requested", days: 1 },
    { idx: 1, balance: 2890.1, amount: 2890.1, status: "approved", days: 3 },
    { idx: 2, balance: 950.2, amount: 650.0, status: "requested", days: 2 },
    { idx: 0, balance: 2380.4, amount: 2380.4, status: "paid", days: 32 },
    { idx: 3, balance: 1210.5, amount: 1210.5, status: "paid", days: 46 },
    { idx: 1, balance: 1980.75, amount: 1980.75, status: "paid", days: 63 },
    { idx: 4, balance: 420.6, amount: 420.6, status: "rejected", days: 70 },
  ];
  return rows.map((r, i) => {
    const ins = INSTRUCTORS[r.idx];
    return {
      id: `ap_${i}`,
      creatorId: ins.id,
      creatorName: ins.name,
      eligibleBalance: r.balance,
      amount: r.amount,
      status: r.status,
      reference: `PO-2026-${String(140 + i * 7)}`,
      requestedAt: daysAgo(r.days),
      processedAt: r.status === "paid" || r.status === "rejected" ? daysAgo(r.days - 2) : undefined,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Categories                                                                  */
/* -------------------------------------------------------------------------- */

export function seedAdminCategories(): AdminCategory[] {
  return CATEGORIES.map((c, order) => ({
    id: `acat_${c.slug}`,
    slug: c.slug,
    name: c.name,
    description: c.description,
    order: order + 1,
    visible: true,
    courseCount: COURSES.filter((course) => course.category === c.slug).length,
  }));
}

/* -------------------------------------------------------------------------- */
/* Reports                                                                     */
/* -------------------------------------------------------------------------- */

export function seedAdminReports(): AdminReport[] {
  const rev = REVIEWS;
  return [
    {
      id: "rpt_1",
      type: "course",
      targetId: "crs_audio",
      targetTitle: "AI Audio and Music Generation",
      reporterName: "Nils Bergström",
      reason: "Licensing concern — one resource link appears to scrape third-party stems without attribution.",
      submittedAt: daysAgo(1),
      status: "open",
      priority: "high",
    },
    {
      id: "rpt_2",
      type: "review",
      targetId: rev[13]?.id ?? "rev14",
      targetTitle: "Review on “Build an AI SaaS”",
      targetExcerpt: rev[13]?.text ?? "Review content",
      reporterName: "Julia Armstrong",
      reason: "Suspected self-review — same writing style as the course landing copy.",
      submittedAt: daysAgo(2),
      status: "under_review",
      priority: "medium",
    },
    {
      id: "rpt_3",
      type: "user",
      targetId: "u_l7",
      targetTitle: "Diego Ramírez (learner)",
      reporterName: "Rafael Costa",
      reason: "Repeated abusive comments in course Q&A threads; multiple flags from instructors.",
      submittedAt: daysAgo(6),
      status: "resolved",
      priority: "high",
      adminNote: "Account suspended after third verified report. (Simulated)",
    },
    {
      id: "rpt_4",
      type: "course",
      targetId: "crs_vision",
      targetTitle: "ChatGPT Vision Mastery",
      reporterName: "Elena Petrova",
      reason: "Thumbnail looks nearly identical to another course in the same category.",
      submittedAt: daysAgo(4),
      status: "dismissed",
      priority: "low",
      adminNote: "Both are template-based gallery images; no policy violation. (Simulated)",
    },
    {
      id: "rpt_5",
      type: "review",
      targetId: rev[2]?.id ?? "rev3",
      targetTitle: "Review on “n8n Automation Mastery”",
      targetExcerpt: rev[2]?.text ?? "Review content",
      reporterName: "Anonymous learner",
      reason: "Review contains an external Discord link that looks like spam.",
      submittedAt: daysAgo(0, 5),
      status: "open",
      priority: "medium",
    },
  ];
}

/* -------------------------------------------------------------------------- */
/* Activity + notifications                                                    */
/* -------------------------------------------------------------------------- */

export function seedAdminActivity(): AdminActivity[] {
  return [
    { id: "act_1", actor: ADMIN_NAME, action: "Approved payout request", target: "$1,980.75 — Sofia Marchetti", at: daysAgo(0, 1), kind: "payout" },
    { id: "act_2", actor: "Rafael Costa", action: "Marked report under review", target: "Review on Build an AI SaaS", at: daysAgo(0, 3), kind: "review" },
    { id: "act_3", actor: ADMIN_NAME, action: "Suspended learner account", target: "Diego Ramírez", at: daysAgo(1, 2), kind: "user" },
    { id: "act_4", actor: "Rafael Costa", action: "Requested changes on", target: "ChatGPT Vision Mastery", at: daysAgo(1, 6), kind: "moderation" },
    { id: "act_5", actor: ADMIN_NAME, action: "Approved and published", target: "AI Video Creation Masterclass", at: daysAgo(2, 4), kind: "moderation" },
    { id: "act_6", actor: ADMIN_NAME, action: "Updated platform commission note", target: "Settings", at: daysAgo(3, 2), kind: "settings" },
    { id: "act_7", actor: "Rafael Costa", action: "Dismissed report", target: "Thumbnail similarity (ChatGPT Vision Mastery)", at: daysAgo(4, 1), kind: "review" },
    { id: "act_8", actor: ADMIN_NAME, action: "Approved payout request", target: "$2,380.40 — Maya Lindqvist", at: daysAgo(5, 3), kind: "payout" },
  ];
}

export function seedAdminNotifications(): AdminNotification[] {
  return [
    { id: "an_1", title: "Course awaiting review", body: "ChatGPT for Teams has been in the queue for 2 days.", kind: "moderation", createdAt: daysAgo(0, 2), href: "/admin/courses/crs_gpt_teams" },
    { id: "an_2", title: "New high-priority report", body: "Licensing concern on AI Audio and Music Generation.", kind: "report", createdAt: daysAgo(1), href: "/admin/reports" },
    { id: "an_3", title: "Payout requested", body: "Sofia Marchetti requested $650.00 to her bank.", kind: "payout", createdAt: daysAgo(2), href: "/admin/payouts" },
    { id: "an_4", title: "Welcome to the Admin Portal", body: "Everything here is a local frontend simulation.", kind: "system", createdAt: daysAgo(3), href: "/admin/settings" },
  ];
}

/* -------------------------------------------------------------------------- */
/* Analytics series                                                            */
/* -------------------------------------------------------------------------- */

export interface AdminSeriesPoint {
  label: string;
  revenue: number;
  users: number;
  enrollments: number;
}

export function adminSeries(range: "7d" | "30d" | "90d" | "1y"): AdminSeriesPoint[] {
  const cfg: Record<string, { points: number; seed: number; baseRev: number; baseUsers: number }> = {
    "7d": { points: 7, seed: 501, baseRev: 2200, baseUsers: 240 },
    "30d": { points: 30, seed: 502, baseRev: 74, baseUsers: 8 },
    "90d": { points: 30, seed: 503, baseRev: 220, baseUsers: 24 },
    "1y": { points: 12, seed: 504, baseRev: 5400, baseUsers: 640 },
  };
  const { points, seed, baseRev, baseUsers } = cfg[range];
  const labels: Record<string, (i: number) => string> = {
    "7d": (i) => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
    "30d": (i) => `${i + 1}`,
    "90d": (i) => `W${Math.floor(i / 3) + 1}`,
    "1y": (i) => ["Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb"][i],
  };
  const rand = mulberry32(seed);
  return Array.from({ length: points }, (_, i) => {
    const weekly = 1 + 0.3 * Math.sin((i / points) * Math.PI * 2);
    const noise = 0.6 + rand() * 0.8;
    const trend = 0.7 + (i / points) * 0.6;
    return {
      label: labels[range](i),
      revenue: Math.round(baseRev * weekly * noise * trend),
      users: Math.max(2, Math.round(baseUsers * weekly * noise * trend)),
      enrollments: Math.max(4, Math.round(baseRev * 1.8 * weekly * noise * trend)),
    };
  });
}

/* -------------------------------------------------------------------------- */
/* CSV export helper (browser-generated demo files)                            */
/* -------------------------------------------------------------------------- */

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function csvDownloadSupported(): boolean {
  return typeof window !== "undefined" && typeof Blob !== "undefined";
}
