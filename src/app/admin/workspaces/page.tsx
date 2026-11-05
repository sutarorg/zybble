import type { Metadata } from "next";
import { PageHeader, Panel } from "@/components/admin/primitives";
import { WorkspacesTable } from "@/components/admin/workspaces-table";

/**
 * Platform workspaces.
 *
 * Member and LinkedIn-account counts are counted from the membership and
 * connection tables for the rows on screen, not from a denormalised column
 * that could drift.
 */

export const metadata: Metadata = { title: "Workspaces" };
export const dynamic = "force-dynamic";

export default function AdminWorkspacesPage() {
  return (
    <>
      <PageHeader
        title="Workspaces"
        description="Every workspace on the platform, with its owner, effective plan and connected accounts. Read-only."
      />

      <Panel className="mt-6" padded={false}>
        <WorkspacesTable />
      </Panel>
    </>
  );
}
