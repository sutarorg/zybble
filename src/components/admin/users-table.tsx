"use client";

import { useCallback, useState } from "react";
import { UserX, Users } from "lucide-react";
import {
  DataTable,
  EmptyRow,
  SkeletonRows,
  StatusPill,
  Td,
  Th,
} from "@/components/admin/primitives";
import {
  Pagination,
  FilterSelect,
  SearchInput,
  TableToolbar,
} from "@/components/admin/table-controls";
import { useAdminList } from "@/components/admin/use-admin-list";
import { formatDate } from "@/features/admin/format";
import type { AdminUserRow } from "@/features/admin/types";
import type { UserStatusFilter } from "@/features/admin/users";
import { cn } from "@/lib/utils";

/**
 * Platform user table.
 *
 * Data comes from `/api/admin/users`, which authorises independently of the
 * page — so a direct request to the endpoint is checked exactly the same way
 * as one made from here.
 *
 * "Workspaces" shows membership, not ownership: the number is the count and the
 * tooltip lists them, because squeezing five workspace names into a cell would
 * make the table unreadable.
 */

const PER_PAGE = 25;

const STATUS_OPTIONS = [
  { value: "all" as const, label: "All statuses" },
  { value: "active" as const, label: "Active" },
  { value: "pending_onboarding" as const, label: "Pending onboarding" },
  { value: "deleted" as const, label: "Deleted" },
];

const STATUS_TONE = {
  active: "success",
  pending_onboarding: "warning",
  deleted: "neutral",
} as const;

const STATUS_LABEL = {
  active: "Active",
  pending_onboarding: "Pending onboarding",
  deleted: "Deleted",
} as const;

const COLUMNS = 5;

export function UsersTable() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<UserStatusFilter>("all");
  const [page, setPage] = useState(1);

  // A narrower result set makes the current page number meaningless, so both
  // controls reset it. This lives in the handlers rather than in an effect:
  // deriving state from a change in the same event avoids the extra render
  // pass an effect would cause.
  const changeSearch = useCallback((next: string) => {
    setSearch(next);
    setPage(1);
  }, []);

  const changeStatus = useCallback((next: UserStatusFilter) => {
    setStatus(next);
    setPage(1);
  }, []);

  const { data, loading, error } = useAdminList<AdminUserRow>("/api/admin/users", {
    q: search || undefined,
    status,
    page,
    perPage: PER_PAGE,
  });

  const firstLoad = data === null;
  const filtered = search !== "" || status !== "all";

  return (
    <>
      <TableToolbar>
        <SearchInput
          label="Search users by name or email"
          placeholder="Search name or email…"
          defaultValue={search}
          onChange={changeSearch}
        />
        <FilterSelect
          label="Filter by account status"
          value={status}
          onChange={changeStatus}
          options={STATUS_OPTIONS}
        />
      </TableToolbar>

      {error ? (
        <p className="px-5 py-10 text-center text-[13px] text-red-600">{error}</p>
      ) : (
        <>
          <DataTable
            className={cn(
              "transition-opacity duration-200",
              loading && !firstLoad && "opacity-60",
            )}
          >
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Registered</Th>
                <Th>Status</Th>
                <Th>Workspaces</Th>
              </tr>
            </thead>
            <tbody>
              {firstLoad ? (
                <SkeletonRows rows={8} columns={COLUMNS} />
              ) : data.rows.length === 0 ? (
                <EmptyRow colSpan={COLUMNS} icon={filtered ? UserX : Users}>
                  {filtered
                    ? "No users match this search."
                    : "No registered users yet."}
                </EmptyRow>
              ) : (
                data.rows.map((user) => (
                  <tr key={user.id}>
                    <Td className="font-medium text-slate-900">
                      {user.name ?? <span className="text-slate-400">—</span>}
                    </Td>
                    <Td>{user.email}</Td>
                    <Td className="tabular-nums text-slate-500">
                      {formatDate(user.createdAt)}
                    </Td>
                    <Td>
                      <StatusPill tone={STATUS_TONE[user.status]}>
                        {STATUS_LABEL[user.status]}
                      </StatusPill>
                    </Td>
                    <Td>
                      {user.workspaceCount === 0 ? (
                        <span className="text-slate-400">None</span>
                      ) : (
                        <span
                          className="tabular-nums"
                          title={user.workspaces
                            .map((workspace) => `${workspace.name} (${workspace.role})`)
                            .join("\n")}
                        >
                          {user.workspaceCount}
                        </span>
                      )}
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
            loading={loading}
          />
        </>
      )}
    </>
  );
}
