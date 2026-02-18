import { useEffect, useMemo, useState } from "react";
import { DEFAULT_FILTERS } from "@/components/dashboard/applications/constants";
import {
  fetchAllFilteredApplications,
  fetchApplications,
  filterApplicationsByNotionExistence,
} from "@/components/dashboard/applications/services";
import { buildQueryString } from "@/components/dashboard/applications/utils";
import type { ApplicationFilters, ApplicationListItem } from "@/types/application";

export function useApplicationsData() {
  const [filters, setFilters] = useState<ApplicationFilters>(DEFAULT_FILTERS);
  const [items, setItems] = useState<ApplicationListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const queryString = useMemo(() => buildQueryString(filters), [filters]);

  useEffect(() => {
    const controller = new AbortController();

    const run = async () => {
      setIsLoading(true);
      setError(null);

      try {
        if (filters.notionExists === "all") {
          const payload = await fetchApplications(filters, controller.signal);
          setItems(payload.items);
          setTotal(payload.total);
          return;
        }

        const allFiltered = await fetchAllFilteredApplications(filters);
        const notionFiltered = await filterApplicationsByNotionExistence(allFiltered, filters.notionExists);
        const offset = (filters.page - 1) * filters.pageSize;
        setItems(notionFiltered.slice(offset, offset + filters.pageSize));
        setTotal(notionFiltered.length);
      } catch (fetchError) {
        if (controller.signal.aborted) return;
        setError(fetchError instanceof Error ? fetchError.message : "Unknown error occurred.");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    void run();
    return () => controller.abort();
  }, [filters, queryString]);

  return {
    filters,
    setFilters,
    items,
    total,
    isLoading,
    error,
    setError,
  };
}
