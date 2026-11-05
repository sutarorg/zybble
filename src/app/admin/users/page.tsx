import type { Metadata } from "next";
import { Users } from "lucide-react";
import { PageHeader, Panel } from "@/components/admin/primitives";
import { UsersTable } from "@/components/admin/users-table";

/**
 * Platform users.
 *
 * The shell is a Server Component; the table is a client component that pages
 * through `/api/admin/users`. Membership is loaded per page of results rather
 * than for the whole table, so the query cost does not grow with the user base.
 */

export const metadata: Metadata = { title: "Users" };
export const dynamic = "force-dynamic";

export default function AdminUsersPage() {
  return (
    <>
      <PageHeader
        title="Users"
        description="Every registered account, with the workspaces they belong to. Read-only — accounts cannot be modified from here."
      />

      <Panel className="mt-6" icon={Users} padded={false}>
        <UsersTable />
      </Panel>
    </>
  );
}
