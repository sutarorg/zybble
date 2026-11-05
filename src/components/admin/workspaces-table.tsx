"use client";

import { useCallback, useState } from "react";
import { DataTable, EmptyRow, StatusPill, Td, Th } from "@/components/admin/primitives";
import { Pagination, FilterSelect, SearchInput, TableToolbar } from "@/components/admin/table-controls";
import { useAdminList } from "@/components/admin/use-admin-list";
import { formatDate } from "@/features/admin/format";
import type { AdminWorkspaceRow } from "@/features/admin/types";
import type { WorkspacePlanFilter } from "@/features/admin/workspaces";

/**
 * Platform workspace table.
 *
 * The Plan column shows the *effective* plan derived from the subscription
 * row — the same rule as `public.workspace_plan()` — so a workspace whose
 * payment lapsed reads as Free here exactly as it does for the customer.
 */

const PER_PAGE = 25;

const PLAN_OPTIONS = [
  { value: "all" as const, label: "All plans" },
  { value: "pro" as const, label: "Pro" },
  { value: "free" as const, label: "Free" },
];

export function WorkspacesTable() {
  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState<WorkspacePlanFilter>("all");
  const [page, setPage] = useState(1);

  // Reset the page in the handlers rather than in an effect: a narrower result
  // set makes the old page number meaningless, and doing it in the same event
  // avoids the extra render pass an effect would trigger.
  const changeSearch = useCallback((next: string) => {
    setSearch(next);
    setPage(1);
  }, []);

  const changePlan = useCallback((next: WorkspacePlanFilter) => {
    setPlan(next);
    setPage(1);
  }, []);

  const { data, loading, error } = useAdminList<AdminWorkspaceRow>("/api/admin/workspaces", {
    q: search || undefined,
    plan,
    page,
    perPage: PER_PAGE,
  });

  return (
    <>
      <TableToolbar>
        <SearchInput
          label="Search workspaces by name"
          placeholder="Search workspace name…"
          defaultValue={search}
          onChange={changeSearch}
        />
        <FilterSelect
          label="Filter by plan"
          value={plan}
          onChange={changePlan}
          options={PLAN_OPTIONS}
        />
      </TableToolbar>

      {error ? (
        <p className="px-4 py-10 text-center text-[13px] text-red-600">{error}</p>
      ) : (
        <>
          <DataTable className={loading ? "opacity-60 transition-opacity" : undefined}>
            <thead>
              <tr>
                <Th>Workspace</Th>
                <Th>Owner</Th>
                <Th>Plan</Th>
                <Th>Members</Th>
                <Th>LinkedIn</Th>
                <Th>Created</Th>
              </tr>
            </thead>
            <tbody>
              {data === null ? (
                <EmptyRow colSpan={6}>Loading…</EmptyRow>
              ) : data.rows.length === 0 ? (
                <EmptyRow colSpan={6}>
                  {search || plan !== "all"
                    ? "No workspaces match this search."
                    : "No workspaces created yet."}
                </EmptyRow>
              ) : (
                data.rows.map((workspace) => (
                  <tr key={workspace.id}>
                    <Td>
                      <span className="font-medium text-slate-900">{workspace.name}</span>
                      <span className="block text-[11px] text-slate-400">
                        /{workspace.slug}
                      </span>
                    </Td>
                    <Td>
                      {workspace.owner ? (
                        <>
                          <span className="block text-slate-700">
                            {workspace.owner.name ?? "—"}
                          </span>
                          <span className="block text-[11px] text-slate-400">
                            {workspace.owner.email}
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </Td>
                    <Td>
                      <StatusPill tone={workspace.plan === "pro" ? "info" : "neutral"}>
                        {workspace.plan === "pro" ? "Pro" : "Free"}
                      </StatusPill>
                      {workspace.subscriptionStatus ? (
                        <span className="mt-0.5 block text-[11px] text-slate-400">
                          {workspace.subscriptionStatus}
                        </span>
                      ) : null}
                    </Td>
                    <Td className="tabular-nums">{workspace.memberCount}</Td>
                    <Td className="tabular-nums">
                      {workspace.linkedinAccountCount}
                      {workspace.seats > 1 ? (
                        <span className="ml-1 text-[11px] text-slate-400">
                          ({workspace.seats} seats)
                        </span>
                      ) : null}
                    </Td>
                    <Td className="tabular-nums text-slate-500">
                      {formatDate(workspace.createdAt)}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </DataTable>

          <Pagination
            page={data?.page ?? page}
            pageCount={data?.pageCount ?? 1}
            total={data?.total ?? 0}
            perPage={PER_PAGE}
            onPage={setPage}
          />
        </>
      )}
    </>
  );
}
