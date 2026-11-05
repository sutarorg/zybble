"use client";

import { useCallback, useState } from "react";
import { DataTable, EmptyRow, StatusPill, Td, Th } from "@/components/admin/primitives";
import { Pagination, FilterSelect, SearchInput, TableToolbar } from "@/components/admin/table-controls";
import { useAdminList } from "@/components/admin/use-admin-list";
import { formatDateTime, humaniseAction } from "@/features/admin/format";
import type { AdminActivityRow } from "@/features/admin/types";

/**
 * Audit trail.
 *
 * Metadata is redacted server-side before it is sent, so the summary column can
 * be rendered without the client having to decide what is safe to show. It is
 * rendered as compact key/value text rather than JSON to keep the rows
 * scannable.
 */

const PER_PAGE = 25;

const ACTOR_OPTIONS = [
  { value: "all" as const, label: "All actors" },
  { value: "user" as const, label: "User" },
  { value: "system" as const, label: "System" },
  { value: "webhook" as const, label: "Webhook" },
];

const ACTOR_TONE = {
  user: "info",
  system: "neutral",
  webhook: "warning",
} as const;

function summarise(metadata: Record<string, unknown> | null): string {
  if (!metadata) return "";

  return Object.entries(metadata)
    .slice(0, 3)
    .map(([key, value]) => {
      const rendered =
        typeof value === "object" && value !== null ? JSON.stringify(value) : String(value);
      return `${key}: ${rendered.length > 40 ? `${rendered.slice(0, 40)}…` : rendered}`;
    })
    .join(" · ");
}

export function ActivityTable() {
  const [search, setSearch] = useState("");
  const [actorType, setActorType] = useState<"all" | "user" | "system" | "webhook">("all");
  const [page, setPage] = useState(1);

  // Reset the page in the handlers, not in an effect — see the note in
  // users-table.tsx.
  const changeSearch = useCallback((next: string) => {
    setSearch(next);
    setPage(1);
  }, []);

  const changeActorType = useCallback((next: "all" | "user" | "system" | "webhook") => {
    setActorType(next);
    setPage(1);
  }, []);

  const { data, loading, error } = useAdminList<AdminActivityRow>("/api/admin/activity", {
    q: search || undefined,
    actorType,
    page,
    perPage: PER_PAGE,
  });

  return (
    <>
      <TableToolbar>
        <SearchInput
          label="Search audit entries"
          placeholder="Search action or entity…"
          defaultValue={search}
          onChange={changeSearch}
        />
        <FilterSelect
          label="Filter by actor type"
          value={actorType}
          onChange={changeActorType}
          options={ACTOR_OPTIONS}
        />
      </TableToolbar>

      {error ? (
        <p className="px-4 py-10 text-center text-[13px] text-red-600">{error}</p>
      ) : (
        <>
          <DataTable className={loading ? "opacity-60 transition-opacity" : undefined}>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Actor</Th>
                <Th>Action</Th>
                <Th>Workspace</Th>
                <Th>Details</Th>
              </tr>
            </thead>
            <tbody>
              {data === null ? (
                <EmptyRow colSpan={5}>Loading…</EmptyRow>
              ) : data.rows.length === 0 ? (
                <EmptyRow colSpan={5}>
                  {search || actorType !== "all"
                    ? "No audit entries match this search."
                    : "No audit entries recorded yet."}
                </EmptyRow>
              ) : (
                data.rows.map((entry) => (
                  <tr key={entry.id}>
                    <Td className="tabular-nums text-slate-500">
                      {formatDateTime(entry.createdAt)}
                    </Td>
                    <Td>
                      <StatusPill tone={ACTOR_TONE[entry.actorType]}>{entry.actorType}</StatusPill>
                      {entry.actorEmail ? (
                        <span className="mt-0.5 block text-[11px] text-slate-500">
                          {entry.actorEmail}
                        </span>
                      ) : null}
                    </Td>
                    <Td className="font-medium text-slate-900">
                      {humaniseAction(entry.action)}
                    </Td>
                    <Td>{entry.workspaceName ?? <span className="text-slate-400">—</span>}</Td>
                    <Td className="max-w-xs truncate text-[12px] text-slate-500">
                      {summarise(entry.metadata) || "—"}
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
