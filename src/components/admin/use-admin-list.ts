"use client";

import { useEffect, useState } from "react";
import { apiGet, errorMessage } from "@/lib/api/client";
import type { Paginated } from "@/features/admin/types";

/**
 * Fetch one page of an admin list.
 *
 * Requests are aborted when the parameters change, so typing in a search box
 * cannot land an older response after a newer one and briefly render the wrong
 * page. The previous page stays visible while the next one loads, which keeps
 * the table from collapsing to a spinner and shifting the layout.
 *
 * "Loading" is derived from whether the stored result belongs to the *current*
 * query rather than being a separate flag set when the effect runs. That is what
 * lets the effect body avoid a synchronous setState: it only ever reacts to a
 * response arriving.
 */

export type AdminListState<T> = {
  data: Paginated<T> | null;
  loading: boolean;
  error: string | null;
};

type Loaded<T> = {
  /** Serialised params this result was fetched with. */
  key: string;
  data: Paginated<T> | null;
  error: string | null;
};

export function useAdminList<T>(
  path: string,
  params: Record<string, string | number | undefined>,
): AdminListState<T> {
  const [loaded, setLoaded] = useState<Loaded<T> | null>(null);

  // Serialised so the effect depends on values, not object identity.
  const query = JSON.stringify(params);

  useEffect(() => {
    const controller = new AbortController();

    apiGet<Paginated<T>>(path, JSON.parse(query) as Record<string, string>, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setLoaded({ key: query, data, error: null });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLoaded({ key: query, data: null, error: errorMessage(error) });
      });

    return () => controller.abort();
  }, [path, query]);

  const current = loaded?.key === query ? loaded : null;

  return {
    data: current?.data ?? null,
    loading: current === null,
    error: current?.error ?? null,
  };
}
